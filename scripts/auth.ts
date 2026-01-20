import { AuthManager } from './lib/auth-manager.ts';

async function main() {
  console.log('[INFO] Starting OAuth authentication setup...\n');

  const authManager = new AuthManager();

  try {
    await authManager.authenticate();
    console.log('\nYou can now use:');
    console.log('  pnpm run download-caption <event_number>');
    console.log('  pnpm run generate-summary <event_number>');
    console.log('  pnpm run create-broadcast <event_number>\n');
  } catch (error) {
    console.error('[ERROR] Authentication failed:', (error as Error).message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
