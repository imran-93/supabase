/**
 * Status Banner Component
 *
 * Displays the current health status of external services to users.
 * Shows alerts when services are down or degraded.
 *
 * Features:
 * - Real-time status updates via health monitor
 * - Color-coded status indicators
 * - Collapsible service details
 * - Links to service status pages
 * - Dismissible alerts with localStorage persistence
 */

'use client'

import React, { useEffect, useState } from 'react'
import type { HealthCheckResult, ServiceHealthCheck, ServiceKey } from '@/lib/services/health-monitor'
import { getHealthMonitor, SERVICES } from '@/lib/services/health-monitor'

interface StatusBannerProps {
  /**
   * Only show banner if critical services are down
   */
  criticalOnly?: boolean

  /**
   * Custom message to display
   */
  message?: string

  /**
   * Callback when status changes
   */
  onStatusChange?: (status: HealthCheckResult) => void

  /**
   * Auto-dismiss after this many milliseconds (0 = no auto-dismiss)
   */
  autoDismissMs?: number

  /**
   * Position on screen
   */
  position?: 'top' | 'bottom'
}

type StatusIconProps = {
  status: string
}

const StatusIcon: React.FC<StatusIconProps> = ({ status }) => {
  const iconMap = {
    healthy: '✅',
    degraded: '⚠️',
    down: '🚨',
    unknown: '❓',
  }
  return <span className="mr-2">{iconMap[status as keyof typeof iconMap] || '?'}</span>
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorMap = {
    healthy: 'bg-green-100 text-green-800 border-green-300',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    down: 'bg-red-100 text-red-800 border-red-300',
    unknown: 'bg-gray-100 text-gray-800 border-gray-300',
  }

  const statusLabels = {
    healthy: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
    unknown: 'Unknown',
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium border ${
        colorMap[status as keyof typeof colorMap]
      }`}
    >
      <StatusIcon status={status} />
      {statusLabels[status as keyof typeof statusLabels]}
    </span>
  )
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  criticalOnly = false,
  message,
  onStatusChange,
  autoDismissMs = 0,
  position = 'top',
}) => {
  const [status, setStatus] = useState<HealthCheckResult>({})
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for dismissed state
    const dismissed = localStorage.getItem('status-banner-dismissed')
    if (dismissed) {
      setIsDismissed(true)
    }

    const monitor = getHealthMonitor()
    const initialStatus = monitor.getStatus()
    setStatus(initialStatus)
    setLoading(false)

    // Subscribe to status changes
    const handleStatusChange = () => {
      const newStatus = monitor.getStatus()
      setStatus(newStatus)
      onStatusChange?.(newStatus)

      // Auto-dismiss after specified time
      if (autoDismissMs > 0) {
        setTimeout(() => {
          setIsDismissed(true)
          localStorage.setItem('status-banner-dismissed', 'true')
        }, autoDismissMs)
      }
    }

    // Check every 30 seconds for status changes
    const interval = setInterval(handleStatusChange, 30000)

    return () => clearInterval(interval)
  }, [onStatusChange, autoDismissMs])

  // Filter services based on criteria
  const affectedServices = Object.values(status).filter((s) => {
    if (criticalOnly) {
      return SERVICES[s.serviceKey as ServiceKey].priority === 'critical' && s.status !== 'healthy'
    }
    return s.status !== 'healthy'
  })

  // Don't show banner if all services healthy or dismissed
  if (isDismissed || affectedServices.length === 0 || loading) {
    return null
  }

  const containerClass = `fixed ${position}-0 left-0 right-0 z-50 ${
    position === 'top' ? 'border-b' : 'border-t'
  } bg-white shadow-lg`

  const bannerClass = `mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8`

  return (
    <div className={containerClass}>
      <div className={bannerClass}>
        {/* Main alert bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-shrink-0">
              <span className="text-2xl">🚨</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">
                {message || `${affectedServices.length} service${affectedServices.length > 1 ? 's' : ''} impacted`}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {affectedServices.map((s) => s.serviceName).join(', ')} experiencing issues
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 rounded border border-blue-200 transition-colors"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? 'Hide' : 'Details'}
            </button>

            <button
              onClick={() => {
                setIsDismissed(true)
                localStorage.setItem('status-banner-dismissed', 'true')
              }}
              className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 rounded border border-gray-200 transition-colors"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Expandable details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {affectedServices.map((service) => (
                <ServiceStatusCard
                  key={service.serviceKey}
                  service={service}
                  serviceConfig={SERVICES[service.serviceKey as ServiceKey]}
                />
              ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-gray-700">
              <strong>What you can do:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check the status page for updates on the incident</li>
                <li>Enable offline mode if available in your settings</li>
                <li>Contact support if you experience issues</li>
                <li>Follow us on social media for real-time updates</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Individual service status card in the expandable details
 */
const ServiceStatusCard: React.FC<{
  service: ServiceHealthCheck
  serviceConfig: (typeof SERVICES)[keyof typeof SERVICES]
}> = ({ service, serviceConfig }) => {
  const statusColors = {
    healthy: 'text-green-700',
    degraded: 'text-yellow-700',
    down: 'text-red-700',
    unknown: 'text-gray-700',
  }

  const downtimeDuration = service.downtime
    ? `${Math.floor((new Date().getTime() - service.downtime.startTime.getTime()) / 60000)} minutes`
    : 'N/A'

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-900">{service.serviceName}</h4>
        <StatusBadge status={service.status} />
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div>
          <strong>Last Check:</strong>{' '}
          {service.lastCheckTime.toLocaleTimeString()}
        </div>
        {service.status !== 'healthy' && (
          <>
            <div>
              <strong>Downtime:</strong> {downtimeDuration}
            </div>
            {service.message && (
              <div>
                <strong>Details:</strong> {service.message}
              </div>
            )}
          </>
        )}
      </div>

      <a
        href={serviceConfig.statusPageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800 underline"
      >
        View Status Page →
      </a>
    </div>
  )
}

/**
 * Simplified status indicator component (for embedding in headers, etc)
 */
export const StatusIndicator: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const [status, setStatus] = useState<HealthCheckResult>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const monitor = getHealthMonitor()
    const initialStatus = monitor.getStatus()
    setStatus(initialStatus)
    setLoading(false)

    const interval = setInterval(() => {
      setStatus(monitor.getStatus())
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <span className="text-gray-400">Loading...</span>
  }

  const statusSummary = Object.values(status)
  const hasDown = statusSummary.some((s) => s.status === 'down')
  const hasDegraded = statusSummary.some((s) => s.status === 'degraded')

  const sizeMap = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  if (hasDown) {
    return (
      <div className="flex items-center gap-2">
        <span className={sizeMap[size]}>🚨</span>
        <span className="text-red-600 font-semibold">Service Issues</span>
      </div>
    )
  }

  if (hasDegraded) {
    return (
      <div className="flex items-center gap-2">
        <span className={sizeMap[size]}>⚠️</span>
        <span className="text-yellow-600 font-semibold">Degraded Performance</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className={sizeMap[size]}>✅</span>
      <span className="text-green-600 font-semibold">All Systems Operational</span>
    </div>
  )
}
