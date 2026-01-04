import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';

const execAsync = promisify(exec);

const GEMINI_TIMEOUT_MS = 300000; // 5 minutes
const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

export class GeminiClient {
  /**
   * Check if Gemini CLI is installed
   */
  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync('which gemini');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a summary from a caption file using Gemini CLI
   */
  async generateSummary(captionFile: string, prompt: string): Promise<string> {
    // Check if Gemini CLI is installed
    const isInstalled = await this.checkInstalled();
    if (!isInstalled) {
      throw new Error(
        'Gemini CLI is not installed.\n' +
        'Please install it globally:\n' +
        '  npm install -g @google/gemini-cli\n' +
        '\nFor more information, visit: https://github.com/google-gemini/gemini-cli'
      );
    }

    console.log('[INFO] Reading caption file...');
    const captionContent = await readFile(captionFile, 'utf-8');

    console.log('[INFO] Generating summary with Gemini CLI...');
    console.log('[INFO] This may take a few minutes...\n');

    // Construct the full prompt with caption content
    const fullPrompt = `${prompt}\n\n以下は字幕ファイルの内容です：\n\n${captionContent}`;

    try {
      // Execute Gemini CLI
      // Note: The actual command may vary depending on Gemini CLI implementation
      // Adjust the command based on the actual CLI interface
      const { stdout, stderr } = await execAsync(
        `gemini "${fullPrompt.replace(/"/g, '\\"')}"`,
        {
          maxBuffer: MAX_BUFFER_SIZE,
          timeout: GEMINI_TIMEOUT_MS,
        }
      );

      if (stderr) {
        console.warn('[WARN] Gemini CLI stderr:', stderr);
      }

      if (!stdout.trim()) {
        throw new Error('Gemini CLI returned empty output');
      }

      return stdout.trim();
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT') {
        throw new Error(
          `Gemini CLI timed out after ${GEMINI_TIMEOUT_MS / 1000} seconds.\n` +
          'The caption file may be too large or the API may be slow.'
        );
      } else if (error.code) {
        throw new Error(`Gemini CLI execution failed (exit code ${error.code}):\n${error.message}`);
      } else {
        throw new Error(`Gemini CLI error: ${error.message}`);
      }
    }
  }
}
