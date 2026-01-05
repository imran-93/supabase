import { CalendarIcon, ClockIcon, MapPinIcon, UserGroupIcon } from '@heroicons/react/outline'
import SectionContainer from '~/components/Layouts/SectionContainer'
import type { EventDetails, Speaker } from '~/lib/events/event-schema'

interface EventDetailsSectionProps {
  details: EventDetails
  id?: string
}

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const formatTime = (time: string, endTime?: string, timezone?: string): string => {
  let timeStr = time
  if (endTime) {
    timeStr = `${time} - ${endTime}`
  }
  if (timezone) {
    timeStr += ` (${timezone.replace('_', ' ')})`
  }
  return timeStr
}

const formatEventType = (format: string): string => {
  const formats: Record<string, string> = {
    webinar: 'Live Webinar',
    workshop: 'Workshop',
    conference: 'Conference',
    meetup: 'Meetup',
    online: 'Online Event',
    'in-person': 'In-Person Event',
    hybrid: 'Hybrid Event',
  }
  return formats[format] || format
}

const SpeakerCard = ({ speaker }: { speaker: Speaker }) => (
  <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-100 border border-default">
    {speaker.image ? (
      <img
        src={speaker.image}
        alt={speaker.name}
        className="w-16 h-16 rounded-full object-cover"
      />
    ) : (
      <div className="w-16 h-16 rounded-full bg-surface-200 flex items-center justify-center">
        <UserGroupIcon className="w-8 h-8 text-foreground-muted" />
      </div>
    )}
    <div>
      <h4 className="text-foreground font-semibold">{speaker.name}</h4>
      {(speaker.title || speaker.company) && (
        <p className="text-foreground-light text-sm">
          {speaker.title}
          {speaker.title && speaker.company && ' at '}
          {speaker.company}
        </p>
      )}
    </div>
  </div>
)

const EventDetailsSection = ({ details, id = 'details' }: EventDetailsSectionProps) => {
  const { date, time, endTime, timezone, format, duration, location, speakers } = details

  return (
    <SectionContainer id={id} className="scroll-mt-[66px]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-foreground text-2xl sm:text-3xl font-bold mb-8 text-center">
          Event Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Date */}
          <div className="flex items-start gap-4 p-6 rounded-xl bg-surface-100 border border-default">
            <div className="p-3 rounded-lg bg-brand-500/10">
              <CalendarIcon className="w-6 h-6 text-brand-500" />
            </div>
            <div>
              <h3 className="text-foreground-light text-sm font-medium uppercase tracking-wide mb-1">
                Date
              </h3>
              <p className="text-foreground font-semibold">
                {formatDate(date)}
              </p>
            </div>
          </div>

          {/* Time */}
          {time && (
            <div className="flex items-start gap-4 p-6 rounded-xl bg-surface-100 border border-default">
              <div className="p-3 rounded-lg bg-brand-500/10">
                <ClockIcon className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-foreground-light text-sm font-medium uppercase tracking-wide mb-1">
                  Time
                </h3>
                <p className="text-foreground font-semibold">
                  {formatTime(time, endTime, timezone)}
                </p>
                {duration && (
                  <p className="text-foreground-light text-sm mt-1">
                    Duration: {duration}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Format */}
          {format && (
            <div className="flex items-start gap-4 p-6 rounded-xl bg-surface-100 border border-default">
              <div className="p-3 rounded-lg bg-brand-500/10">
                <UserGroupIcon className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-foreground-light text-sm font-medium uppercase tracking-wide mb-1">
                  Format
                </h3>
                <p className="text-foreground font-semibold">
                  {formatEventType(format)}
                </p>
              </div>
            </div>
          )}

          {/* Location */}
          {location && (
            <div className="flex items-start gap-4 p-6 rounded-xl bg-surface-100 border border-default">
              <div className="p-3 rounded-lg bg-brand-500/10">
                <MapPinIcon className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-foreground-light text-sm font-medium uppercase tracking-wide mb-1">
                  Location
                </h3>
                <p className="text-foreground font-semibold">
                  {location}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Speakers */}
        {speakers && speakers.length > 0 && (
          <div className="mt-12">
            <h3 className="text-foreground text-xl font-bold mb-6 text-center">
              {speakers.length === 1 ? 'Your Host' : 'Speakers'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {speakers.map((speaker, index) => (
                <SpeakerCard key={`speaker-${index}`} speaker={speaker} />
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionContainer>
  )
}

export default EventDetailsSection
