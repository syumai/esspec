# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based tool for downloading YouTube video captions and generating summaries using Gemini AI. The project is specifically designed for ECMAScript specification study sessions (輪読会), downloading Japanese captions and generating detailed summaries in Japanese.

## Development Commands

**Type checking:**
```bash
pnpm run typecheck
```

**Authentication setup (run once):**
```bash
pnpm run auth
```

**Download captions from YouTube:**
```bash
pnpm run download-caption -- --event <num> --url <youtube_url>
# Example:
pnpm run download-caption -- --event 42 --url https://youtube.com/live/Q3ZKvcPSnNE
```

**Generate summary from captions:**
```bash
pnpm run generate-summary -- --event <num>
# Example:
pnpm run generate-summary -- --event 42
```

## Architecture

### Script Execution

All scripts are executed using Node.js with `--experimental-strip-types` flag, which allows running TypeScript files directly without compilation. This is configured in package.json scripts.

### Core Components

**scripts/lib/config.ts**: Central configuration
- Credentials stored in `~/.local/esspec/`
- YouTube API scopes and caption preferences (Japanese, SRT format)
- Gemini prompt configuration (Japanese prompt for detailed summaries)
- Retry and timeout settings

**scripts/lib/auth-manager.ts**: OAuth 2.0 authentication
- Manages Google OAuth 2.0 credentials for YouTube Data API
- Stores credentials in `~/.local/esspec/credentials.json`
- Stores access/refresh tokens in `~/.local/esspec/tokens.json`
- Automatically refreshes expired tokens with 5-minute buffer

**scripts/lib/youtube-client.ts**: YouTube Data API wrapper
- Fetches available caption tracks for videos
- Downloads captions in SRT format
- Selects Japanese captions (prefers manual over auto-generated)

**scripts/lib/gemini-client.ts**: Gemini AI integration
- Uses Gemini CLI (must be installed globally: `npm install -g @google/gemini-cli`)
- Generates summaries from caption files
- 5-minute timeout for processing, 10MB buffer for large outputs

**scripts/lib/video-id-extractor.ts**: URL parser
- Extracts video IDs from various YouTube URL formats
- Supports: /watch, /live, /embed, /v, youtu.be URLs

### Workflow

1. **Initial setup**: Run `auth.ts` to set up OAuth credentials via browser flow
   - Starts local server on port 3000 to receive OAuth callback
   - Opens browser for Google authentication
   - Saves tokens to `~/.local/esspec/tokens.json`

2. **Download captions**: Run `download-caption.ts` with event number and YouTube URL
   - Extracts video ID from URL
   - Authenticates with saved tokens
   - Fetches available caption tracks
   - Selects Japanese track (manual preferred over auto-generated)
   - Downloads to `./tmp/captions/caption-{event}.srt`
   - Skips if file already exists (no overwrite)

3. **Generate summary**: Run `generate-summary.ts` with event number
   - Reads caption from `./tmp/captions/caption-{event}.srt`
   - Calls Gemini CLI with Japanese prompt
   - Saves markdown summary to `./summaries/summary-{event}.md`
   - Overwrites existing summaries

### TypeScript Configuration

- Target: ES2022, Module: NodeNext
- Strict mode enabled
- Uses `rewriteRelativeImportExtensions: true` to keep `.ts` extensions in imports
- `verbatimModuleSyntax: true` for explicit type imports
- Only includes `scripts/**/*.ts`

## Prerequisites

- pnpm 10.7.1 (specified in packageManager)
- Node.js with TypeScript strip-types support (Node 20.16.0+)
- Google Cloud OAuth 2.0 credentials for YouTube Data API
- Gemini CLI installed globally: `npm install -g @google/gemini-cli`

## Important Notes

- All scripts use `.ts` extensions in imports due to Node.js module resolution with `rewriteRelativeImportExtensions`
- Credentials are stored in `~/.local/esspec/` for security (tokens.json has 0600 permissions)
- Caption files are never overwritten; summary files are overwritten
- Error handling includes specific messages for quota limits, permissions, and missing files
