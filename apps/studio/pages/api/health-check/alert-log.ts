/**
 * Alert Log API Endpoint
 * POST /api/health-check/alert-log
 *
 * Logs service alerts to the database for audit trail and deduplication
 * Called by the admin notifier service after sending emails
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { ServiceName, AlertType } from '@/lib/services/health-check/types'

interface LogRequest {
  organizationId: string
  service: ServiceName
  alertType: AlertType
  statusPageUrl: string
  adminEmailsSent: string[]
  deduplicationKey: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { organizationId, service, alertType, statusPageUrl, adminEmailsSent, deduplicationKey } =
      req.body as LogRequest

    // Validate required fields
    if (!organizationId || !service || !alertType || !deduplicationKey) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // TODO: Insert into admin_service_alerts table
    // const { error } = await supabase
    //   .from('admin_service_alerts')
    //   .insert({
    //     organization_id: organizationId,
    //     service_name: service,
    //     alert_type: alertType,
    //     status_page_link: statusPageUrl,
    //     admin_email_addresses: adminEmailsSent,
    //     deduplication_key: deduplicationKey,
    //     created_at: new Date().toISOString(),
    //   })

    // if (error) {
    //   throw error
    // }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Alert log error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to log alert',
    })
  }
}
