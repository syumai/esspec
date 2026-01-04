# esspec

[ECMAScript仕様輪読会](https://esspec.connpass.com)のための、イベント管理、YouTube字幕取得およびGemini AIによる要約生成ツールです。

このツールは、輪読会のイベント情報をYAML形式で管理し、アーカイブから字幕をダウンロードし、Gemini CLIを使用して詳細な要約（Markdown形式）を生成します。

## 過去の輪読会のサマリー一覧

- [https://syumai.github.io/esspec/summaries/](https://syumai.github.io/esspec/summaries/)

## 前提条件

- pnpm 10.7.1
- Node.js 20.16.0 以上（TypeScript strip-types サポート）
- Gemini CLI: `npm install -g @google/gemini-cli`
- Google Cloud OAuth 2.0 認証情報（YouTube Data API用）

## 初期セットアップ

### 1. 認証設定（初回のみ実行）

YouTube Data APIを使用するために、Google OAuth 2.0認証を設定します。

```bash
pnpm run auth
```

このコマンドを実行すると：
- ブラウザが開き、Googleアカウントでの認証を求められます
- 認証情報が `~/.local/esspec/` に保存されます
- この設定は一度行えば、以降は不要です

### 2. 環境変数の設定

Connpassイベントテンプレート生成に必要な環境変数を設定します。

```bash
export ESSPEC_ZOOM_URL="https://zoom.us/j/..."
export ESSPEC_DISCORD_URL="https://discord.gg/..."
```

これらの環境変数を永続化するには、シェルの設定ファイル（`.bashrc`, `.zshrc` など）に追加してください。

## 使い方

### クイックスタート：統合ワークフロー（推奨）

新しいイベントを一括でセットアップするには、以下のコマンドを使用します：

```bash
pnpm run setup-event <回数>
```

例:

```bash
pnpm run setup-event 93
```

このコマンドは以下を自動実行します：
1. イベントの作成（`create-event`）
2. YouTube Live配信の作成（`create-broadcast`）
3. Connpassイベントテンプレートの生成（`generate-connpass-texts`）

実行中に以下の情報を入力するプロンプトが表示されます：
- **輪読の範囲**（必須）: 当日扱う仕様のセクション
- **開催日時**（必須）: 前回イベントから2週間後の日時が提案されます

### 個別コマンド

必要に応じて、各ステップを個別に実行することもできます。

#### 1. イベントの作成

新しい輪読会のイベントを作成します。

```bash
pnpm run create-event <回数>
```

例:

```bash
pnpm run create-event 93
```

コマンドを実行すると、以下の情報を入力するプロンプトが表示されます：

1. **輪読の範囲**（必須）: 当日扱う仕様のセクション
2. **開催日時**（必須）:
   - 前回イベントが存在する場合、2週間後の日時（19:30 JST）が提案されます
   - `y` で提案を採用、`n` で手動入力、または直接カスタム日時を入力できます
   - 日付フォーマット: `YYYY/MM/DD` または `YYYY/MM/DD HH:MM`
   - 時刻を省略した場合は 19:30 がデフォルトで使用されます

入力後、イベント情報が `events/event-<回数>.yaml` に保存されます。

イベント情報には以下が含まれます：
- イベント名（自動生成）
- 開催日時（入力必須、ISO 8601形式で保存）
- 輪読の範囲（入力必須）
- Scrapbox URL（自動生成）
- Connpass URL（オプション、手動追加可能）
- YouTube URL（`create-broadcast`実行時に自動追加）

#### 2. YouTube Live配信の作成

YouTube Live配信を作成し、配信URLをイベントファイルに保存します。

```bash
pnpm run create-broadcast <回数>
```

例:

```bash
pnpm run create-broadcast 93
```

このコマンドは：
- YouTube Live配信を作成します
- 配信URLを自動的にイベントファイルに保存します
- 配信設定（タイトル、説明、開始時刻など）をイベントデータから自動設定します
- ストリーミングキーとRTMP URLを表示します（OBS等での配信に使用）

既にYouTube URLが設定されている場合は、更新または新規作成を選択できます。

#### 3. Connpassイベントテンプレートの生成

Connpassイベントページ作成用のテンプレートファイルを生成します。

```bash
pnpm run generate-connpass-texts <回数>
```

例:

```bash
pnpm run generate-connpass-texts 93
```

このコマンドは `tmp/connpass/` に以下のファイルを生成します：
- `event-<回数>-body.md` - イベント本文（タイムテーブル、参加条件などを含む）
- `event-<回数>-participant-info.md` - 参加者への情報（Zoom、YouTube Live、Scrapbox、DiscordのURL）
- `event-<回数>-message.md` - 開催メッセージ（参加者への連絡用）
- `event-<回数>-info.txt` - イベント情報（タイトル、番号、日時）

これらのファイルをConnpassイベントページの作成時にコピー&ペーストして使用します。

#### 4. 字幕のダウンロード

イベント配信後、アーカイブから字幕をダウンロードします。

```bash
pnpm run download-caption <回数>
```

例:

```bash
pnpm run download-caption 42
```

YouTube URLは、イベントファイルに保存されたURLから自動的に取得します（`create-broadcast`実行時に保存されます）。

ダウンロードされた字幕ファイルは以下に保存されます：
- `tmp/captions/caption-<回数>.srt` - 元のSRT形式
- `tmp/captions/caption-<回数>.txt` - テキスト形式（タイムスタンプ除去済み）

#### 5. 要約の生成

ダウンロードした字幕ファイルをもとに、Gemini AIを使って要約を生成します。

```bash
pnpm run generate-summary <回数>
```

例:

```bash
pnpm run generate-summary 42
```

生成された要約ファイルは `summaries/summary-<回数>.md` に保存されます。

## 開発

```bash
# 型チェック
pnpm run typecheck
```
