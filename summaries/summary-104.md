# 第104回 ECMAScript仕様輪読会

## ECMAScript 2026 の公開と主な追加機能

ECMAScript 2026 が公開され、仕様として内容が確定したことが共有されました。TC39 の Finished Proposals を見ると、今回の版には日常的に役立つ小さな API が多数入っています。

主な話題は次のとおりです。

- `Map` / `WeakMap` の upsert 系 API
- JSON のパース時に元のソーステキストへアクセスする機能
- `Iterator` の連結
- `ArrayBuffer` と Base64 / Hex の相互変換
- `Error.isError`
- `Math.sumPrecise`
- 非同期イテレーターを配列へ集める `AsyncIterator.from` 周辺

### Map / WeakMap の upsert

`Map.prototype.getOrInsert` は、キーに対応する値があればそれを返し、なければ指定値を入れて返すための API です。

```js
const cache = new Map();

const value = cache.getOrInsert("user:1", { visits: 0 });
// 存在しなければ { visits: 0 } を格納し、それを返す
```

さらに、値の生成コストが高い場合には、必要になったときだけコールバックで生成する形式も使えます。

```js
const cache = new Map();

const value = cache.getOrInsertComputed("user:1", (key) => {
  return createExpensiveUserData(key);
});
```

従来は `has`、`get`、`set` を組み合わせて書く必要があり、値が `undefined` の場合との区別なども考える必要がありました。この API により、その定番処理を意図どおりに表現できます。`WeakMap` にも対応する API が入っています。

### JSON のソーステキストアクセス

JSON をパースする際、これまでの reviver は「変換済みの値」を受け取ることが中心でした。新しい機能では、元の JSON テキストに関する情報にもアクセスできます。

これは、たとえば数値を JavaScript の `Number` に変換した結果では精度が失われるような場面で、元の表記を参照して独自の変換を行いたい場合に役立ちます。JSON のパース結果だけでなく、「入力に何が書かれていたか」も必要になるケースへの拡張です。

### Iterator の連結

イテレーターをストリームとして考えたとき、複数のイテレーターを順に流したい場合があります。`concat` 系の機能により、その連結を直接表現できます。

```js
const first = [1, 2].values();
const second = [3, 4].values();

// 概念的には [1, 2, 3, 4] を順に読むイテレーター
const all = first.concat(second);
```

Node.js のストリームや Reader / Writer のような抽象を扱うときに、「入力をつなぐ」という見方をすると理解しやすい機能です。

### `ArrayBuffer` の Base64 / Hex 変換

バイナリデータと Base64・16進数文字列を相互変換する標準 API が追加されます。

```js
const bytes = Uint8Array.fromBase64("SGVsbG8=");
const text = new TextDecoder().decode(bytes);

console.log(text); // Hello
```

これまで JavaScript では、Base64 処理に `atob` / `btoa` を使ったり、環境ごとの `Buffer` を使ったりすることが多く、バイト列を安全・直接に扱うには少し手間がありました。標準化により、環境差を減らせます。Hex 形式も対象です。

### `Error.isError`

`instanceof Error` は、iframe など別 Realm で生成されたエラーを正しく判定できないことがあります。別 Realm の `Error` コンストラクターは現在の Realm のものとは別オブジェクトだからです。

```js
value instanceof Error
```

その代わりに `Error.isError(value)` を使うと、Error オブジェクトとして持つ内部的な情報に基づいて判定できます。

```js
Error.isError(value);
```

これは「どの `Error` コンストラクターから作られたか」ではなく、「仕様上 Error として扱われるオブジェクトか」を見るため、Realm をまたぐケースに強い判定です。

### `Math.sumPrecise`

`Math.sumPrecise` は、通常の加算よりも数値誤差を意識した合計計算のための機能です。浮動小数点数では加算順序によって結果が変わることがあり、単純な `reduce` では誤差が蓄積することがあります。

この API は、仕様上の数学的な値を意識して合計を求めるため、数値計算でより信頼しやすい結果を得るための選択肢になります。

