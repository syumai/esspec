import { EventManager } from './lib/event-manager.ts';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

interface CreateEventArgs {
  event: number;
}

function parseArgs(): CreateEventArgs {
  const args = process.argv.slice(2);

  // Support both positional and --event flag
  let event: number | undefined;

  if (args.length === 1 && !args[0].startsWith('--')) {
    // Positional argument: pnpm run create-event 92
    event = parseInt(args[0], 10);
  } else {
    // Flag-based argument: pnpm run create-event -- --event 92
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--event' && args[i + 1]) {
        event = parseInt(args[i + 1], 10);
        i++;
      }
    }
  }

  if (!event) {
    console.error('[ERROR] Missing required argument\n');
    console.error('Usage: pnpm run create-event <event_number>');
    console.error('   or: pnpm run create-event -- --event <event_number>');
    console.error('\nExample:');
    console.error('  pnpm run create-event 92');
    console.error('  pnpm run create-event -- --event 92\n');
    process.exit(1);
  }

  if (isNaN(event) || event <= 0) {
    console.error('[ERROR] Event number must be a positive integer\n');
    process.exit(1);
  }

  return { event };
}

async function promptForReadingRange(): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question('輪読の範囲を入力してください: ');

    if (!answer.trim()) {
      console.error('\n[ERROR] Reading range cannot be empty\n');
      process.exit(1);
    }

    return answer.trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const { event } = parseArgs();

  console.log('[INFO] Creating new event...\n');

  const eventManager = new EventManager();

  // 1. Check if event already exists
  if (eventManager.eventExists(event)) {
    console.error(`[ERROR] Event #${event} already exists at:`);
    console.error(`  ${eventManager.getEventPath(event)}`);
    console.error(
      '\nPlease use a different event number or delete the existing file.\n'
    );
    process.exit(1);
  }

  // 2. Prompt for reading range
  console.log(`[INFO] Event #${event}`);
  console.log(`[INFO] Event name: ${eventManager.generateEventName(event)}`);
  console.log(
    `[INFO] Scrapbox URL: ${eventManager.generateScrapboxUrl(event)}\n`
  );

  const readingRange = await promptForReadingRange();

  // 3. Create event
  try {
    const createdEvent = await eventManager.createEvent({
      eventNumber: event,
      readingRange,
    });

    console.log(`\n[SUCCESS] Event #${event} created successfully!`);
    console.log(`[INFO] Saved to: ${eventManager.getEventPath(event)}\n`);
    console.log('[INFO] Event details:');
    console.log(`  Event name: ${createdEvent.eventName}`);
    console.log(`  Reading range: ${createdEvent.readingRange}`);
    console.log(`  Scrapbox URL: ${createdEvent.scrapboxUrl}\n`);
    console.log('[INFO] Next steps:');
    console.log(
      '  - Add connpass URL using: pnpm run add-connpass-url (to be implemented)'
    );
    console.log(
      '  - Add YouTube URL using: pnpm run add-youtube-url (to be implemented)'
    );
    console.log(
      `  - Download captions: pnpm run download-caption -- --event ${event} --url <youtube_url>`
    );
    console.log(`  - Generate summary: pnpm run generate-summary -- --event ${event}\n`);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
