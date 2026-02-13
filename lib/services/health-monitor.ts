/**
 * Health Monitoring Service
 *
 * Monitors the health status of critical external dependencies:
 * - Supabase
 * - Vercel
 * - Nylas
 * - Inngest
 * - Redis/Upstash
 *
 * Implements:
 * - Direct /ping health check endpoints
 * - RSS feed polling for status updates
 * - Automatic incident detection and recovery tracking
 * - Admin notification triggers
 */

import { z } from 'zod'

// Service definitions with health check configurations
export const SERVICES = {
  SUPABASE: {
    name: 'Supabase',
    statusPageUrl: 'https://status.supabase.com/',
    rssFeedUrl: 'https://status.supabase.com/history.rss',
    healthCheckEndpoints: [
      'https://api.supabase.co/health',
      // Will be overridden with customer instance URL in production
    ],
    priority: 'critical',
  },
  VERCEL: {
    name: 'Vercel',
    statusPageUrl: 'https://www.vercelstatus.com/',
    rssFeedUrl: 'https://www.vercelstatus.com/history.rss',
    healthCheckEndpoints: [
      'https://www.vercelstatus.com/api/v2/status.json',
    ],
    priority: 'high',
  },
  NYLAS: {
    name: 'Nylas',
    statusPageUrl: 'https://status.nylas.com/',
    rssFeedUrl: 'https://status.nylas.com/history.rss',
    healthCheckEndpoints: [
      'https://api.nylas.com/health',
    ],
    priority: 'high',
  },
  INNGEST: {
    name: 'Inngest',
    statusPageUrl: 'https://status.inngest.com/',
    rssFeedUrl: 'https://status.inngest.com/history.rss',
    healthCheckEndpoints: [
      'https://api.inngest.com/health',
    ],
    priority: 'medium',
  },
  REDIS: {
    name: 'Upstash Redis',
    statusPageUrl: 'https://status.upstash.com/',
    rssFeedUrl: 'https://status.upstash.com/history.rss',
    healthCheckEndpoints: [
      'https://api.upstash.com/health',
    ],
    priority: 'medium',
  },
} as const

export type ServiceKey = keyof typeof SERVICES

// Health status schema
export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'down', 'unknown'])
export type HealthStatus = z.infer<typeof HealthStatusSchema>

export interface ServiceHealthCheck {
  serviceKey: ServiceKey
  serviceName: string
  status: HealthStatus
  lastCheckTime: Date
  lastStatusChange: Date
  downtime?: {
    startTime: Date
    endTime?: Date
    durationMinutes?: number
  }
  message?: string
}

export interface HealthCheckResult {
  [key: string]: ServiceHealthCheck
}

/**
 * Health Monitor Class
 * Responsible for periodic health checks and status tracking
 */
export class HealthMonitor {
  private checkInterval: number = 30 * 1000 // 30 seconds
  private rssFeedCheckInterval: number = 5 * 60 * 1000 // 5 minutes
  private statusCache: Map<ServiceKey, ServiceHealthCheck> = new Map()
  private previousStates: Map<ServiceKey, HealthStatus> = new Map()
  private onStatusChange?: (change: StatusChangeEvent) => Promise<void>
  private onHealthCheckError?: (error: HealthCheckError) => Promise<void>

  constructor(
    onStatusChange?: (change: StatusChangeEvent) => Promise<void>,
    onHealthCheckError?: (error: HealthCheckError) => Promise<void>
  ) {
    this.onStatusChange = onStatusChange
    this.onHealthCheckError = onHealthCheckError
    this.initializeCache()
  }

  private initializeCache() {
    Object.entries(SERVICES).forEach(([key, service]) => {
      this.statusCache.set(key as ServiceKey, {
        serviceKey: key as ServiceKey,
        serviceName: service.name,
        status: 'unknown',
        lastCheckTime: new Date(),
        lastStatusChange: new Date(),
      })
      this.previousStates.set(key as ServiceKey, 'unknown')
    })
  }

  /**
   * Start monitoring all services
   */
  public start() {
    // Initial health check
    this.checkAllServices()

    // Periodic health checks via /ping
    setInterval(() => this.checkAllServices(), this.checkInterval)

    // RSS feed polling
    setInterval(() => this.pollRSSFeeds(), this.rssFeedCheckInterval)
  }

  /**
   * Perform health check for all services
   */
  private async checkAllServices() {
    const results = await Promise.all(
      Object.keys(SERVICES).map((key) => this.checkService(key as ServiceKey))
    )

    for (const result of results) {
      if (result) {
        await this.updateServiceStatus(result)
      }
    }
  }

