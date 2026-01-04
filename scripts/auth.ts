import { AuthManager } from './lib/auth-manager.ts';
import { createServer } from 'node:http';
import { parse } from 'node:url';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { exec } from 'node:child_process';

const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];

async function main() {
  console.log('[INFO] Starting OAuth authentication setup...\n');

  const authManager = new AuthManager();

  // 1. Create credentials directory if it doesn't exist
  const credentialsDir = authManager.getCredentialsDir();
  if (!existsSync(credentialsDir)) {
    console.log(`[INFO] Creating credentials directory: ${credentialsDir}`);
    await mkdir(credentialsDir, { recursive: true });
  }

  // 2. Check for credentials.json
  const credentialsPath = authManager.getCredentialsPath();
  if (!existsSync(credentialsPath)) {
    console.error(`[ERROR] Credentials file not found: ${credentialsPath}\n`);
    console.error('Please follow these steps:');
    console.error('1. Go to https://console.cloud.google.com/apis/credentials');
    console.error('2. Create OAuth 2.0 Client ID (Application type: Desktop app)');
    console.error('3. Download the credentials JSON file');
    console.error(`4. Save it to: ${credentialsPath}\n`);
    process.exit(1);
  }

  // 3. Initialize OAuth 2.0 client
  let client;
  try {
    client = await authManager.getAuthClient();
  } catch (error) {
    console.error('[ERROR] Failed to load credentials:', (error as Error).message);
    process.exit(1);
  }

  // 4. Generate authorization URL
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: YOUTUBE_SCOPES,
  });

  console.log('[INFO] Opening browser for authentication...\n');
  console.log('If the browser does not open automatically, please visit this URL:');
  console.log(authUrl);
  console.log();

  // Open browser
  const openCommand = process.platform === 'darwin' ? 'open' :
                     process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${openCommand} "${authUrl}"`);

  // 5. Start local server to receive callback
  const server = createServer(async (req, res) => {
    if (!req.url) {
      return;
    }

    const { query } = parse(req.url, true);
    const code = query.code as string;

    if (code) {
      try {
        // 6. Exchange authorization code for tokens
        console.log('[INFO] Exchanging authorization code for tokens...');
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        // 7. Save tokens
        await authManager.saveTokens(tokens as any);

        // 8. Display success message
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        console.log('\n[SUCCESS] Authentication completed successfully!');
        console.log(`[INFO] Tokens saved to: ${authManager.getTokensPath()}`);
        console.log('\nYou can now use:');
        console.log('  pnpm run download-caption -- --event <num> --url <youtube_url>');
        console.log('  pnpm run generate-summary -- --event <num>\n');

        server.close();
        process.exit(0);
      } catch (error) {
        console.error('[ERROR] Failed to exchange code for tokens:', (error as Error).message);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body>
              <h1>Authentication Failed</h1>
              <p>Error: ${(error as Error).message}</p>
              <p>Please check the terminal for details.</p>
            </body>
          </html>
        `);
        server.close();
        process.exit(1);
      }
    }
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    console.log(`[INFO] Local server started on http://localhost:${PORT}`);
    console.log('[INFO] Waiting for authorization...\n');
  });
}

main().catch((error) => {
  console.error('[ERROR] Unexpected error:', error);
  process.exit(1);
});
