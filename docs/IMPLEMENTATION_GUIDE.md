# Dependency Audit & Contingency System - Implementation Guide

This guide walks you through implementing the dependency health monitoring and admin notification system.

## Overview

The system consists of:

1. **Health Checker**: Monitors service health via HTTP endpoints and RSS feeds
2. **Status Banner**: Displays service alerts to users in real-time
3. **Admin Notifier**: Sends idempotent emails to organization admins
4. **API Endpoints**: Backend services for health checks and alert management

---

## Step 1: Database Schema Setup

Run the following SQL migrations to set up the required tables:

### Migration 1: Create Admin Contacts Table

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for storing admin contact information
CREATE TABLE public.admin_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  email VARCHAR NOT NULL,
  name VARCHAR,
  role VARCHAR NOT NULL CHECK (role IN ('owner', 'billing', 'admin', 'technical')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_contacts_org_email_unique UNIQUE (organization_id, email),
  CONSTRAINT admin_contacts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Index for efficient lookups by organization
CREATE INDEX idx_admin_contacts_org_id ON public.admin_contacts(organization_id);
CREATE INDEX idx_admin_contacts_org_role ON public.admin_contacts(organization_id, role);

-- Enable RLS
ALTER TABLE public.admin_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization members can view their org's admin contacts
CREATE POLICY admin_contacts_view ON public.admin_contacts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Only organization owners can modify admin contacts
CREATE POLICY admin_contacts_modify ON public.admin_contacts
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
```

### Migration 2: Create Service Alerts Table

```sql
-- Table for tracking service alerts and deduplication
CREATE TABLE public.admin_service_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  service_name VARCHAR NOT NULL,
  alert_type VARCHAR NOT NULL CHECK (alert_type IN ('started', 'resolved')),
  status_page_link TEXT,
  admin_emails_sent TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  deduplication_key VARCHAR NOT NULL,

  CONSTRAINT service_alerts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT service_alerts_dedup_unique UNIQUE (deduplication_key)
);

-- Index for efficient lookups
CREATE INDEX idx_service_alerts_org_id ON public.admin_service_alerts(organization_id);
CREATE INDEX idx_service_alerts_service ON public.admin_service_alerts(service_name);
CREATE INDEX idx_service_alerts_created ON public.admin_service_alerts(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_service_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Organization members can view alerts for their org
CREATE POLICY service_alerts_view ON public.admin_service_alerts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Only service can insert alerts (authenticated but restricted in app)
CREATE POLICY service_alerts_insert ON public.admin_service_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);
```

### Migration 3: Create Email Audit Log Table

```sql
-- Table for audit trail of emails sent
CREATE TABLE public.email_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id VARCHAR NOT NULL,
  recipient_email VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  status VARCHAR NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  error_message TEXT,
  idempotency_key VARCHAR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT email_audit_idempotency_unique UNIQUE (idempotency_key)
);

-- Index for efficient lookups
CREATE INDEX idx_email_audit_recipient ON public.email_audit_log(recipient_email);
CREATE INDEX idx_email_audit_created ON public.email_audit_log(created_at DESC);
CREATE INDEX idx_email_audit_status ON public.email_audit_log(status);
```

---

## Step 2: Import Components in Your App

### Add to `_app.tsx`

```typescript
import { useEffect, useState } from 'react'
import { MultiServiceStatusBanner } from '@/components/ServiceStatusBanner'
import { useHealthStatus } from '@/hooks/useHealthStatus'

