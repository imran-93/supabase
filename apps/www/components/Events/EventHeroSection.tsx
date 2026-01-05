import Link from 'next/link'
import { Button } from 'ui'
import SectionContainer from '~/components/Layouts/SectionContainer'
import type { HeroSection, CTAButton } from '~/lib/events/event-schema'

interface EventHeroSectionProps {
  hero: HeroSection
  eventTitle: string
}

const CTAButtonComponent = ({ cta, variant }: { cta: CTAButton; variant?: 'primary' | 'secondary' | 'outline' }) => {
  const buttonType = variant === 'primary' ? 'primary' : variant === 'outline' ? 'outline' : 'default'
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

const EventHeroSection = ({ hero, eventTitle }: EventHeroSectionProps) => {
  const { headline, subheadline, description, backgroundImage, primaryCta, secondaryCta } = hero

  return (
    <div
      className="relative -mt-[65px] overflow-hidden"
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {backgroundImage && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      )}
      <SectionContainer className="pt-8 md:pt-16 relative z-10">
        <div className="mx-auto max-w-4xl pt-[90px] lg:pt-[120px] lg:min-h-[400px] flex flex-col items-center justify-center text-center gap-6">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-foreground text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              <span className="block text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground-light">
                {headline}
              </span>
            </h1>

            {subheadline && (
              <h2 className="text-transparent bg-clip-text bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 text-2xl sm:text-3xl lg:text-4xl font-semibold">
                {subheadline}
              </h2>
            )}

            {description && (
              <p className="text-foreground-light mt-4 text-base sm:text-lg lg:text-xl max-w-2xl">
                {description}
              </p>
            )}
          </div>

          {(primaryCta || secondaryCta) && (
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
              {primaryCta && (
                <CTAButtonComponent cta={primaryCta} variant="primary" />
              )}
              {secondaryCta && (
                <CTAButtonComponent cta={secondaryCta} variant="outline" />
              )}
            </div>
          )}
        </div>
      </SectionContainer>
    </div>
  )
}

export default EventHeroSection
