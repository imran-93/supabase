import { Button } from 'ui'
import SectionContainer from '~/components/Layouts/SectionContainer'
import type { RegistrationForm } from '~/lib/events/event-schema'

interface EventRegistrationSectionProps {
  registration: RegistrationForm
  id?: string
}

const EventRegistrationSection = ({ registration, id = 'register' }: EventRegistrationSectionProps) => {
  const {
    enabled = true,
    heading = 'Register Now',
    subheading,
    submitButtonText = 'Register',
    redirectUrl,
    embedUrl,
  } = registration

  if (!enabled) return null

  // If there's a redirect URL, show a button that links to it
  if (redirectUrl) {
    return (
      <SectionContainer id={id} className="scroll-mt-[66px]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-8 md:p-12 rounded-2xl bg-surface-100 border border-default">
            <h2 className="text-foreground text-2xl sm:text-3xl font-bold mb-4">
              {heading}
            </h2>
            {subheading && (
              <p className="text-foreground-light text-lg mb-8">
                {subheading}
              </p>
            )}
            <Button asChild size="xlarge" className="text-white">
              <a href={redirectUrl} target="_blank" rel="noopener noreferrer">
                {submitButtonText}
              </a>
            </Button>
          </div>
        </div>
      </SectionContainer>
    )
  }

  // If there's an embed URL, show the embedded form
  if (embedUrl) {
    return (
      <SectionContainer id={id} className="scroll-mt-[66px]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-foreground text-2xl sm:text-3xl font-bold mb-4">
              {heading}
            </h2>
            {subheading && (
              <p className="text-foreground-light text-lg">
                {subheading}
              </p>
            )}
          </div>
          <div className="rounded-xl overflow-hidden border border-default bg-white">
            <iframe
              src={embedUrl}
              className="w-full min-h-[600px]"
              frameBorder="0"
              title="Registration form"
            />
          </div>
        </div>
      </SectionContainer>
    )
  }

  // Default: show a placeholder for custom form handling
  return (
    <SectionContainer id={id} className="scroll-mt-[66px]">
      <div className="max-w-2xl mx-auto text-center">
        <div className="p-8 md:p-12 rounded-2xl bg-surface-100 border border-default">
          <h2 className="text-foreground text-2xl sm:text-3xl font-bold mb-4">
            {heading}
          </h2>
          {subheading && (
            <p className="text-foreground-light text-lg mb-8">
              {subheading}
            </p>
          )}
          <p className="text-foreground-muted">
            Registration form coming soon
          </p>
        </div>
      </div>
    </SectionContainer>
  )
}

export default EventRegistrationSection
