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
  id: string;
  text: string;
}

export interface CosensePage {
  id: string;
  lines: CosenseLine[];
}

// Raw shape of `cosense readPage` JSON output. Scrapbox has "non-persistent" pages
// (a page slot that exists only because something links to it or it was visited via
// URL, but nobody has actually saved content to it yet): readPage still responds with
// HTTP 200 for these, but `persistent` is false and `id`/`linesCount`/`commitId` are null.
interface RawReadPageResult {
  id: string | null;
  persistent?: boolean;
  lines: CosenseLine[];
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

type EditOp = { insertBefore: string; text: string } | { replace: string; text: string } | { delete: string };

export class CosenseClient {
  /**
   * Build the full Scrapbox page URL for a given title, for use in API calls
   * (readPage / previewEdit). `#` and spaces are percent-encoded via
   * encodeURIComponent — required because a raw `#` would otherwise be
   * treated as a URL fragment and break the request.
   */
  private buildPageUrl(title: string): string {
    return `${PROJECT_URL}/${encodeURIComponent(title)}`;
  }

  /**
   * Build a human-readable Scrapbox page URL for console display only.
   * Only spaces are replaced with `_` (Scrapbox's conventional display form,
   * e.g. `ECMAScript仕様輪読会_#106`) — no percent-encoding is applied.
   * Do not use this for API calls; use the internal `buildPageUrl` (via
   * readPage/previewEdit/createPage/overwritePageBody) for those instead.
   */
  buildDisplayPageUrl(title: string): string {
    return `${PROJECT_URL}/${title.replaceAll(' ', '_')}`;
  }

  /**
   * Read a Scrapbox page (id + line texts) via `cosense readPage`.
   * Returns null if the page does not exist (HTTP 404), or if it is a
   * non-persistent page (`persistent: false`, `id: null` — a page slot that
   * exists only via a link/URL visit but has no saved content, which readPage
   * reports as HTTP 200) — both cases are treated as "no page to work with".
   * Throws on any other error.
   */
  async readPage(title: string): Promise<CosensePage | null> {
    const pageUrl = this.buildPageUrl(title);

    try {
      const { stdout } = await execFile(COSENSE_CLI_PATH, ['readPage', pageUrl], {
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      const result = JSON.parse(stdout) as RawReadPageResult;
      if (result.persistent !== true || typeof result.id !== 'string') {
        return null;
      }
      return { id: result.id, lines: result.lines };
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
   * Read a Scrapbox page's line texts via `cosense readPage`.
   * Returns null if the page does not exist (HTTP 404).
   * Throws on any other error.
   */
  async readPageLines(title: string): Promise<string[] | null> {
    const page = await this.readPage(title);
    if (page === null) {
      return null;
    }
    return page.lines.map((line) => line.text);
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
    const previewId = await this.runPreviewEdit(['--new', PROJECT_URL], bodyText);
    return this.runSubmitEdit(previewId);
  }

  /**
   * Overwrite an existing Scrapbox page's body with plain text (1st line = title, ignored).
   * Deletes all existing lines except the title line, then appends the new body lines
   * at the end. The title line itself is never touched (replacing it would rename the page).
   * Runs `previewEdit <projectUrl> <pageId>` (with an ops JSON on stdin) followed by `submitEdit`.
   */
  async overwritePageBody(page: CosensePage, bodyText: string): Promise<{ title: string; url: string }> {
    const bodyLines = bodyText.split('\n');
    const [newTitleLine, ...restLines] = bodyLines;

    const currentTitle = page.lines[0]?.text;
    if (currentTitle !== undefined && currentTitle !== newTitleLine) {
      console.warn(
        `[WARN] First line of bodyText ("${newTitleLine}") does not match the page's current title ("${currentTitle}"); the page title will not be changed.`
      );
    }

    const ops: EditOp[] = [];

    for (const line of page.lines.slice(1)) {
      ops.push({ delete: line.id });
    }

    if (restLines.length > 0) {
      ops.push({ insertBefore: '_end', text: restLines.join('\n') });
    }

    const previewId = await this.runPreviewEdit([PROJECT_URL, page.id], JSON.stringify({ ops }));
    return this.runSubmitEdit(previewId);
  }

  private async runPreviewEdit(args: string[], stdin: string): Promise<string> {
    const { stdout, stderr, code } = await this.spawnCommand(['previewEdit', ...args], stdin);

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
