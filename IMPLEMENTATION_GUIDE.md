# Dependency Audit Implementation Guide

## Overview

This guide explains how to integrate the dependency health monitoring system into your application. The system provides:

- **Health Monitoring:** Real-time monitoring of external services via /ping endpoints and RSS feeds
- **Admin Notifications:** Idempotent email notifications sent to organization admins when services go down or recover
- **Status Banners:** User-facing UI components showing current service status
- **API Endpoints:** REST API for querying health status

---

## Quick Start

### 1. Install Dependencies

```bash
npm install zod  # If not already installed
```

### 2. Environment Variables

Add the following to your `.env.local`:

```env
# Health Monitor Configuration
HEALTH_CHECK_INTERVAL=30000  # milliseconds
RSS_FEED_CHECK_INTERVAL=300000  # milliseconds

# Admin Email Notifications
ADMIN_EMAIL_PROVIDER=resend  # or sendgrid, ses, smtp
ADMIN_EMAIL_FROM=noreply@platform.local
ADMIN_EMAIL_REPLY_TO=support@platform.local
ADMIN_EMAIL_API_KEY=your_api_key_here
ADMIN_FALLBACK_EMAIL=admin@platform.local  # Fallback if org admins can't be fetched

# Supabase (needed for admin lookup)
NEXT_PUBLIC_SUPABASE_URL=https://your-instance.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# SMTP (only if using SMTP provider)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=username
SMTP_PASS=password
```

### 3. Initialize in Your Application

**For Next.js App Router (`app/layout.tsx`):**

```typescript
import { initializeMonitoringServices } from '@/lib/services/initialize-monitoring'

export default async function RootLayout({ children }) {
  // Initialize monitoring on server startup
  if (typeof window === 'undefined') {
    await initializeMonitoringServices()
  }

  return (
    <html>
      <body>{children}</body>
    </html>
  )
}
```

**For Next.js Pages Router (`pages/_app.tsx`):**

```typescript
import { useEffect } from 'react'
import { initializeMonitoringServices } from '@/lib/services/initialize-monitoring'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Initialize on client
    initializeMonitoringServices()
  }, [])

  return <Component {...pageProps} />
}

export default MyApp
```

**For Node.js/Express:**

```typescript
import { initializeMonitoringServices } from '@/lib/services/initialize-monitoring'

async function startServer() {
  await initializeMonitoringServices()
  // Start your server...
}

startServer()
```

### 4. Add Status Banner to Your UI

**In your main layout or header:**

```typescript
import { StatusBanner, StatusIndicator } from '@/components/StatusBanner'

export default function Header() {
  return (
    <div>
      {/* Full status banner for bottom of page */}
      <StatusBanner position="top" criticalOnly={true} />

      {/* Or compact status indicator for header */}
      <StatusIndicator size="sm" />
    </div>
  )
}
```

### 5. Query Health Status

**In API routes:**

```typescript
import { getDetailedStatus, getSystemHealth } from '@/lib/services/initialize-monitoring'

export async function GET(req: Request) {
  const health = getSystemHealth()
  const detailed = getDetailedStatus()

  return Response.json({
    status: health,
    services: detailed,
  })
}
```

**Via the API endpoint:**

```bash
# Get overall status
curl http://localhost:3000/api/health

# Get detailed status
curl http://localhost:3000/api/health?detailed=true

# Get specific service
curl http://localhost:3000/api/health?service=supabase
```

---

## Detailed Configuration

### Email Provider Setup

#### Resend (Recommended)

