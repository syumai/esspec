import { EventManager } from './lib/event-manager.ts';
import { CosenseClient, type CosensePage } from './lib/cosense-client.ts';
import { buildEventPageBody, buildEventPageTitle } from './lib/scrapbox-page-builder.ts';
import { parseEventNumberArg } from './lib/arg-parser.ts';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

async function promptForOverwriteConfirmation(title: string, url: string): Promise<boolean> {
  const rl = createInterface({ input, output });

  try {
    console.log(`[INFO] ページ "${title}" は既に存在します:`);
    console.log(`  ${url}\n`);

    const answer = await rl.question('既にページが存在します。内容を上書きしますか？ (y/n): ');
    const trimmed = answer.trim().toLowerCase();

    return trimmed === 'y' || trimmed === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const event = parseEventNumberArg();

  console.log('[INFO] Creating Scrapbox event page...\n');

  // 1. Ensure the event data exists
  const eventManager = new EventManager();

  try {
    console.log(`[INFO] Loading event #${event} data...`);
    await eventManager.loadEvent(event);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  const cosenseClient = new CosenseClient();
  const newTitle = buildEventPageTitle(event);
  const previousTitle = buildEventPageTitle(event - 1);

  // 2. Check whether the new page already exists.
  //    Fetch once via readPage() so the pageId/lineIds are available for overwriting later.
  console.log(`[INFO] Checking whether "${newTitle}" already exists...`);
  let existingPage: CosensePage | null;

  try {
    existingPage = await cosenseClient.readPage(newTitle);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  let shouldOverwrite = false;

  if (existingPage !== null) {
    const existingUrl = cosenseClient.buildDisplayPageUrl(newTitle);
    const confirmed = await promptForOverwriteConfirmation(newTitle, existingUrl);

    if (!confirmed) {
      console.log('\n[INFO] キャンセルしました。ページは変更されていません。\n');
      process.exit(0);
    }

    shouldOverwrite = true;
  }

  // 3. Fetch the previous event page as a template
  console.log(`[INFO] Fetching previous page "${previousTitle}"...`);
  let previousLines: string[] | null;

  try {
    previousLines = await cosenseClient.readPageLines(previousTitle);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  if (previousLines === null) {
    console.error(`[ERROR] Previous Scrapbox page not found: ${previousTitle}`);
    console.error('  Cannot build a new event page template without a previous page.\n');
    process.exit(1);
  }

  // 4. Build the new page body
  let bodyText: string;

  try {
    bodyText = buildEventPageBody(previousLines, event);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  // 5. Create or overwrite the page
  try {
    if (shouldOverwrite && existingPage !== null) {
      console.log('[INFO] Overwriting existing Scrapbox page...');
      const result = await cosenseClient.overwritePageBody(existingPage, bodyText);
      console.log(`\n[SUCCESS] Scrapbox page updated: ${result.title}`);
      console.log(`[INFO] URL: ${cosenseClient.buildDisplayPageUrl(result.title)}\n`);
    } else {
      console.log('[INFO] Creating Scrapbox page...');
      const result = await cosenseClient.createPage(bodyText);
      console.log(`\n[SUCCESS] Scrapbox page created: ${result.title}`);
      console.log(`[INFO] URL: ${cosenseClient.buildDisplayPageUrl(result.title)}\n`);
    }
  } catch (error) {
    console.error(`\n[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
