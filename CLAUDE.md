# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based tool for managing ECMAScript specification study sessions (輪読会). It provides event management, YouTube video caption downloading, and AI-powered summary generation using Gemini AI. Event information is stored as YAML files with schema validation via Zod.

## Development Commands

**Type checking:**
```bash
pnpm run typecheck
```

**Authentication setup (run once):**
```bash
pnpm run auth
```

**Create new event:**
```bash
pnpm run create-event <event_number>
# Example:
pnpm run create-event 93
```

**Download captions from YouTube:**
```bash
pnpm run download-caption -- --event <num> --url <youtube_url>
# Example:
pnpm run download-caption -- --event 42 --url https://youtube.com/live/Q3ZKvcPSnNE
```

**Generate summary from captions:**
```bash
pnpm run generate-summary <event_number>
# Example:
pnpm run generate-summary 42
```

## Architecture

### Script Execution

All scripts are executed using Node.js with `--experimental-strip-types` flag, which allows running TypeScript files directly without compilation. This is configured in package.json scripts.

### Core Components

**scripts/lib/event-manager.ts**: Event management
- Manages event data with Zod schema validation
- Stores events as YAML files in `./events/` directory
- Auto-generates event names and Scrapbox URLs
- Supports creating, loading, and updating events
- Event schema includes: eventNumber, eventName, eventDateTime, readingRange, connpassUrl (optional), youtubeUrl (optional), scrapboxUrl
- Configuration: events directory (`./events/`)

**scripts/lib/auth-manager.ts**: OAuth 2.0 authentication
- Manages Google OAuth 2.0 credentials for YouTube Data API
- Stores credentials in `~/.local/esspec/credentials.json`
- Stores access/refresh tokens in `~/.local/esspec/tokens.json`
- Automatically refreshes expired tokens with 5-minute buffer
- Configuration: credentials directory (`~/.local/esspec/`)

**scripts/lib/youtube-client.ts**: YouTube Data API wrapper
- Fetches available caption tracks for videos
- Downloads captions in SRT format
- Selects Japanese captions (prefers manual over auto-generated)
- Configuration: caption format (SRT), preferred language (Japanese)

**scripts/lib/gemini-client.ts**: Gemini AI integration
- Uses Gemini CLI (must be installed globally: `npm install -g @google/gemini-cli`)
- Generates summaries from caption files
- Configuration: 5-minute timeout, 10MB buffer for large outputs

**scripts/lib/video-id-extractor.ts**: URL parser
- Extracts video IDs from various YouTube URL formats
- Supports: /watch, /live, /embed, /v, youtu.be URLs

**scripts/lib/date-utils.ts**: Date utility functions
- Handles date-time operations for event management
- Parses and formats ISO 8601 datetime strings (JST timezone)
- Calculates suggested event dates (2 weeks after previous event)
- Formats dates for Japanese display (e.g., "2026/01/06(月) 19:30")
- Validates user input for date and time
- Configuration: JST timezone (+09:00), default time (19:30)

### Workflow

1. **Initial setup**: Run `auth.ts` to set up OAuth credentials via browser flow
   - Starts local server on port 3000 to receive OAuth callback
   - Opens browser for Google authentication
   - Saves tokens to `~/.local/esspec/tokens.json`

2. **Create event**: Run `create-event.ts` with event number
   - Prompts user for reading range (輪読の範囲)
   - Prompts user for event date-time:
     - If previous event exists: suggests 2 weeks after previous event's date (default time: 19:30 JST)
     - User can accept suggestion (y), decline (n) for manual input, or directly enter custom date-time
     - Accepts formats: "YYYY/MM/DD" or "YYYY/MM/DD HH:MM"
     - Date-time is stored in ISO 8601 format with JST timezone (e.g., "2026-01-06T19:30:00+09:00")
   - Auto-generates event name: "ECMAScript 仕様輪読会 第{N}回"
   - Auto-generates Scrapbox URL: `https://scrapbox.io/esspec/ECMAScript仕様輪読会_#{N}`
   - Validates input with Zod schema
   - Saves event data to `./events/event-{event}.yaml`
   - Prevents overwriting existing event files
   - Configuration: events directory (`./events/`)

3. **Download captions**: Run `download-caption.ts` with event number and YouTube URL
   - Extracts video ID from URL
   - Authenticates with saved tokens
   - Fetches available caption tracks
   - Selects Japanese track (manual preferred over auto-generated)
   - Downloads to `./tmp/captions/caption-{event}.srt`
   - Skips if file already exists (no overwrite)
   - Configuration: captions directory (`./tmp/captions`)

4. **Generate summary**: Run `generate-summary.ts` with event number
   - Reads caption from `./tmp/captions/caption-{event}.txt`
   - Calls Gemini CLI with Japanese prompt (detailed summaries, skip introductions)
   - Saves markdown summary to `./summaries/summary-{event}.md`
   - Overwrites existing summaries
   - Configuration: captions directory (`./tmp/captions`), summaries directory (`./summaries`), Gemini prompt

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
- Configuration values (paths, timeouts, prompts) are defined directly in each script/module as constants
- Credentials are stored in `~/.local/esspec/` for security (tokens.json has 0600 permissions)
- Event files and caption files are never overwritten; summary files are overwritten
- Event data is validated using Zod schemas at runtime
- Error handling includes specific messages for quota limits, permissions, and missing files
