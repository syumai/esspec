import { GeminiClient } from './lib/gemini-client.ts';
import { config } from './lib/config.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

interface GenerateSummaryArgs {
  event: number;
}

function parseArgs(): GenerateSummaryArgs {
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
    console.error('Usage: pnpm run generate-summary -- --event <num>');
    console.error('\nExample:');
    console.error('  pnpm run generate-summary -- --event 42\n');
    process.exit(1);
  }

  if (isNaN(event) || event <= 0) {
    console.error('[ERROR] Event number must be a positive integer\n');
    process.exit(1);
  }

  return { event };
}

async function main() {
  const { event } = parseArgs();

  console.log('[INFO] Starting summary generation...\n');

  // 1. Verify caption file exists
  const captionPath = join(config.captionsDir, `caption-${event}.txt`);

  if (!existsSync(captionPath)) {
    console.error(`[ERROR] Caption file not found: ${captionPath}`);
    console.error('\nPlease download the caption first:');
    console.error(`  pnpm run download-caption -- --event ${event} --url <youtube_url>\n`);
    process.exit(1);
  }

  console.log(`[INFO] Caption file: ${captionPath}`);

  // 2. Initialize Gemini client
  const geminiClient = new GeminiClient();

  // 3. Generate summary
  let summary;
  try {
    summary = await geminiClient.generateSummary(captionPath, config.geminiPrompt);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  // 4. Create summaries directory if it doesn't exist
  if (!existsSync(config.summariesDir)) {
    await mkdir(config.summariesDir, { recursive: true });
  }

  // 5. Write summary to file
  const outputPath = join(config.summariesDir, `summary-${event}.md`);

  if (existsSync(outputPath)) {
    console.log(`[WARN] File already exists: ${outputPath}`);
    console.log('[WARN] Overwriting existing file...\n');
  }

  try {
    await writeFile(outputPath, summary, 'utf-8');
    console.log(`[SUCCESS] Summary generated for event #${event}`);
    console.log(`[INFO] Summary saved to: ${outputPath}\n`);
  } catch (error) {
    console.error(`[ERROR] Failed to write summary file: ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
