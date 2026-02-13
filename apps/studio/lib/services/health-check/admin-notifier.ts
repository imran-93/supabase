/**
 * Admin Notifier Service
 * Sends idempotent emails to organization admins when service issues are detected
 * Deduplicates alerts to prevent email flooding
 */

import { ServiceName, AlertType, AdminContact } from './types'

interface NotificationOptions {
  organizationId: string
  service: ServiceName
  alertType: AlertType
  statusPageUrl: string
  message: string
  estimatedResolutionTime?: string
}

interface NotificationResult {
  success: boolean
  emailsSent: string[]
  error?: string
  deduplicationSkipped?: boolean
}

/**
 * Generate deduplication key for alert
 * Ensures same service doesn't send multiple alerts on the same day
 */
function generateDeduplicationKey(organizationId: string, service: ServiceName, alertType: AlertType): string {
  const today = new Date().toISOString().split('T')[0]
  return `${organizationId}:${service}:${alertType}:${today}`
}

/**
 * Check if alert has already been sent today (deduplication)
 */
async function hasAlertBeenSent(
  organizationId: string,
  service: ServiceName,
  alertType: AlertType
): Promise<boolean> {
  try {
    const deduplicationKey = generateDeduplicationKey(organizationId, service, alertType)

    // This would query the database for existing alerts
    // For now, returning false to show the structure
    const response = await fetch('/api/health-check/alert-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deduplicationKey }),
    })

    const result = await response.json()
    return result.exists || false
  } catch (error) {
    console.error('Error checking alert deduplication:', error)
    // Fail open - send email if we can't check deduplication
    return false
  }
}

/**
 * Fetch admin contacts for organization
 * Falls back to multiple sources:
 * 1. Explicitly configured admin emails
 * 2. Organization owner email
 * 3. Billing contact email
 */
