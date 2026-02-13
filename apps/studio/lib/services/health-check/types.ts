/**
 * Health Check and Status Monitoring Types
 * Used for dependency health monitoring and alert management
 */

export type ServiceName = 'supabase' | 'nylas' | 'vercel' | 'inngest' | 'upstash'
export type ServiceStatus = 'operational' | 'degraded' | 'major_outage' | 'maintenance' | 'unknown'
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'
export type AlertType = 'started' | 'resolved'

export interface ServiceHealthCheck {
  service: ServiceName
  status: ServiceStatus
  lastChecked: Date
  responseTime: number // milliseconds
  statusCode?: number
  errorMessage?: string
  statusPageUrl: string
  rssUrl?: string
}

export interface ServiceHealthAlert {
  id: string
  organizationId: string
  service: ServiceName
  status: ServiceStatus
  alertType: AlertType
  message: string
  startTime: Date
  estimatedResolution?: Date
  statusPageUrl: string
  severity: AlertSeverity
  adminsNotified: string[] // email addresses
  createdAt: Date
  resolvedAt?: Date
}

export interface AdminContact {
  id: string
  organizationId: string
  email: string
  name?: string
  role: 'owner' | 'billing' | 'admin' | 'technical'
  verified: boolean
  createdAt: Date
}

export interface DependencyAuditAlert {
  id: string
  organizationId: string
  serviceName: ServiceName
  alertType: AlertType
  statusPageLink: string
  adminEmailsSent: string[]
  createdAt: Date
  resolvedAt?: Date
  deduplicationKey: string
}

export interface HealthCheckConfig {
  enabled: boolean
  interval: number // seconds
  timeout: number // seconds
  retries: number
  rssPollingEnabled: boolean
}

export interface StatusBannerData {
  service: ServiceName
  status: ServiceStatus
  severity: AlertSeverity
  message: string
  statusPageUrl: string
  dismissible: boolean
  dismissedUntil?: Date
}
