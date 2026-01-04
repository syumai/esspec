import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

const EVENTS_DIR = './events';

// Zod schema for event validation
export const EventSchema = z.object({
  eventNumber: z.number().int().positive(),
  eventName: z.string().min(1),
  readingRange: z.string().min(1),
  connpassUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
  scrapboxUrl: z.string().url(),
});

export type Event = z.infer<typeof EventSchema>;

// Schema for creating new events (without URLs)
export const CreateEventInputSchema = z.object({
  eventNumber: z.number().int().positive(),
  readingRange: z.string().min(1),
});

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;

export class EventManager {
  /**
   * Get the path to the events directory
   */
  getEventsDir(): string {
    return EVENTS_DIR;
  }

  /**
   * Get the path to a specific event file
   */
  getEventPath(eventNumber: number): string {
    return join(EVENTS_DIR, `event-${eventNumber}.yaml`);
  }

  /**
   * Check if an event file exists
   */
  eventExists(eventNumber: number): boolean {
    return existsSync(this.getEventPath(eventNumber));
  }

  /**
   * Generate event name from event number
   */
  generateEventName(eventNumber: number): string {
    return `ECMAScript 仕様輪読会 第${eventNumber}回`;
  }

  /**
   * Generate Scrapbox URL from event number
   */
  generateScrapboxUrl(eventNumber: number): string {
    const pageName = `ECMAScript仕様輪読会_#${eventNumber}`;
    const encodedPageName = encodeURIComponent(pageName);
    return `https://scrapbox.io/esspec/${encodedPageName}`;
  }

  /**
   * Create a new event with auto-generated fields
   */
  async createEvent(input: CreateEventInput): Promise<Event> {
    // Validate input
    const validatedInput = CreateEventInputSchema.parse(input);

    // Check if event already exists
    if (this.eventExists(validatedInput.eventNumber)) {
      throw new Error(
        `Event file already exists: ${this.getEventPath(validatedInput.eventNumber)}\n` +
          'Please use a different event number or delete the existing file.'
      );
    }

    // Create event object with auto-generated fields
    const event: Event = {
      eventNumber: validatedInput.eventNumber,
      eventName: this.generateEventName(validatedInput.eventNumber),
      readingRange: validatedInput.readingRange,
      scrapboxUrl: this.generateScrapboxUrl(validatedInput.eventNumber),
      // Optional fields remain undefined
    };

    // Validate complete event
    const validatedEvent = EventSchema.parse(event);

    // Ensure events directory exists
    if (!existsSync(EVENTS_DIR)) {
      await mkdir(EVENTS_DIR, { recursive: true });
    }

    // Write event to YAML file
    await this.saveEvent(validatedEvent);

    return validatedEvent;
  }

  /**
   * Save event to YAML file
   */
  private async saveEvent(event: Event): Promise<void> {
    const eventPath = this.getEventPath(event.eventNumber);

    // Convert to YAML with proper formatting
    const yamlContent = yaml.dump(event, {
      indent: 2,
      lineWidth: -1, // Don't wrap lines
      noRefs: true,
      sortKeys: false, // Maintain key order
    });

    await writeFile(eventPath, yamlContent, 'utf-8');
  }

  /**
   * Load event from YAML file
   */
  async loadEvent(eventNumber: number): Promise<Event> {
    const eventPath = this.getEventPath(eventNumber);

    if (!existsSync(eventPath)) {
      throw new Error(
        `Event file not found: ${eventPath}\n` +
          `Please create event #${eventNumber} first using:\n` +
          `  pnpm run create-event ${eventNumber}`
      );
    }

    const yamlContent = await readFile(eventPath, 'utf-8');
    const data = yaml.load(yamlContent);

    // Validate and return
    return EventSchema.parse(data);
  }

  /**
   * Update event with new fields (for future commands)
   */
  async updateEvent(
    eventNumber: number,
    updates: Partial<Omit<Event, 'eventNumber'>>
  ): Promise<Event> {
    const event = await this.loadEvent(eventNumber);
    const updatedEvent = { ...event, ...updates };
    const validatedEvent = EventSchema.parse(updatedEvent);
    await this.saveEvent(validatedEvent);
    return validatedEvent;
  }
}
