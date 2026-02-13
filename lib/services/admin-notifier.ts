/**
 * Admin Notification Service
 *
 * Sends idempotent email notifications to organization admins
 * when external service downtime is detected and resolved.
 *
 * Features:
 * - Idempotent delivery (no duplicate emails for same incident)
 * - Service admin discovery (queries organization for admin users)
 * - Preemptive notifications (sent immediately when downtime detected)
 * - Recovery notifications (sent when service status improves)
 * - Template-based email generation
 */

import { z } from 'zod'
import type { StatusChangeEvent } from './health-monitor'

// Email templates
const EMAIL_TEMPLATES = {
  INCIDENT_START: {
    subject: '🚨 Service Alert: {serviceName} is Down',
    body: `
Service Alert

Dear Platform Admin,

We've detected that {serviceName} is currently unavailable or degraded.

Service: {serviceName}
Status: {status}
Detected At: {timestamp}
Status Page: {statusPageUrl}

This may impact:
{affectedFeatures}

Our team is monitoring the situation. Please check the status page for updates.

{adminActions}

Regards,
Platform Team
    `,
  },
  INCIDENT_DEGRADED: {
    subject: '⚠️ Service Degradation: {serviceName} Performance Impacted',
    body: `
Service Alert - Degradation

Dear Platform Admin,

We've detected that {serviceName} is experiencing performance degradation.

Service: {serviceName}
Status: {status}
Detected At: {timestamp}
Status Page: {statusPageUrl}

This may impact:
{affectedFeatures}

Performance may be slower than usual. Please monitor your application's behavior.

Regards,
Platform Team
    `,
  },
  INCIDENT_RESOLVED: {
    subject: '✅ Service Recovered: {serviceName} is Back Online',
    body: `
Service Alert - Resolution

Dear Platform Admin,

{serviceName} has been restored and is operating normally.

Service: {serviceName}
Status: Healthy
Recovered At: {timestamp}
Downtime Duration: {downtimeDuration}
Status Page: {statusPageUrl}

Your services should return to normal operation. If you experience any issues, please contact support.

Regards,
Platform Team
    `,
  },
} as const

// Service-specific affected features mapping
const AFFECTED_FEATURES_MAP: Record<string, string[]> = {
  Supabase: [
    'User authentication and login',
    'Database queries and operations',
    'Real-time data synchronization',
    'File storage and retrieval',
    'Edge function execution',
  ],
  Vercel: [
    'Dashboard and UI deployment',
    'Feature rollout and updates',
    'Edge function execution',
    'Environment variable synchronization',
    'Zero-downtime deployments',
  ],
  Nylas: [
    'Email synchronization',
    'Calendar event integration',
    'Contact management',
    'Email scheduling',
    'Real-time email notifications',
  ],
  Inngest: [
    'Background job processing',
    'Workflow orchestration',
    'Async task execution',
    'Event-driven workflows',
    'Scheduled jobs',
  ],
  'Upstash Redis': [
    'Session caching',
    'Real-time state',
    'Rate limiting',
    'Task queue processing',
    'Cache invalidation',
  ],
}

// Types
export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'owner'
}

export interface IncidentLog {
  id: string
  serviceKey: string
  serviceName: string
  startTime: Date
  resolvedTime?: Date
  incidentId: string
  status: 'active' | 'resolved'
  emailsSent: {
    event: 'start' | 'degraded' | 'resolved'
    timestamp: Date
    recipients: string[]
  }[]
}

export interface AdminNotifierConfig {
  supabaseUrl: string
  supabaseServiceKey: string
  emailProvider: 'resend' | 'sendgrid' | 'ses' | 'smtp'
  emailConfig: {
    from: string
    replyTo?: string
  }
  emailApiKey?: string
  smtpConfig?: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
}

/**
 * Admin Notifier Service
 * Manages incident notifications to organization admins
 */
export class AdminNotifier {
  private config: AdminNotifierConfig
  private incidentLog: Map<string, IncidentLog> = new Map()

  constructor(config: AdminNotifierConfig) {
    this.config = config
  }

