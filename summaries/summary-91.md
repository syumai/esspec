# 第91回 ECMAScript仕様輪読会

## 1. 前回の振り返り
本格的な読み合わせに入る前に、前回（ES2026に含まれる予定の機能など）の振り返りが行われました。

*   **Math.sumPrecise**:
    *   数値を一度「Mathematical Value（無限精度の値）」に変換してから合計し、最後にNumber型に戻すことで、精度の問題を回避して正確な合計値を出す機能。
    *   前回「2の53乗を超えたらRangeError」という仕様を確認し、実際に試そうとしたが、計算量が膨大すぎて現実的ではなかったという反省点について言及。
*   **Dateオブジェクト**:
    *   POSIXとの類似性、先発グレゴリオ暦（proleptic Gregorian calendar）の採用。
    *   表現可能な範囲はエポックから前後1億日（約27〜28万年）。
    *   **うるう秒（Leap seconds）**: ECMAScriptのTime Valueでは考慮しない。1分は常に60秒であり、61秒になる瞬間はない（OSや時計側で調整される可能性があるが、仕様上は無視される）。
    *   **うるう年（Leap year）**: 定義の確認。
    *   1年の平均日数の定義などが確認された。

## 2. Time-Related Constants (時間に関連する定数)
ここから今回のメインコンテンツである仕様の読み合わせが開始されました。以下の定数は、後続のセクションのアルゴリズムで参照されます。

| 定数名 | 値 | 説明 |
| :--- | :--- | :--- |
| `HoursPerDay` | 24 | 1日の時間数 |
| `MinutesPerHour` | 60 | 1時間の分数 |
| `SecondsPerMinute` | 60 | 1分の秒数 |
| `msPerSecond` | 1000 (`1000𝔽`) | 1秒のミリ秒数 |
| `msPerMinute` | 60000 (`60000𝔽`) | 1分のミリ秒数 |
| `msPerHour` | 3600000 (`3600000𝔽`) | 1時間のミリ秒数 |
| `msPerDay` | 86400000 (`86400000𝔽`) | 1日のミリ秒数 |

*   **議論**: 値の表記にある `𝔽` は、これが Mathematical Value ではなく、ECMAScript上の **Number型** であることを明示している。`HoursPerDay` など `𝔽` がついていないものは Mathematical Value として扱われる。

## 3. 日付と時刻の計算 (Abstract Operations)

### Day ( t )
有限のTime Value `t` (ミリ秒) を受け取り、エポック（1970年1月1日）からの経過日数を返します。

*   **アルゴリズム**:
    ```
    floor(R(t) / msPerDay)
    ```
*   **解説**:
    *   `t` はNumber型だが、`R(t)` でMathematical Valueに変換し、`msPerDay` で割って床関数（floor）を適用する。
    *   `t` が「該当する（falls on）」日を表す数値を返す。

### TimeWithinDay ( t )
その日の始まりから経過したミリ秒数を返します。

*   **アルゴリズム**:
    ```
    R(t) modulo msPerDay
    ```
*   **範囲**: `+0𝔽` から `msPerDay` (含まない) までの整数。

### DaysInYear ( y )
ある年 `y` が何日あるかを返します（365 または 366）。

*   **アルゴリズム**:
    *   `y` が400で割り切れるなら 366
    *   `y` が100で割り切れるなら 365
    *   `y` が4で割り切れるなら 366
    *   それ以外は 365
*   **解説**: うるう年の一般的な定義通り。

### DayFromYear ( y )
年 `y` の1月1日が、エポックから何日目にあたるかを計算します。

*   **アルゴリズム**:
    ```
    365 × (y - 1970)
    + floor((y - 1969) / 4)
    - floor((y - 1901) / 100)
    + floor((y - 1601) / 400)
    ```
*   **解説**:
    *   `y - 1970` は経過年数。
    *   それ以降の項は、エポックからその年までに挿入された「うるう日」の数を加算している。
    *   式中の定数（1969, 1901, 1601）は、計算の基準点合わせのために調整された値。

### TimeFromYear ( y )
年 `y` の開始時刻（ミリ秒）を返します。

*   **アルゴリズム**:
    ```
    msPerDay × DayFromYear(y)
    ```

### YearFromTime ( t )
時刻 `t` が属する「年」を返します。

*   **定義**:
    *   `TimeFromYear(y) <= t` を満たす最大の整数 `y`。
*   **議論**:
    *   仕様上は「満たす最大の整数」と定義されているだけだが、実装時は探索アルゴリズムなどが必要になりそうであり、頻繁に使われる操作のためパフォーマンスが重要になるだろうという意見が出た。

### DayWithinYear ( t )
時刻 `t` がその年の中で何日目か（0始まり）を返します。

*   **アルゴリズム**:
    ```
    Day(t) - DayFromYear(YearFromTime(t))
    ```
*   **範囲**: 0 〜 365（うるう年の場合）。

### InLeapYear ( t )
時刻 `t` がうるう年に属するかどうかを返します。

*   **戻り値**: うるう年なら `1`、そうでなければ `0`。
*   **議論**: なぜBoolean（true/false）ではなく `1/0` なのか？ → 後続の `MonthFromTime` の計算式で数値として扱うため（日数の加算に使用される）であることが判明。

