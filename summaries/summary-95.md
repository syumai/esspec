## 1. Time Zone Offset String Format (続き)

前回の振り返りを経て、`Time Zone Offset String Format`の仕様確認から開始されました。

### 文法と構造
*   ECMAScriptはISO 8601由来のUTCオフセットのための交換形式を定義している。
*   **Numeric String Grammar**: ここで定義されている文法は、ソースコードのパース用ではなく、ランタイムで文字列を数値として解釈するために使われる文法（`StringStringToNumber`などで利用）。
*   **構成要素**:
    *   符号（`+` または `-`）
    *   Hour（時）
    *   `HourSubComponents`（分、秒、小数点以下）

### 文法的パラメータ（Extended）
文法定義において、パラメータ（`Extended`など）による生成規則の制御について議論されました。

*   **`Extended`ありの場合**:
    *   セパレーター（コロン `:`）が含まれる形式。
    *   例: `+HH:mm:ss.sss`
*   **`Extended`なしの場合**:
    *   セパレーターが含まれない形式。
    *   例: `+HHmmss.sss`
*   仕様上はコロンなしの形式も定義されているが、実際にどこで使われているのか、あるいは`Date`コンストラクタでパースできるのかについては疑問が呈されました。

### 実装と挙動の確認
*   `Date.parse` や `new Date()` に様々なフォーマットを渡して挙動を確認。
    *   コロンあり（Extended）はパースできるが、コロンなしや、秒・ミリ秒まで含めた複雑なオフセット形式はブラウザ（Chrome/V8）では`Invalid Date`になる場合がある。
*   **結論**:
    *   このフォーマット定義は、外部入力のパース用というよりは、内部的な「システムタイムゾーン識別子」や、特定のAPI（`ParseTimeZoneOffsetString`）での利用を想定している可能性が高い。
    *   `Date.parse`自体は、このフォーマットの厳密な適用よりも、実装依存のフォールバックやヒューリスティックな解釈を含んでいる。

## 2. The Date Constructor

`Date`コンストラクタの仕様読み合わせに入りました。

### Intrinsic Objects と Realm
仕様書内で登場する `%Date%` という表記に関連して、**Intrinsic Objects**（固有オブジェクト）と **Realm**（レルム）についての解説が行われました。

*   **Intrinsic Objects**: JSエンジンに組み込まれている「よく知られた（Well-known）」オブジェクト群。
*   **Realm**: スクリプトの実行コンテキストに関連する「グローバル環境」のような概念。
    *   例: ブラウザのメインウィンドウと、その中の`iframe`は別のRealmを持つ。
    *   そのため、メインウィンドウの`Array`と`iframe`内の`Array`は別のオブジェクト（アイデンティティが異なる）となり、`instanceof`などが意図通り動かないケースがある。

### Dateコンストラクタの挙動
`Date`は関数としても、コンストラクタ（`new`付き）としても呼び出せます。

1.  **関数として呼び出された場合 (`NewTarget` is undefined)**
    *   引数に関わらず、**現在時刻（UTC）を表す文字列**を返す（`Date.prototype.toString`相当）。
    *   引数は無視される（仕様上の挙動として確認され、驚きがあった点）。

2.  **コンストラクタとして呼び出された場合 (`new Date(...)`)**
    *   **引数なし (`new Date()`)**:
        *   現在時刻のタイムバリューを生成し、内部スロット `[[DateValue]]` に設定する。
    *   **引数1つ (`new Date(value)`)**:
        *   `value` が Dateオブジェクトの場合: その `[[DateValue]]` をコピーする。
        *   それ以外: `ToPrimitive(value)` を行う。
            *   結果が文字列の場合: `Date.parse` と同じアルゴリズムでパースする。
            *   結果が数値の場合: そのままタイムバリュー（ミリ秒）として扱う（`TimeClip`で有効範囲に丸められる）。
    *   **引数2つ以上 (`new Date(year, month, ...)`)**:
        *   `year`, `month` は必須。それ以降（`date`, `hours`, `minutes`, `seconds`, `ms`）は省略可能。
        *   省略時のデフォルト値:
            *   `date`: 1
            *   時刻関連: 0
        *   **MakeFullYear**: `year` が 0〜99 の場合、1900を加算して 1900〜1999年として扱う（レガシーな挙動）。
        *   各要素から `MakeDate`, `MakeTime` を経て最終的な `FinalDate` を計算し、`[[DateValue]]` に設定する。

### 内部スロットと継承
*   **`[[DateValue]]`**: Dateオブジェクトが持つ唯一のデータ（エポックからのミリ秒）。タイムゾーン情報は持たない（表示時にシステムのタイムゾーンが使われる）。
*   **サブクラス化**: `class MyDate extends Date` のように継承する場合、`super()` コールは必須。これを行わないと `[[DateValue]]` などの内部スロットが初期化されず、インスタンスとして不整合になる。

## 3. Properties of the Date Constructor

Dateコンストラクタ自身が持つプロパティについて。

*   `Date.prototype`: プロトタイプオブジェクト。
*   `Date.length`: 7（引数の最大数）。
*   **`Date.now()`**:
    *   現在時刻のタイムバリュー（Number）を返す。

### Date.parse (string)
文字列を日付に変換するメソッド。

*   **処理フロー**:
    1.  `ToString` を適用。
    2.  文字列を日付・時刻として解釈。
    3.  UTCタイムバリュー（Number）を返す。
*   **解釈のルール**:
    *   まず、仕様にある「Date Time String Format」に従ってパースを試みる。
        *   この際、「拡張された年（Expanded Year）」も含める。
    *   適合しない場合、**実装依存（Implementation-specific）** のヒューリスティックやフォーマットにフォールバックしてよい。
    *   解釈不能な場合は `NaN` を返す。
*   **省略時のデフォルト値**:
    *   月・日: `01`
    *   時刻: `00:00:00.000`
*   **UTC vs Local (重要な挙動の違い)**:
    *   タイムゾーン指定（`Z`やオフセット）がない場合：
        *   **日付のみ (Date-only forms, e.g., `2023-01-01`)**: **UTC** として解釈される。
        *   **日付と時刻 (Date-Time forms, e.g., `2023-01-01T00:00`)**: **ローカルタイム** として解釈される。
    *   この非対称性は注意が必要。

### 一貫性の要件 (Consistency)
あるDateオブジェクト `x` において、ミリ秒が0である場合、以下の式は同じ数値を生成すべきである（推奨）。

1.  `x.valueOf()`
2.  `Date.parse(x.toString())`
3.  `Date.parse(x.toUTCString())`
4.  `Date.parse(x.toISOString())`

ただし、`Date.parse(x.toLocaleString())` については、同じ値を生成することは求められていない（フォーマットが多様であり、パースできない場合も多いため）。

---

### 次回の予定
*   日程: 4週間後の3月3日（火）
*   範囲: `Date.prototype` から開始。
