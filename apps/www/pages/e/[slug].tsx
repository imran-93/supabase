import { GetStaticPaths, GetStaticProps } from 'next'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'

import DefaultLayout from '~/components/Layouts/Default'
import {
  EventHeroSection,
  EventDetailsSection,
  EventContentSection,
  EventVideoSection,
  EventRegistrationSection,
  EventCTASection,
  EventPageTracker,
} from '~/components/Events'

import { getEventConfig, getAllEventSlugs } from '~/lib/events/get-event-config'
import type { EventConfig } from '~/lib/events/event-schema'
import { BASE_URL } from '~/lib/constants'

interface EventPageProps {
  event: EventConfig
}

export default function EventPage({ event }: EventPageProps) {
  const router = useRouter()

  // Handle fallback state
  if (router.isFallback) {
    return (
      <DefaultLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-foreground-muted">Loading...</p>
        </div>
      </DefaultLayout>
    )
  }

  const {
    slug,
    title,
    hero,
    eventDetails,
    video,
    contentSections,
    registration,
    ctaSection,
    utmTracking,
    seo,
    hideNav,
    hideFooter,
  } = event

  // Build SEO metadata
  const pageTitle = seo?.title || title
  const pageDescription = seo?.description || hero.description || `Join us for ${title}`
  const ogImage = seo?.ogImage || `${BASE_URL}/images/og/og-image-v2.jpg`
  const pageUrl = `${BASE_URL}/e/${slug}`

  return (
    <>
      <NextSeo
        title={pageTitle}
        description={pageDescription}
        noindex={seo?.noIndex}
        openGraph={{
          title: pageTitle,
          description: pageDescription,
          url: pageUrl,
          images: [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        }}
        twitter={{
          cardType: 'summary_large_image',
        }}
      />

      {/* Analytics tracking */}
      <EventPageTracker
        slug={slug}
        title={title}
        utmTracking={utmTracking}
      />

      <DefaultLayout hideHeader={hideNav} hideFooter={hideFooter}>
        {/* Hero Section */}
        <EventHeroSection hero={hero} eventTitle={title} />

        {/* Video Section */}
        {video?.enabled && video && (
          <EventVideoSection video={video} />
        )}

        {/* Event Details */}
        {eventDetails && (
          <EventDetailsSection details={eventDetails} />
        )}

        {/* Content Sections */}
        {contentSections?.map((section) => (
          <EventContentSection key={section.id} section={section} />
        ))}

        {/* Registration Section */}
        {registration?.enabled && registration && (
          <EventRegistrationSection registration={registration} />
        )}

        {/* CTA Section */}
        {ctaSection?.enabled && ctaSection && (
          <EventCTASection cta={ctaSection} />
        )}
      </DefaultLayout>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllEventSlugs()

  return {
    paths: slugs.map((slug) => ({
      params: { slug },
    })),
    fallback: true, // Enable fallback for new events
  }
}

export const getStaticProps: GetStaticProps<EventPageProps> = async ({ params }) => {
  const slug = params?.slug as string

  if (!slug) {
    return { notFound: true }
  }

  const event = getEventConfig(slug)

  if (!event) {
    return { notFound: true }
  }

  return {
    props: {
      event,
    },
    // Revalidate every 5 minutes for quick updates
    revalidate: 300,
  }
}
