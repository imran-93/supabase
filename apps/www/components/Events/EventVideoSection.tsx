import SectionContainer from '~/components/Layouts/SectionContainer'
import type { VideoSection } from '~/lib/events/event-schema'

interface EventVideoSectionProps {
  video: VideoSection
  id?: string
}

const getVideoEmbedUrl = (url: string): string | null => {
  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  // Return original URL if it's already an embed URL or unknown format
  if (url.includes('embed') || url.includes('player')) {
    return url
  }

  return null
}

const EventVideoSection = ({ video, id = 'video' }: EventVideoSectionProps) => {
  const { enabled = true, heading, videoUrl, embedCode, thumbnailUrl } = video

  if (!enabled) return null

  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null

  return (
    <SectionContainer id={id} className="scroll-mt-[66px]">
      <div className="max-w-4xl mx-auto">
        {heading && (
          <h2 className="text-foreground text-2xl sm:text-3xl font-bold mb-8 text-center">
            {heading}
          </h2>
        )}

        <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-100 border border-default shadow-lg">
          {embedCode ? (
            <div
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: embedCode }}
            />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={heading || 'Event video'}
            />
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={heading || 'Video thumbnail'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-foreground-muted">Video coming soon</p>
            </div>
          )}
        </div>
      </div>
    </SectionContainer>
  )
}

export default EventVideoSection
