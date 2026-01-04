# esspec

[ECMAScript仕様輪読会](https://esspec.connpass.com)のための、イベント管理、YouTube字幕取得およびGemini AIによる要約生成ツールです。

このツールは、輪読会のイベント情報をYAML形式で管理し、アーカイブから字幕をダウンロードし、Gemini CLIを使用して詳細な要約（Markdown形式）を生成します。

## 使い方

### 1. イベントの作成

新しい輪読会のイベントを作成します。

```bash
pnpm run create-event <回数>
```

例:

```bash
pnpm run create-event 93
```

コマンドを実行すると、輪読の範囲を入力するプロンプトが表示されます。入力後、イベント情報が `events/event-<回数>.yaml` に保存されます。

イベント情報には以下が含まれます：
- イベント名（自動生成）
- 輪読の範囲（入力必須）
- Scrapbox URL（自動生成）
- connpass URL（オプション、将来のコマンドで追加予定）
- YouTube URL（オプション、将来のコマンドで追加予定）

### 2. 字幕のダウンロード

アーカイブのURLを指定して、字幕（日本語）をダウンロードします。

```bash
pnpm run download-caption -- --event <回数> --url <YouTubeのURL>
```

例:

```bash
pnpm run download-caption -- --event 42 --url https://youtube.com/live/Q3ZKvcPSnNE
```

ダウンロードされた字幕ファイルは `tmp/captions/caption-<回数>.srt` に保存されます。

### 3. 要約の生成

ダウンロードした字幕ファイルをもとに、Gemini AIを使って要約を生成します。

```bash
pnpm run generate-summary -- --event <回数>
```

生成された要約ファイルは `summaries/summary-<回数>.md` に保存されます。

## 開発

```bash
# 型チェック
pnpm run typecheck
```
