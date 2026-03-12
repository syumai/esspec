# 第96回 ECMAScript仕様輪読会 記録

本セッションでは、前回に引き続き「21.4 Date Objects」の仕様を確認しました。主に `Date.UTC` 関数から `Date.prototype` の各メソッド（Getter/Setter、文字列変換）について、仕様のアルゴリズムと実際の挙動をコードで検証しながら読み進めました。

## 1. 前回の振り返り
前回確認した以下の内容を軽く復習しました。
- タイムゾーンオフセットの文字列フォーマット。
- `NumericStringGrammar`: 文字列を数値として解釈するための文法。
- `Date` コンストラクタの挙動（関数として呼ばれた場合とコンストラクタとして呼ばれた場合の違い）。
- `Internal Slot` (`[[DateValue]]`) や `Realm`（グローバル環境）の概念。

---

## 2. Date.UTC ( year [ , month [ , date [ , hours [ , minutes [ , seconds [ , ms ] ] ] ] ] ] )

`Date.UTC` は、引数をUTCとして解釈し、対応するタイムバリュー（数値）を返します。

### アルゴリズムのポイント
1. 各引数に対して `ToNumber` を適用する。
2. デフォルト値の適用：
   - `month` がなければ `0`。
   - `date` がなければ `1`（Dateのみ1オリジン）。
   - 時・分・秒・ミリ秒がなければ `0`。
3. `MakeFullYear`, `MakeDay`, `MakeTime`, `MakeDate` という内部操作を経て値を生成する。
4. **`TimeClip`**: 生成された値がDateオブジェクトで表現可能な範囲（約±285,426年）に収まっているかを確認し、範囲外なら `NaN` を返す。

### Dateコンストラクタとの違い
- `Date` コンストラクタは新しいDateオブジェクトを生成するが、`Date.UTC` は数値を返す。
- `Date` コンストラクタ（引数が複数の場合）は引数を**ローカルタイム**として解釈するが、`Date.UTC` は**UTC**として解釈する。

```javascript
// 検証：範囲外の年は NaN になる
Date.UTC(275760, 8, 13); // 数値が返る
Date.UTC(285427, 0, 1);  // NaN (TimeClipによる)
```

---

## 3. Date.prototype オブジェクト

`Date.prototype` 自体の特性について確認しました。

- **属性**: `writable: false`, `enumerable: false`, `configurable: false`。
  - `configurable` が `false` であるため、プロパティの再定義や削除は一切不可。
- **特性**:
  - 普通のオブジェクト（Ordinary Object）である。
  - **Dateインスタンスではない**。そのため `[[DateValue]]` 内部スロットを持たず、自身のメソッドを自身に対して呼ぶことはできない。
- **メソッドの制約**:
  - `Date.prototype` のメソッドは原則として「ジェネリックではない」。
  - 実行時に `this` が `[[DateValue]]` 内部スロットを持つ（＝Dateインスタンスである）ことを要求し、持たない場合は `TypeError` を投げる。

---

## 4. Date.prototype の Getter メソッド

各Getter（`getDate`, `getHours`, `getTime` など）の共通アルゴリズムを確認しました。

### 基本的な流れ
1. `this` を `Date` オブジェクトとして受け取る。
2. `this` が `[[DateValue]]` 内部スロットを持っているかチェック（`RequireInternalSlot`）。なければ `TypeError`。
3. 内部スロットの値を `t` とする。
4. `t` が `NaN` なら `NaN` を返す。
5. それ以外なら、`LocalTime(t)` （ローカルタイムへの変換）を適用した上で、必要な要素（日、時など）を抽出して返す。

### Date.prototype.getTime()
内部スロット `[[DateValue]]` の値をそのまま返す（変換なし）。

### Date.prototype.getTimezoneOffset()
UTCとローカルタイムの差分を「分」で返します。
- 計算式: `(t - LocalTime(t)) / msPerMinute`
- 日本標準時（JST, +09:00）の場合、`t - (t + 9h)` となるため、結果は **`-540`** となる。

```javascript
// 検証
new Date().getTimezoneOffset(); // 日本なら -540
```

---

## 5. Date.prototype の Setter メソッド

各Setter（`setDate`, `setFullYear`, `setTime` など）の挙動を確認しました。

### Date.prototype.setDate ( date )
特定の「日」を設定します。
- 面白い挙動として、`0` や負の数、あるいはその月の末日を超える数値を渡すと、適切に前後の月に繰り越される。
- `0` を設定すると「前月の最終日」になる。

```javascript
const d = new Date(2026, 0, 1); // 2026-01-01
d.setDate(32); // 2026-02-01 になる
d.setDate(0);  // 2026-01-31 になる（2月の0日＝1月の最終日）
```

### Date.prototype.setFullYear ( year [ , month [ , date ] ] )
年を設定するメソッドですが、オプションで月と日も同時に設定可能です。
- 他のSetterも同様に、自身より細かい単位の引数（`setHours` なら分・秒・ミリ秒）をオプションで受け取れるよう設計されています。

### Date.prototype.setTime ( time )
内部スロット `[[DateValue]]` を直接書き換えます。
- 引数を `ToNumber` し、`TimeClip` を適用した値を設定する。
- 非常に大きな数値を渡して `TimeClip` の範囲を超えた場合、`NaN`（Invalid Date）が設定される。

---

## 6. 文字列変換メソッド

### Date.prototype.toDateString ()
日付部分のみを人間が読める形式の文字列で返します（例: "Sun Mar 01 2026"）。

### Date.prototype.toISOString ()
ISO 8601形式の文字列を返します。
- 内部スロットが `NaN` の場合、`RangeError` を投げる。
- 拡張形式に対応しており、通常の4桁を超える年（例: `+0275760-09-13T00:00:00.000Z`）も表現可能。

### Date.prototype.toJSON ( key )
`JSON.stringify` で呼ばれるためのメソッドです。
1. `this` をオブジェクトに変換する。
2. `ToPrimitive` をヒント「Number」で呼び出す。
3. その結果が有限の数値でない（`NaN` や `Infinity`）場合は `null` を返す。
4. そうでなければ、自身の `toISOString()` メソッドを呼び出した結果を返す。

**特徴**:
- **意図的にジェネリック**に設計されている。
- `this` が Date インスタンスである必要はなく、`toISOString` という名前のメソッドを持ってさえいれば動作する。

```javascript
// 検証：ジェネリックな挙動
const obj = {
  toISOString: () => "Custom ISO String",
  toJSON: Date.prototype.toJSON
};
console.log(obj.toJSON()); // "Custom ISO String"

// 数値として不正な場合は null
const invalidDate = new Date(NaN);
console.log(invalidDate.toJSON()); // null
```

---

## 次回の予定
次回のセッションでは、`Date.prototype.toLocaleDateString` から読み進める予定です。
