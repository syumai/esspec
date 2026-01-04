import { AuthManager } from './lib/auth-manager.ts';
import { YouTubeClient } from './lib/youtube-client.ts';
import { EventManager, type Event } from './lib/event-manager.ts';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

interface CreateBroadcastArgs {
  event: number;
}

function parseArgs(): CreateBroadcastArgs {
  const args = process.argv.slice(2);
  let event: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--event' && args[i + 1]) {
      event = parseInt(args[i + 1], 10);
      i++;
    }
  }

  if (!event) {
    console.error('[ERROR] Missing required argument\n');
    console.error('Usage: pnpm run create-broadcast -- --event <num>');
    console.error('\nExample:');
    console.error('  pnpm run create-broadcast -- --event 93\n');
    process.exit(1);
  }

  if (isNaN(event) || event <= 0) {
    console.error('[ERROR] Event number must be a positive integer\n');
    process.exit(1);
  }

  return { event };
}

function buildDescription(eventData: Event): string {
  const parts = [
    `輪読の範囲: ${eventData.readingRange}`,
    '',
    `Scrapbox: ${eventData.scrapboxUrl}`,
  ];

  if (eventData.connpassUrl) {
    parts.push(`Connpass: ${eventData.connpassUrl}`);
  }

  return parts.join('\n');
}

async function confirmOverwrite(eventNumber: number, existingUrl: string): Promise<boolean> {
  const rl = createInterface({ input, output });

  try {
    console.log(`[WARN] YouTube URL already exists for event #${eventNumber}:`);
    console.log(`  ${existingUrl}\n`);

    const answer = await rl.question('Do you want to create another broadcast? (y/n): ');

    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const { event } = parseArgs();

  console.log('[INFO] Creating YouTube live broadcast...\n');

  // 1. Load event data
  const eventManager = new EventManager();
  let eventData: Event;

  try {
    console.log(`[INFO] Loading event #${event} data...`);
    eventData = await eventManager.loadEvent(event);
    console.log(`[INFO] Event name: ${eventData.eventName}`);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  // 2. Check if YouTube URL already exists
  if (eventData.youtubeUrl) {
    const shouldContinue = await confirmOverwrite(event, eventData.youtubeUrl);
    if (!shouldContinue) {
      console.log('\n[INFO] Broadcast creation cancelled.\n');
      process.exit(0);
    }
    console.log();
  }

  // 3. Authenticate
  const authManager = new AuthManager();
  let authClient;

  try {
    authClient = await authManager.getAuthClient();
  } catch (error) {
    console.error((error as Error).message);
    console.error('\nPlease run authentication first: pnpm run auth\n');
    process.exit(1);
  }

  // 4. Initialize YouTube client
  const youtubeClient = new YouTubeClient(authClient);

  // 5. Build broadcast configuration
  const broadcastConfig = {
    title: eventData.eventName,
    description: buildDescription(eventData),
    scheduledStartTime: eventData.eventDateTime,
    privacyStatus: 'public' as const,
    latencyPreference: 'normal' as const,
  };

  const streamConfig = {
    title: `${eventData.eventName} - Stream`,
    ingestionType: 'rtmp' as const,
    resolution: 'variable' as const,
    frameRate: 'variable' as const,
  };

  // 6. Create broadcast
  let broadcast;

  try {
    broadcast = await youtubeClient.createCompleteBroadcast(
      broadcastConfig,
      streamConfig
    );
  } catch (error) {
    console.error(`\n[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  console.log(`\n[SUCCESS] Live broadcast created!`);
  console.log(`[INFO] Broadcast URL: ${broadcast.youtubeUrl}`);
  console.log(`[INFO] Broadcast ID: ${broadcast.broadcastId}`);
  console.log(`[INFO] Stream ID: ${broadcast.streamId}`);

  if (broadcast.streamKey && broadcast.ingestionAddress) {
    console.log(`\n[INFO] Stream settings:`);
    console.log(`  Server URL: ${broadcast.ingestionAddress}`);
    console.log(`  Stream Key: ${broadcast.streamKey}`);
    console.log('\n[WARN] Keep your stream key private! Do not share it publicly.');
  }

  // 7. Update event with YouTube URL
  try {
    await eventManager.updateEvent(event, {
      youtubeUrl: broadcast.youtubeUrl,
    });

    console.log(`\n[SUCCESS] Event #${event} updated with YouTube URL`);
    console.log('[INFO] You can now start streaming at the scheduled time');
    console.log(`[INFO] To download captions later, run:`);
    console.log(`  pnpm run download-caption -- --event ${event}\n`);
  } catch (error) {
    console.error(`\n[ERROR] Failed to update event file: ${(error as Error).message}`);
    console.error('[WARN] Broadcast was created successfully, but the URL was not saved to the event file.');
    console.error(`[WARN] You can manually add this URL to the event file:`);
    console.error(`  ${eventManager.getEventPath(event)}`);
    console.error(`[WARN] YouTube URL: ${broadcast.youtubeUrl}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
