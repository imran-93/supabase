/**
 * Health Checker Service
 * Monitors the health of external dependencies via health checks and RSS feeds
 */

import { ServiceHealthCheck, ServiceName, ServiceStatus } from './types'

const HEALTH_CHECK_CONFIG = {
  supabase: {
    httpUrl: 'https://api.supabase.com/health',
    statusPageUrl: 'https://status.supabase.com',
    rssUrl: 'https://status.supabase.com/history.rss',
    interval: 60, // 1 minute
  },
  nylas: {
    httpUrl: 'https://api.nylas.com/health',
    statusPageUrl: 'https://status.nylas.com',
    rssUrl: 'https://status.nylas.com/history.rss',
    interval: 300, // 5 minutes
  },
  vercel: {
    httpUrl: 'https://api.vercel.com/health',
    statusPageUrl: 'https://status.vercel.com',
    rssUrl: 'https://status.vercel.com/history.rss',
    interval: 300, // 5 minutes
  },
  inngest: {
    httpUrl: 'https://api.inngest.com/health',
    statusPageUrl: 'https://status.inngest.com',
    rssUrl: 'https://status.inngest.com/history.rss',
    interval: 300, // 5 minutes
  },
  upstash: {
    httpUrl: 'https://api.upstash.com/health',
    statusPageUrl: 'https://status.upstash.com',
    rssUrl: 'https://status.upstash.com/history.rss',
    interval: 60, // 1 minute
  },
}

export class HealthChecker {
  /**
   * Perform HTTP health check on a service
   */
  static async checkServiceHealth(
    service: ServiceName,
    options: { timeout?: number } = {}
  ): Promise<ServiceHealthCheck> {
    const config = HEALTH_CHECK_CONFIG[service]
    const timeout = options.timeout || 10000 // 10 second default

    const startTime = Date.now()
    let status: ServiceStatus = 'unknown'
    let statusCode: number | undefined
    let errorMessage: string | undefined

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(config.httpUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Supabase-Studio-Health-Check/1.0',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      statusCode = response.status

      if (response.ok) {
        status = 'operational'
      } else if (response.status >= 500) {
        status = 'major_outage'
        errorMessage = `HTTP ${response.status}`
      } else if (response.status >= 400) {
        status = 'degraded'
        errorMessage = `HTTP ${response.status}`
      }

      return {
        service,
        status,
        lastChecked: new Date(),
        responseTime,
        statusCode,
        errorMessage,
        statusPageUrl: config.statusPageUrl,
        rssUrl: config.rssUrl,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Health check timeout'
        } else {
          errorMessage = error.message
        }
      } else {
        errorMessage = 'Unknown error'
      }

      return {
        service,
        status: 'major_outage',
        lastChecked: new Date(),
        responseTime,
        errorMessage,
        statusPageUrl: config.statusPageUrl,
        rssUrl: config.rssUrl,
      }
    }
  }

  /**
   * Check multiple services in parallel
   */
  static async checkAllServices(): Promise<ServiceHealthCheck[]> {
    const services: ServiceName[] = ['supabase', 'nylas', 'vercel', 'inngest', 'upstash']
    const results = await Promise.all(
      services.map((service) => this.checkServiceHealth(service))
    )
    return results
  }

  /**
   * Parse RSS feed to detect service status changes
   * Returns true if status has changed from previous check
   */
  static async pollRssFeed(
    service: ServiceName,
    lastCheckTime?: Date
  ): Promise<{
    hasUpdate: boolean
    incidents: Array<{
      title: string
      link: string
      pubDate: Date
      status: ServiceStatus
    }>
  }> {
    const config = HEALTH_CHECK_CONFIG[service]

    try {
      const response = await fetch(config.rssUrl, {
        headers: {
          'User-Agent': 'Supabase-Studio-RSS-Parser/1.0',
        },
      })

      if (!response.ok) {
        return { hasUpdate: false, incidents: [] }
      }

      const text = await response.text()
      const incidents = parseRssFeed(text, lastCheckTime)

      return {
        hasUpdate: incidents.length > 0,
        incidents,
      }
    } catch (error) {
      console.error(`Failed to poll RSS feed for ${service}:`, error)
      return { hasUpdate: false, incidents: [] }
    }
  }
}

/**
 * Simple RSS feed parser for status page incidents
 */
function parseRssFeed(
  xmlText: string,
  sinceDate?: Date
): Array<{
  title: string
  link: string
  pubDate: Date
  status: ServiceStatus
}> {
  const incidents = []

  // Parse <item> elements
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const item = match[1]

    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(item)
    const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(item)
    const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(item)

    if (titleMatch && linkMatch && pubDateMatch) {
      const title = decodeXmlEntities(titleMatch[1])
      const link = linkMatch[1]
      const pubDate = new Date(pubDateMatch[1])

      // Skip items older than sinceDate
      if (sinceDate && pubDate < sinceDate) {
        continue
      }

      // Determine status from title
      let status: ServiceStatus = 'unknown'
      if (title.toLowerCase().includes('resolved') || title.toLowerCase().includes('completed')) {
        status = 'operational'
      } else if (title.toLowerCase().includes('degraded') || title.toLowerCase().includes('partial')) {
        status = 'degraded'
      } else if (title.toLowerCase().includes('outage') || title.toLowerCase().includes('investigating')) {
        status = 'major_outage'
      } else if (title.toLowerCase().includes('maintenance')) {
        status = 'maintenance'
      }

      incidents.push({
        title,
        link,
        pubDate,
        status,
      })
    }
  }

  return incidents
}

/**
 * Decode XML entities in RSS content
 */
function decodeXmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
  }

  return text.replace(/&(?:amp|lt|gt|quot|apos);/g, (match) => entities[match] || match)
}
