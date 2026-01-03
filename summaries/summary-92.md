# 第92回 ECMAScript仕様輪読会

## 1. 前回の振り返り（Time Zone関連）

前回のセッションでは、日時（Date/Time）に関する基本的な定義やTime Zoneの導入部分を確認しました。

*   **基本型:** `F` は Number型である。
*   **計算操作:** `Day`, `TimeWithinDay`, `DaysInYear`, `MonthFromTime` など多数の操作が存在。
*   **インデックスの不整合:** 仕様内で、Month（月）が「0始まり」の箇所と「1始まり」の箇所が混在している（`UTCEpochNanoseconds`などは1始まり）。
*   **Time Zone:**
    *   `ZoneName`（例: `Asia/Tokyo`）や IANA Database へのリンク定義。
    *   すべての実装は少なくとも **UTC** をサポートする必要がある。
    *   独自の名前（例: `JST`）を勝手に使うべきではない。

次回（今回）は `GetNamedTimeZoneEpochNanoseconds` から読み進めることになっていました。

---

## 2. GetNamedTimeZoneEpochNanoseconds (抽象操作)

この操作は**実装定義（Implementation Defined）**であり、名前付きタイムゾーンにおける特定の日時（壁時計時間）に対応するエポックナノ秒を取得します。

### 定義と引数
```text
GetNamedTimeZoneEpochNanoseconds(
  timeZoneIdentifier, // String
  year, month, day,   // Integers (month, dayは inclusive interval: 1-12, 1-31)
  hour, minute, second,
  millisecond, microsecond, nanosecond
)
```
*   **戻り値:** BigIntの **List**（リスト）。
*   リストに含まれる各値は、指定されたタイムゾーンと日時（ISO 8601カレンダー）に対応する「エポックからのナノ秒」を表します。

### 戻り値のリストが複数要素または空になるケース（夏時間の影響）
入力された「ローカル時間（壁時計時間）」の解釈には以下のパターンがあります。

1.  **重複する時間（Repeat）:**
    *   **状況:** 夏時間（DST）の終了時や、タイムゾーンルールの変更でオフセットが減少（時間が戻る）する場合。
    *   **結果:** 同じローカル時間が1回より多く発生するため、**複数の要素**を持つリスト（数値の昇順ソート済み）を返す。
2.  **存在しない時間（Skip）:**
    *   **状況:** 夏時間の開始時や、タイムゾーンルールの変更でオフセットが増加（時間が進む）する場合。
    *   **結果:** 該当する時間はスキップされるため、**空のリスト**を返す。
3.  **通常:**
    *   それ以外の場合は、**1つの要素**のみを持つリストを返す。

### 具体例（America/New_York の場合）
*   **重複の例:** `2017-11-05 01:30` (DST終了日)
    *   この時間は「夏時間（EDT）」としての1:30と、「標準時（EST）」としての1:30の2回存在する。
    *   戻り値: `[UTC 05:30, UTC 06:30]` のような2つの値を含むリスト。
*   **欠落の例:** `2017-03-12 02:30` (DST開始日)
    *   時計が 02:00 から 03:00 に進むため、02:30 という時間は存在しない。
    *   戻り値: `[]` (空リスト)。

### デフォルト実装（タイムゾーン非認識の場合）
タイムゾーンの政治的ルール（Local Political Rules）を持たない実装の場合の振る舞い：
1.  `timeZoneIdentifier` が "UTC" であると断定（Assert）する。
2.  引数から単純にUTCのエポックナノ秒を計算して返す（タイムゾーン考慮なし）。

---

## 3. GetNamedTimeZoneOffsetNanoseconds (抽象操作)

指定されたエポックナノ秒時点での、UTCからのオフセットを返します。

*   **引数:** `timeZoneIdentifier`, `epochNanoseconds`
*   **戻り値:** 整数（Integer）。
*   **デフォルト実装:** 常に `0` を返す（UTC扱い）。

---

## 4. TimeZoneIdentifierRecord (仕様上の型)

`AvailableNamedTimeZoneIdentifiers` が返すリストの要素として使用されるレコード型です。

### Record（レコード）についての解説
*   **概要:** ECMAScript仕様内だけで使われる値の型。「リスト（List）」と同様に、JSの言語機能として直接露出するものではない。
*   **表記:** `[[Field]]` のように二重括弧でフィールド名が示される。
*   **特徴:** JSのオブジェクトとは異なり、固定のフィールドセットを持つプレーンなデータ構造。

### テーブル62: TimeZoneIdentifierRecord のフィールド
| フィールド名 | 説明 |
| :--- | :--- |
| `[[Identifier]]` | 実装がサポートする利用可能な名前付きタイムゾーン識別子（String）。 |
| `[[PrimaryIdentifier]]` | `[[Identifier]]` に対応するプライマリ（正規化された）タイムゾーン識別子。 |

*   **関係性:** `[[Identifier]]` がエイリアス（Link Name）の場合、`[[PrimaryIdentifier]]` にはその解決先（Zone Name）が入る。同一の場合は同じ値が入る。

---

