import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execFile = promisify(execFileCb);

const PROJECT_URL = 'https://scrapbox.io/esspec';
const COSENSE_CLI_PATH = join(process.cwd(), 'node_modules', '.bin', 'cosense');
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10MB
const LOGIN_HINT = 'cosense login https://scrapbox.io を実行してください';

interface CosenseLine {
  text: string;
}

interface ReadPageResult {
  lines: CosenseLine[];
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export class CosenseClient {
  /**
   * Build the full Scrapbox page URL for a given title.
   * `#` and spaces are percent-encoded via encodeURIComponent.
   */
  private buildPageUrl(title: string): string {
    return `${PROJECT_URL}/${encodeURIComponent(title)}`;
  }

  /**
   * Read a Scrapbox page's line texts via `cosense readPage`.
   * Returns null if the page does not exist (HTTP 404).
   * Throws on any other error.
   */
  async readPageLines(title: string): Promise<string[] | null> {
    const pageUrl = this.buildPageUrl(title);

    try {
      const { stdout } = await execFile(COSENSE_CLI_PATH, ['readPage', pageUrl], {
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      const result = JSON.parse(stdout) as ReadPageResult;
      return result.lines.map((line) => line.text);
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const combined = `${err.stdout ?? ''}${err.stderr ?? ''}`;

      if (combined.includes('HTTP 404')) {
        return null;
      }

      throw new Error(
        `Failed to read Scrapbox page "${title}": ${err.message ?? String(error)}\n${combined}`
      );
    }
  }

  /**
   * Check whether a Scrapbox page with the given title exists.
   */
  async pageExists(title: string): Promise<boolean> {
    const lines = await this.readPageLines(title);
    return lines !== null;
  }

  /**
   * Create a new Scrapbox page from plain text body (1st line = title).
   * Runs `previewEdit --new` followed by `submitEdit`.
   */
  async createPage(bodyText: string): Promise<{ title: string; url: string }> {
    const previewId = await this.runPreviewEdit(bodyText);
    return this.runSubmitEdit(previewId);
  }

  private async runPreviewEdit(bodyText: string): Promise<string> {
    const { stdout, stderr, code } = await this.spawnCommand(
      ['previewEdit', '--new', PROJECT_URL],
      bodyText
    );

    if (code !== 0) {
      throw new Error(this.formatCliError('previewEdit', code, stdout, stderr));
    }

    const match = stdout.match(/^previewId:\s*(\S+)/m);
    if (!match) {
      throw new Error(
        `Failed to parse previewId from "cosense previewEdit" output.\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }

    return match[1];
  }

  private async runSubmitEdit(previewId: string): Promise<{ title: string; url: string }> {
    const { stdout, stderr, code } = await this.spawnCommand(
      ['submitEdit', PROJECT_URL, previewId],
      null
    );

    if (code !== 0) {
      throw new Error(this.formatCliError('submitEdit', code, stdout, stderr));
    }

    const titleMatch = stdout.match(/^title:\s*(.+)$/m);
    const urlMatch = stdout.match(/^url:\s*(\S+)/m);

    if (!titleMatch || !urlMatch) {
      throw new Error(
        `Failed to parse title/url from "cosense submitEdit" output.\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }

    return { title: titleMatch[1].trim(), url: urlMatch[1].trim() };
  }

  private formatCliError(command: string, code: number | null, stdout: string, stderr: string): string {
    const combined = `${stdout}${stderr}`;
    const base = `"cosense ${command}" failed (exit code ${code}).\nstdout:\n${stdout}\nstderr:\n${stderr}`;

    if (combined.includes('HTTP 403')) {
      return `${base}\n\n[INFO] 認証エラーです。次のコマンドを実行してください: ${LOGIN_HINT}`;
    }

    return base;
  }

  private spawnCommand(args: string[], stdin: string | null): Promise<SpawnResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(COSENSE_CLI_PATH, args, { timeout: COMMAND_TIMEOUT_MS });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code });
      });

      if (stdin !== null) {
        child.stdin.write(stdin, 'utf-8');
      }
      child.stdin.end();
    });
  }
}
