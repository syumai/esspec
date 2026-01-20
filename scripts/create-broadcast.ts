import { AuthManager } from './lib/auth-manager.ts';
import { YouTubeClient } from './lib/youtube-client.ts';
import { EventManager, type Event } from './lib/event-manager.ts';
import { extractVideoId } from './lib/video-id-extractor.ts';
import { parseEventNumberArg } from './lib/arg-parser.ts';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

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

type BroadcastAction = 'update' | 'create' | 'cancel';

async function confirmBroadcastAction(eventNumber: number, existingUrl: string): Promise<BroadcastAction> {
  const rl = createInterface({ input, output });

  try {
    console.log(`[INFO] YouTube URL already exists for event #${eventNumber}:`);
    console.log(`  ${existingUrl}\n`);
    console.log('What would you like to do?');
    console.log('  [u] Update existing broadcast (recommended)');
    console.log('  [c] Create new broadcast');
    console.log('  [n] Cancel\n');

    const answer = await rl.question('Enter your choice (u/c/n): ');
    const choice = answer.trim().toLowerCase();

    if (choice === 'u' || choice === 'update') {
      return 'update';
    } else if (choice === 'c' || choice === 'create') {
      return 'create';
    } else {
      return 'cancel';
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const event = parseEventNumberArg();

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
  let existingBroadcastId: string | null = null;
  if (eventData.youtubeUrl) {
    const broadcastId = extractVideoId(eventData.youtubeUrl);
    if (broadcastId) {
      existingBroadcastId = broadcastId;
      const action = await confirmBroadcastAction(event, eventData.youtubeUrl);
      
      if (action === 'cancel') {
        console.log('\n[INFO] Broadcast operation cancelled.\n');
        process.exit(0);
      } else if (action === 'update') {
        // Will update existing broadcast later
        console.log('[INFO] Will update existing broadcast\n');
      } else {
        // Will create new broadcast
        console.log('[INFO] Will create new broadcast\n');
        existingBroadcastId = null;
      }
    } else {
      console.log('[WARN] Could not extract broadcast ID from URL, will create new broadcast\n');
    }
  }

  // 3. Authenticate (with automatic re-authentication if tokens are expired)
  const authManager = new AuthManager();
  let authClient;

  try {
    authClient = await authManager.getAuthClient({ autoReauthenticate: true });
  } catch (error) {
    console.error((error as Error).message);
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
    categoryId: 28,
  };

  // 6. Update existing broadcast or create new one
  if (existingBroadcastId) {
    // Update existing broadcast
    try {
      console.log(`[INFO] Updating broadcast ${existingBroadcastId}...`);
      await youtubeClient.updateLiveBroadcast(existingBroadcastId, broadcastConfig);
      
      console.log(`\n[SUCCESS] Live broadcast updated!`);
      console.log(`[INFO] Broadcast URL: ${eventData.youtubeUrl}`);
      console.log(`[INFO] Broadcast ID: ${existingBroadcastId}`);
      console.log(`\n[SUCCESS] Event #${event} broadcast updated`);
      console.log('[INFO] You can now start streaming at the scheduled time');
      console.log(`[INFO] To download captions later, run:`);
      console.log(`  pnpm run download-caption ${event}\n`);
    } catch (error) {
      console.error(`\n[ERROR] ${(error as Error).message}\n`);
      process.exit(1);
    }
  } else {
    // Create new broadcast
    const streamConfig = {
      title: `${eventData.eventName} - Stream`,
      ingestionType: 'rtmp' as const,
      resolution: 'variable' as const,
      frameRate: 'variable' as const,
    };

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
      console.log(`  pnpm run download-caption ${event}\n`);
    } catch (error) {
      console.error(`\n[ERROR] Failed to update event file: ${(error as Error).message}`);
      console.error('[WARN] Broadcast was created successfully, but the URL was not saved to the event file.');
      console.error(`[WARN] You can manually add this URL to the event file:`);
      console.error(`  ${eventManager.getEventPath(event)}`);
      console.error(`[WARN] YouTube URL: ${broadcast.youtubeUrl}\n`);
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