## 5. AvailableNamedTimeZoneIdentifiers (抽象操作)

*   **動作:** 引数を取らず、`TimeZoneIdentifierRecord` のリストを返す。
*   **要件:**
    *   ECMA-402（国際化API）を実装している場合、IANA Time Zone Databaseの情報を使用することが**必須**（required）。
*   **デフォルト実装（タイムゾーン非認識）:**
    *   `UTC` のみを含むリストを返す。

---

## 6. SystemTimeZoneIdentifier (抽象操作)

ホスト環境の現在のタイムゾーンを表す文字列を返します。

### アルゴリズム
1.  実装がUTCのみサポートする場合: "UTC" を返す。
2.  ホスト環境のタイムゾーン文字列表現を取得する。これは「Primary Time Zone Identifier」または「Offset Time Zone Identifier」のいずれかである。
3.  取得した文字列を返す。

### Offset String の形式
*   `IsTimeZoneOffsetString` が `true` を返す形式。
*   例: `+09:00`, `-0500` など。
*   **詳細:** 秒の小数部（TemporalDecimalFraction）が非常に長く定義できる（最大9桁など）。

### 推奨事項 (Note)
*   単なるオフセット（例: `+09:00`）ではなく、可能な限りホスト環境の設定に対応する **IANAタイムゾーン名**（例: `America/New_York`）を返すことが推奨される。
*   ユーザーがシステム設定で「US Eastern Time」を選んでいるなら、`SystemTimeZoneIdentifier` は "America/New_York" を返すべきである。

---

## 7. LocalTime (抽象操作)

UTCの時刻値（Time Value）をローカル時刻（数値）に変換します。

### 定義
```text
LocalTime(t)
```
*   **引数:** `t` (Finite Time Value / UTC)
*   **戻り値:** Integer (Local Time)
*   **動作:** UTCからローカルタイムへ変換する。その地域の標準時および夏時間のルールを適用する。

### アルゴリズム
1.  `timeZoneIdentifier` = `SystemTimeZoneIdentifier()`
2.  `offsetNs`（オフセットナノ秒）を取得:
    *   識別子がオフセット文字列なら、それをパースして設定。
    *   そうでなければ、`GetNamedTimeZoneOffsetNanoseconds` を呼び出し、`t`（ミリ秒）をナノ秒（$10^6$倍）に換算して渡す。
3.  `offsetMs` = `offsetNs` / $10^6$ （切り捨て）
4.  戻り値 = `t + offsetMs`

*   **注記:**
    *   UTC時刻 `t` に対応するローカル時刻が存在しないことはない（常に1つに定まる）。
    *   ただし、異なるUTC時刻が同じローカル時刻になることはある（夏時間終了時の重複）。

---

## 8. UTC (抽象操作)

ローカル時刻（数値）をUTCの時刻値（Time Value）に変換します。`LocalTime` の逆操作ですが、複雑です。

### 定義
```text
UTC(t)
```
*   **引数:** `t` (Number / Local Time)
*   **戻り値:** Time Value (UTC)

### アルゴリズム（途中まで確認）
1.  `t` が有限でなければ `NaN` を返す。
2.  `timeZoneIdentifier` = `SystemTimeZoneIdentifier()`
3.  オフセット文字列なら単純計算。
4.  そうでない場合（名前付きタイムゾーン）:
    *   `possibleInstants` = `GetNamedTimeZoneEpochNanoseconds(..., tの各要素)`
    *   これはリストを返す（0個、1個、または2個の要素）。

### 重複・欠落時の解決ロジック (Note & Step)
*   **重複時（リストが2つ）:**
    *   リストは昇順（数値の小さい順＝早い時間順）にソートされている。
    *   一般的に、夏時間（DST）の方が標準時よりオフセットが大きいため、UTCに直すと値が小さく（早く）なる？（※ここでの議論は少し混乱ありつつも、仕様上はリストの先頭要素を使う流れ）。
    *   仕様：`possibleInstants` が空でない場合、`possibleInstants[0]` を採用する。
*   **欠落時（リストが空）:**
    *   時間がスキップされて存在しない場合。
    *   （議論中に詳細なアルゴリズムの読み解きは難航したが、次回詳しく確認することに）。

---

## 余談・議論ポイント

*   **Temporalプロポーザル:**
    *   現在の `Date` オブジェクトの複雑さや不備を解消するための新しい日時API。
    *   仕様書（プロポーザル）の量が膨大であり、既存の `Date` 仕様とは別に `Temporal` 名前空間として定義されているようだ。
    *   今回の範囲（`GetNamedTimeZoneEpochNanoseconds`など）は既存仕様の話であり、Temporalが入っても残る部分。
*   **実装の複雑さ:**
    *   夏時間の切り替わり（重複やスキップ）を扱うためのロジックが非常に複雑。
    *   `10^6` で割ったり掛けたりする変換が多い。

---

## 次回予定

*   **UTC (抽象操作)** の読み直しからスタート。
    *   特に `PossibleInstants` が空の場合や複数ある場合の挙動、アルゴリズムの詳細について、記憶が薄れることを見越して最初から確認し直す。
