/**
 * Alert History API Endpoint
 * POST /api/health-check/alert-history
 *
 * Checks if an alert has already been sent (deduplication)
 * Used by the admin notifier service to prevent duplicate emails
 */

import type { NextApiRequest, NextApiResponse } from 'next'

interface CheckRequest {
  deduplicationKey: string
}

interface CheckResponse {
  exists: boolean
  lastSentAt?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CheckResponse | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { deduplicationKey } = req.body as CheckRequest

    if (!deduplicationKey) {
      return res.status(400).json({ error: 'deduplicationKey is required' })
    }

    // TODO: Query admin_service_alerts table
    // const alert = await supabase
    //   .from('admin_service_alerts')
    //   .select('created_at')
    //   .eq('deduplication_key', deduplicationKey)
    //   .single()

    // For now, return false (no alert sent yet)
    return res.status(200).json({
      exists: false,
      lastSentAt: undefined,
    })
  } catch (error) {
    console.error('Alert history check error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to check alert history',
    })
  }
}
