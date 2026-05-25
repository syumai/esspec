# ECMAScript仕様輪読会 第101回

## 今回読んだ範囲の全体像

今回は `String.prototype.localeCompare` を中心に読み、その流れで Unicode の正規等価性、ECMA-402 側の国際化仕様、そして `String.prototype.normalize` まで読みました。

前回読む予定として残っていた `localeCompare` を先に扱い、その後、本来は `matchAll` に進む予定でしたが、`localeCompare` の理解に Unicode 正規化が強く関わるため、順序を入れ替えて `normalize` を読みました。

また、冒頭付近で現在の ECMAScript 仕様ドラフトについても少し確認しました。Temporal は Stage 4 には到達しているものの、ECMAScript 2026 には入らず、ECMAScript 2027 側の扱いになるらしい、という話が出ました。

## ECMAScript 2026 / 2027 と Temporal

仕様ページを見たところ、ドラフト上では 2027 年版に関する表示が出ていました。

Temporal はすでに Stage 4 の Finished Proposal に入っているものの、今年出る ECMAScript 2026 には含まれないようだ、という話になりました。

理由としては、Stage 4 になった時期がかなりギリギリで、しかも Temporal は仕様サイズが大きいため、2026 年版には間に合わなかったのではないか、という見方でした。

一方で ECMAScript 2026 には、すでに輪読会で触れた機能もいくつか入っていそうだという話も出ました。

例としては次のようなものです。

```js
Error.isError(value)
```

これは、対象が Error オブジェクトかどうかを内部スロットで判定する機能として以前話題にしたものです。

その他にも Iterator 関連や Array 関連など、今後読むのが楽しみな機能がある、という確認がありました。

## `String.prototype.localeCompare`

今回の主題は `String.prototype.localeCompare` でした。

ECMAScript 本体、つまり ECMA-262 側にも `localeCompare` の記述はありますが、実際には国際化 API である ECMA-402 を含む実装では、ECMA-402 側の仕様に従って実装することになっています。

つまり、ECMA-262 側に書かれている内容は、ECMA-402 を持たない実装向けのフォールバック仕様に近いものです。

仕様上はおおよそ次のような位置づけです。

```js
"abc".localeCompare("abd")
```

このメソッドは、現在のロケールに基づいて、レシーバー文字列と引数文字列の順序を比較します。

戻り値は数値です。

```js
"abc".localeCompare("abd"); // 負の値
"abc".localeCompare("abc"); // 0
"abc".localeCompare("abb"); // 正の値
```

ただし、戻り値が必ず `-1`, `0`, `1` になるとは仕様上保証されていません。

重要なのは符号です。

```js
const result = a.localeCompare(b);

if (result < 0) {
  // a は b より前に並ぶ
}

if (result > 0) {
  // a は b より後に並ぶ
}

if (result === 0) {
  // 並び順上は同等
}
```

実装は追加情報を戻り値にエンコードしてもよいため、負の値・正の値・ゼロという関係だけを見るべき、という話でした。

## `localeCompare` の基本的な処理

ECMA-262 側の仕様では、まずレシーバーが `null` や `undefined` でないことを確認します。

これは他の多くの `String.prototype` メソッドと同じです。

```js
String.prototype.localeCompare.call(null, "x");
// TypeError

String.prototype.localeCompare.call(undefined, "x");
// TypeError
```

その後、レシーバーと比較対象の値を文字列に変換します。

つまり、`localeCompare` は文字列専用に見えますが、内部的には `ToString` されるため、比較対象には文字列以外も渡せます。

```js
"123".localeCompare(123);
// "123" と "123" の比較になる
```

ただし、レシーバー側については `null` / `undefined` は拒否されます。

```js
String.prototype.localeCompare.call(123, "124");
// 123 が "123" に変換されて比較される
```

この意味で、`localeCompare` も他の多くの `String.prototype` メソッドと同じく generic なメソッドです。

