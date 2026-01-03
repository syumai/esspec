# esspec

[ECMAScript仕様輪読会](https://esspec.connpass.com)のための、YouTube字幕取得およびGemini AIによる要約生成ツールです。

このツールは、指定された輪読会のアーカイブから字幕をダウンロードし、Gemini CLIを使用して詳細な要約（Markdown形式）を生成します。

## 使い方

### 1. 字幕のダウンロード

アーカイブのURLを指定して、字幕（日本語）をダウンロードします。

```bash
pnpm run download-caption -- --event <回数> --url <YouTubeのURL>
```

例:

```bash
pnpm run download-caption -- --event 42 --url https://youtube.com/live/Q3ZKvcPSnNE
```

ダウンロードされた字幕ファイルは `tmp/captions/caption-<回数>.srt` に保存されます。

### 2. 要約の生成

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
