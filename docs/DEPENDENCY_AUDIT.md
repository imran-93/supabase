# Dependency Audit & Contingency Plan

**Document Version**: 1.0
**Last Updated**: 2026-02-13
**Author**: System Architecture Team
**Status**: Active

## Executive Summary

This document outlines a comprehensive audit of critical dependencies (Nylas, Supabase, Vercel, Inngest, and Redis/Upstash), potential failure scenarios, and contingency plans to maintain service availability and ensure timely admin notification during outages.

---

## Table of Contents

1. [Dependency Audit](#dependency-audit)
2. [Potential 500 Error Scenarios](#potential-500-error-scenarios)
3. [Contingency Plans](#contingency-plans)
4. [Implementation Details](#implementation-details)
5. [Monitoring & Alerting](#monitoring--alerting)

---

## Dependency Audit

### 1. Supabase (Backend Database & Auth)

**Current Usage**:
- Primary database backend (PostgreSQL)
- Authentication and authorization (GoTrue)
- Real-time subscriptions
- File storage (Supabase Storage)
- Edge Functions for async tasks

**Critical Components**:
- API (`api.supabase.co`)
- Authentication service (`auth.supabase.co`)
- Real-time service (`realtime.supabase.co`)
- Storage service (`storage.supabase.co`)
- Functions service (`functions.supabase.co`)

**Potential 500 Errors**:
| Error Code | Scenario | Impact | Severity |
|-----------|----------|--------|----------|
| 500 | Database connection timeout | Cannot read/write data | **CRITICAL** |
| 503 | Database maintenance/overload | Degraded read performance | **HIGH** |
| 502 | API gateway failure | All API calls fail | **CRITICAL** |
| 429 | Rate limit exceeded | Temporary service throttling | **MEDIUM** |
| 400 | Invalid JWT tokens | Auth failures | **HIGH** |
| 401 | Auth service down | Users cannot log in | **CRITICAL** |
| 503 | Real-time service unavailable | Live features broken | **HIGH** |
| 500 | Edge Function crash | Async operations fail silently | **MEDIUM** |

**Health Check URL**: `https://api.supabase.co/health` or via status page API

---

### 2. Nylas (Email & Calendar API)

**Proposed Usage**:
- Email synchronization
- Calendar integration
- Event management
- Contact management

**API Endpoints**:
- Authentication: `https://api.nylas.com/oauth/authorize`
- Email: `https://api.nylas.com/emails`
- Calendar: `https://api.nylas.com/calendars`
- Contacts: `https://api.nylas.com/contacts`

**Potential 500 Errors**:
| Error Code | Scenario | Impact | Severity |
|-----------|----------|--------|----------|
| 500 | Email sync service down | Cannot sync emails | **HIGH** |
| 502 | API gateway failure | All Nylas API calls fail | **CRITICAL** |
| 429 | Rate limit exceeded | Sync operations throttled | **MEDIUM** |
| 401 | Auth token expired/invalid | OAuth re-authorization needed | **HIGH** |
| 503 | Service maintenance | Email operations unavailable | **HIGH** |
| 400 | Invalid OAuth scope | User permission issues | **MEDIUM** |

**Health Check URL**: `https://status.nylas.com/api/v2/status.json` (RSS: `https://status.nylas.com/history.rss`)

---

### 3. Vercel (Deployment & Hosting)

**Current Usage**:
- Staging deployments
- Environment variable management
- Analytics and monitoring
- Edge middleware

**API Endpoints**:
- Projects: `https://api.vercel.com/v1/projects`
- Deployments: `https://api.vercel.com/v1/deployments`
- Integrations: `https://api.vercel.com/v1/integrations`

**Potential 500 Errors**:
| Error Code | Scenario | Impact | Severity |
|-----------|----------|--------|----------|
| 500 | Deployment service down | Cannot deploy or manage projects | **HIGH** |
| 502 | API gateway failure | All Vercel API calls fail | **CRITICAL** |
| 429 | API rate limit exceeded | Build/deployment delays | **MEDIUM** |
| 401 | Invalid API token | Authentication fails | **HIGH** |
| 503 | Service maintenance | Console access may be limited | **MEDIUM** |
| 504 | Timeout on deployment | Build process hangs | **HIGH** |

**Health Check URL**: `https://status.vercel.com/api/v2/status.json` (RSS: `https://status.vercel.com/history.rss`)

---

### 4. Inngest (Job Queue & Workflow Orchestration)

**Proposed Usage**:
- Background job processing
- Async workflow orchestration
- Scheduled tasks
- Retry logic and error handling
- Event-driven architecture

**API Endpoints**:
- Events: `https://api.inngest.com/v/events`
- Workflows: `https://api.inngest.com/v/workflows`
- Runs: `https://api.inngest.com/v/runs`

**Potential 500 Errors**:
| Error Code | Scenario | Impact | Severity |
|-----------|----------|--------|----------|
| 500 | Event processing failure | Jobs don't execute | **CRITICAL** |
| 502 | API gateway failure | Cannot enqueue jobs | **CRITICAL** |
| 429 | Rate limit exceeded | Job processing delayed | **MEDIUM** |
| 401 | Invalid signing key | Event ingestion fails | **HIGH** |
| 503 | Service maintenance | All workflows paused | **HIGH** |
| 408 | Timeout on workflow execution | Long-running jobs terminate | **HIGH** |

**Health Check URL**: `https://status.inngest.com/api/v2/status.json` (RSS: `https://status.inngest.com/history.rss`)

---

### 5. Redis/Upstash (Cache & Session Store)

**Proposed Usage**:
- Session management
- Cache layer for frequent queries
- Rate limiting
- Real-time data storage
- Pub/Sub for live updates

**API Endpoints**:
- REST API: `https://api.upstash.com/`
- Redis instance: `<instance-url>.upstash.io`

**Potential 500 Errors**:
| Error Code | Scenario | Impact | Severity |
|-----------|----------|--------|----------|
| 500 | Redis server crash | Cache/sessions unavailable | **HIGH** |
| 502 | Connection pool exhaustion | Cannot connect to cache | **CRITICAL** |
| 429 | Rate limit exceeded | Cache operations throttled | **MEDIUM** |
| 401 | Invalid auth token | Connection authentication fails | **CRITICAL** |
| 503 | Maintenance/failover | Redis temporarily unavailable | **HIGH** |
| TIMEOUT | Network latency | Slow cache responses | **MEDIUM** |

**Health Check URL**: Direct connection test to Redis instance + Upstash dashboard API

---

## Potential 500 Error Scenarios

### Cascading Failures

```
Scenario 1: Database Down
├── Direct Impact
│   ├── Cannot fetch user data
│   ├── Cannot authenticate users
│   └── Cannot save changes
└── Cascading Impact
    ├── Edge Functions hang (waiting for DB)
    ├── API endpoints timeout
    └── Real-time connections fail

Scenario 2: Email Service (Nylas) Down
├── Direct Impact
│   ├── Cannot send notifications
│   ├── Cannot sync emails
│   └── Calendar features fail
└── Cascading Impact
    ├── Admin alerts cannot be sent
    ├── Email-dependent workflows fail
    └── Users cannot receive confirmations

Scenario 3: Redis Down
├── Direct Impact
│   ├── Session management fails
│   ├── Cache misses on all queries
│   └── Rate limiting disabled
└── Cascading Impact
    ├── Database gets hammered with cache misses
    ├── Performance degradation
    └── Potential rate limit violations
```

---

## Contingency Plans

### Plan 1: Status Banner System

**Objective**: Display service status to users in real-time

**Components**:
- Real-time status monitoring
- Dismissible banner UI component
- Color-coded severity levels
- Call-to-action links to status pages

**Implementation**:
```typescript
type ServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'maintenance'

interface ServiceHealthAlert {
  service: 'supabase' | 'nylas' | 'vercel' | 'inngest' | 'upstash'
  status: ServiceStatus
  message: string
  startTime: ISO8601 string
  estimatedResolution?: ISO8601 string
  statusPageUrl: string
  severity: 'info' | 'warning' | 'error'
}
```

### Plan 2: Idempotent Admin Email Service

**Objective**: Notify organization admins of service issues without duplicates

**Key Features**:
- Deduplication of alerts (same service, same time window)
- Separate "issue started" and "issue resolved" emails
- Rate limiting to prevent email flooding
- Fallback email addresses from multiple sources
- Retry logic with exponential backoff

**Database Schema**:
```sql
CREATE TABLE admin_service_alerts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  service_name VARCHAR NOT NULL,
  alert_type VARCHAR ('started', 'resolved'),
  status_page_link TEXT,
  admin_email_addresses TEXT[], -- JSON array of emails sent to
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  UNIQUE(organization_id, service_name, alert_type, DATE(created_at))
);

CREATE TABLE admin_contacts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  email VARCHAR NOT NULL,
  name VARCHAR,
  role VARCHAR ('owner', 'billing', 'admin', 'technical'),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  UNIQUE(organization_id, email)
);
```

### Plan 3: Health Check & Monitoring

**Objective**: Proactively detect service outages

**Monitoring Methods**:

1. **RSS Feed Subscriptions**:
   - Poll status page RSS feeds every 1-5 minutes
   - Parse incident updates
   - Trigger alerts on status changes

2. **Health Check Endpoints**:
   - Direct ping to each service health endpoint
   - Test authentication with real credentials
   - Monitor response time and availability

3. **Transaction Tests**:
   - Synthetic transactions (test API calls)
   - Monitor end-to-end latency
   - Detect partial outages

**Check Frequency**:
- Critical services: Every 1 minute
- Non-critical services: Every 5 minutes
- Health endpoint timeout: 10 seconds

---

## Implementation Details

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│          Health Monitoring System                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────┐      ┌──────────────────┐     │
│  │ RSS Feed Parser │──────│ Status Database  │     │
│  └─────────────────┘      └──────────────────┘     │
│           │                        │                 │
│  ┌────────▼─────────┐      ┌───────▼────────┐      │
│  │ Health Check     │──────│ Alert Engine   │      │
│  │ Endpoints        │      └───────┬────────┘      │
│  └──────────────────┘              │                 │
│                         ┌──────────▼────────┐       │
│                         │ Email Service     │       │
│                         │ (Idempotent)      │       │
│                         └──────────┬────────┘       │
│                                    │                 │
│                    ┌───────────────┼────────────┐   │
│                    │               │            │   │
│          ┌─────────▼───┐  ┌────────▼──┐  ┌─────▼──┐ │
│          │Admin Email  │  │Status API │  │Banner  │ │
│          │Service      │  │Endpoint   │  │System  │ │
│          └─────────────┘  └───────────┘  └────────┘ │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Services to Monitor

| Service | Type | Priority | Check Interval |
|---------|------|----------|-----------------|
| Supabase API | HTTP Health Check | CRITICAL | 1 min |
| Supabase Auth | HTTP Health Check | CRITICAL | 1 min |
| Nylas API | RSS Feed + Health | HIGH | 5 min |
| Vercel API | RSS Feed + Health | MEDIUM | 5 min |
| Inngest API | RSS Feed + Health | HIGH | 5 min |
| Upstash Redis | TCP Connection | CRITICAL | 1 min |

---

## Monitoring & Alerting

### Alert Levels

```
Level 1: INFO (Green) ✓ Operational
├── Service fully operational
└── Normal latency

Level 2: WARNING (Yellow) ⚠️ Degraded Performance
├── Service responding but with increased latency
├── Partial functionality available
└── Some users experiencing issues

Level 3: ERROR (Red) ⚠️ Major Outage
├── Service unavailable or mostly down
├── Complete functionality loss
└── Requires immediate attention

Level 4: MAINTENANCE (Blue) 🔧 Scheduled Maintenance
├── Planned downtime announced
└── Expected resolution time provided
```

### Admin Notification Flow

```
Service Down Detected
        │
        ▼
┌──────────────────────┐
│ Check if Alert       │
│ Already Sent Today?  │
└──────────────────────┘
        │
        ├─ YES ─────────────► SKIP (Deduplication)
        │
        └─ NO
           │
           ▼
    ┌──────────────────────┐
    │ Fetch Organization   │
    │ Admin Contacts       │
    └──────────────────────┘
           │
           ▼
    ┌──────────────────────┐
    │ Compose Alert Email  │
    │ with Status Page URL │
    └──────────────────────┘
           │
           ▼
    ┌──────────────────────┐
    │ Send via Email       │
    │ Service with Retry   │
    └──────────────────────┘
           │
           ▼
    ┌──────────────────────┐
    │ Log in Database      │
    │ (Alert Sent)         │
    └──────────────────────┘
           │
           ▼
    Display Status Banner
    to All Users
```

---

## Recovery & Verification

### Post-Outage Checklist

1. **Verify Service Recovery**:
   - Health check returns operational
   - No pending error messages in logs
   - Test transactions complete successfully

2. **Send "All Clear" Email**:
   - Same admin contacts notified
   - Include incident duration
   - Link to status page report

3. **Clear Status Banner**:
   - Remove UI alert 5 minutes after recovery
   - Log incident for analytics

4. **Documentation**:
   - Record incident in audit log
   - Update internal status dashboard
   - Share postmortem summary

---

## Security Considerations

1. **Email Delivery**:
   - Use authenticated SMTP with encryption
   - Rate limit to prevent abuse
   - Validate email addresses before sending

2. **Credential Management**:
   - Store service credentials in secure environment variables
   - Rotate credentials quarterly
   - Use separate credentials for health checks

3. **Status Information**:
   - Don't expose internal system details
   - Use generic error messages for users
   - Link to official status pages only

4. **Access Control**:
   - Only admins can view detailed status reports
   - Audit all alert configurations
   - Log all email deliveries

---

## Testing & Validation

### Synthetic Testing

```bash
# Test Supabase connectivity
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  https://$SUPABASE_URL/rest/v1/health

# Test Nylas connectivity
curl -H "Authorization: Bearer $NYLAS_API_KEY" \
  https://api.nylas.com/emails?limit=1

# Test Inngest connectivity
curl -X POST \
  -H "Authorization: Bearer $INNGEST_API_KEY" \
  https://api.inngest.com/v/events \
  -d '{"name":"health.check","data":{}}'

# Test Upstash connectivity
redis-cli -u $UPSTASH_REDIS_URL PING
```

### Manual Testing

1. Simulate service outage
2. Verify banner appears within 1 minute
3. Verify admin email sent within 2 minutes
4. Simulate service recovery
5. Verify "resolved" email sent
6. Verify banner removed within 5 minutes

---

## References

- [Supabase Status Page](https://status.supabase.com)
- [Nylas Status Page](https://status.nylas.com)
- [Vercel Status Page](https://status.vercel.com)
- [Inngest Status Page](https://status.inngest.com)
- [Upstash Status Page](https://status.upstash.com)

---

**Document Maintenance**: Review quarterly and update as services/dependencies change.
