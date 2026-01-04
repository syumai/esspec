import { EventManager, type Event } from './lib/event-manager.ts';
import {
  generateEventBody,
  generateParticipantInfo,
  generateEventMessage,
  generateEventInfo,
} from './lib/connpass-text-generator.ts';
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

  // 4. Generate templates
  const eventBody = generateEventBody(eventData, startTime);
  const participantInfo = generateParticipantInfo(
    eventData,
    zoomUrl,
    discordUrl
  );
  const eventMessage = generateEventMessage(eventData, zoomUrl, discordUrl);
  const eventInfo = generateEventInfo(eventData, startTime);

  // 5. Create output directory if it doesn't exist
  if (!existsSync(CONNPASS_DIR)) {
    await mkdir(CONNPASS_DIR, { recursive: true });
  }

  // 6. Write files
  const bodyPath = join(CONNPASS_DIR, `event-${event}-body.md`);
  const participantInfoPath = join(
    CONNPASS_DIR,
    `event-${event}-participant-info.md`
  );
  const messagePath = join(CONNPASS_DIR, `event-${event}-message.md`);
  const infoPath = join(CONNPASS_DIR, `event-${event}-info.txt`);

  try {
    await writeFile(bodyPath, eventBody, 'utf-8');
    await writeFile(participantInfoPath, participantInfo, 'utf-8');
    await writeFile(messagePath, eventMessage, 'utf-8');
    await writeFile(infoPath, eventInfo, 'utf-8');

    console.log('[SUCCESS] Connpass texts generated successfully!\n');
    console.log('[INFO] Generated files:');
    console.log(`  - ${bodyPath}`);
    console.log(`  - ${participantInfoPath}`);
    console.log(`  - ${messagePath}`);
    console.log(`  - ${infoPath}\n`);

    if (!eventData.youtubeUrl) {
      console.warn(
        '[WARN] YouTube URL is not set for this event. Some templates may contain placeholders.\n'
      );
    }
  } catch (error) {
    console.error(`[ERROR] Failed to write files: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
