import { AuthManager } from './lib/auth-manager.ts';
import { YouTubeClient } from './lib/youtube-client.ts';
import { extractVideoId } from './lib/video-id-extractor.ts';
import { SRTParser } from './lib/srt-parser.ts';
import { config } from './lib/config.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

interface DownloadCaptionArgs {
  event: number;
  url: string;
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

  if (!event || !url) {
    console.error('[ERROR] Missing required arguments\n');
    console.error('Usage: pnpm run download-caption -- --event <num> --url <youtube_url>');
    console.error('\nExample:');
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

  // 1. Extract video ID from URL
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error(`[ERROR] Could not extract video ID from URL: ${url}`);
    console.error('Please provide a valid YouTube URL\n');
    process.exit(1);
  }

  console.log(`[INFO] Video ID: ${videoId}`);

  // 2. Load OAuth credentials
  const authManager = new AuthManager();
  let authClient;

  try {
    authClient = await authManager.getAuthClient();
  } catch (error) {
    console.error((error as Error).message);
    console.error('\nPlease run authentication first: pnpm run auth\n');
    process.exit(1);
  }

  // 3. Initialize YouTube client
  const youtubeClient = new YouTubeClient(authClient);

  // 4. Get available caption tracks
  let tracks;
  try {
    tracks = await youtubeClient.getCaptionTracks(videoId);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  // 5. Select Japanese caption track
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

  // 6. Create captions directory if it doesn't exist
  if (!existsSync(config.captionsDir)) {
    await mkdir(config.captionsDir, { recursive: true });
  }

  // 7. Download caption
  const outputPath = join(config.captionsDir, `caption-${event}.srt`);

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