## 第2引数・第3引数

`localeCompare` にはオプショナルな第2引数と第3引数があります。

```js
str.localeCompare(that, locales, options)
```

ECMA-262 側では、これらの引数について具体的な意味を定義しません。

それらは ECMA-402 側で定義されます。

そのため、ECMA-402 を含まない実装は、第2引数・第3引数に勝手な別の意味を与えてはいけない、という制約があります。

これは、将来または別仕様で定義される意味と衝突しないようにするためです。

```js
"a".localeCompare("b", "ja", {
  numeric: true,
});
```

このような `locales` や `options` の意味は ECMA-402 側の責務です。

## `localeCompare` は全順序を定義する比較である必要がある

仕様には、`localeCompare` は文字列全体に対して一貫した比較を定義する必要がある、という趣旨の記述があります。

ここで話題になったのが「全順序」です。

全順序とは、任意の2つの要素について必ず順序関係を決められるような順序です。

数値は典型的な全順序です。

```txt
1 < 2 < 3 < 4
```

どの2つを選んでも、どちらが前か、または等しいかを決められます。

一方、クラス継承関係のようなものは半順序の例として説明されました。

```txt
Object
├── String
└── Number
```

`String` は `Object` の子であり、`Number` も `Object` の子です。

しかし、`String` と `Number` の間に「どちらが上か」という直接の順序はありません。

このように、比較できない組が存在するものは全順序ではありません。

`localeCompare` はソートに使われる可能性があるため、同じ入力に対して呼ぶたびに違う結果を返すような、非決定的な比較であってはいけません。

例えば次のような比較関数は不適切です。

```js
function badCompare(a, b) {
  return Math.random() - 0.5;
}
```

`localeCompare` は、ロケール依存ではあっても、一貫した比較である必要があります。

## `Array.prototype.sort` にそのまま渡してはいけない

仕様には、`String.prototype.localeCompare` 自体は `Array.prototype.sort` の比較関数として直接渡すのに適していない、という注意もあります。

`sort` の比較関数は、2つの引数を受け取る関数を期待します。

```js
array.sort((a, b) => {
  return a.localeCompare(b);
});
```

一方、`localeCompare` は「レシーバー文字列」と「引数文字列」を比較するメソッドです。

つまり、次のように直接渡すのは意図通りではありません。

```js
array.sort(String.prototype.localeCompare);
```

正しくは、明示的に2引数の比較関数で包む必要があります。

```js
const items = ["c", "a", "b"];

items.sort((a, b) => a.localeCompare(b));

console.log(items);
// ["a", "b", "c"]
```

## ロケールに応じた比較

`localeCompare` は、ホスト環境の現在のロケールや、指定されたロケールに応じた比較を行うことを意図しています。

例えば、同じ文字でも言語・地域によって並び順が変わります。

輪読会では `ä` と `z` の比較が例に出ました。

```js
const a = "ä";
const b = "z";

// ドイツ語では ä は a のバリエーションとして扱われ、z より前
console.log(a.localeCompare(b, "de"));
// 負の値

// スウェーデン語では ä はアルファベットの後半に位置し、z より後
console.log(a.localeCompare(b, "sv"));
// 正の値
```

同じ文字でも、ドイツ語とスウェーデン語では順序が異なります。

これが `localeCompare` の本質的な難しさです。

## language と locale の違い

途中で、language と locale の違いも確認しました。

language は言語そのものを指します。

```txt
en = 英語
ja = 日本語
de = ドイツ語
```

一方、locale は言語だけでなく、地域・文化的慣習・通貨・日付形式・数値形式などを含む設定です。

```txt
en-US = アメリカ英語
en-GB = イギリス英語
ja-JP = 日本語 / 日本
```

例えば、同じ英語でもアメリカとイギリスでは日付表記が異なります。

```txt
en-US: 05/25/2026
en-GB: 25/05/2026
```

`localeCompare` は「言語」だけでなく「ロケール」に基づく比較を扱います。

