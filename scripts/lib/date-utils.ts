/**
 * Date utility functions for event management
 *
 * All dates are handled in JST (Japan Standard Time, UTC+9)
 * Format: ISO 8601 with timezone offset (e.g., "2026-01-06T19:30:00+09:00")
 */

// Constants
const JST_OFFSET = '+09:00';
const DEFAULT_EVENT_TIME = '19:30'; // 7:30 PM JST
const JAPANESE_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Parse ISO 8601 datetime string to Date object
 * @param isoString - ISO 8601 formatted string with timezone
 * @returns Date object
 * @throws Error if parsing fails
 */
export function parseISODateTime(isoString: string): Date {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO 8601 datetime: ${isoString}`);
  }
  return date;
}

/**
 * Add specified number of days to a date
 * @param date - Source date
 * @param days - Number of days to add
 * @returns New Date object
 */
export function addDays(date: Date, days: number): Date {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
}

/**
 * Add 2 weeks (14 days) to a date
 * @param date - Source date
 * @returns New Date object
 */
export function addTwoWeeks(date: Date): Date {
  return addDays(date, 14);
}

/**
 * Format Date to ISO 8601 string with JST timezone
 * @param date - Date object
 * @returns ISO 8601 formatted string (e.g., "2026-01-06T19:30:00+09:00")
 */
export function formatToISOWithJST(date: Date): string {
  // Get components in JST
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${JST_OFFSET}`;
}

/**
 * Format Date to Japanese display format
 * @param date - Date object
 * @returns Formatted string (e.g., "2026/01/06(月) 19:30")
 */
export function formatToJapaneseDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekday = JAPANESE_WEEKDAYS[date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day}(${weekday}) ${hours}:${minutes}`;
}

/**
 * Create ISO datetime string from Japanese date input
 * @param dateInput - Date string in format "YYYY/MM/DD" or "YYYY-MM-DD"
 * @param timeInput - Optional time string in format "HH:MM" (defaults to "19:30")
 * @returns ISO 8601 formatted string with JST timezone
 * @throws Error if date is invalid
 */
export function createISODateTimeFromInput(
  dateInput: string,
  timeInput: string = DEFAULT_EVENT_TIME
): string {
  // Normalize date input (accept both / and -)
  const normalizedDate = dateInput.replace(/\//g, '-');

  // Parse date parts
  const dateMatch = normalizedDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!dateMatch) {
    throw new Error(
      `Invalid date format: ${dateInput}. Expected format: YYYY/MM/DD or YYYY-MM-DD`
    );
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  // Parse time parts
  const timeMatch = timeInput.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    throw new Error(
      `Invalid time format: ${timeInput}. Expected format: HH:MM`
    );
  }

  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);

  // Validate ranges
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }
  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }
  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid hour: ${hours}`);
  }
  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minute: ${minutes}`);
  }

  // Create date and verify it's valid (handles month/day edge cases)
  const date = new Date(year, month - 1, day, hours, minutes, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(
      `Invalid date: ${dateInput} (e.g., February 30th doesn't exist)`
    );
  }

  return formatToISOWithJST(date);
}

/**
 * Suggest next event date-time based on previous event
 * @param previousEventDateTime - ISO 8601 datetime string of previous event
 * @returns Object with suggested ISO string and display format
 */
export function suggestNextEventDateTime(previousEventDateTime: string): {
  isoString: string;
  displayString: string;
} {
  const previousDate = parseISODateTime(previousEventDateTime);
  const suggestedDate = addTwoWeeks(previousDate);

  return {
    isoString: formatToISOWithJST(suggestedDate),
    displayString: formatToJapaneseDisplay(suggestedDate),
  };
}