  /**
   * Handle status change event and send notifications
   */
  async handleStatusChange(event: StatusChangeEvent): Promise<void> {
    const incidentId = this.generateIncidentId(event.serviceKey, event.timestamp)
    let incident = this.incidentLog.get(incidentId)

    // Determine email type to send
    let emailType: 'start' | 'degraded' | 'resolved' | null = null

    if (event.previousStatus === 'healthy' && event.newStatus === 'down') {
      // Service went down
      emailType = 'start'
      if (!incident) {
        incident = {
          id: incidentId,
          serviceKey: event.serviceKey,
          serviceName: event.serviceName,
          startTime: event.timestamp,
          incidentId,
          status: 'active',
          emailsSent: [],
        }
      } else {
        incident.startTime = event.timestamp
        incident.status = 'active'
        incident.resolvedTime = undefined
      }
    } else if (
      event.previousStatus === 'healthy' &&
      event.newStatus === 'degraded'
    ) {
      // Service is degraded
      emailType = 'degraded'
      if (!incident) {
        incident = {
          id: incidentId,
          serviceKey: event.serviceKey,
          serviceName: event.serviceName,
          startTime: event.timestamp,
          incidentId,
          status: 'active',
          emailsSent: [],
        }
      }
    } else if (
      (event.previousStatus === 'down' || event.previousStatus === 'degraded') &&
      event.newStatus === 'healthy'
    ) {
      // Service recovered
      emailType = 'resolved'
      if (!incident) {
        incident = {
          id: incidentId,
          serviceKey: event.serviceKey,
          serviceName: event.serviceName,
          startTime: event.timestamp,
          resolvedTime: event.timestamp,
          incidentId,
          status: 'resolved',
          emailsSent: [],
        }
      } else {
        incident.resolvedTime = event.timestamp
        incident.status = 'resolved'
      }
    }

    // Send email if type determined
    if (emailType) {
      const alreadySent = incident?.emailsSent.some((e) => e.event === emailType!)
      if (!alreadySent) {
        await this.sendNotificationEmails(event, emailType, incident)
      }
    }

    // Update incident log
    if (incident) {
      this.incidentLog.set(incidentId, incident)
    }
  }

  /**
   * Send notification emails to organization admins
   */
  private async sendNotificationEmails(
    event: StatusChangeEvent,
    emailType: 'start' | 'degraded' | 'resolved',
    incident: IncidentLog
  ): Promise<void> {
    try {
      // Get admin users
      const admins = await this.getOrganizationAdmins()

      if (admins.length === 0) {
        console.warn('No admin users found for organization')
        return
      }

      // Generate email content
      const emailContent = this.generateEmailContent(event, emailType, incident)

      // Send emails to all admins
      const recipients = admins.map((a) => a.email)
      await this.sendEmails(recipients, emailContent.subject, emailContent.body)

      // Log email send
      incident.emailsSent.push({
        event: emailType,
        timestamp: new Date(),
        recipients,
      })

      console.log(
        `Sent ${emailType} notification emails for ${event.serviceName} to ${recipients.length} admins`
      )
    } catch (error) {
      console.error(`Failed to send admin notifications:`, error)
      throw error
    }
  }

