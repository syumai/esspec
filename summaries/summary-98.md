# 第98回 ECMAScript仕様輪読会 まとめ

本セッションでは、`Date.prototype` の残りメソッドの確認から、新しく `String` オブジェクトの仕様へと読み進めました。

## 1. 前回（第97回）の振り返り
前回のセッションでは、以下の内容が扱われました。
- `Date.prototype.toLocaleDateString`, `toLocaleString`, `toLocaleTimeString` の詳細。
- `Date.prototype.toString` の内部アルゴリズム。
- `toString` の結果を再度 `Date.parse` した際にミリ秒単位が欠落する問題の検証。
- 無効な日付（NaN）を渡した際の `"Invalid Date"` 文字列の返却挙動。

---

## 2. Date オブジェクトのメソッド（続き）

### Date.prototype.toUTCString ()
このメソッドは、日付をUTC（協定世界時）に基づいた文字列形式で返します。形式は **RFC 7231** の「HTTP-date」に基づいて一般化されたものです。

**主なアルゴリズム:**
1. `[[DateValue]]` が `NaN` の場合は `"Invalid Date"` を返す。
2. 曜日（`Table 60`）と月（`Table 61`）の名称（3文字の略称）を取得する。
3. 日付を2桁、年を4桁以上の「0埋めデシマル文字列」としてフォーマットする。
4. `"Wed, 01 Jan 2025 00:00:00 GMT"` のような形式で結合して返す。

**検証内容:**
- **1万年問題**: 年が5桁（10000年など）になっても、仕様上は制限がないため、そのまま `"10000"` と出力される。
- **マイナス年**: `YearFromTime` の結果がマイナスになる場合、負符号（`-`）が付与される。

### Date.prototype.valueOf ()
`Date` インスタンスの内部スロット `[[DateValue]]`（ミリ秒単位の数値）をそのまま返します。

### Date.prototype [ @@toPrimitive ] ( hint )
`Date` オブジェクトをプリミティブ型に変換する際に呼ばれるメソッドです。

**Date オブジェクトの特異性:**
通常、JSオブジェクトの `default` ヒンは `number` として扱われますが、**`Date` オブジェクトのみ `string` と同等として扱う**というユニークな挙動をします。

- **引数 `hint`**: `"string"`, `"number"`, `"default"` のいずれか。
- `hint` が `"string"` または `"default"` の場合、文字列への変換を優先する。
- `hint` が `"number"` の場合、数値（`valueOf`）への変換を優先する。

**検証：`Object.defineProperty` による上書き**
`Date.prototype[Symbol.toPrimitive]` は `writable: false` ですが `configurable: true` であるため、`Object.defineProperty` を使って挙動を上書きすることが可能です。

```javascript
// 常に数値 1 を返すように上書きする例
const myPrimitive = function(hint) { return 1; };
Object.defineProperty(Date.prototype, Symbol.toPrimitive, {
  value: myPrimitive
});

const d1 = new Date();
const d2 = new Date();
console.log(d1 + d2); // 本来は文字列結合されるが、上書き後は 1 + 1 = 2 になる
```

---

## 3. String オブジェクト (22.1)

### String コンストラクタ
`String` は、呼び出し方によって挙動が異なります。
- **コンストラクタとして (`new String(...)`)**: 新しい String インスタンス（オブジェクト）を作成し、内部スロット `[[StringData]]` を初期化する。
- **関数として (`String(...)`)**: 引数を文字列型に変換して返す。

#### 特殊な挙動：Symbol の変換
`String(symbol)` のように関数として呼び出した場合、`SymbolDescriptiveString` という抽象操作が走り、`Symbol(description)` のような説明用文字列を返します。
しかし、**`new String(symbol)`** のようにコンストラクタとして呼び出すと、内部で `ToString` が呼ばれ、Symbol は文字列に暗黙変換できないため **TypeError** になります。

### String.fromCharCode ( ...codeUnits )
渡された 16ビットのコードユニット群から文字列を生成します。

- **アルゴリズム**: 各引数に対して `ToUint16` を適用します。
- **挙動**: 16ビット（0〜65535）を超える数値や小数が渡された場合、ビットが切り詰められます（modulo 2^16）。
- **Length**: `arguments` を扱うため `length` は `1` と定義されています。

### String.fromCodePoint ( ...codePoints )
ES2015で追加された、完全な Unicode コードポイントをサポートするメソッドです。

- **アルゴリズム**: 
  - 各引数が有効なコードポイント（0 〜 0x10FFFF）の範囲内にあるかチェックする。
  - 整数でない場合や範囲外の場合は **RangeError** を投げる。
- **サロゲートペア**: サロゲートペアが必要なコードポイント（例：絵文字や一部の漢字）も正しく扱えます。

**比較検証（サロゲートペアの例：漢字「𩸽（ほけ）」）:**
```javascript
const codePoint = 0x29E3D; // 「𩸽」

// 正しく表示される
console.log(String.fromCodePoint(codePoint)); 

// 下位16ビットのみが評価され、全く別の文字（鳩に似た字など）になる
console.log(String.fromCharCode(codePoint)); 
```

---

## 4. 次回の予定
次回のセッションでは、タグ付きテンプレートリテラルなどで利用される `String.raw` の仕様から読み進める予定です。
