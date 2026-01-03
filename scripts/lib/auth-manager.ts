import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.ts';

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export class AuthManager {
  private credentialsPath: string;
  private tokensPath: string;

  constructor() {
    this.credentialsPath = join(config.credentialsDir, 'credentials.json');
    this.tokensPath = join(config.credentialsDir, 'tokens.json');
  }

  /**
   * Get an authenticated OAuth2Client instance
   */
  async getAuthClient(): Promise<OAuth2Client> {
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
      await this.refreshTokensIfNeeded(client);
    }

    return client;
  }

  /**
   * Save tokens to disk with restricted permissions
   */
  async saveTokens(tokens: TokenData): Promise<void> {
    // Ensure directory exists
    if (!existsSync(config.credentialsDir)) {
      await mkdir(config.credentialsDir, { recursive: true });
    }

    // Write tokens
    await writeFile(this.tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');

    // Set restrictive permissions (owner read/write only)
    await chmod(this.tokensPath, 0o600);

    console.log(`[INFO] Tokens saved to: ${this.tokensPath}`);
  }

  /**
   * Refresh tokens if they're expired or about to expire
   */
  private async refreshTokensIfNeeded(client: OAuth2Client): Promise<void> {
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
        throw new Error('Token refresh failed. Please re-authenticate using: pnpm run auth');
      }
    }
  }

  /**
   * Get the path to the credentials directory
   */
  getCredentialsDir(): string {
    return config.credentialsDir;
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
}