### ECMAScript 2027 に向けた話題

次年度の候補としては、`using`、`Atomics.pause`、Joint Iteration、そして Temporal が話題になりました。特に Temporal は日付・時刻の標準 API として期待されており、翌年は「Temporal 元年」になりそうだ、という見通しが共有されました。

また、TypeScript 会議の開催・プロポーザル募集についても案内がありました。

---

## `String.prototype.replaceAll`

今回の本題は `String.prototype.replaceAll` です。文字列中のすべての一致箇所を置換するメソッドで、`replace` と似ていますが、文字列検索の場合も常に全件置換を行う点が大きな違いです。

```js
const str = "ABCDEABCDE";

console.log(str.replaceAll("BC", "bc"));
// AbcDEAbcDE
```

### 正規表現を渡す場合は `g` フラグが必要

検索対象として正規表現を渡す場合、`replaceAll` ではグローバルフラグ `g` が必須です。

```js
"abcabc".replaceAll(/a/g, "A"); // OK
"abcabc".replaceAll(/a/, "A");  // TypeError
```

これは「すべて置換する」メソッドなのに、グローバルでない正規表現を渡して一部だけ処理する曖昧さを避けるためです。

ただし、この判定は単純に「`RegExp` のインスタンスか」だけを見ているわけではありません。`Symbol.match` などのプロパティにより正規表現相当として扱われるオブジェクトもあります。JavaScript では組み込み型そのものではなく、プロトコル用の Symbol を使って振る舞いを差し替えられる場面があります。

### `Symbol.replace` による独自の置換処理

検索値が `Symbol.replace` メソッドを持つ場合、`replaceAll` はそのメソッドへ処理を委譲します。

つまり、`replaceAll` 自身が常に文字列検索・置換を実装するわけではありません。正規表現や独自オブジェクトに「自分で置換を実装する」機会を渡す設計です。

概念的には次のような流れです。

```js
const customReplacer = {
  [Symbol.replace](source, replacement) {
    return `置換済み: ${source}`;
  },
};

console.log("abc".replaceAll(customReplacer, "x"));
// 置換済み: abc
```

このように、戻り値も独自実装側が決められます。そのため、通常の文字列置換とはまったく異なる値を返すことも可能です。

### 文字列検索の場合の処理

検索値が特別な置換メソッドを持たない場合、`replaceAll` は検索値と対象文字列を文字列化し、一致箇所を前から探します。

置換対象の位置をすべて集めてから、次のような構成で結果を作ります。

1. 前回の一致の終端から、今回の一致の開始までの部分を残す
2. 一致箇所を置換値へ変換する
3. 最後に、最後の一致以降に残った部分を付け足す

たとえば `"ABCDEABCDE"` から `"BC"` を置換する場合、残る `"A"` や `"DE"` を保ちながら、2 箇所の `"BC"` だけを差し替えます。

### 空文字列を検索する場合

空文字列 `""` は文字列中の各文字の間、および先頭・末尾に一致します。

```js
const str = "ABCDEABCDE";

console.log(str.replaceAll("", "!"));
// !A!B!C!D!E!A!B!C!D!E!
```

この結果は、空文字列が「文字の前後を含む境界」に一致するという見方をすると理解できます。

グローバルな空正規表現でも同様です。

```js
console.log(str.replaceAll(new RegExp("", "g"), "!"));
// !A!B!C!D!E!A!B!C!D!E!
```

空文字列を検索するとき、検索位置をまったく進めないと無限ループになってしまいます。そのため実装上は、空の検索文字列であっても少なくとも 1 ずつ進めるための扱いがあります。

### 置換文字列中の特殊パターン

置換値が関数でない場合、文字列として扱われ、`$` で始まる記法が解釈されます。これは以前扱った `GetSubstitution` の仕組みを利用するものです。

代表例は次のとおりです。

```js
const str = "ABCDEABCDE";

console.log(str.replaceAll("BC", "[$&]"));
// A[BC]DEA[BC]DE
```

