import { EventManager } from './event-manager.ts';
import { generateSummariesIndex } from './summaries-index-generator.ts';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SUMMARIES_DIR = './summaries';
const INDEX_FILENAME = 'index.md';

/**
 * Update summaries index file
 * This function can be called from any script that needs to regenerate the index
 */
export async function updateSummariesIndex(): Promise<void> {
  console.log('[INFO] Generating summaries index...\n');

  // 1. Load all events
  const eventManager = new EventManager();
  const events = await eventManager.loadAllEvents();

  if (events.length === 0) {
    console.warn('[WARN] No events found. Index will be empty.\n');
  } else {
    console.log(`[INFO] Loaded ${events.length} event(s)`);
    console.log(
      `[INFO] Event range: #${events[0].eventNumber} - #${events[events.length - 1].eventNumber}\n`
    );
  }

  // 2. Generate index content
  const indexContent = generateSummariesIndex(events);

  // 3. Ensure summaries directory exists
  if (!existsSync(SUMMARIES_DIR)) {
    await mkdir(SUMMARIES_DIR, { recursive: true });
    console.log(`[INFO] Created directory: ${SUMMARIES_DIR}\n`);
  }

  // 4. Write index file
  const indexPath = join(SUMMARIES_DIR, INDEX_FILENAME);
  await writeFile(indexPath, indexContent, 'utf-8');
  console.log('[SUCCESS] Summaries index generated successfully!');
  console.log(`[INFO] Index saved to: ${indexPath}\n`);
}
