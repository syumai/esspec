import type { Event } from './event-manager.ts';
import { parseISODateTime, formatToJapaneseDisplay } from './date-utils.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SUMMARIES_DIR = './summaries';

/**
 * Check if summary file exists for an event
 */
function summaryExists(eventNumber: number): boolean {
  const summaryPath = join(SUMMARIES_DIR, `summary-${eventNumber}.md`);
  return existsSync(summaryPath);
}

/**
 * Generate summary column content
 * Returns markdown link if summary exists, otherwise status text
 */
function generateSummaryColumn(eventNumber: number): string {
  if (summaryExists(eventNumber)) {
    return `[サマリー](./summary-${eventNumber}.md)`;
  }
  return 'サマリー未作成';
}

/**
 * Generate table row for a single event
 */
function generateEventRow(event: Event): string {
  const eventDate = parseISODateTime(event.eventDateTime);
  const displayDate = formatToJapaneseDisplay(eventDate);
  const summaryColumn = generateSummaryColumn(event.eventNumber);

  return `| #${event.eventNumber} | ${displayDate} | ${summaryColumn} |`;
}

/**
 * Generate complete index markdown content
 */
export function generateSummariesIndex(events: Event[]): string {
  // Header
  const lines = [
    '# ECMAScript仕様輪読会 書き起こしサマリー一覧',
    '',
    '| イベント番号 | 開催日時 | サマリー |',
    '|:---:|:---:|:---|',
  ];

  // Event rows (already sorted by EventManager)
  for (const event of events) {
    lines.push(generateEventRow(event));
  }

  // Empty line at end
  lines.push('');

  return lines.join('\n');
}