`$&` は一致した文字列そのものを表します。

そのほかにも、正規表現のキャプチャを参照する `$1`、一致箇所より前を参照する ``$` ``、後ろを参照する `$'`、ドル記号そのものを表す `$$` などがあります。

文字列置換でもこれらの記法が使えるため、単純に置換文字列をそのまま差し込むだけではありません。

---

## 関数による置換

第2引数に関数を渡すと、各一致箇所ごとにその関数が呼ばれます。

文字列検索の場合、関数には概ね次の情報が渡されます。

```js
(searchString, matchPosition, string) => {
  // searchString: 検索に使った文字列
  // matchPosition: 一致した開始位置
  // string: 元の文字列全体
}
```

勉強会では、一致箇所を小文字化する例を試しました。

```js
const str = "ABCDEABCDE";

console.log(
  str.replaceAll("CD", function (searchString, matchPosition, string) {
    return string
      .substring(matchPosition, matchPosition + searchString.length)
      .toLowerCase();
  }),
);

// ABcdEABcdE
```

この例では、関数に「一致した文字列そのもの」が直接渡されるのではなく、検索文字列・位置・元文字列を使って自分で部分文字列を取り出しています。

文字列検索の場合には検索語が既知なので、実用上は `searchString` をそのまま返還・加工すれば済むことも多いです。しかし、正規表現ではキャプチャ情報を使った柔軟な変換が可能になります。

### 正規表現での関数置換は可変長引数

正規表現を使うと、置換関数には一致全体に加えて各キャプチャが引数として渡されます。そのため、キャプチャ数によって関数の引数の並びが変わります。

概念的には次のような形です。

```js
(match, capture1, capture2, ..., position, source, groups) => {
  // groups は名前付きキャプチャがある場合に渡される
}
```

このシグネチャには次の難しさがあります。

- キャプチャ数によって引数の数が変わる
- 最後のほうに位置と元文字列が来る
- 名前付きキャプチャを使うと `groups` がさらに追加される
- 同じ置換関数を別の正規表現へ使い回しにくい

歴史的な API 設計を引き継いだ結果と考えられ、現代的なオブジェクト形式の引数と比べると扱いづらさがあります。

### 正規表現で簡易 XML 風の文字列を処理する例

キャプチャを使うと、タグ名や属性値などを取り出して置換関数で構造化できます。

```js
const input = '<div id="aaa"><span class="bbb"></span></div>';
const re = /<(\/?)(\w+)(?:\s+(\w+)="([^"]*?)")?>/g;

console.log(
  input.replaceAll(
    re,
    (search, isStart, element, attribute, value, position, string) => {
      return JSON.stringify(
        {
          isStart: isStart === "",
          element,
          attribute,
          value,
        },
        null,
        2,
      ) + "\n";
    },
  ),
);
```

出力は、開始タグ・終了タグ、要素名、属性名、属性値を取り出したものになります。

```json
{
  "isStart": true,
  "element": "div",
  "attribute": "id",
  "value": "aaa"
}
{
  "isStart": true,
  "element": "span",
  "attribute": "class",
  "value": "bbb"
}
{
  "isStart": false,
  "element": "span"
}
{
  "isStart": false,
  "element": "div"
}
```

ただし、これは XML パーサーの代わりにはなりません。属性が複数ある場合、引用符の扱い、エスケープ、コメント、ネスト、名前空間などを正しく扱おうとすると、正規表現だけではすぐに限界が来ます。

この例は「キャプチャと関数置換でどのような情報が渡るか」を見るための例です。真面目に XML を処理するなら、構文解析器を使うべきです。

### `replace` と `replaceAll` の置換関数

正規表現を使うときの置換関数の引数構成は、`replace` と `replaceAll` で本質的に同じです。差は主に、`replaceAll` がグローバル置換を要求する点にあります。

`searchValue` が単なる文字列か、正規表現か、正規表現にキャプチャがいくつあるかによって、`replaceValue` 側の受け取り方が変化します。この「検索側の内容が置換関数のシグネチャを左右する」点は、使いづらさとして確認されました。

