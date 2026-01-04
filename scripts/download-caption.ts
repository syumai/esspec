import { AuthManager } from './lib/auth-manager.ts';
import { YouTubeClient } from './lib/youtube-client.ts';
import { extractVideoId } from './lib/video-id-extractor.ts';
import { SRTParser } from './lib/srt-parser.ts';
import { EventManager } from './lib/event-manager.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const CAPTIONS_DIR = './tmp/captions';

interface DownloadCaptionArgs {
  event: number;
  url: string | undefined;
}

function parseArgs(): DownloadCaptionArgs {
  const args = process.argv.slice(2);
  let event: number | undefined;
  let url: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--event' && args[i + 1]) {
      event = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    }
  }

  if (!event) {
    console.error('[ERROR] Missing required argument\n');
    console.error('Usage: pnpm run download-caption -- --event <num> [--url <youtube_url>]');
    console.error('\nExamples:');
    console.error('  pnpm run download-caption -- --event 42');
    console.error('  pnpm run download-caption -- --event 42 --url https://youtube.com/live/Q3ZKvcPSnNE\n');
    process.exit(1);
  }

  if (isNaN(event) || event <= 0) {
    console.error('[ERROR] Event number must be a positive integer\n');
    process.exit(1);
  }

  return { event, url };
}

async function main() {
  const { event, url } = parseArgs();

  console.log('[INFO] Starting caption download...\n');

  // 1. Determine video URL (from argument or event data)
  let videoUrl: string;

  if (url) {
    // URL provided as argument - use it directly
    videoUrl = url;
  } else {
    // Load URL from event data
    console.log(`[INFO] Loading event #${event} data...`);
    const eventManager = new EventManager();

    try {
      const eventData = await eventManager.loadEvent(event);

      if (!eventData.youtubeUrl) {
        console.error(`[ERROR] Event #${event} does not have a YouTube URL`);
        console.error('\nPlease either:');
        console.error(`  1. Create a broadcast: pnpm run create-broadcast -- --event ${event}`);
        console.error(`  2. Provide URL manually: pnpm run download-caption -- --event ${event} --url <youtube_url>\n`);
        process.exit(1);
      }

      videoUrl = eventData.youtubeUrl;
      console.log(`[INFO] Using YouTube URL from event: ${videoUrl}`);
    } catch (error) {
      console.error(`[ERROR] ${(error as Error).message}\n`);
      process.exit(1);
    }
  }

  // 2. Extract video ID from URL
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    console.error(`[ERROR] Could not extract video ID from URL: ${videoUrl}`);
    console.error('Please provide a valid YouTube URL\n');
    process.exit(1);
  }

  console.log(`[INFO] Video ID: ${videoId}`);

  // 3. Load OAuth credentials
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

  // 5. Get available caption tracks
  let tracks;
  try {
    tracks = await youtubeClient.getCaptionTracks(videoId);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  // 6. Select Japanese caption track
  const selectedTrack = youtubeClient.selectJapaneseCaptionTrack(tracks);
  if (!selectedTrack) {
    console.error('[ERROR] No Japanese captions available for this video');
    console.error('\nAvailable languages:');
    tracks.forEach((track) => {
      console.error(`  - ${track.language}: ${track.name}`);
    });
    console.error();
    process.exit(1);
  }

  // 7. Create captions directory if it doesn't exist
  if (!existsSync(CAPTIONS_DIR)) {
    await mkdir(CAPTIONS_DIR, { recursive: true });
  }

  // 8. Download caption
  const outputPath = join(CAPTIONS_DIR, `caption-${event}.srt`);

  if (existsSync(outputPath)) {
    console.log(`[WARN] File already exists: ${outputPath}`);
    console.log('[WARN] Skipping download (file will not be overwritten)\n');
    return;
  }

  try {
    await youtubeClient.downloadCaption(selectedTrack.id, outputPath);
    console.log(`\n[SUCCESS] Caption saved for event #${event}`);

    // Convert SRT to plain text
    try {
      console.log('[INFO] Converting SRT to plain text...');
      const srtContent = await readFile(outputPath, 'utf-8');
      const textContent = SRTParser.parseToText(srtContent);
      const textPath = outputPath.replace('.srt', '.txt');
      await writeFile(textPath, textContent, 'utf-8');
      console.log(`[SUCCESS] Text version saved to: ${textPath}`);
    } catch (conversionError) {
      console.warn(`[WARN] Failed to convert SRT to text: ${(conversionError as Error).message}`);
    }

    console.log(`[INFO] You can now generate a summary with:`);
    console.log(`  pnpm run generate-summary -- --event ${event}\n`);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