  /**
   * Get organization admin users
   */
  private async getOrganizationAdmins(): Promise<AdminUser[]> {
    try {
      const response = await fetch(
        `${this.config.supabaseUrl}/rest/v1/org_members?select=id,email,name,role&role=in.("admin","owner")`,
        {
          headers: {
            'apikey': this.config.supabaseServiceKey,
            'Authorization': `Bearer ${this.config.supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch admins: ${response.statusText}`)
      }

      const admins = (await response.json()) as AdminUser[]
      return admins
    } catch (error) {
      console.error('Error fetching organization admins:', error)
      // Fallback to environment variable if available
      const fallbackEmail = process.env.ADMIN_FALLBACK_EMAIL
      if (fallbackEmail) {
        return [
          {
            id: 'fallback',
            email: fallbackEmail,
            name: 'Administrator',
            role: 'admin',
          },
        ]
      }
      throw error
    }
  }

  /**
   * Generate email content from template
   */
  private generateEmailContent(
    event: StatusChangeEvent,
    emailType: 'start' | 'degraded' | 'resolved',
    incident: IncidentLog
  ): { subject: string; body: string } {
    const template = EMAIL_TEMPLATES[
      `INCIDENT_${emailType.toUpperCase()}` as keyof typeof EMAIL_TEMPLATES
    ]

    const affectedFeatures = AFFECTED_FEATURES_MAP[event.serviceName] || [
      'Core functionality',
    ]

    let downtimeDuration = 'Calculating...'
    if (incident.resolvedTime && incident.startTime) {
      const durationMs = incident.resolvedTime.getTime() - incident.startTime.getTime()
      const minutes = Math.floor(durationMs / 60000)
      const hours = Math.floor(minutes / 60)
      if (hours > 0) {
        downtimeDuration = `${hours}h ${minutes % 60}m`
      } else {
        downtimeDuration = `${minutes}m`
      }
    }

    const adminActions = this.getAdminActions(event.serviceName)

    let subject = template.subject
      .replace('{serviceName}', event.serviceName)
      .replace('{status}', event.newStatus)

    let body = template.body
      .replace('{serviceName}', event.serviceName)
      .replace('{status}', event.newStatus)
      .replace('{timestamp}', event.timestamp.toISOString())
      .replace('{statusPageUrl}', this.getStatusPageUrl(event.serviceKey))
      .replace(
        '{affectedFeatures}',
        affectedFeatures.map((f) => `- ${f}`).join('\n')
      )
      .replace('{downtimeDuration}', downtimeDuration)
      .replace('{adminActions}', adminActions || '')

    return { subject, body }
  }

  /**
   * Get admin action items based on service
   */
  private getAdminActions(serviceName: string): string {
    const actions: Record<string, string> = {
      Supabase: `
Recommended Actions:
1. Monitor your database connections and query performance
2. Check application logs for database-related errors
3. Consider implementing automatic retry logic for failed queries
4. Prepare customer communication if needed
      `,
      Vercel: `
Recommended Actions:
1. Rollback to the last known stable deployment if possible
2. Prepare alternative deployment strategy if needed
3. Monitor deployment queue and function execution
4. Have manual deployment procedures ready
      `,
      Nylas: `
Recommended Actions:
1. Implement message queuing for missed email syncs
2. Prepare to catch up on missed calendar events
3. Monitor sync lag when service recovers
4. Have fallback contact management procedures ready
      `,
      Inngest: `
Recommended Actions:
1. Queue jobs in-process temporarily
2. Prepare job replay strategy when service recovers
3. Monitor job backlog and completion rates
4. Have manual job execution procedures ready
      `,
      'Upstash Redis': `
Recommended Actions:
1. Implement in-memory cache fallback
2. Prepare session persistence strategy
3. Monitor cache hit rates and memory usage
4. Have rate limiting fallback ready
      `,
    }

    return actions[serviceName] || ''
  }

  /**
   * Get status page URL
   */
  private getStatusPageUrl(serviceKey: string): string {
    const statusPages: Record<string, string> = {
      SUPABASE: 'https://status.supabase.com/',
      VERCEL: 'https://www.vercelstatus.com/',
      NYLAS: 'https://status.nylas.com/',
      INNGEST: 'https://status.inngest.com/',
      REDIS: 'https://status.upstash.com/',
    }
    return statusPages[serviceKey] || ''
  }

  /**
   * Send emails via configured provider
   */
  private async sendEmails(
    recipients: string[],
    subject: string,
    body: string
  ): Promise<void> {
    switch (this.config.emailProvider) {
      case 'resend':
        await this.sendViaResend(recipients, subject, body)
        break
      case 'sendgrid':
        await this.sendViaSendGrid(recipients, subject, body)
        break
      case 'ses':
        await this.sendViaSES(recipients, subject, body)
        break
      case 'smtp':
        await this.sendViaSMTP(recipients, subject, body)
        break
      default:
        throw new Error(`Unsupported email provider: ${this.config.emailProvider}`)
    }
  }

  /**
   * Send via Resend
   */
  private async sendViaResend(
    recipients: string[],
    subject: string,
    body: string
  ): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.emailApiKey}`,
      },
      body: JSON.stringify({
        from: this.config.emailConfig.from,
        to: recipients,
        subject,
        text: body,
      }),
    })

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.statusText}`)
    }
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(
    recipients: string[],
    subject: string,
    body: string
  ): Promise<void> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.emailApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map((email) => ({ email })) }],
        from: { email: this.config.emailConfig.from },
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    })

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.statusText}`)
    }
  }

  /**
   * Send via AWS SES
   */
  private async sendViaSES(
    recipients: string[],
    subject: string,
    body: string
  ): Promise<void> {
    // This would require AWS SDK integration
    // Placeholder for implementation
    console.log('SES email sending not yet implemented')
    throw new Error('SES implementation pending')
  }

  /**
   * Send via SMTP
   */
  private async sendViaSMTP(
    recipients: string[],
    subject: string,
    body: string
  ): Promise<void> {
    // This would require nodemailer or similar SMTP library
    // Placeholder for implementation
    console.log('SMTP email sending not yet implemented')
    throw new Error('SMTP implementation pending')
  }

  /**
   * Generate unique incident ID
   */
  private generateIncidentId(
    serviceKey: string,
    timestamp: Date
  ): string {
    // Create incident ID from service key and date (to track multiple incidents per day)
    const date = timestamp.toISOString().split('T')[0]
    return `incident-${serviceKey}-${date}`
  }

  /**
   * Get incident history
   */
  public getIncidentHistory(): IncidentLog[] {
    return Array.from(this.incidentLog.values())
  }

  /**
   * Clear old incidents (e.g., older than 30 days)
   */
  public cleanupOldIncidents(daysOld: number = 30): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    for (const [key, incident] of this.incidentLog.entries()) {
      if (incident.startTime < cutoffDate && incident.status === 'resolved') {
        this.incidentLog.delete(key)
      }
    }
  }
}

// Singleton instance
let notifierInstance: AdminNotifier | null = null

export function getAdminNotifier(): AdminNotifier {
  if (!notifierInstance) {
    throw new Error('Admin notifier not initialized. Call initializeAdminNotifier first.')
  }
  return notifierInstance
}

export function initializeAdminNotifier(config: AdminNotifierConfig): AdminNotifier {
  notifierInstance = new AdminNotifier(config)
  return notifierInstance
}
