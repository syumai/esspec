import { type Event } from './event-manager.ts';
import { formatToJapaneseDisplay } from './date-utils.ts';

/**
 * Format Date to time string (HH:MM)
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Add hours to a Date
 */
function addHours(date: Date, hoursToAdd: number): Date {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + hoursToAdd);
  return newDate;
}

/**
 * Generate event body template
 */
export function generateEventBody(event: Event, startTime: Date): string {
  const startTimeStr = formatTime(startTime);
  const breakTime = formatTime(addHours(startTime, 1));
  const endTime = formatTime(addHours(startTime, 2));

  return `## どんなイベント？

* 集まったメンバーで ECMAScript の仕様を読みます。
* オンライン開催 (Zoom + YouTube Live) します。

## イベント内容

* 参加枠のメンバーで、 [ECMAScript の Spec](https://tc39.es/ecma262) をいくつかのパートに分けて翻訳しながら読み進めます。

### 今回の範囲

* ${event.readingRange}

## 参加条件 (Zoom)

### 参加枠

* 業務や趣味で JavaScript を使ったことがある
* 英語を雰囲気で読み進められる。わからない単語が出現した時に、適宜調べられる
* 輪読会の途中で頻繁に議論が入って中断されても気にしない

#### 読んでおいた方がいい資料

できればこちらに軽く目を通してみてください

[ECMAScript仕様を読むのに必要な知識 - ダイジェスト版](https://speakerdeck.com/syumai/ecmascriptshi-yang-wodu-munonibi-yao-nazhi-shi-daiziesutoban)

## タイムテーブル

\`\`\`
${startTimeStr} 集合、自己紹介
${breakTime} 休憩 (10分)
${endTime} 終了
\`\`\`

## 参加者向けの情報

### Zoom の URL

* イベント開催前に、メールで連絡を行います。

### YouTube Live の URL

* メールおよび connpass で連絡を行います。

### 遅刻連絡

* 参加者への情報に記載している、Discordまで連絡をお願いします。
* または、管理者の [syumai](https://twitter.com/__syumai) 宛にDMまたはメンション（@ツイート）をお願いします。

## 行動規範

主催者を含む全ての参加者は次のページに記載される行動規範に従う必要があります。

https://syumai.github.io/event-code-of-conduct/ecma-spec/
`;
}

/**
 * Generate participant info template
 */
export function generateParticipantInfo(
  event: Event,
  zoomUrl: string,
  discordUrl: string
): string {
  if (!event.youtubeUrl) {
    throw new Error('YouTube URL is required for participant info generation');
  }

  return `* Zoom: ${zoomUrl}
* YouTube Live: ${event.youtubeUrl}
* Scrapbox: ${event.scrapboxUrl}
* 連絡用Discord: ${discordUrl}
`;
}

/**
 * Generate event message template
 */
export function generateEventMessage(
  event: Event,
  zoomUrl: string,
  discordUrl: string
): string {
  if (!event.youtubeUrl) {
    throw new Error('YouTube URL is required for event message generation');
  }

  return `こんにちは！ECMAScript 仕様輪読会主催の syumai です。
本日は、下記にて開催いたします。
Zoom: ${zoomUrl}
YouTube Live: ${event.youtubeUrl}
また、連絡用の Discord を用意しておりますので、もしよろしければこちらもご利用ください。
連絡用Discord: ${discordUrl}
本日はよろしくお願いいたします。`;
}

/**
 * Generate event info text
 */
export function generateEventInfo(event: Event, startTime: Date): string {
  return `イベントタイトル: ${event.eventName}
イベント番号: ${event.eventNumber}
開始日時: ${formatToJapaneseDisplay(startTime)}`;
}