## ECMA-402 側の `localeCompare`

ECMA-402 側の仕様も軽く確認しました。

ECMA-402 では、`String.prototype.localeCompare` は内部的に `Intl.Collator` を使う形になっています。

概念的には次のような流れです。

```js
const collator = new Intl.Collator(locales, options);
const result = collator.compare(S, that);
```

実際の仕様では `CompareStrings` という抽象操作が出てきます。

`Collator` は、ロケールに応じた文字列の照合・比較を担当するオブジェクトです。

```js
const collator = new Intl.Collator("sv");

console.log(collator.compare("ä", "z"));
// スウェーデン語の順序で比較される
```

`localeCompare` の第2引数・第3引数は、最終的にこの `Intl.Collator` の構築に使われます。

## `numeric` オプション

ECMA-402 の `options` には `numeric` というオプションがあります。

これは、数字列を数値として比較するかどうかに関わります。

```js
const items = ["2", "10", "1"];

console.log(items.toSorted((a, b) =>
  a.localeCompare(b, "en", { numeric: false })
));
// ["1", "10", "2"]

console.log(items.toSorted((a, b) =>
  a.localeCompare(b, "en", { numeric: true })
));
// ["1", "2", "10"]
```

`numeric: false` では文字列として比較されるため、`"10"` が `"2"` より前に来ます。

`numeric: true` では数値的に比較されるため、`"2"` が `"10"` より前に来ます。

輪読会では日本語の漢数字も試しました。

```js
const nums = ["一", "四十五", "三", "100", "3", "百", "二"];

console.log(nums.toSorted((a, b) =>
  a.localeCompare(b, "ja", { numeric: true })
));

console.log(nums.toSorted((a, b) =>
  a.localeCompare(b, "ja", { numeric: false })
));
```

結果は次のようになりました。

```txt
3,100,一,三,四十五,二,百
100,3,一,三,四十五,二,百
```

`numeric: true` は、少なくとも通常の ASCII 数字列には効きます。

しかし、漢数字の `"四十五"` や `"百"` を数値として解釈するわけではありませんでした。

## Unicode の正規等価性

`localeCompare` で重要なのが、Unicode の正規等価性です。

仕様では、実装は Unicode Standard に基づく canonical equivalence を認識しなければならない、とされています。

日本語では「正規等価性」などと訳されます。

これは、見た目や意味として同じ文字を、異なる Unicode コードポイント列で表せる場合がある、という問題に関係します。

例えば、次の2つは見た目としては同じような文字です。

```js
"\u212B"   // Å ANGSTROM SIGN
"A\u030A" // A + COMBINING RING ABOVE
```

前者は 1 つのコードポイントで表された `Å` です。

後者は `A` に「上に丸を付ける結合文字」を組み合わせています。

`localeCompare` は、これらを正規等価なものとして扱い、比較結果として `0` を返す必要があります。

```js
console.log("\u212B".localeCompare("A\u030A"));
// 0
```

## 正規等価な文字列の例

輪読会では、仕様に載っている例を実際に試しました。

```js
{
  // Å ANGSTROM SIGN vs.
  // Å LATIN CAPITAL LETTER A + COMBINING RING ABOVE
  console.log("\u212B".localeCompare("A\u030A"));

  // Ω OHM SIGN vs.
  // Ω GREEK CAPITAL LETTER OMEGA
  console.log("\u2126".localeCompare("\u03A9"));

  // ṩ LATIN SMALL LETTER S WITH DOT BELOW AND DOT ABOVE vs.
  // ṩ LATIN SMALL LETTER S + COMBINING DOT ABOVE + COMBINING DOT BELOW
  console.log("\u1E69".localeCompare("s\u0307\u0323"));

  // ḍ̇ LATIN SMALL LETTER D WITH DOT ABOVE + COMBINING DOT BELOW vs.
  // ḍ̇ LATIN SMALL LETTER D WITH DOT BELOW + COMBINING DOT ABOVE
  console.log("\u1E0B\u0323".localeCompare("\u1E0D\u0307"));

  // 가 HANGUL CHOSEONG KIYEOK + HANGUL JUNGSEONG A vs.
  // 가 HANGUL SYLLABLE GA
  console.log("\u1100\u1161".localeCompare("\uAC00"));

  console.log("㌀".localeCompare("アパート"));
}
```