1. Sign up at [resend.com](https://resend.com)
2. Get your API key from dashboard
3. Verify your domain
4. Configure:

```env
ADMIN_EMAIL_PROVIDER=resend
ADMIN_EMAIL_API_KEY=re_xxxxxxxxxxxxx
ADMIN_EMAIL_FROM=noreply@yourdomain.com
```

#### SendGrid

1. Create account at [sendgrid.com](https://sendgrid.com)
2. Create API key with Mail Send permission
3. Verify sender identity
4. Configure:

```env
ADMIN_EMAIL_PROVIDER=sendgrid
ADMIN_EMAIL_API_KEY=SG.xxxxxxxxxxxxx
ADMIN_EMAIL_FROM=noreply@yourdomain.com
```

#### AWS SES

1. Set up AWS SES in your region
2. Verify sender email address
3. Create IAM credentials with SES permissions
4. Configure:

```env
ADMIN_EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
ADMIN_EMAIL_FROM=noreply@yourdomain.com
```

#### SMTP

For self-hosted or corporate email:

```env
ADMIN_EMAIL_PROVIDER=smtp
SMTP_HOST=mail.company.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@company.com
SMTP_PASS=password
ADMIN_EMAIL_FROM=notifications@company.com
```

### Admin User Discovery

The system automatically fetches admin users from your Supabase organization:

```sql
-- Required table structure
CREATE TABLE org_members (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  role VARCHAR NOT NULL  -- 'admin' or 'owner'
);
```

**Or set a fallback:**

```env
ADMIN_FALLBACK_EMAIL=admin@yourcompany.com
```

---

## Advanced Usage

### Custom Status Change Handler

```typescript
import { initializeHealthMonitor, type StatusChangeEvent } from '@/lib/services/health-monitor'

async function customStatusHandler(event: StatusChangeEvent) {
  console.log(`${event.serviceName} changed to ${event.newStatus}`)

  // Log to external service
  await externalLogger.log({
    service: event.serviceName,
    oldStatus: event.previousStatus,
    newStatus: event.newStatus,
    timestamp: event.timestamp,
  })

  // Update database
  await db.incidents.create({
    serviceId: event.serviceKey,
    status: event.newStatus,
    detectedAt: event.timestamp,
  })

  // Send webhook
  await fetch('https://hooks.slack.com/...', {
    method: 'POST',
    body: JSON.stringify({
      text: `${event.serviceName} is now ${event.newStatus}`,
    }),
  })
}

initializeHealthMonitor(customStatusHandler)
```

### Custom Health Check Endpoints

Extend the SERVICES configuration for your specific instances:

```typescript
import { SERVICES } from '@/lib/services/health-monitor'

// Add custom endpoints for your instances
const customServices = {
  ...SERVICES,
  SUPABASE: {
    ...SERVICES.SUPABASE,
    healthCheckEndpoints: [
      'https://your-instance.supabase.co/health',
      'https://api.supabase.co/health',
    ],
  },
}
```

### Manual Health Check Trigger

```typescript
import { triggerHealthCheck } from '@/lib/services/initialize-monitoring'

// In a scheduled task or manual endpoint
const status = await triggerHealthCheck()
console.log('Current health:', status)
```

### Access Incident History

```typescript
import { getIncidentHistory } from '@/lib/services/initialize-monitoring'

const incidents = getIncidentHistory()
incidents.forEach((incident) => {
  console.log(`${incident.serviceName}:`, incident)
})
```

---

## Integration with Monitoring Tools

### Sentry Integration

```typescript
import * as Sentry from '@sentry/nextjs'
import { initializeHealthMonitor } from '@/lib/services/health-monitor'

initializeHealthMonitor(async (event) => {
  Sentry.captureMessage(
    `Service status: ${event.serviceName} → ${event.newStatus}`,
    event.newStatus === 'down' ? 'error' : 'info'
  )
})
```

### DataDog Integration

```typescript
import { StatsD } from 'node-dogstatsd'

const dogstatsd = new StatsD()

async function datadogHandler(event) {
  dogstatsd.gauge('service.health', event.newStatus === 'healthy' ? 1 : 0, {
    tags: [`service:${event.serviceName.toLowerCase()}`],
  })
}

initializeHealthMonitor(datadogHandler)
```

### Custom Database Logging

```typescript
async function dbLogger(event) {
  await supabase.from('service_incidents').insert({
    service_name: event.serviceName,
    previous_status: event.previousStatus,
    new_status: event.newStatus,
    timestamp: event.timestamp,
  })
}

initializeHealthMonitor(dbLogger)
```

---

## Testing

### Manual Test Script

```typescript
// test-health-monitor.ts
import { initializeHealthMonitor, getHealthMonitor } from '@/lib/services/health-monitor'
import { initializeAdminNotifier } from '@/lib/services/admin-notifier'

async function runTests() {
  // Initialize
  initializeHealthMonitor()

  // Get monitor
  const monitor = getHealthMonitor()

  // Check status
  console.log('Current health:', monitor.getHealthSummary())
  console.log('Detailed status:', monitor.getStatus())

  // Simulate status change
  const status = monitor.getStatus()
  console.log('Status:', status)

  // Wait for RSS check
  await new Promise((resolve) => setTimeout(resolve, 5000))

  console.log('Final status:', monitor.getStatus())
}

runTests()
```

### Mock Health Checks

```typescript
// For testing without real API calls
import { vi } from 'vitest'

vi.mock('@/lib/services/health-monitor', () => ({
  getHealthMonitor: () => ({
    getStatus: () => ({
      SUPABASE: { status: 'healthy', lastCheckTime: new Date() },
      VERCEL: { status: 'down', lastCheckTime: new Date() },
    }),
    getHealthSummary: () => ({ healthy: 1, degraded: 0, down: 1, critical: true }),
  }),
}))
```

---

## Troubleshooting

### Health Checks Not Running

**Problem:** Monitor initialized but no health checks happening

**Solution:**
- Verify `initializeMonitoringServices()` is called during startup
- Check browser console for errors
- Ensure network requests are not blocked

### Emails Not Sending

**Problem:** Admin notifications not being delivered

**Solutions:**
- Verify email provider API key in environment variables
- Check admin user query: `SELECT * FROM org_members WHERE role IN ('admin', 'owner')`
- Test email with fallback: set `ADMIN_FALLBACK_EMAIL`
- Check email provider logs for delivery failures

### Status Always "Unknown"

**Problem:** All services showing unknown status

**Solutions:**
- Check network connectivity to health check endpoints
- Verify endpoints are accessible from your environment
- Check CORS policies if running in browser
- Use `/api/health` endpoint instead (server-side)

### Memory Leaks

**Problem:** Process memory grows over time

**Solutions:**
- Call `cleanupOldIncidents(30)` periodically
- Implement incident history cleanup in a cron job
- Limit incident log size with rotation

---

## Production Deployment

### Environment-Specific Configuration

```typescript
// lib/services/initialize-monitoring.ts

const isProduction = process.env.NODE_ENV === 'production'

export async function initializeMonitoringServices() {
  const config = {
    checkInterval: isProduction ? 30000 : 60000, // Less frequent in dev
    rssFeedInterval: isProduction ? 300000 : 600000,
    enableEmailNotifications: isProduction && !!process.env.ADMIN_EMAIL_PROVIDER,
  }

  // ... rest of initialization
}
```

### Monitoring the Monitor

```typescript
// Set up uptime monitoring for the monitoring service itself
setInterval(() => {
  const monitor = getHealthMonitor()
  const health = monitor.getHealthSummary()

  // Log to external service
  analytics.track('health_monitor_status', {
    healthy: health.healthy,
    degraded: health.degraded,
    down: health.down,
    critical: health.critical,
  })
}, 60000) // Every minute
```

### Rate Limiting Considerations

- Health checks: 30-second interval (2 requests/minute per service)
- RSS polling: 5-minute interval (0.2 requests/minute per service)
- Total: ~13 requests/minute across all services
- Adjust intervals based on your needs and API quotas

---

## Support & Documentation

- **Status Pages:** Links provided in DEPENDENCY_AUDIT.md
- **Runbooks:** See `/docs/runbooks/` for incident response procedures
- **Configuration Reference:** See environment variables section above
- **API Documentation:** See comments in `/pages/api/health.ts`

---

## Next Steps

1. ✅ Configure environment variables
2. ✅ Initialize monitoring service
3. ✅ Add status banner to UI
4. ✅ Test health check endpoints
5. ✅ Set up email notifications
6. ✅ Monitor incident history
7. ✅ Create runbooks for each service
8. ✅ Schedule incident cleanup jobs

