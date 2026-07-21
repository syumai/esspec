import { EventManager } from './lib/event-manager.ts';
import { CosenseClient } from './lib/cosense-client.ts';
import { buildEventPageBody, buildEventPageTitle } from './lib/scrapbox-page-builder.ts';
import { parseEventNumberArg } from './lib/arg-parser.ts';

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

  // 2. Check the new page does not already exist
  console.log(`[INFO] Checking whether "${newTitle}" already exists...`);
  let alreadyExists: boolean;

  try {
    alreadyExists = await cosenseClient.pageExists(newTitle);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }

  if (alreadyExists) {
    console.error(`[ERROR] Scrapbox page already exists: ${newTitle}`);
    console.error(`  https://scrapbox.io/esspec/${encodeURIComponent(newTitle)}\n`);
    process.exit(1);
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

  // 5. Create the page
  console.log('[INFO] Creating Scrapbox page...');

  try {
    const result = await cosenseClient.createPage(bodyText);
    console.log(`\n[SUCCESS] Scrapbox page created: ${result.title}`);
    console.log(`[INFO] URL: ${result.url}\n`);
  } catch (error) {
    console.error(`\n[ERROR] ${(error as Error).message}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