実行結果は次の通りです。

```txt
0
0
0
0
0
-1
```

最初の5つは `0` になっています。

つまり、コードポイント列としては異なっていても、Unicode の正規等価性により同等と扱われます。

一方で、`"㌀"` と `"アパート"` は `localeCompare` では `0` になりませんでした。

```js
console.log("㌀".localeCompare("アパート"));
// -1
```

これは、`㌀` と `アパート` が canonical equivalence ではなく、compatibility equivalence 側の関係だからです。

## canonical equivalence と compatibility equivalence

Unicode には、少なくとも次の2種類の等価性があります。

```txt
canonical equivalence
compatibility equivalence
```

canonical equivalence は、文字として本質的に同じとみなせるような等価性です。

例えば、合成済み文字と、基底文字 + 結合文字の組み合わせです。

```js
"\u00E9"   // é
"e\u0301" // e + COMBINING ACUTE ACCENT
```

これらは正規等価です。

一方、compatibility equivalence は、互換性のために対応づけられている関係です。

例えば、次のようなものが含まれます。

```txt
㌀  <=>  アパート
全角・半角の違い
リガチャ
互換漢字
```

`localeCompare` の仕様では、canonical equivalence は尊重しなければならない一方、compatibility equivalence は尊重しないことが推奨されています。

つまり、`"㌀"` と `"アパート"` を同じと扱う必要はありません。

```js
console.log("㌀".localeCompare("アパート"));
// 0 である必要はない
```

実際、今回の実行環境では `-1` でした。

## “honour canonical equivalence” の意味

仕様には `honour canonical equivalence` という表現が出てきました。

ここでの `honour` は「尊重する」「準拠する」「従う」という意味で使われています。

つまり、`localeCompare` は Unicode Standard における canonical equivalence を尊重しなければならない、という意味です。

これは、単に見た目が同じなら同じと扱う、という曖昧な話ではなく、Unicode 側で定義された正規等価性に従う、という話です。

## ホスト環境の比較機能に依存してよいが、Unicode 正規等価性は守る必要がある

仕様では、`localeCompare` はホスト環境が提供する言語・ロケール依存の比較機能に依存してよい、とされています。

例えば、OS や ICU などのライブラリを使って比較してもよい、ということです。

ただし、どの比較機能を使うとしても、Unicode Standard の canonical equivalence は守らなければなりません。

つまり、実装ごとにロケール比較の細部が違うことはあり得ますが、正規等価な文字列の比較結果が `0` になる、という部分は要求されます。

## `String.prototype.normalize`

`localeCompare` と Unicode 正規化の話になったため、次に `String.prototype.normalize` を読みました。

`normalize` は、文字列を Unicode の正規化形式に変換するメソッドです。

```js
str.normalize(form)
```

`form` には次の4種類を指定できます。

```txt
NFC
NFD
NFKC
NFKD
```

引数を省略した場合は `"NFC"` が使われます。

```js
"é".normalize();
// "é".normalize("NFC") と同じ
```

指定できない値を渡すと `RangeError` になります。

```js
"abc".normalize("INVALID");
// RangeError
```

## `normalize` の基本処理

仕様上の流れは次のようなものです。

1. レシーバーを取得する
2. `RequireObjectCoercible` で `null` / `undefined` を拒否する
3. レシーバーを文字列化する
4. `form` が `undefined` なら `"NFC"` にする
5. `form` が指定されていれば文字列化する
6. `form` が `"NFC"`, `"NFD"`, `"NFKC"`, `"NFKD"` のいずれでもなければ `RangeError`
7. Unicode Standard に従って正規化した文字列を返す

