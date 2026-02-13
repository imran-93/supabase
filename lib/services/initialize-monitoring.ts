/**
 * Initialize Monitoring Services
 *
 * This module sets up the health monitor and admin notifier
 * in your application. Call this during application startup.
 *
 * Usage in Next.js:
 * - Call in pages/_app.tsx or app layout
 * - Call in API route middleware
 * - Call in edge function initialization
 */

import type { AdminNotifierConfig } from './admin-notifier'
import { initializeAdminNotifier, getAdminNotifier } from './admin-notifier'
import type { StatusChangeEvent, HealthCheckError } from './health-monitor'
import { initializeHealthMonitor, getHealthMonitor } from './health-monitor'

/**
 * Initialize both health monitoring and admin notification services
 * Should be called once during application startup
 */
export async function initializeMonitoringServices(): Promise<void> {
  // Step 1: Initialize Health Monitor
  const monitor = initializeHealthMonitor(
    handleStatusChange,
    handleHealthCheckError
  )

  console.log('Health monitoring initialized')

  // Step 2: Initialize Admin Notifier (if configured)
  const notifierConfig = getAdminNotifierConfig()
  if (notifierConfig) {
    initializeAdminNotifier(notifierConfig)
    console.log('Admin notifier initialized')
  } else {
    console.warn(
      'Admin notifier not configured. Email notifications will be disabled. Configure via environment variables.'
    )
  }

  // Step 3: Start monitoring
  monitor.start()
  console.log('Health monitoring service started')
}

/**
 * Handle status change events from health monitor
 */
async function handleStatusChange(event: StatusChangeEvent): Promise<void> {
  console.log(
    `Service status changed: ${event.serviceName} - ${event.previousStatus} -> ${event.newStatus}`
  )

  // Send admin notifications if notifier is initialized
  try {
    const notifier = getAdminNotifier()
    await notifier.handleStatusChange(event)
  } catch (error) {
    // Notifier may not be initialized, that's ok
    if (error instanceof Error && !error.message.includes('not initialized')) {
      console.error('Failed to send admin notification:', error)
    }
  }

  // Implement any additional logic here:
  // - Log to external monitoring service (e.g., Sentry)
  // - Update database with incident record
  // - Trigger webhooks
  // - Update internal status cache
  // - Notify other services

  // Example: Log to Sentry
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/nextjs')
      Sentry.captureMessage(
        `Service status change: ${event.serviceName} - ${event.newStatus}`,
        'info'
      )
    } catch {
      // Sentry not available
    }
  }
}

/**
 * Handle health check errors
 */
async function handleHealthCheckError(error: HealthCheckError): Promise<void> {
  console.error(
    `Health check error for ${error.serviceName}:`,
    error.error.message
  )

  // Implement error handling logic here:
  // - Log errors for debugging
  // - Alert ops team for persistent failures
  // - Switch to fallback health check methods
  // - Implement circuit breaker pattern
}

/**
 * Get admin notifier configuration from environment variables
 */
function getAdminNotifierConfig(): AdminNotifierConfig | null {
  const emailProvider = process.env.ADMIN_EMAIL_PROVIDER as
    | 'resend'
    | 'sendgrid'
    | 'ses'
    | 'smtp'
    | undefined

  if (!emailProvider) {
    return null
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase configuration missing for admin notifier')
    return null
  }

  const config: AdminNotifierConfig = {
    supabaseUrl,
    supabaseServiceKey,
    emailProvider,
    emailConfig: {
      from: process.env.ADMIN_EMAIL_FROM || 'noreply@platform.local',
      replyTo: process.env.ADMIN_EMAIL_REPLY_TO,
    },
    emailApiKey: process.env.ADMIN_EMAIL_API_KEY,
  }

  // Add SMTP config if needed
  if (emailProvider === 'smtp') {
    config.smtpConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    }
  }

  return config
}

/**
 * Get current health status (for use in API responses, etc)
 */
export function getSystemHealth() {
  try {
    const monitor = getHealthMonitor()
    return monitor.getHealthSummary()
  } catch {
    return null
  }
}

/**
 * Get detailed status of all services
 */
export function getDetailedStatus() {
  try {
    const monitor = getHealthMonitor()
    return monitor.getStatus()
  } catch {
    return {}
  }
}

/**
 * Get incident history (for admin dashboard, etc)
 */
export function getIncidentHistory() {
  try {
    const notifier = getAdminNotifier()
    return notifier.getIncidentHistory()
  } catch {
    return []
  }
}

/**
 * Manually trigger a status check (for testing or forced refresh)
 */
export async function triggerHealthCheck() {
  try {
    const monitor = getHealthMonitor()
    // Note: Health monitor doesn't expose a direct method,
    // but we can check status immediately
    return monitor.getStatus()
  } catch (error) {
    console.error('Failed to trigger health check:', error)
    return {}
  }
}

/**
 * Cleanup and stop monitoring (useful for testing)
 */
export function stopMonitoring() {
  // Note: Current implementation doesn't expose stop method
  // This is a placeholder for future enhancement
  console.log('Monitoring stop requested')
}
