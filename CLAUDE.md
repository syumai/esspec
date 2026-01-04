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
pnpm run download-caption <event_number>
# Example:
pnpm run download-caption 42
# Note: YouTube URL is automatically fetched from event data
```

**Generate summary from captions:**
```bash
pnpm run generate-summary <event_number>
# Example:
pnpm run generate-summary 42
```

**Create YouTube Live broadcast:**
```bash
pnpm run create-broadcast <event_number>
# Example:
pnpm run create-broadcast 93
# This creates a YouTube Live broadcast and saves the URL to the event file
```

**Generate Connpass event templates:**
```bash
pnpm run generate-connpass-texts <event_number>
# Example:
pnpm run generate-connpass-texts 93
# Requires environment variables: ESSPEC_ZOOM_URL, ESSPEC_DISCORD_URL
# Generates 4 template files in ./tmp/connpass/
```

**Run complete event setup workflow:**
```bash
pnpm run setup-event <event_number>
# Example:
pnpm run setup-event 93
# This runs: create-event → create-broadcast → generate-connpass-texts
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
- Creates YouTube Live broadcasts with configuration
- Updates existing broadcasts
- Creates live streams and binds them to broadcasts
- Orchestrates complete broadcast setup workflow
- Configuration: caption format (SRT), preferred language (Japanese), default category ID (28 - Science & Technology)

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

**scripts/lib/srt-parser.ts**: SRT subtitle parser
- Parses SRT (SubRip Subtitle) format files
- Extracts plain dialogue text, removing sequence numbers and timestamps
- Preserves original line breaks in dialogue
- Used during caption download to create .txt version alongside .srt
- Configuration: none (pure parser utility)

**scripts/lib/connpass-text-generator.ts**: Connpass template generator
- Generates event body template with timetable and participation requirements
- Generates participant info template (Zoom, YouTube Live, Scrapbox, Discord URLs)
- Generates event message template for participant communication
- Generates event info text (title, number, date-time)
- Validates that YouTube URL exists before generating participant-facing templates
- Configuration: timetable timing (start, break at +1h, end at +2h)

**scripts/lib/arg-parser.ts**: Shared argument parser
- Provides `parseEventNumberArg()` function for parsing event numbers from command-line arguments
- Used by all event-related scripts (create-event, download-caption, generate-summary, create-broadcast, generate-connpass-texts)
- Accepts only positional arguments (e.g., `pnpm run create-event 42`)
- Validates that event number is a positive integer
- Reduces code duplication across scripts
- Configuration: none (pure parser utility)

### Workflow

**Quick start**: For a complete event setup workflow, you can use `pnpm run setup-event <event_number>` which runs `create-event`, `create-broadcast`, and `generate-connpass-texts` in sequence. This is the recommended approach for new events.

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

3. **Create broadcast**: Run `create-broadcast.ts` with event number
   - Loads event data from `./events/event-{event}.yaml`
   - Authenticates with saved tokens
   - Creates YouTube Live broadcast with event details
   - Configures broadcast: title (from event), description (reading range + URLs), scheduled time, privacy (public), latency (normal), category (28 - Science & Technology)
   - Creates RTMP stream and binds to broadcast
   - Returns stream key and ingestion address for OBS/streaming software
   - Saves YouTube URL to event file
   - If YouTube URL already exists, prompts to update existing broadcast or create new one
   - Configuration: broadcast settings (privacy, latency, category), stream settings (RTMP, variable resolution/framerate)

4. **Generate Connpass templates**: Run `generate-connpass-texts.ts` with event number
   - Loads event data from `./events/event-{event}.yaml`
   - Requires environment variables: ESSPEC_ZOOM_URL, ESSPEC_DISCORD_URL
   - Generates event body with timetable (start time, break at +1h, end at +2h)
   - Generates participant info (Zoom, YouTube Live, Scrapbox, Discord URLs)
   - Generates event message for participant communication
   - Generates event info summary (title, number, date-time)
   - Saves 4 markdown/text files to `./tmp/connpass/`
   - Configuration: timetable timing, template structure

5. **Download captions**: Run `download-caption.ts` with event number
   - Loads YouTube URL from event data (requires event to have youtubeUrl set via create-broadcast)
   - Extracts video ID from URL
   - Authenticates with saved tokens
   - Fetches available caption tracks
   - Selects Japanese track (manual preferred over auto-generated)
   - Downloads to `./tmp/captions/caption-{event}.srt`
   - Converts SRT to plain text using SRTParser
   - Saves plain text version to `./tmp/captions/caption-{event}.txt`
   - Skips if SRT file already exists (no overwrite)
   - Configuration: captions directory (`./tmp/captions`)

6. **Generate summary**: Run `generate-summary.ts` with event number
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
- Environment variables (for Connpass template generation):
  - `ESSPEC_ZOOM_URL`: Zoom meeting URL
  - `ESSPEC_DISCORD_URL`: Discord server URL
- Gemini CLI installed globally: `npm install -g @google/gemini-cli`

## Important Notes

- All scripts use `.ts` extensions in imports due to Node.js module resolution with `rewriteRelativeImportExtensions`
- Configuration values (paths, timeouts, prompts) are defined directly in each script/module as constants
- Credentials are stored in `~/.local/esspec/` for security (tokens.json has 0600 permissions)
- Event files and caption SRT files are never overwritten; caption TXT files and summary files are overwritten
- Caption download automatically creates both SRT and TXT versions
- Connpass template files are overwritten on each generation
- All event-related scripts accept `<event_number>` as a positional argument, parsed via shared arg-parser library
- Event data is validated using Zod schemas at runtime
- Error handling includes specific messages for quota limits, permissions, and missing files