コードでイメージすると次のような感じです。

```js
function normalizeLikeSpec(value, form) {
  if (value == null) {
    throw new TypeError();
  }

  const str = String(value);
  const f = form === undefined ? "NFC" : String(form);

  if (!["NFC", "NFD", "NFKC", "NFKD"].includes(f)) {
    throw new RangeError();
  }

  // 実際の正規化処理は Unicode Standard に従う
  return str.normalize(f);
}
```

## NFC / NFD / NFKC / NFKD

今回の輪読会で特に理解が進んだのが、この4つの違いでした。

大まかには次のように整理できます。

```txt
NFD  = canonical decomposition
NFC  = canonical decomposition + canonical composition
NFKD = compatibility decomposition
NFKC = compatibility decomposition + canonical composition
```

`D` は decomposition、つまり分解です。

`C` は composition、つまり合成です。

`K` は compatibility、つまり互換性を考慮した正規化です。

### NFD

NFD は canonical decomposition を行います。

つまり、合成済み文字を、基底文字と結合文字に分解します。

```js
console.log("パ".normalize("NFD"));
// パ
```

見た目は `パ` に見えますが、内部的には次のような構成になります。

```txt
ハ + COMBINING KATAKANA-HIRAGANA SEMI-VOICED SOUND MARK
```

### NFC

NFC は、一度 canonical decomposition した上で、可能なものを canonical composition します。

つまり、標準的な合成済み表現に寄せる形式です。

```js
console.log("パ".normalize("NFC"));
// パ
```

### NFKD

NFKD は compatibility decomposition を行います。

互換文字も分解対象になります。

例えば、`㌀` は「アパート」を表す互換文字です。

```js
console.log("㌀".normalize("NFKD"));
// アパート
```

この結果は、`パ` がさらに `ハ + ゚` に分解された形になります。

### NFKC

NFKC は、compatibility decomposition をした上で canonical composition します。

```js
console.log("㌀".normalize("NFKC"));
// アパート
```

`㌀` はまず互換分解されて `アパート` になり、その後 `ハ + ゚` が合成されて `パ` になります。

## `㌀` と `アパート` の正規化

輪読会では `㌀` を使って、4種類の正規化形式を比較しました。

```js
{
  console.log("㌀".normalize("NFD"));
  console.log("㌀".normalize("NFKD"), "length", "㌀".normalize("NFKD").length);
  console.log("㌀".normalize("NFC"));
  console.log("㌀".normalize("NFKC"), "length", "㌀".normalize("NFKC").length);
}
```

結果は次のようになりました。

```txt
㌀
アパート length 5
㌀
アパート length 4
```

`NFD` と `NFC` では `㌀` はそのままです。

これは `㌀` が canonical decomposition の対象ではないからです。

一方、`NFKD` と `NFKC` では互換分解が行われます。

```js
"㌀".normalize("NFKD");
// アパート

"㌀".normalize("NFKC");
// アパート
```

`NFKD` では `パ` が `ハ + ゚` に分解されたままなので、length が 5 になります。

`NFKC` では `パ` に再合成されるため、length が 4 になります。

## `アパート` の正規化

通常の `アパート` でも正規化の違いを確認しました。

```js
{
  console.log("アパート".normalize("NFD"));
  console.log("アパート".normalize("NFKD"));
  console.log("アパート".normalize("NFC"));
  console.log("アパート".normalize("NFKC"));
}
```

結果は次のようになります。

```txt
アパート
アパート
アパート
アパート
```

`NFD` と `NFKD` では `パ` が分解されます。

`NFC` と `NFKC` では合成済みの `パ` になります。

この例では、もともと互換文字ではないため、`NFD` と `NFKD` の差は目立ちません。

## 半角カナの正規化

半角カナも試しました。