---

## `RegExp` の `y` フラグと `lastIndex`

前回範囲に関連する確認として、sticky フラグ `y` と `lastIndex` を改めて確認しました。

`y` フラグ付きの正規表現は、文字列中のどこかを探して一致させるのではなく、`lastIndex` が指す位置からただちに一致しなければ失敗します。

```js
const str = "foofoofoobarfoo";
const regex = /foo/y;

console.log(regex.test(str)); // true
console.log(regex.lastIndex); // 3

console.log(regex.test(str)); // true
console.log(regex.lastIndex); // 6

console.log(regex.test(str)); // true
console.log(regex.lastIndex); // 9

console.log(regex.test(str)); // false
console.log(regex.lastIndex); // 0
```

この例では、`lastIndex` が 0、3、6、9 と進みます。9 の位置からは `"foo"` が始まっていないため失敗し、失敗時には `lastIndex` が 0 に戻ります。

### `g` と `y` の感覚的な違い

- `g`: 現在位置以降を検索して、一致する場所を探しにいく
- `y`: 現在位置で一致しなければ失敗する

`y` は、文字列を先頭から順に読んでトークンへ分けるスキャナーのような用途に向いています。たとえば字句解析では、「今読んでいる位置に識別子・数値・記号のどれがあるか」を順番に判定したいので、途中を飛ばして検索されると困ります。

### `String.prototype.search` と `lastIndex`

`search` は正規表現を受け取れますが、渡した正規表現の `lastIndex` を外部から見える形で変更しません。

```js
const str = "foofoofoobarfoo";
const regex = /foo/y;

console.log(str.search(regex)); // 0
console.log(regex.lastIndex);   // 0

console.log(str.search(regex)); // 0
console.log(regex.lastIndex);   // 0
```

`RegExp.prototype.test` を直接呼ぶ場合とは異なり、`search` は検索処理のために必要な内部状態を扱っても、その変更を正規表現オブジェクトへ残さないように見えます。

`lastIndex` を使う正規表現は状態を持つため、読み手にとって挙動を追いにくくなります。スキャナーなど明確な目的がある場合を除けば、安易に依存しないほうがよい、という感想になりました。

---

## `String.prototype.slice`

続いて `String.prototype.slice` を読みました。これは文字列の指定範囲を取り出すメソッドです。

```js
const s = "ECMAScript";

console.log(s.slice(0));         // ECMAScript
console.log(s.slice(-Infinity)); // ECMAScript
console.log(s.slice(0, 4));      // ECMA
console.log(s.slice(4, 100));    // Script
console.log(s.slice(-6));        // Script
console.log(s.slice(-6, -5));    // S
console.log(s.slice(-6, Infinity)); // Script
```

第1引数は開始位置、第2引数は終了位置です。終了位置の文字は含まれません。

```js
"ECMAScript".slice(0, 4); // "ECMA"
```

### 負のインデックス

開始・終了位置に負の値を指定すると、文字列末尾から数えます。

```js
const s = "ECMAScript";

console.log(s.slice(-6));     // Script
console.log(s.slice(-6, -5)); // S
```

文字列長が 10 の場合、`-6` は先頭から数えて 4 番目の位置に相当します。

ただし、範囲外の値は安全な範囲へ丸められます。

- 非常に小さい負数は先頭側へ丸められる
- 非常に大きい正数は末尾側へ丸められる
- `-Infinity` は先頭扱いになる
- `Infinity` は末尾扱いになる

開始位置が終了位置以上になった場合は、空文字列になります。

```js
"ECMAScript".slice(6, 2); // ""
```

### 文字列専用に見えて、ある程度は汎用的

`String.prototype.slice` は、文字列オブジェクトだけにしか使えないわけではありません。`call` で別の値に対して呼ぶと、その値を文字列化して処理します。

```js
console.log(String.prototype.slice.call({}, 1, 7));
// object
```