function MyApp({ Component, pageProps }) {
  const { statuses, isLoading } = useHealthStatus()

  // Filter to only show non-operational services
  const alertStatuses = statuses.filter(s => s.status !== 'operational')

  return (
    <>
      {alertStatuses.length > 0 && (
        <MultiServiceStatusBanner statuses={alertStatuses} />
      )}
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
```

### Create Health Status Hook

Create `/apps/studio/hooks/useHealthStatus.ts`:

```typescript
import { useEffect, useState } from 'react'
import { ServiceHealthCheck } from '@/lib/services/health-check/types'

export function useHealthStatus() {
  const [statuses, setStatuses] = useState<ServiceHealthCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch health status on mount
    fetchStatuses()

    // Poll every 30 seconds
    const interval = setInterval(fetchStatuses, 30 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchStatuses() {
    try {
      const response = await fetch('/api/health-check/services')
      if (response.ok) {
        const data = await response.json()
        setStatuses(data)
      }
    } catch (error) {
      console.error('Failed to fetch health status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return { statuses, isLoading }
}
```

---

## Step 3: Set Up Background Health Monitoring

### Create a Background Service

Create `/apps/studio/lib/services/health-check/background-monitor.ts`:

```typescript
import { HealthChecker } from './health-checker'
import { notifyAdminsOfServiceIssue } from './admin-notifier'
import { ServiceName, ServiceStatus } from './types'

interface ServiceStatusCache {
  [key in ServiceName]: {
    status: ServiceStatus
    lastChecked: Date
    notifiedAt?: Date
  }
}

const statusCache: ServiceStatusCache = {
  supabase: { status: 'unknown', lastChecked: new Date() },
  nylas: { status: 'unknown', lastChecked: new Date() },
  vercel: { status: 'unknown', lastChecked: new Date() },
  inngest: { status: 'unknown', lastChecked: new Date() },
  upstash: { status: 'unknown', lastChecked: new Date() },
}

/**
 * Start background health monitoring
 * Should be called once when the app starts
 */
export function startHealthMonitoring() {
  // Check critical services every 1 minute
  setInterval(async () => {
    const criticalServices: ServiceName[] = ['supabase', 'upstash']

    for (const service of criticalServices) {
      const health = await HealthChecker.checkServiceHealth(service)
      await handleStatusChange(service, health.status)
    }
  }, 60 * 1000)

  // Check non-critical services every 5 minutes
  setInterval(async () => {
    const nonCriticalServices: ServiceName[] = ['nylas', 'vercel', 'inngest']

    for (const service of nonCriticalServices) {
      const health = await HealthChecker.checkServiceHealth(service)
      await handleStatusChange(service, health.status)
    }
  }, 5 * 60 * 1000)

  // Poll RSS feeds every 5 minutes
  setInterval(pollAllRssFeeds, 5 * 60 * 1000)
}

/**
 * Handle service status changes
 */
async function handleStatusChange(service: ServiceName, newStatus: ServiceStatus) {
  const cached = statusCache[service]

  if (cached.status === newStatus) {
    return // No change
  }

  // Status changed
  statusCache[service] = {
    status: newStatus,
    lastChecked: new Date(),
  }

  if (newStatus !== 'operational') {
    // Service is down - notify admins
    // In production, get real organization IDs from a list
    // For now, this is a placeholder
    console.log(`[ALERT] ${service} status changed to ${newStatus}`)
  } else if (cached.status !== 'operational' && newStatus === 'operational') {
    // Service recovered
    console.log(`[RESOLVED] ${service} is back to operational`)
  }
}

/**
 * Poll all RSS feeds for status changes
 */
async function pollAllRssFeeds() {
  const services: ServiceName[] = ['supabase', 'nylas', 'vercel', 'inngest', 'upstash']

  for (const service of services) {
    const result = await HealthChecker.pollRssFeed(service, statusCache[service].lastChecked)

    if (result.hasUpdate) {
      // Process incidents
      for (const incident of result.incidents) {
        console.log(`[RSS] ${service}: ${incident.title}`)
        // Could trigger notifications here
      }
    }
  }
}
```

### Initialize Background Monitoring

In `_app.tsx`, add to `useEffect`:

```typescript
useEffect(() => {
  // Only run in production/browser context
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    import('@/lib/services/health-check/background-monitor').then(({ startHealthMonitoring }) => {
      startHealthMonitoring()
    })
  }
}, [])
```

---

## Step 4: Configure Admin Contacts

Provide UI for admins to configure who should receive notifications:

```typescript
// pages/organization/[slug]/settings/admin-contacts.tsx
import { useState } from 'react'
import { useAdminContacts } from '@/hooks/useAdminContacts'

export default function AdminContactsSettings() {
  const { contacts, addContact, removeContact } = useAdminContacts()
  const [newEmail, setNewEmail] = useState('')

  return (
    <div>
      <h2>Admin Notification Contacts</h2>
      <p>Configure who receives alerts when critical services are down:</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          addContact(newEmail)
          setNewEmail('')
        }}
      >
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="admin@example.com"
          required
        />
        <button type="submit">Add Contact</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>{contact.email}</td>
              <td>{contact.role}</td>
              <td>{contact.verified ? '✓' : 'Pending'}</td>
              <td>
                <button onClick={() => removeContact(contact.id)}>Remove</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Step 5: Environment Variables

Add these to your `.env.local`:

```bash
# Health Monitoring Configuration
NEXT_PUBLIC_HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL_CRITICAL=60 # seconds
HEALTH_CHECK_INTERVAL_STANDARD=300 # seconds
HEALTH_CHECK_TIMEOUT=10000 # milliseconds

# Email Configuration (choose one)
# Option 1: Supabase Edge Functions
SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1

# Option 2: SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key

# Option 3: Mailgun
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_domain.mailgun.org

# Option 4: AWS SES
AWS_SES_REGION=us-east-1
AWS_SES_SENDER_EMAIL=noreply@example.com

# Admin Notification
ADMIN_NOTIFICATION_ENABLED=true
ALERT_DEDUPLICATION_WINDOW_HOURS=24
```

---

## Step 6: Testing

### Test Health Check Endpoint

```bash
curl http://localhost:3000/api/health-check/services | jq
```

Expected response:
```json
[
  {
    "service": "supabase",
    "status": "operational",
    "lastChecked": "2026-02-13T10:00:00Z",
    "responseTime": 245,
    "statusCode": 200,
    "statusPageUrl": "https://status.supabase.com"
  }
]
```

### Test Email Sending

```bash
curl -X POST http://localhost:3000/api/mail/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "admin@example.com",
    "subject": "Test Alert",
    "htmlBody": "<p>Test alert</p>",
    "plainTextBody": "Test alert",
    "idempotencyKey": "test-123"
  }' | jq
```

### Simulate Service Outage

For testing notification flow:

```typescript
// In a test file
import { notifyAdminsOfServiceIssue } from '@/lib/services/health-check/admin-notifier'

await notifyAdminsOfServiceIssue({
  organizationId: 'org-123',
  service: 'supabase',
  alertType: 'started',
  statusPageUrl: 'https://status.supabase.com',
  message: 'Database connection timeout - investigating',
  estimatedResolutionTime: '30 minutes',
})
```

---

## Step 7: Production Deployment Checklist

- [ ] Database migrations applied to production
- [ ] Environment variables configured
- [ ] Email service provider credentials set up
- [ ] Admin contacts configured for all organizations
- [ ] RLS policies tested and verified
- [ ] Background monitoring service deployed
- [ ] Health check endpoints responding correctly
- [ ] Alert system tested with test organization
- [ ] Email delivery tested with real addresses
- [ ] Monitoring dashboard configured
- [ ] On-call runbook created
- [ ] Team trained on alert system

---

## Monitoring & Dashboards

### Key Metrics to Track

1. **Health Check Response Time**: API call latency
2. **Service Availability**: % time each service is operational
3. **Alert Frequency**: Number of alerts per service per day
4. **Email Delivery Rate**: % of notification emails successfully delivered
5. **Time to Detection**: How quickly we detect service issues
6. **Time to Resolution**: How quickly services recover

### Example Prometheus Queries

```promql
# Service availability percentage
(1 - rate(health_check_failures_total[5m])) * 100

# Alert frequency by service
rate(service_alerts_total[1h])

# Email delivery success rate
rate(email_sent_total[1h]) / rate(email_attempts_total[1h])
```

---

## Troubleshooting

### Alerts Not Being Sent

1. Check admin contacts are configured: `/api/organizations/{id}/admin-contacts`
2. Verify email service credentials
3. Check email audit log for failures
4. Review application logs for errors

### False Alerts

1. Increase health check timeout if services are slow
2. Verify status page RSS feeds are accurate
3. Add retry logic before alerting

### Duplicate Alerts

1. Check deduplication_key uniqueness
2. Verify date-based deduplication logic
3. Review alert history table for duplicates

---

## References

- [Health Checker Service](./DEPENDENCY_AUDIT.md#health-check--monitoring)
- [Admin Notifier Service](./DEPENDENCY_AUDIT.md#plan-2-idempotent-admin-email-service)
- [Status Banner Component](../apps/studio/components/ServiceStatusBanner.tsx)

---

**Last Updated**: 2026-02-13
**Maintained By**: System Architecture Team