```js
{
  console.log("ｱﾊﾟｰﾄ".normalize("NFD"));
  console.log("ｱﾊﾟｰﾄ".normalize("NFKD"));
  console.log("ｱﾊﾟｰﾄ".normalize("NFC"));
  console.log("ｱﾊﾟｰﾄ".normalize("NFKC"));
}
```

結果は次の通りです。

```txt
ｱﾊﾟｰﾄ
アパート
ｱﾊﾟｰﾄ
アパート
```

`NFD` と `NFC` では半角カナはそのままです。

一方、`NFKD` と `NFKC` では互換分解が行われ、全角カナに変換されます。

```js
"ｱﾊﾟｰﾄ".normalize("NFKD");
// アパート

"ｱﾊﾟｰﾄ".normalize("NFKC");
// アパート
```

つまり、半角・全角のような互換文字の違いをならしたい場合は、`NFKC` や `NFKD` を使うことになります。

## `NFKD` と `NFKC` の違い

`NFKD` と `NFKC` の違いは、分解した後に再合成するかどうかです。

```js
console.log("㌀".normalize("NFKD"));
// アパート

console.log("㌀".normalize("NFKC"));
// アパート
```

`NFKD` では `パ` が次の2つに分かれます。

```txt
ハ
゚
```

一方、`NFKC` ではそれが再合成されます。

```txt
パ
```

実際にコードポイントを取り出して、分解後の3番目の要素が半濁点であることも確認しました。

```js
console.log(String.fromCodePoint("㌀".normalize("NFKD").codePointAt(2)));
// ゚

console.log(String.fromCodePoint("㌀".normalize("NFKC").codePointAt(2)));
// ー
```

`NFKD` では `アパート` なので、3番目付近に結合用の半濁点が出てきます。

`NFKC` では `アパート` なので、その位置には長音記号 `ー` が来ます。

## `localeCompare` と `normalize` の関係

`localeCompare` は canonical equivalence を尊重する必要があります。

そのため、次のような文字列は同等に比較されます。

```js
console.log("\u212B".localeCompare("A\u030A"));
// 0
```

しかし、compatibility equivalence まで同等に扱うことは要求されません。

```js
console.log("㌀".localeCompare("アパート"));
// 0 になる必要はない
```

もしアプリケーション側で互換文字も同一視したいなら、比較前に `normalize("NFKC")` するような処理が考えられます。

```js
const a = "㌀";
const b = "アパート";

console.log(a.localeCompare(b));
// 実装やロケールに依存するが、今回の環境では -1

console.log(a.normalize("NFKC").localeCompare(b.normalize("NFKC")));
// 0
```

このように、`localeCompare` と `normalize` は別の役割を持ちます。

`localeCompare` はロケールに基づく順序比較を行います。

`normalize` は Unicode 文字列の表現を特定の正規化形式にそろえます。

## 今回の重要ポイント

`localeCompare` は、単純な辞書順比較ではありません。

ロケール、言語、ホスト環境、ECMA-402、Unicode 正規等価性が関わる、かなり深いメソッドです。

戻り値については、具体的な数値ではなく符号を見る必要があります。

```js
a.localeCompare(b) < 0
a.localeCompare(b) === 0
a.localeCompare(b) > 0
```

また、`sort` に使う場合は直接渡さず、比較関数で包む必要があります。

```js
items.sort((a, b) => a.localeCompare(b, "ja"));
```

Unicode には、見た目が同じでもコードポイント列が異なる文字列があります。

`localeCompare` は canonical equivalence を尊重しますが、compatibility equivalence までは同一視しないことが推奨されています。

互換文字までならしたい場合は、`normalize("NFKC")` のような正規化を明示的に使う必要があります。

## 次回

今回は `matchAll` に進む予定でしたが、`localeCompare` から `normalize` に流れたため、`matchAll` は次回に回りました。

次回は `String.prototype.matchAll` から読み進める予定です。