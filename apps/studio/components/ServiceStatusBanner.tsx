/**
 * Service Status Banner Component
 * Displays real-time service status alerts to users
 * Auto-dismisses after 30 minutes or when service recovers
 */

import React, { useState, useEffect } from 'react'
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { ServiceName, ServiceStatus } from '@/lib/services/health-check/types'

interface ServiceStatusBannerProps {
  service: ServiceName
  status: ServiceStatus
  message: string
  statusPageUrl: string
  onDismiss?: () => void
  autoHideAfterMs?: number
}

const STATUS_CONFIG = {
  operational: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: 'text-green-600',
    label: 'Operational',
  },
  degraded: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-900',
    icon: 'text-yellow-600',
    label: 'Degraded Performance',
  },
  major_outage: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: 'text-red-600',
    label: 'Service Outage',
  },
  maintenance: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: 'text-blue-600',
    label: 'Scheduled Maintenance',
  },
  unknown: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-900',
    icon: 'text-gray-600',
    label: 'Status Unknown',
  },
}

const SERVICE_DISPLAY_NAMES: Record<ServiceName, string> = {
  supabase: 'Supabase',
  nylas: 'Nylas',
  vercel: 'Vercel',
  inngest: 'Inngest',
  upstash: 'Upstash Redis',
}

/**
 * Service Status Banner - displays as a fixed alert at top of screen
 */
export const ServiceStatusBanner: React.FC<ServiceStatusBannerProps> = ({
  service,
  status,
  message,
  statusPageUrl,
  onDismiss,
  autoHideAfterMs = 30 * 60 * 1000, // 30 minutes
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const config = STATUS_CONFIG[status]
  const serviceName = SERVICE_DISPLAY_NAMES[service]

  // Auto-hide after timeout
  useEffect(() => {
    if (autoHideAfterMs && isVisible) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, autoHideAfterMs)

      return () => clearTimeout(timer)
    }
  }, [autoHideAfterMs, isVisible])

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) {
    return null
  }

  const getIcon = () => {
    switch (status) {
      case 'operational':
        return <Info className={`w-5 h-5 ${config.icon}`} />
      case 'degraded':
        return <AlertTriangle className={`w-5 h-5 ${config.icon}`} />
      case 'major_outage':
        return <AlertCircle className={`w-5 h-5 ${config.icon}`} />
      case 'maintenance':
        return <Info className={`w-5 h-5 ${config.icon}`} />
      default:
        return <Info className={`w-5 h-5 ${config.icon}`} />
    }
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 border-b ${config.bg} ${config.border} ${config.text}`}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">
            {serviceName} - {config.label}
          </h3>
          <p className="text-sm mt-1 opacity-90">{message}</p>

          <div className="mt-2 flex items-center gap-3">
            <a
              href={statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline hover:opacity-75 transition-opacity"
            >
              View Status Page →
            </a>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 mt-0.5 hover:opacity-75 transition-opacity"
          aria-label="Dismiss alert"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

/**
 * Multi-service Status Banner Container
 * Displays multiple service status alerts if multiple services are affected
 */
interface MultiServiceBannerProps {
  statuses: Array<{
    service: ServiceName
    status: ServiceStatus
    message: string
    statusPageUrl: string
  }>
  onDismiss?: (service: ServiceName) => void
}

export const MultiServiceStatusBanner: React.FC<MultiServiceBannerProps> = ({
  statuses,
  onDismiss,
}) => {
  const [dismissedServices, setDismissedServices] = useState<Set<ServiceName>>(new Set())

  const visibleStatuses = statuses.filter((s) => !dismissedServices.has(s.service))

  if (visibleStatuses.length === 0) {
    return null
  }

  const handleDismiss = (service: ServiceName) => {
    setDismissedServices((prev) => new Set(prev).add(service))
    onDismiss?.(service)
  }

  // Show only the most critical status if multiple issues
  const criticalStatus = visibleStatuses.reduce((prev, current) => {
    const severity = { major_outage: 3, degraded: 2, maintenance: 1, operational: 0, unknown: 0 }
    return severity[current.status] > severity[prev.status] ? current : prev
  })

  return (
    <ServiceStatusBanner
      service={criticalStatus.service}
      status={criticalStatus.status}
      message={
        visibleStatuses.length > 1
          ? `${criticalStatus.service} and ${visibleStatuses.length - 1} other service(s) experiencing issues. ${criticalStatus.message}`
          : criticalStatus.message
      }
      statusPageUrl={criticalStatus.statusPageUrl}
      onDismiss={() => handleDismiss(criticalStatus.service)}
    />
  )
}

/**
 * Inline Status Indicator (for use in headers, footers, etc.)
 */
interface StatusIndicatorProps {
  service: ServiceName
  status: ServiceStatus
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  service,
  status,
  size = 'md',
  showLabel = true,
}) => {
  const config = STATUS_CONFIG[status]
  const serviceName = SERVICE_DISPLAY_NAMES[service]

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`${sizeClasses[size]} rounded-full ${config.icon} bg-current opacity-20`} />
      {showLabel && (
        <span className={`text-xs ${config.text}`}>
          {serviceName}: {config.label}
        </span>
      )}
    </div>
  )
}
