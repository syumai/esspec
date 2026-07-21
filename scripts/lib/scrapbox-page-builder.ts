// Title format used for Scrapbox event pages, e.g. "ECMAScript仕様輪読会 #105"
const EVENT_TITLE_PREFIX = 'ECMAScript仕様輪読会 #';

// Matches the "前回のあらすじ" summary link, e.g.
// " https://syumai.github.io/esspec/summaries/summary-104.html"
const SUMMARY_URL_PATTERN =
  /(https:\/\/syumai\.github\.io\/esspec\/summaries\/summary-)(\d+)(\.html)/;

// Matches the "前回: [ECMAScript仕様輪読会 #104]" line
const PREVIOUS_EVENT_LINE_PATTERN = /^前回:\s*\[.*\]\s*$/;

// Matches the "[* 今回のメモ]" heading line (Scrapbox heading notation, any nesting level)
const MEMO_HEADING_PATTERN = /\[\*+\s*今回のメモ\s*\]/;

/**
 * Build the Scrapbox event page title for a given event number.
 */
export function buildEventPageTitle(eventNumber: number): string {
  return `${EVENT_TITLE_PREFIX}${eventNumber}`;
}

/**
 * Build the plain-text body for a new event page by transforming the
 * previous event page's lines:
 *   1. Title line -> new event number
 *   2. "前回: [...]" line -> previous event number
 *   3. Summary link under "[* 前回のあらすじ]" -> previous event number (best-effort)
 *   4. Everything after "[* 今回のメモ]" heading is dropped (heading itself kept as the last line)
 *
 * All other content (tools, news, self-introductions, etc.) is copied as-is.
 */
export function buildEventPageBody(previousPageLines: string[], eventNumber: number): string {
  if (previousPageLines.length === 0) {
    throw new Error('Previous page has no content; cannot build a new event page body.');
  }

  const lines = [...previousPageLines];
  const previousEventNumber = eventNumber - 1;

  // 1. Title line
  lines[0] = buildEventPageTitle(eventNumber);

  // 2. "前回: [...]" line
  const previousLineIndex = lines.findIndex((line) => PREVIOUS_EVENT_LINE_PATTERN.test(line));
  if (previousLineIndex === -1) {
    throw new Error(
      'Could not find the "前回: [...]" line in the previous page. Aborting to avoid creating a broken page.'
    );
  }
  lines[previousLineIndex] = `前回: [${buildEventPageTitle(previousEventNumber)}]`;

  // 3. Summary URL line (best-effort; warn and continue if not found)
  const summaryLineIndex = lines.findIndex((line) => SUMMARY_URL_PATTERN.test(line));
  if (summaryLineIndex === -1) {
    console.warn(
      '[WARN] Could not find the previous summary URL line ("summary-N.html"); leaving it as-is.'
    );
  } else {
    lines[summaryLineIndex] = lines[summaryLineIndex].replace(
      SUMMARY_URL_PATTERN,
      `$1${previousEventNumber}$3`
    );
  }

  // 4. Truncate everything after (and including the trailing content of) "[* 今回のメモ]"
  const memoHeadingIndex = lines.findIndex((line) => MEMO_HEADING_PATTERN.test(line));
  if (memoHeadingIndex === -1) {
    throw new Error(
      'Could not find the "[* 今回のメモ]" heading in the previous page. Aborting to avoid creating a broken page.'
    );
  }

  return lines.slice(0, memoHeadingIndex + 1).join('\n');
}