async function fetchAdminContacts(organizationId: string): Promise<AdminContact[]> {
  try {
    const response = await fetch(`/api/organizations/${organizationId}/admin-contacts`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      console.warn(`Failed to fetch admin contacts for org ${organizationId}`)
      return []
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching admin contacts:', error)
    return []
  }
}

/**
 * Compose email content for service alert
 */
function composeEmail(options: NotificationOptions): {
  subject: string
  htmlBody: string
  plainTextBody: string
} {
  const serviceName = options.service.charAt(0).toUpperCase() + options.service.slice(1)
  const isResolved = options.alertType === 'resolved'

  const statusEmoji = isResolved ? '✓' : '⚠️'
  const statusText = isResolved ? 'Resolved' : 'Issue Detected'
  const action = isResolved ? 'resolved' : 'identified'

  const subject = `${statusEmoji} ${serviceName} Service ${statusText} - Action Required`

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${isResolved ? '#10b981' : '#ef4444'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .service-name { font-size: 24px; font-weight: bold; margin: 0; }
    .status-badge { display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 12px; margin-top: 8px; }
    .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 12px 0; border-radius: 4px; }
    .alert-box.resolved { background: #f0fdf4; border-left-color: #10b981; }
    .action-link { background: #3b82f6; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; display: inline-block; margin: 12px 0; }
    .footer { color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="service-name">${serviceName}</p>
      <span class="status-badge">${statusText}</span>
    </div>
    <div class="content">
      <p><strong>Alert Type:</strong> ${options.alertType.charAt(0).toUpperCase() + options.alertType.slice(1)}</p>
      <div class="alert-box ${isResolved ? 'resolved' : ''}">
        <strong>${isResolved ? '✓ Service Resolved' : '⚠️ Service Issue Detected'}</strong>
        <p>${options.message}</p>
      </div>

      ${options.estimatedResolutionTime && !isResolved ? `
        <p><strong>Estimated Resolution:</strong> ${options.estimatedResolutionTime}</p>
      ` : ''}

      <p>Please visit the status page for detailed information and real-time updates:</p>
      <a href="${options.statusPageUrl}" class="action-link">View Status Page →</a>

      <p><strong>Recommended Actions:</strong></p>
      <ul>
        <li>Monitor the status page for updates</li>
        <li>Inform relevant team members</li>
        <li>Prepare communication for affected users</li>
        ${isResolved ? '<li>Verify functionality has been restored</li>' : ''}
      </ul>

      <div class="footer">
        <p>This is an automated alert from Supabase Studio.</p>
        <p>You're receiving this because you're an admin for an organization using ${serviceName}.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()

  const plainTextBody = `
${serviceName} Service ${statusText}

Alert Type: ${options.alertType}

${isResolved ? '✓ Service Resolved' : '⚠️ Service Issue Detected'}

${options.message}

${options.estimatedResolutionTime && !isResolved ? `Estimated Resolution: ${options.estimatedResolutionTime}` : ''}

Visit the status page for more information:
${options.statusPageUrl}

Recommended Actions:
- Monitor the status page for updates
- Inform relevant team members
- Prepare communication for affected users
${isResolved ? '- Verify functionality has been restored' : ''}

This is an automated alert from Supabase Studio.
  `.trim()

  return {
    subject,
    htmlBody,
    plainTextBody,
  }
}

/**
 * Send alert email to organization admins
 * Idempotent: deduplicates alerts to prevent flooding
 */
export async function notifyAdminsOfServiceIssue(
  options: NotificationOptions
): Promise<NotificationResult> {
  try {
    // Check deduplication
    const alreadySent = await hasAlertBeenSent(options.organizationId, options.service, options.alertType)
    if (alreadySent) {
      return {
        success: true,
        emailsSent: [],
        deduplicationSkipped: true,
      }
    }

    // Fetch admin contacts
    const admins = await fetchAdminContacts(options.organizationId)

    if (admins.length === 0) {
      return {
        success: false,
        emailsSent: [],
        error: 'No admin contacts found for organization',
      }
    }

    // Compose email
    const email = composeEmail(options)

    // Send emails with retry logic
    const emailsSent: string[] = []
    const emailErrors: { email: string; error: string }[] = []

    for (const admin of admins) {
      const result = await sendEmailWithRetry(
        admin.email,
        email.subject,
        email.htmlBody,
        email.plainTextBody,
        {
          retries: 3,
          backoffMs: 1000,
        }
      )

      if (result.success) {
        emailsSent.push(admin.email)
      } else {
        emailErrors.push({
          email: admin.email,
          error: result.error || 'Unknown error',
        })
      }
    }

    // Log alert to database
    await logAlertToDatabase({
      organizationId: options.organizationId,
      service: options.service,
      alertType: options.alertType,
      statusPageUrl: options.statusPageUrl,
      emailsSent,
      deduplicationKey: generateDeduplicationKey(
        options.organizationId,
        options.service,
        options.alertType
      ),
    })

    const hasFailures = emailErrors.length > 0
    return {
      success: emailsSent.length > 0,
      emailsSent,
      error: hasFailures ? `Failed to send to ${emailErrors.length} recipient(s)` : undefined,
    }
  } catch (error) {
    console.error('Error notifying admins:', error)
    return {
      success: false,
      emailsSent: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send email with exponential backoff retry logic
 */
async function sendEmailWithRetry(
  to: string,
  subject: string,
  htmlBody: string,
  plainTextBody: string,
  options: { retries: number; backoffMs: number }
): Promise<{ success: boolean; error?: string }> {
  let lastError: string | undefined

  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      const response = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          htmlBody,
          plainTextBody,
          idempotencyKey: `${to}:${subject}:${Date.now()}`,
        }),
      })

      if (response.ok) {
        return { success: true }
      }

      lastError = `HTTP ${response.status}`

      // Only retry on server errors (5xx)
      if (response.status < 500) {
        break
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'

      // Wait before retrying with exponential backoff
      if (attempt < options.retries) {
        const delayMs = options.backoffMs * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  return {
    success: false,
    error: lastError,
  }
}

/**
 * Log alert to database for deduplication and audit trail
 */
async function logAlertToDatabase(options: {
  organizationId: string
  service: ServiceName
  alertType: AlertType
  statusPageUrl: string
  emailsSent: string[]
  deduplicationKey: string
}): Promise<void> {
  try {
    await fetch('/api/health-check/alert-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: options.organizationId,
        service: options.service,
        alertType: options.alertType,
        statusPageUrl: options.statusPageUrl,
        adminEmailsSent: options.emailsSent,
        deduplicationKey: options.deduplicationKey,
      }),
    })
  } catch (error) {
    console.error('Error logging alert to database:', error)
    // Don't throw - logging failure shouldn't block alert sending
  }
}