`{}` は文字列化すると `"[object Object]"` になるため、その一部が返ります。

日付オブジェクトも同様です。

```js
class Hoge {}

console.log(String.prototype.slice.call(new Date(), 1, 7));
console.log(String.prototype.slice.call(new Date(), 0, 3));
console.log(String.prototype.slice.call(new Hoge(), 0, 3));
```

出力例です。

```txt
ue Jul
Tue
[ob
```

ただし、これは通常の実用的な使い方ではありません。仕様上、`this` を文字列へ変換していることを確認するための例です。

---

## `String.prototype.substring`

`substring` も指定範囲の文字列を取り出すメソッドですが、`slice` と異なる歴史的な挙動があります。

最も重要な違いは次の2点です。

1. 負の値は末尾から数えず、0 として扱う
2. 開始位置が終了位置より大きいと、両者を入れ替える

```js
const s = "ECMAScript";

console.log(s.substring(-6)); // ECMAScript
console.log(s.substring(6, 2)); // MASc
```

`slice(-6)` が `"Script"` を返すのに対し、`substring(-6)` は `-6` を 0 とみなすため、文字列全体を返します。

また、`substring(6, 2)` は空文字列にはなりません。開始位置と終了位置を交換して、実質的に `substring(2, 6)` として扱われます。

この「引数を入れ替える」挙動は意外性があり、`slice` に慣れていると混乱しやすい点です。

### `slice` と `substring` の使い分け

現代的には、負のインデックスを自然に扱え、開始・終了の逆転も明示的に空文字列となる `slice` のほうが理解しやすい場面が多いです。

| 観点 | `slice` | `substring` |
|---|---|---|
| 負の値 | 末尾から数える | 0 とみなす |
| 開始位置 > 終了位置 | 空文字列 | 引数を交換する |
| 範囲外 | 端へ丸める | 端へ丸める |
| 歴史 | 比較的自然な範囲指定 | 非常に古い互換性を持つ API |

`substring` 自体が常に危険というわけではありません。しかし、負数や引数順の間違いに対する振る舞いが `slice` と違うため、意図を明確にしたいコードでは `slice` を選ぶほうが無難です。

---

## `String.prototype.substr`

`substr` は Annex B に置かれている歴史的な API です。Annex B は主に Web 互換性のための追加仕様をまとめた領域であり、新しいコードで積極的に使う対象ではありません。

`substr` の引数は「開始位置」と「終了位置」ではなく、「開始位置」と「取り出す長さ」です。

```js
const s = "ECMAScript";

console.log(s.substr(2, 2)); // MA
```

これは、インデックス 2 から 2 文字取り出す意味です。

### 各 API の第2引数の違い

```js
const s = "ECMAScript";

s.slice(2, 4);      // "MA" : 2 から 4 の手前まで
s.substring(2, 4);  // "MA" : 2 から 4 の手前まで
s.substr(2, 2);     // "MA" : 2 から 2 文字
```

同じように見える API が複数あり、第2引数の意味が異なることが混乱の元です。

`substr` は負の開始位置を末尾から数える点では `slice` と似ていますが、長さの解釈が異なります。また標準の中心的な API ではなく、互換性のために残されているものです。

勉強会では「極端に奇妙な挙動というより、似た機能が重複していて名称・引数の意味が紛らわしいことが問題」と整理されました。

補足として、`substr` は Internet Explorer 独自ではなく、Netscape Navigator 4 で入った特殊な API だったことも確認されました。

---

## 今回の到達点と次回予定

今回、`String.prototype.replaceAll` を読み終え、関数置換・正規表現キャプチャ・特殊な置換文字列・空文字列検索の挙動を確認しました。

さらに、文字列を部分的に取り出す API として、以下を比較しました。

```js
String.prototype.slice
String.prototype.substring
String.prototype.substr
```

次回は、途中で飛ばした `split` と `startsWith` を扱い、その後 `toLocaleLowerCase` などのロケール依存の大文字・小文字変換へ進む予定です。