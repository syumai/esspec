import { updateSummariesIndex } from './lib/summaries-index-updater.ts';

/**
 * CLI entry point
 */
async function main() {
  try {
    await updateSummariesIndex();
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
