/**
 * Parse event number from command-line arguments
 * Accepts positional argument: <event_number>
 *
 * @returns Event number as a positive integer
 * @throws Exits process with error if argument is missing or invalid
 */
export function parseEventNumberArg(): number {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('[ERROR] Missing required argument\n');
    console.error('Usage: <command> <event_number>');
    console.error('\nExamples:');
    console.error('  pnpm run create-event 42');
    console.error('  pnpm run download-caption 42');
    console.error('  pnpm run generate-summary 42\n');
    process.exit(1);
  }

  const event = parseInt(args[0], 10);

  if (isNaN(event) || event <= 0) {
    console.error('[ERROR] Event number must be a positive integer\n');
    process.exit(1);
  }

  return event;
}
