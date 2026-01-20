import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { parse } from 'node:url';
import { exec } from 'node:child_process';

const YOUTUBE_SCOPES = ['https://www.googleapis.com/auth/youtube.force-ssl'];
const AUTH_SERVER_PORT = 3000;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export class AuthManager {
  private credentialsDir: string;
  private credentialsPath: string;
  private tokensPath: string;

  constructor() {
    this.credentialsDir = join(homedir(), '.local', 'esspec');
    this.credentialsPath = join(this.credentialsDir, 'credentials.json');
    this.tokensPath = join(this.credentialsDir, 'tokens.json');
  }

  /**
   * Get an authenticated OAuth2Client instance
   * @param options.autoReauthenticate - If true, automatically run browser auth when tokens are missing or refresh fails
   */
  async getAuthClient(options?: { autoReauthenticate?: boolean }): Promise<OAuth2Client> {
    const { autoReauthenticate = false } = options ?? {};

    // Load credentials
    if (!existsSync(this.credentialsPath)) {
      throw new Error(
        `[ERROR] Credentials file not found at: ${this.credentialsPath}\n` +
        'Please download OAuth 2.0 credentials from Google Cloud Console and save it to this path.\n' +
        'See: https://console.cloud.google.com/apis/credentials'
      );
    }

    const credentialsContent = await readFile(this.credentialsPath, 'utf-8');
    const credentials = JSON.parse(credentialsContent);

    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    const client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    // Load saved tokens if they exist
    if (existsSync(this.tokensPath)) {
      const tokensContent = await readFile(this.tokensPath, 'utf-8');
      const tokens = JSON.parse(tokensContent);
      client.setCredentials(tokens);

      // Refresh tokens if needed
      await this.refreshTokensIfNeeded(client, autoReauthenticate);
    } else if (autoReauthenticate) {
      // No tokens found, start authentication
      console.log('[INFO] No tokens found. Starting authentication...');
      return await this.authenticate();
    }

    return client;
  }

  /**
   * Save tokens to disk with restricted permissions
   */
  async saveTokens(tokens: TokenData): Promise<void> {
    // Ensure directory exists
    if (!existsSync(this.credentialsDir)) {
      await mkdir(this.credentialsDir, { recursive: true });
    }

    // Write tokens
    await writeFile(this.tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');

    // Set restrictive permissions (owner read/write only)
    await chmod(this.tokensPath, 0o600);

    console.log(`[INFO] Tokens saved to: ${this.tokensPath}`);
  }

  /**
   * Refresh tokens if they're expired or about to expire
   * @param autoReauthenticate - If true, automatically run browser auth when refresh fails
   */
  private async refreshTokensIfNeeded(client: OAuth2Client, autoReauthenticate: boolean = false): Promise<void> {
    const credentials = client.credentials;

    if (!credentials.expiry_date) {
      return;
    }

    const now = Date.now();
    const expiryTime = credentials.expiry_date;
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

    // Refresh if expired or expiring soon
    if (expiryTime - now < bufferTime) {
      console.log('[INFO] Refreshing access token...');

      try {
        const { credentials: newCredentials } = await client.refreshAccessToken();
        client.setCredentials(newCredentials);
        await this.saveTokens(newCredentials as TokenData);
        console.log('[SUCCESS] Access token refreshed');
      } catch (error) {
        console.error('[ERROR] Failed to refresh token:', error);

        if (autoReauthenticate) {
          console.log('[INFO] Attempting automatic re-authentication...');
          const newClient = await this.authenticate();
          // Copy credentials from new client to original client
          client.setCredentials(newClient.credentials);
        } else {
          throw new Error('Token refresh failed. Please re-authenticate using: pnpm run auth');
        }
      }
    }
  }

  /**
   * Get the path to the credentials directory
   */
  getCredentialsDir(): string {
    return this.credentialsDir;
  }

  /**
   * Get the path to the credentials file
   */
  getCredentialsPath(): string {
    return this.credentialsPath;
  }

  /**
   * Get the path to the tokens file
   */
  getTokensPath(): string {
    return this.tokensPath;
  }

  /**
   * Run OAuth authentication flow via browser
   * Opens browser for user consent and waits for callback
   */
  async authenticate(): Promise<OAuth2Client> {
    // 1. Create credentials directory if it doesn't exist
    if (!existsSync(this.credentialsDir)) {
      console.log(`[INFO] Creating credentials directory: ${this.credentialsDir}`);
      await mkdir(this.credentialsDir, { recursive: true });
    }

    // 2. Check for credentials.json
    if (!existsSync(this.credentialsPath)) {
      throw new Error(
        `[ERROR] Credentials file not found: ${this.credentialsPath}\n` +
        'Please follow these steps:\n' +
        '1. Go to https://console.cloud.google.com/apis/credentials\n' +
        '2. Create OAuth 2.0 Client ID (Application type: Desktop app)\n' +
        '3. Download the credentials JSON file\n' +
        `4. Save it to: ${this.credentialsPath}`
      );
    }

    // 3. Initialize OAuth 2.0 client
    const credentialsContent = await readFile(this.credentialsPath, 'utf-8');
    const credentials = JSON.parse(credentialsContent);
    const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
    const client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    // 4. Generate authorization URL with prompt: 'consent' to always get new refresh token
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: YOUTUBE_SCOPES,
      prompt: 'consent',
    });

    console.log('[INFO] Opening browser for authentication...\n');
    console.log('If the browser does not open automatically, please visit this URL:');
    console.log(authUrl);
    console.log();

    // Open browser
    const openCommand = process.platform === 'darwin' ? 'open' :
                       process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${openCommand} "${authUrl}"`);

    // 5. Start local server to receive callback with timeout
    return new Promise<OAuth2Client>((resolve, reject) => {
      let server: Server | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (server) {
          server.close();
          server = null;
        }
      };

      // Set timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Authentication timed out. Please try again.'));
      }, AUTH_TIMEOUT_MS);

      server = createServer(async (req, res) => {
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
            await this.saveTokens(tokens as TokenData);

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
            cleanup();
            resolve(client);
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
            cleanup();
            reject(error);
          }
        }
      });

      server.listen(AUTH_SERVER_PORT, () => {
        console.log(`[INFO] Local server started on http://localhost:${AUTH_SERVER_PORT}`);
        console.log('[INFO] Waiting for authorization...\n');
      });

      server.on('error', (error: NodeJS.ErrnoException) => {
        cleanup();
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${AUTH_SERVER_PORT} is already in use. Please close other applications using this port and try again.`));
        } else {
          reject(error);
        }
      });
    });
  }
}