  /**
   * Check health of a single service
   */
  private async checkService(serviceKey: ServiceKey): Promise<ServiceHealthCheck | null> {
    const service = SERVICES[serviceKey]
    let status: HealthStatus = 'unknown'
    let message: string | undefined

    try {
      // Try health check endpoints
      for (const endpoint of service.healthCheckEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            timeout: 10000, // 10 second timeout
          })

          if (response.ok) {
            status = 'healthy'
            break
          } else if (response.status >= 500) {
            status = 'down'
            message = `Health check returned ${response.status}`
          } else {
            status = 'degraded'
            message = `Health check returned ${response.status}`
          }
        } catch (error) {
          // Continue to next endpoint
          continue
        }
      }

      // If all endpoints failed, mark as down
      if (status === 'unknown') {
        status = 'down'
        message = 'All health check endpoints unreachable'
      }
    } catch (error) {
      status = 'down'
      message = `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`

      if (this.onHealthCheckError) {
        await this.onHealthCheckError({
          serviceKey,
          serviceName: service.name,
          error: error instanceof Error ? error : new Error(String(error)),
          timestamp: new Date(),
        })
      }
    }

    const now = new Date()
    const existing = this.statusCache.get(serviceKey)

    return {
      serviceKey,
      serviceName: service.name,
      status,
      lastCheckTime: now,
      lastStatusChange: existing?.lastStatusChange || now,
      message,
      downtime: existing?.downtime,
    }
  }

  /**
   * Poll RSS feeds for status updates
   */
  private async pollRSSFeeds() {
    for (const [key, service] of Object.entries(SERVICES)) {
      try {
        const response = await fetch(service.rssFeedUrl)
        const feedText = await response.text()

        // Parse RSS feed for incidents
        const incidents = this.parseRSSIncidents(feedText)

        if (incidents.length > 0) {
          const currentStatus = this.statusCache.get(key as ServiceKey)
          if (currentStatus) {
            // Update status based on RSS feed findings
            const hasActiveIncident = incidents.some((i) => !i.resolved)
            const newStatus: HealthStatus = hasActiveIncident ? 'down' : 'healthy'

            if (newStatus !== currentStatus.status) {
              await this.updateServiceStatus({
                ...currentStatus,
                status: newStatus,
                message: incidents.map((i) => i.title).join('; '),
              })
            }
          }
        }
      } catch (error) {
        // RSS polling is best-effort, log but don't fail
        console.warn(`Failed to poll RSS feed for ${service.name}:`, error)
      }
    }
  }

  /**
   * Parse RSS feed for incidents
   */
  private parseRSSIncidents(
    feedText: string
  ): Array<{ title: string; resolved: boolean; timestamp: Date }> {
    const incidents: Array<{ title: string; resolved: boolean; timestamp: Date }> = []

    try {
      // Extract incident items from RSS
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match

      while ((match = itemRegex.exec(feedText)) !== null) {
        const item = match[1]

        // Check if incident is resolved
        const resolved = item.includes('resolved') || item.includes('Resolved')
        const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]

        incidents.push({
          title: this.stripHtml(title),
          resolved,
          timestamp: pubDate ? new Date(pubDate) : new Date(),
        })
      }
    } catch (error) {
      console.warn('Failed to parse RSS feed:', error)
    }

    return incidents
  }

  /**
   * Update service status and trigger change callbacks
   */
  private async updateServiceStatus(check: ServiceHealthCheck) {
    const previousStatus = this.previousStates.get(check.serviceKey)

    if (previousStatus !== check.status) {
      // Status changed
      this.statusCache.set(check.serviceKey, {
        ...check,
        lastStatusChange: new Date(),
      })
      this.previousStates.set(check.serviceKey, check.status)

      if (this.onStatusChange) {
        await this.onStatusChange({
          serviceKey: check.serviceKey,
          serviceName: check.serviceName,
          previousStatus: previousStatus || 'unknown',
          newStatus: check.status,
          timestamp: new Date(),
          message: check.message,
        })
      }
    } else {
      // Status unchanged, just update check time
      this.statusCache.set(check.serviceKey, check)
    }
  }

  /**
   * Get current status of all services
   */
  public getStatus(): HealthCheckResult {
    const result: HealthCheckResult = {}
    this.statusCache.forEach((status, key) => {
      result[key] = status
    })
    return result
  }

  /**
   * Get status of a specific service
   */
  public getServiceStatus(serviceKey: ServiceKey): ServiceHealthCheck | undefined {
    return this.statusCache.get(serviceKey)
  }

  /**
   * Check if any critical services are down
   */
  public hasCriticalServiceDown(): boolean {
    return Array.from(this.statusCache.values()).some(
      (status) => SERVICES[status.serviceKey].priority === 'critical' && status.status === 'down'
    )
  }

  /**
   * Get summary of current system health
   */
  public getHealthSummary(): {
    healthy: number
    degraded: number
    down: number
    critical: boolean
  } {
    const statuses = Array.from(this.statusCache.values())
    return {
      healthy: statuses.filter((s) => s.status === 'healthy').length,
      degraded: statuses.filter((s) => s.status === 'degraded').length,
      down: statuses.filter((s) => s.status === 'down').length,
      critical: this.hasCriticalServiceDown(),
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim()
  }
}

// Event types
export interface StatusChangeEvent {
  serviceKey: ServiceKey
  serviceName: string
  previousStatus: HealthStatus
  newStatus: HealthStatus
  timestamp: Date
  message?: string
}

export interface HealthCheckError {
  serviceKey: ServiceKey
  serviceName: string
  error: Error
  timestamp: Date
}

// Singleton instance
let monitorInstance: HealthMonitor | null = null

export function getHealthMonitor(): HealthMonitor {
  if (!monitorInstance) {
    monitorInstance = new HealthMonitor()
  }
  return monitorInstance
}

export function initializeHealthMonitor(
  onStatusChange?: (change: StatusChangeEvent) => Promise<void>,
  onHealthCheckError?: (error: HealthCheckError) => Promise<void>
): HealthMonitor {
  monitorInstance = new HealthMonitor(onStatusChange, onHealthCheckError)
  monitorInstance.start()
  return monitorInstance
}
