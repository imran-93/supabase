'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { useTelemetryProps } from 'common/hooks/useTelemetryProps'
import Telemetry from '~/lib/telemetry'
import type { UTMTracking } from '~/lib/events/event-schema'

interface EventPageTrackerProps {
  slug: string
  title: string
  utmTracking?: UTMTracking
}

interface UTMParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
}

/**
 * Extracts UTM parameters from URL query string
 */
const extractUTMParams = (query: Record<string, string | string[] | undefined>): UTMParams => {
  return {
    utm_source: typeof query.utm_source === 'string' ? query.utm_source : undefined,
    utm_medium: typeof query.utm_medium === 'string' ? query.utm_medium : undefined,
    utm_campaign: typeof query.utm_campaign === 'string' ? query.utm_campaign : undefined,
    utm_term: typeof query.utm_term === 'string' ? query.utm_term : undefined,
    utm_content: typeof query.utm_content === 'string' ? query.utm_content : undefined,
  }
}

/**
 * Merges URL UTM params with default tracking config
 */
const mergeUTMParams = (
  urlParams: UTMParams,
  defaults?: UTMTracking
): UTMParams => {
  return {
    utm_source: urlParams.utm_source || defaults?.defaultSource,
    utm_medium: urlParams.utm_medium || defaults?.defaultMedium,
    utm_campaign: urlParams.utm_campaign || defaults?.defaultCampaign,
    utm_term: urlParams.utm_term || defaults?.defaultTerm,
    utm_content: urlParams.utm_content || defaults?.defaultContent,
  }
}

/**
 * EventPageTracker Component
 * Tracks event page views with UTM parameters
 *
 * This component should be placed in the event page and will:
 * - Track page view on mount
 * - Capture UTM parameters from URL
 * - Merge with default UTM tracking config
 * - Send telemetry event
 */
const EventPageTracker = ({ slug, title, utmTracking }: EventPageTrackerProps) => {
  const router = useRouter()
  const telemetryProps = useTelemetryProps()
  const hasTracked = useRef(false)

  useEffect(() => {
    // Only track once per page load
    if (hasTracked.current) return
    if (!router.isReady) return

    hasTracked.current = true

    // Extract and merge UTM parameters
    const urlUTMParams = extractUTMParams(router.query)
    const mergedUTMParams = mergeUTMParams(urlUTMParams, utmTracking)

    // Build tracking label with UTM info
    const utmLabel = Object.entries(mergedUTMParams)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    // Send event page view telemetry
    Telemetry.sendEvent(
      {
        category: 'event_page',
        action: 'page_view',
        label: slug,
        value: utmLabel || undefined,
      },
      telemetryProps,
      router
    )

    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[EventPageTracker] Page view tracked:', {
        slug,
        title,
        utmParams: mergedUTMParams,
        referrer: document?.referrer,
      })
    }
  }, [router.isReady, router.query, slug, title, utmTracking, telemetryProps, router])

  // This component doesn't render anything
  return null
}

export default EventPageTracker
