import { homedir } from 'node:os';
import { join } from 'node:path';

export const config = {
  // Paths
  credentialsDir: join(homedir(), '.local', 'esspec'),
  captionsDir: './tmp/captions',
  summariesDir: './summaries',

  // YouTube API
  youtubeScopes: ['https://www.googleapis.com/auth/youtube.force-ssl'] as string[],
  preferredCaptionLanguage: 'ja',
  captionFormat: 'srt' as const,

  // Gemini
  geminiPrompt: `このECMAScript仕様輪読会全体の内容を、出来る限り省略無しで、詳しく説明してください。
ただし、冒頭に行われる、自己紹介及び雑談の部分は飛ばしてください。
書式はMarkdownで整え、必要に応じてコードブロックによる説明を示してください。`,

  // Retry settings
  maxRetries: 3,
  retryDelayMs: 1000,

  // Timeouts
  geminiTimeoutMs: 300000, // 5 minutes
};