### MonthFromTime ( t )
時刻 `t` が属する「月」を返します（0 = 1月, 11 = 12月）。

*   **アルゴリズム**:
    *   `DayWithinYear(t)` の値と `InLeapYear(t)` の結果を用いて判定する。
    *   例: 0 <= 日数 < 31 なら 0 (1月)
    *   例: 31 <= 日数 < 59 + `InLeapYear(t)` なら 1 (2月) ...
*   **議論**:
    *   1月=0、12月=11 という仕様（JavaやC言語の `struct tm` に由来する古い慣習）がここでも確認された。
    *   `DateFromTime(t)`（日付を返す操作）は1始まり（1-31）であり、月と日でインデックスの始まりが違うことへの言及があった。
    *   計算式が、if文の羅列ではなく「日数 < 閾値」のような愚直な定義で記述されている。

### WeekDay ( t )
時刻 `t` の曜日を返します（0 = 日曜日 〜 6 = 土曜日）。

*   **アルゴリズム**:
    ```
    (Day(t) + 4) modulo 7
    ```
*   **解説**:
    *   エポック（1970年1月1日）が **木曜日** であったため、`+4` して調整している（日曜=0 とするため）。
    *   数式内の数字のフォントの違い（Mathematical ValueかNumber型か）に注意が必要。

### 時刻コンポーネントの取得
以下の操作は、時刻 `t` から各単位の値を抽出します。

*   **HourFromTime(t)**: 0 〜 23
    *   `floor((t / msPerHour) modulo HoursPerDay)`
*   **MinFromTime(t)**: 0 〜 59
    *   `floor((t / msPerMinute) modulo MinutesPerHour)`
*   **SecFromTime(t)**: 0 〜 59
    *   `floor((t / msPerSecond) modulo SecondsPerMinute)`
*   **msFromTime(t)**: 0 〜 999
    *   `t modulo msPerSecond`

---

## 4. GetUTCEpochNanoseconds
（新しいTemporal APIなどに関連する）年、月、日、時、分、秒、ミリ秒、マイクロ秒、ナノ秒を受け取り、UTCエポックからのナノ秒単位の経過時間をBigIntで返す操作。

*   **引数**: `year`, `month` (1-12), `day`, ... `nanosecond`
*   **アルゴリズム概要**:
    1.  `MakeDay`, `MakeTime`, `MakeDate` を使用してミリ秒までのタイムスタンプを計算。
    2.  それを `10^6` 倍してナノ秒に換算。
    3.  マイクロ秒（`10^3`倍）とナノ秒を加算する。
*   **議論**:
    *   ここで使われる `MakeDay` などの古い操作は月を0-11で扱うが、この `GetUTCEpochNanoseconds` のインターフェースや新しい仕様（Temporalなど）では月を1-12で扱うことが多く、内部で `month - 1` するなどの調整が行われている点がややこしい。

---

## 5. Time Zone Identifiers (タイムゾーン識別子)

### 定義と構成
*   **Time Zone Identifier**: `0x00` (NUL) から `0x007F` (DEL) までのコードユニット（ASCII文字）で構成される文字列。
*   **Available Named Time Zones**: ECMAScript実装がサポートするタイムゾーンの集合。
*   **Offset Time Zones**: `+09:00` のような固定オフセットを表す文字列（`IsTimeZoneOffsetString` で判定される）。

### Primary vs Non-Primary
*   **Primary Time Zone Identifier**: そのタイムゾーンに対して「好ましい（preferred）」とされる識別子。いわゆる "Canonical" な名前（例: `Asia/Tokyo`, `UTC`）。
*   **Non-Primary Time Zone Identifier**: Primaryではない識別子（例: `Japan` などのリンクやエイリアス）。
*   **関係性**:
    *   各 Available Named Time Zone は、**正確に1つの Primary Identifier** と、**0個以上の Non-Primary Identifiers** を持つ。

### 実装への要求
*   **必須要件**: すべての実装は `UTC` をサポートしなければならず、`UTC` は Primary Time Zone Identifier でなければならない。
*   **Time Zone Aware 実装 (ECMA-402)**:
    *   IANA Time Zone Database (tz database) の Zone と Link 名に対応する識別子をサポートしなければならない。
    *   基本的に **Primary = Zone Name**、**Non-Primary = Link Name** となる（ECMA-402で明示的に上書きされる場合を除く）。
*   **推奨事項**: 完全なTime Zone Databaseをサポートしない実装であっても、タイムゾーン識別子には IANA Time Zone Database の名前を使用することが推奨される。

### 議論
*   `JST` は Primary なのか？ という疑問に対し、`Asia/Tokyo` が Primary（Zone Name）であり、`JST` は省略形（Abbreviation）であって、ここでの Identifier の定義（Zone or Link）には当てはまらないのではないか、という確認が行われた。
*   IANA Database における `Zone`（地域名）と `Link`（別名）の関係が、ECMAScript仕様上の `Primary` と `Non-Primary` にマッピングされていることが確認された。

---

ここで時間が来たため、次回は `GetNamedTimeZoneEpochNanoseconds` から読み進めることとなり、終了しました。
