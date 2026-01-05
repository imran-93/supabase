import { z } from 'zod'

/**
 * CTA Button Schema
 * Represents a call-to-action button with text and link
 */
const CTAButtonSchema = z.object({
  text: z.string().min(1, 'CTA text is required'),
  href: z.string().url('CTA href must be a valid URL'),
  variant: z.enum(['primary', 'secondary', 'outline']).optional().default('primary'),
})

/**
 * Hero Section Schema
 * The main hero section at the top of the event page
 */
const HeroSectionSchema = z.object({
  headline: z.string().min(1, 'Headline is required'),
  subheadline: z.string().optional(),
  description: z.string().optional(),
  backgroundImage: z.string().optional(),
  primaryCta: CTAButtonSchema.optional(),
  secondaryCta: CTAButtonSchema.optional(),
})

/**
 * Speaker Schema
 * Information about event speakers/hosts
 */
const SpeakerSchema = z.object({
  name: z.string().min(1, 'Speaker name is required'),
  title: z.string().optional(),
  company: z.string().optional(),
  image: z.string().optional(),
  bio: z.string().optional(),
})

/**
 * Event Details Schema
 * Core event information like date, time, format
 */
const EventDetailsSchema = z.object({
  date: z.string().min(1, 'Event date is required'), // ISO date string
  time: z.string().optional(), // e.g., "14:00"
  endTime: z.string().optional(), // e.g., "15:00"
  timezone: z.string().optional().default('America/New_York'),
  format: z.enum(['webinar', 'workshop', 'conference', 'meetup', 'online', 'in-person', 'hybrid']).optional().default('webinar'),
  duration: z.string().optional(), // e.g., "60 minutes"
  location: z.string().optional(), // For in-person/hybrid events
  speakers: z.array(SpeakerSchema).optional(),
})

/**
 * Content Section Item Schema
 * Individual items within a content section (e.g., agenda items)
 */
const ContentItemSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
})

/**
 * Content Section Schema
 * Flexible content blocks for the page body
 */
const ContentSectionSchema = z.object({
  id: z.string().min(1, 'Section ID is required'),
  type: z.enum(['agenda', 'features', 'benefits', 'faq', 'custom']).optional().default('custom'),
  header: z.string().optional(),
  subheader: z.string().optional(),
  items: z.array(z.union([z.string(), ContentItemSchema])).optional(),
  content: z.string().optional(), // For custom HTML/markdown content
})

/**
 * Registration Form Field Schema
 * Custom form fields for registration
 */
const FormFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'email', 'tel', 'select', 'textarea']).default('text'),
  required: z.boolean().optional().default(false),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(), // For select fields
})

/**
 * Registration Form Schema
 * Optional registration/signup form configuration
 */
const RegistrationFormSchema = z.object({
  enabled: z.boolean().default(true),
  heading: z.string().optional().default('Register Now'),
  subheading: z.string().optional(),
  submitButtonText: z.string().optional().default('Register'),
  redirectUrl: z.string().optional(), // External form URL (e.g., Calendly, Typeform)
  embedUrl: z.string().optional(), // Embed URL for iframes
  fields: z.array(FormFieldSchema).optional(),
  successMessage: z.string().optional().default('Thank you for registering!'),
})

/**
 * UTM Tracking Schema
 * Default UTM parameters for the event page
 */
const UTMTrackingSchema = z.object({
  defaultSource: z.string().optional(),
  defaultMedium: z.string().optional(),
  defaultCampaign: z.string().optional(),
  defaultTerm: z.string().optional(),
  defaultContent: z.string().optional(),
})

/**
 * SEO/Meta Schema
 * SEO and social sharing configuration
 */
const SEOSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  ogImage: z.string().optional(),
  noIndex: z.boolean().optional().default(false),
})

/**
 * CTA Section Schema
 * Call-to-action section configuration
 */
const CTASectionSchema = z.object({
  enabled: z.boolean().default(true),
  heading: z.string().optional(),
  subheading: z.string().optional(),
  primaryCta: CTAButtonSchema.optional(),
  secondaryCta: CTAButtonSchema.optional(),
})

/**
 * Video Section Schema
 * Video embed configuration
 */
const VideoSectionSchema = z.object({
  enabled: z.boolean().default(true),
  heading: z.string().optional(),
  videoUrl: z.string().optional(), // YouTube, Vimeo, or direct video URL
  embedCode: z.string().optional(), // Custom embed code
  thumbnailUrl: z.string().optional(),
})

/**
 * Main Event Configuration Schema
 * The complete event page configuration
 */
export const EventConfigSchema = z.object({
  // Required fields
  slug: z.string().min(1, 'Event slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  title: z.string().min(1, 'Event title is required'),

  // Page sections
  hero: HeroSectionSchema,
  eventDetails: EventDetailsSchema.optional(),
  video: VideoSectionSchema.optional(),
  contentSections: z.array(ContentSectionSchema).optional(),
  registration: RegistrationFormSchema.optional(),
  ctaSection: CTASectionSchema.optional(),

  // Tracking & SEO
  utmTracking: UTMTrackingSchema.optional(),
  seo: SEOSchema.optional(),

  // Layout options
  hideNav: z.boolean().optional().default(false),
  hideFooter: z.boolean().optional().default(false),
  darkMode: z.boolean().optional().default(true),

  // Status
  isPublished: z.boolean().optional().default(true),
  publishedAt: z.string().optional(),
})

/**
 * Type exports for TypeScript usage
 */
export type EventConfig = z.infer<typeof EventConfigSchema>
export type HeroSection = z.infer<typeof HeroSectionSchema>
export type EventDetails = z.infer<typeof EventDetailsSchema>
export type ContentSection = z.infer<typeof ContentSectionSchema>
export type RegistrationForm = z.infer<typeof RegistrationFormSchema>
export type CTAButton = z.infer<typeof CTAButtonSchema>
export type Speaker = z.infer<typeof SpeakerSchema>
export type VideoSection = z.infer<typeof VideoSectionSchema>
export type UTMTracking = z.infer<typeof UTMTrackingSchema>
export type SEOConfig = z.infer<typeof SEOSchema>

/**
 * Validate event configuration
 * @param config - Raw configuration object
 * @returns Validated EventConfig or throws ZodError
 */
export function validateEventConfig(config: unknown): EventConfig {
  return EventConfigSchema.parse(config)
}

/**
 * Safe validation that returns result object
 * @param config - Raw configuration object
 * @returns Object with success boolean and data or error
 */
export function safeValidateEventConfig(config: unknown) {
  return EventConfigSchema.safeParse(config)
}
