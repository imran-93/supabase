import { CheckCircleIcon, LightBulbIcon, QuestionMarkCircleIcon } from '@heroicons/react/outline'
import SectionContainer from '~/components/Layouts/SectionContainer'
import type { ContentSection } from '~/lib/events/event-schema'

interface EventContentSectionProps {
  section: ContentSection
}

const getIcon = (type: string, index: number) => {
  switch (type) {
    case 'agenda':
      return <span className="text-brand-500 font-bold">{index + 1}</span>
    case 'features':
    case 'benefits':
      return <CheckCircleIcon className="w-5 h-5 text-brand-500" />
    case 'faq':
      return <QuestionMarkCircleIcon className="w-5 h-5 text-brand-500" />
    default:
      return <LightBulbIcon className="w-5 h-5 text-brand-500" />
  }
}

const EventContentSection = ({ section }: EventContentSectionProps) => {
  const { id, type = 'custom', header, subheader, items, content } = section

  return (
    <SectionContainer id={id} className="scroll-mt-[66px]">
      <div className="max-w-4xl mx-auto">
        {header && (
          <div className="text-center mb-10">
            <h2 className="text-foreground text-2xl sm:text-3xl font-bold mb-3">
              {header}
            </h2>
            {subheader && (
              <p className="text-foreground-light text-lg max-w-2xl mx-auto">
                {subheader}
              </p>
            )}
          </div>
        )}

        {/* Custom HTML/Markdown content */}
        {content && (
          <div
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}

        {/* Item list */}
        {items && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item, index) => {
              const isString = typeof item === 'string'
              const title = isString ? item : item.title
              const description = isString ? undefined : item.description

              return (
                <div
                  key={`${id}-item-${index}`}
                  className="flex items-start gap-4 p-6 rounded-xl bg-surface-100 border border-default hover:border-brand-500/50 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-brand-500/10">
                    {getIcon(type, index)}
                  </div>
                  <div className="flex-1">
                    {title && (
                      <h3 className="text-foreground font-semibold text-lg">
                        {title}
                      </h3>
                    )}
                    {description && (
                      <p className="text-foreground-light mt-1">
                        {description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SectionContainer>
  )
}

export default EventContentSection
