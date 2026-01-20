import { EventManager, type Event } from './lib/event-manager.ts';
import { generateCombinedConnpassText } from './lib/connpass-text-generator.ts';
import { parseISODateTime } from './lib/date-utils.ts';
import { parseEventNumberArg } from './lib/arg-parser.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const CONNPASS_DIR = './tmp/connpass';

async function main() {
  const event = parseEventNumberArg();

  console.log(`[INFO] Generating connpass texts for event #${event}...\n`);

  // 1. Load event data
  const eventManager = new EventManager();

  let eventData: Event;
  try {
    eventData = await eventManager.loadEvent(event);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  // 2. Get environment variables
  const zoomUrl = process.env.ESSPEC_ZOOM_URL;
  const discordUrl = process.env.ESSPEC_DISCORD_URL;

  if (!zoomUrl) {
    console.error('[ERROR] Environment variable ESSPEC_ZOOM_URL is not set\n');
    console.error('Please set it using:');
    console.error('  export ESSPEC_ZOOM_URL="https://zoom.us/j/..."\n');
    process.exit(1);
  }

  if (!discordUrl) {
    console.error('[ERROR] Environment variable ESSPEC_DISCORD_URL is not set\n');
    console.error('Please set it using:');
    console.error('  export ESSPEC_DISCORD_URL="https://discord.gg/..."\n');
    process.exit(1);
  }

  // 3. Extract start time from eventDateTime
  const startTime = parseISODateTime(eventData.eventDateTime);

  // 4. Generate combined template
  const combinedContent = generateCombinedConnpassText(
    eventData,
    startTime,
    zoomUrl,
    discordUrl
  );

  // 5. Create output directory if it doesn't exist
  if (!existsSync(CONNPASS_DIR)) {
    await mkdir(CONNPASS_DIR, { recursive: true });
  }

  // 6. Write file
  const outputPath = join(CONNPASS_DIR, `event-${event}-connpass.md`);

  try {
    await writeFile(outputPath, combinedContent, 'utf-8');

    console.log('[SUCCESS] Connpass template generated successfully!\n');
    console.log('[INFO] Generated file:');
    console.log(`  - ${outputPath}\n`);

    if (!eventData.youtubeUrl) {
      console.warn(
        '[WARN] YouTube URL is not set for this event. Some templates may contain placeholders.\n'
      );
    }
  } catch (error) {
    console.error(`[ERROR] Failed to write file: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
