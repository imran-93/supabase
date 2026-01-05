import Link from 'next/link'
import { Button } from 'ui'
import type { CTAButton } from '~/lib/events/event-schema'

interface CTASectionConfig {
  enabled?: boolean
  heading?: string
  subheading?: string
  primaryCta?: CTAButton
  secondaryCta?: CTAButton
}

interface EventCTASectionProps {
  cta: CTASectionConfig
  className?: string
}

const CTAButtonComponent = ({ cta, variant }: { cta: CTAButton; variant?: 'primary' | 'secondary' }) => {
  const buttonType = variant === 'primary' ? 'primary' : 'default'
  const isExternal = cta.href.startsWith('http')

  if (isExternal) {
    return (
      <Button asChild size="large" type={buttonType} className={variant === 'primary' ? 'text-white' : ''}>
        <a href={cta.href} target="_blank" rel="noopener noreferrer">
          {cta.text}
        </a>
      </Button>
    )
  }

  return (
    <Button asChild size="large" type={buttonType} className={variant === 'primary' ? 'text-white' : ''}>
      <Link href={cta.href}>
        {cta.text}
      </Link>
    </Button>
  )
}

const EventCTASection = ({ cta, className = '' }: EventCTASectionProps) => {
  const { enabled = true, heading, subheading, primaryCta, secondaryCta } = cta

  if (!enabled) return null
  if (!primaryCta && !secondaryCta && !heading) return null

  return (
    <div
      className={`bg-alternative border-t border-default py-20 md:py-32 text-center px-6 ${className}`}
    >
      <div className="max-w-3xl mx-auto">
        {heading && (
          <h2 className="text-foreground text-2xl sm:text-3xl lg:text-4xl font-bold mb-4">
            {heading}
          </h2>
        )}
        {subheading && (
          <p className="text-foreground-light text-lg mb-8">
            {subheading}
          </p>
        )}
        {(primaryCta || secondaryCta) && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {primaryCta && (
              <CTAButtonComponent cta={primaryCta} variant="primary" />
            )}
            {secondaryCta && (
              <CTAButtonComponent cta={secondaryCta} variant="secondary" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default EventCTASection
