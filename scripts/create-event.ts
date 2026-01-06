import { EventManager } from './lib/event-manager.ts';
import {
  suggestNextEventDateTime,
  createISODateTimeFromInput,
  formatToJapaneseDisplay,
  parseISODateTime,
} from './lib/date-utils.ts';
import { parseEventNumberArg } from './lib/arg-parser.ts';
import { normalizeUrl } from './lib/url-normalizer.ts';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { z } from 'zod';

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

async function promptForConnpassUrl(): Promise<string | undefined> {
  const rl = createInterface({ input, output });

  try {
    const answer = await rl.question('Connpass URLを入力してください（スキップする場合はEnter）: ');

    const trimmed = answer.trim();

    // 空文字列の場合はundefinedを返す（スキップ）
    if (!trimmed) {
      return undefined;
    }

    // URL形式のバリデーション（Zodスキーマを使用）
    const urlSchema = z.string().url();

    try {
      urlSchema.parse(trimmed);
      return normalizeUrl(trimmed);
    } catch (error) {
      console.error('\n[ERROR] 無効なURL形式です。正しいURLを入力してください。\n');
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

/**
 * Parse custom date-time input from user
 * Accepts formats: "YYYY/MM/DD" or "YYYY/MM/DD HH:MM"
 */
function parseCustomDateTimeInput(input: string): string {
  const parts = input.split(/\s+/);

  if (parts.length === 1) {
    // Date only, use default time
    return createISODateTimeFromInput(parts[0]);
  } else if (parts.length === 2) {
    // Date and time
    return createISODateTimeFromInput(parts[0], parts[1]);
  } else {
    throw new Error(
      `Invalid format: ${input}. Expected "YYYY/MM/DD" or "YYYY/MM/DD HH:MM"`
    );
  }
}

/**
 * Prompt user for event date-time with suggestion based on previous event
 */
async function promptForEventDateTime(
  eventManager: EventManager,
  eventNumber: number
): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    // Try to find previous event
    const previousEventNumber = eventNumber - 1;
    let suggestedDateTime: { isoString: string; displayString: string } | null =
      null;

    if (
      previousEventNumber > 0 &&
      eventManager.eventExists(previousEventNumber)
    ) {
      try {
        const previousEvent = await eventManager.loadEvent(previousEventNumber);
        if (previousEvent.eventDateTime) {
          suggestedDateTime = suggestNextEventDateTime(
            previousEvent.eventDateTime
          );
        }
      } catch (error) {
        // If previous event can't be loaded or doesn't have eventDateTime, fall through
        console.warn(
          `[WARN] Could not load previous event #${previousEventNumber}: ${(error as Error).message}`
        );
      }
    }

    // Show suggestion or prompt for manual input
    if (suggestedDateTime) {
      console.log(
        `\n[INFO] 前回のイベント（#${previousEventNumber}）の2週間後を提案します:`
      );
      console.log(`[INFO] 提案日時: ${suggestedDateTime.displayString}`);

      const answer = await rl.question(
        '\nこの日時でよろしいですか？ (y/n または カスタム日時を入力): '
      );

      const trimmed = answer.trim().toLowerCase();

      if (trimmed === 'y' || trimmed === 'yes' || trimmed === '') {
        return suggestedDateTime.isoString;
      } else if (trimmed === 'n' || trimmed === 'no') {
        // Fall through to manual input
      } else {
        // User provided custom input - try to parse it
        try {
          return parseCustomDateTimeInput(trimmed);
        } catch (error) {
          console.error(`\n[ERROR] ${(error as Error).message}`);
          console.error(
            '[ERROR] フォーマット例: 2026/01/20 または 2026/01/20 20:00\n'
          );
          process.exit(1);
        }
      }
    }

    // Manual input (no previous event or user declined suggestion)
    console.log('\n[INFO] イベント日時を入力してください');
    console.log('[INFO] フォーマット: YYYY/MM/DD または YYYY/MM/DD HH:MM');
    console.log('[INFO] 例: 2026/01/20 または 2026/01/20 20:00');
    console.log('[INFO] (時刻を省略した場合は 19:30 になります)\n');

    const dateTimeInput = await rl.question('日時: ');

    if (!dateTimeInput.trim()) {
      console.error('\n[ERROR] 日時は必須です\n');
      process.exit(1);
    }

    try {
      return parseCustomDateTimeInput(dateTimeInput.trim());
    } catch (error) {
      console.error(`\n[ERROR] ${(error as Error).message}\n`);
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const event = parseEventNumberArg();

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

  // 2.5. Prompt for event date-time
  const eventDateTime = await promptForEventDateTime(eventManager, event);

  // 2.6. Prompt for Connpass URL
  const connpassUrl = await promptForConnpassUrl();

  // 3. Create event
  try {
    const createdEvent = await eventManager.createEvent({
      eventNumber: event,
      eventDateTime,
      readingRange,
      connpassUrl,
    });

    console.log(`\n[SUCCESS] Event #${event} created successfully!`);
    console.log(`[INFO] Saved to: ${eventManager.getEventPath(event)}\n`);
    console.log('[INFO] Event details:');
    console.log(`  Event name: ${createdEvent.eventName}`);
    console.log(
      `  Event date: ${formatToJapaneseDisplay(parseISODateTime(createdEvent.eventDateTime))}`
    );
    console.log(`  Reading range: ${createdEvent.readingRange}`);
    if (createdEvent.connpassUrl) {
      console.log(`  Connpass URL: ${createdEvent.connpassUrl}`);
    }
    console.log(`  Scrapbox URL: ${createdEvent.scrapboxUrl}\n`);
    console.log('[INFO] Next steps:');
    console.log(`  - Download captions: pnpm run download-caption ${event}`);
    console.log(`  - Generate summary: pnpm run generate-summary ${event}\n`);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
