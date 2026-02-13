/**
 * Health Status API Endpoint
 *
 * Provides current health status of all external dependencies
 * Can be used for:
 * - Load balancer health checks
 * - Monitoring dashboards
 * - Status pages
 * - Client-side status displays
 *
 * GET /api/health
 * GET /api/health?service=supabase
 * GET /api/health?detailed=true
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { getHealthMonitor, SERVICES } from '@/lib/services/health-monitor'
import type { ServiceKey } from '@/lib/services/health-monitor'

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  services: Record<string, unknown>
  summary?: {
    healthy: number
    degraded: number
    down: number
  }
}

interface ErrorResponse {
  error: string
  timestamp: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    const monitor = getHealthMonitor()
    const { service, detailed } = req.query
    const timestamp = new Date().toISOString()

    // Get specific service status
    if (service && typeof service === 'string') {
      const serviceKey = service.toUpperCase() as ServiceKey

      if (!SERVICES[serviceKey]) {
        return res.status(404).json({
          error: `Unknown service: ${service}`,
          timestamp,
        })
      }

      const serviceStatus = monitor.getServiceStatus(serviceKey)

      if (!serviceStatus) {
        return res.status(503).json({
          error: `Service ${service} status unavailable`,
          timestamp,
        })
      }

      const overallStatus =
        serviceStatus.status === 'healthy'
          ? 'healthy'
          : serviceStatus.status === 'degraded'
            ? 'degraded'
            : 'down'

      return res.status(200).json({
        status: overallStatus,
        timestamp,
        services: {
          [service]: serviceStatus,
        },
      })
    }

    // Get all services status
    const allStatus = monitor.getStatus()
    const summary = monitor.getHealthSummary()

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy'
    if (summary.down > 0) {
      overallStatus = 'down'
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded'
    }

    const response: HealthResponse = {
      status: overallStatus,
      timestamp,
      services: detailed === 'true' ? allStatus : Object.fromEntries(
        Object.entries(allStatus).map(([key, status]) => [
          key,
          {
            status: status.status,
          },
        ])
      ),
    }

    // Add summary if requested
    if (detailed === 'true') {
      response.summary = summary
    }

    // Set appropriate HTTP status code
    const httpStatus =
      overallStatus === 'healthy'
        ? 200
        : overallStatus === 'degraded'
          ? 200 // Still 200 but clients can check the status field
          : 503 // Service unavailable for critical failures

    return res.status(httpStatus).json(response)
  } catch (error) {
    console.error('Health check failed:', error)
    return res.status(500).json({
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    })
  }
}
