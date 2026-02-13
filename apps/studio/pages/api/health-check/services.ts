/**
 * Health Check API Endpoint
 * GET /api/health-check/services
 *
 * Returns current health status of all monitored services
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { HealthChecker } from '@/lib/services/health-check/health-checker'
import { ServiceHealthCheck } from '@/lib/services/health-check/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ServiceHealthCheck[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const statuses = await HealthChecker.checkAllServices()

    // Cache for 1 minute
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.setHeader('X-Checked-At', new Date().toISOString())

    return res.status(200).json(statuses)
  } catch (error) {
    console.error('Health check error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Health check failed',
    })
  }
}
