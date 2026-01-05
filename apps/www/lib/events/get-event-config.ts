import fs from 'fs'
import path from 'path'
import { validateEventConfig, type EventConfig } from './event-schema'

const EVENTS_DATA_DIR = path.join(process.cwd(), 'data', 'events')

/**
 * Get all available event slugs for static path generation
 */
export function getAllEventSlugs(): string[] {
  try {
    if (!fs.existsSync(EVENTS_DATA_DIR)) {
      return []
    }

    const files = fs.readdirSync(EVENTS_DATA_DIR)
    return files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''))
  } catch (error) {
    console.error('Error reading event slugs:', error)
    return []
  }
}

/**
 * Load and validate event configuration by slug
 * @param slug - Event slug (without .json extension)
 * @returns Validated EventConfig or null if not found/invalid
 */
export function getEventConfig(slug: string): EventConfig | null {
  try {
    const filePath = path.join(EVENTS_DATA_DIR, `${slug}.json`)

    if (!fs.existsSync(filePath)) {
      console.warn(`Event config not found: ${filePath}`)
      return null
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const rawConfig = JSON.parse(fileContent)

    // Validate against schema
    const validatedConfig = validateEventConfig(rawConfig)

    // Check if event is published
    if (validatedConfig.isPublished === false) {
      console.warn(`Event not published: ${slug}`)
      return null
    }

    return validatedConfig
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Invalid JSON in event config: ${slug}`, error)
    } else if (error instanceof Error && error.name === 'ZodError') {
      console.error(`Schema validation failed for event: ${slug}`, error)
    } else {
      console.error(`Error loading event config: ${slug}`, error)
    }
    return null
  }
}

/**
 * Get all published event configurations
 */
export function getAllEventConfigs(): EventConfig[] {
  const slugs = getAllEventSlugs()
  return slugs
    .map((slug) => getEventConfig(slug))
    .filter((config): config is EventConfig => config !== null)
}
