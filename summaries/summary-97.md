# ECMAScript仕様輪読会 第99回 まとめ

## 1. 導入と新ツールの紹介
本編に入る前に、参加者同士でコードを共有・実行できる「同時編集プレイグラウンド（JavaScript版）」が紹介されました。
*   **特徴**: ブラウザ上でV8エンジンによる挙動確認が可能。
*   **機能**: ユーザー名の設定が可能で、誰がコードを編集・実行しているかがリアルタイムで把握できる。
*   **目的**: 仕様書を読みながら、その場でコードの振る舞いを検証するために使用される。

## 2. 読み進めている仕様のステータス
*   **対象**: ECMAScriptのドラフト版（現在はES2026に向けた内容）。
*   **仕様の確定時期**: 毎年6月〜7月頃にその年のバージョンが確定する。
*   **Temporal**: 最近ステージ4（最終段階）に到達したが、まだメインの仕様書には完全にはマージされていない段階。

## 3. 前回内容の振り返り
前回は以下の内容が確認されました。
*   `Date.UTC`：数値を返し、引数をUTCとして解釈する。
*   `Date`コンストラクタ：Dateオブジェクトを生成し、引数をローカルタイムとして解釈する。
*   `Date.prototype`のメソッド：`getTime`, `getDate`, `setFullYear` など。
*   `toISOString`：ISO 8601拡張形式（年が4桁を超える場合など）への対応。
*   `toJSON`：意図的にジェネリックに設計されており、`this`がDateインスタンスでなくても呼び出し可能。

---

## 4. 今回読み進めた仕様

### 4.1. `Date.prototype.toLocaleDateString` / `toLocaleString` / `toLocaleTimeString`
これらのメソッドは国際化API（ECMA-402）との関連が深く、仕様上は以下のようになっています。

*   **ECMA-402が実装されている場合**: 同仕様に従って実装される。
*   **実装されていない場合のフォールバック**:
    *   返り値は「実装依存（implementation-defined）」の文字列。
    *   ただし、ホスト環境のカレントロケールや慣習に基づき、人間が読みやすい形式であることが意図されている。
    *   `toLocaleDateString`は日付部分、`toLocaleTimeString`は時刻部分のみを返すことを目的とする。

### 4.2. `Date.prototype.toString`
このメソッドは、`Date.prototype.toJSON`とは異なり**ジェネリックではありません**。

*   内部スロット `[[DateValue]]` を持たないオブジェクトを `this` として呼び出すと、`TypeError` を投げます。
*   ただし、`Date`を継承したクラスのインスタンスは内部スロットを持つため、呼び出し可能です。

```javascript
// 検証コード
const toStr = Date.prototype.toString;

// Dateインスタンスでないオブジェクトからの呼び出しはエラー
try {
  toStr.call({});
} catch (e) {
  console.log(e); // TypeError: Method Date.prototype.toString called on incompatible receiver
}

// Dateを継承したクラスはOK
class MyDate extends Date {}
console.log(toStr.call(new MyDate())); // 有効な日付文字列が返る
```

### 4.3. 抽象操作（Abstract Operations）の解読
`Date.prototype.toString` などの裏側で動く、文字列生成のアルゴリズムが詳しく読み解かれました。

#### `ToZeroPaddedDecimalString(n, minLength)`
数値を指定された長さでゼロ埋めした文字列に変換する共通処理です。
*   `n`: 0以上の整数。
*   `minLength`: 最小の桁数。
*   内部で `StringPad` 操作（`padStart`のような処理）が呼ばれます。

#### `DateString(tv)`
`Www Mmm dd yyyy`（例: `Mon Jan 01 2024`）という形式の文字列を生成します。
*   曜日の名前（Table 60）や月の名前（Table 61）は英語で定義されています。
*   **負の年**: 年が負の場合、先頭にマイナス記号を付け、絶対値を4桁でゼロ埋めします（例: `-0001`）。

#### `TimeString(tv)`
`HH:mm:ss GMT`（例: `12:34:56 GMT`）という形式を生成します。
*   `HourFromTime`, `MinFromTime`, `SecFromTime` といった操作を呼び出して各値を抽出します。

#### `TimeZoneString(tv)`
タイムゾーンのオフセットと名前を生成します（例: `+0900 (Japan Standard Time)`）。
*   オフセット記号（`+` または `-`）と4桁の数値（例: `0900`）を結合。
*   丸括弧内のタイムゾーン名（例: `(JST)`）の部分は**実装依存（implementation-defined）**とされており、ブラウザやOSによって異なります。

#### `ToDateString(tv)`
`Date.prototype.toString` の実体となる操作です。
*   `DateString` + `space` + `TimeString` + `TimeZoneString` を結合して返します。

---

## 5. 検証と議論

### ミリ秒の欠落とパース
`Date.prototype.toString()` の結果を `Date.parse()` で再度読み取った場合、ミリ秒単位で値が割り切れない（1000で割り切れない）Dateオブジェクトは、元の値と一致しなくなるという注意点が議論されました。

```javascript
const d = new Date(1234567890123); // ミリ秒が123
const s = d.toString();
const parsed = Date.parse(s);

console.log(d.getTime() === parsed); // false (ミリ秒が削れるため)
```
※仕様書のノートには「1000で割り切れる（ミリ秒が0）場合は、パースした結果が一致する」と記載されています。

### 異常値の挙動
*   `NaN`（Invalid Date）を渡した場合、抽象操作の冒頭でチェックされ、即座に `"Invalid Date"` という文字列が返ることが確認されました。
*   非常に古い年（マイナスの年など）を渡した際のゼロ埋めの挙動も確認されました。

```javascript
const d = new Date();
d.setFullYear(-1);
console.log(d.toDateString()); // "Sat Mar 22 -0001" (曜日は計算による)
```

## 6. 次回予告
*   次回は `Date.prototype.toUTCString` から読み進める予定。
*   `Date` オブジェクトの節がまもなく終了し、その次は「Text Processing（文字列処理）」の章に入る見込みです。
