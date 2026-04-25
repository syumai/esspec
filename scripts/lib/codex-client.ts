import { spawn } from "node:child_process";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execAsync = promisify(exec);

const CODEX_TIMEOUT_MS = 300000; // 5 minutes

export class CodexClient {
  /**
   * Check if Codex CLI is installed
   */
  async checkInstalled(): Promise<boolean> {
    try {
      await execAsync("which codex");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate a summary from a caption file using Codex CLI
   */
  async generateSummary(
    captionFile: string,
    prompt: string,
    scrapboxMemo?: string
  ): Promise<string> {
    // Check if Codex CLI is installed
    const isInstalled = await this.checkInstalled();
    if (!isInstalled) {
      throw new Error(
        "Codex CLI is not installed.\n" +
          "Please install it globally:\n" +
          "  npm install -g @openai/codex\n" +
          "\nFor more information, visit: https://github.com/openai/codex"
      );
    }

    console.log("[INFO] Reading caption file...");
    const captionContent = await readFile(captionFile, "utf-8");

    console.log("[INFO] Generating summary with Codex CLI...");
    console.log("[INFO] This may take a few minutes...\n");

    // Construct the full prompt with caption content
    let fullPrompt = `${prompt}\n\n---\n以下は字幕ファイルの内容です。\n\n<caption>${captionContent}</caption>`;

    if (scrapboxMemo) {
      fullPrompt += `\n\n---\n以下はScrapboxページの「今回のメモ」セクションの内容です。勉強会中に書かれたコード例やメモが含まれています。\n\n<scrapboxMemo>${scrapboxMemo}</scrapboxMemo>`;
    }

    return new Promise<string>((resolve, reject) => {
      const child = spawn("codex", ["exec", "-s", "read-only", "-"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(
          new Error(
            `Codex CLI timed out after ${CODEX_TIMEOUT_MS / 1000} seconds.\n` +
              "The caption file may be too large or the API may be slow."
          )
        );
      }, CODEX_TIMEOUT_MS);

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Codex CLI error: ${error.message}`));
      });

      child.on("close", (code) => {
        clearTimeout(timer);

        if (stderr) {
          console.warn("[WARN] Codex CLI stderr:", stderr);
        }

        if (code !== 0) {
          reject(
            new Error(
              `Codex CLI execution failed (exit code ${code}):\n${stderr || stdout}`
            )
          );
          return;
        }

        if (!stdout.trim()) {
          reject(new Error("Codex CLI returned empty output"));
          return;
        }

        resolve(stdout.trim());
      });

      // Write the prompt to stdin and close
      child.stdin.write(fullPrompt);
      child.stdin.end();
    });
  }
}
