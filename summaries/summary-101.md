# ECMAScript 仕様輪読会 #101

## 前回の振り返り

前回は `String.prototype` の各種メソッドを読んでいました。今回の冒頭では、その内容を軽く振り返ったうえで、今回読む `localeCompare` に入っています。

### `endsWith(searchString, endPosition)`

`endsWith` は、文字列が指定した文字列で終わっているかを調べるメソッドです。

第2引数 `endPosition` がある場合、その位置までの部分文字列を対象にして「末尾が `searchString` か」を調べます。

```js
"ABCDE".endsWith("BCD", 4); // true
"ABCDE".endsWith("BCD", 5); // false
```

`endPosition` は「ここから後ろを無視する」という意味に近いです。

たとえば `"ABCDE"` に対して `endPosition` が `4` の場合、対象は `"ABCD"` になります。その末尾は `"BCD"` なので `true` になります。

一方、`endPosition` が `5` の場合は対象が `"ABCDE"` になり、末尾は `"CDE"` なので `"BCD"` ではありません。

この第2引数は直感的にかなり難しいという話になりました。単に `slice` で部分文字列を取ってから判定した方が、読む側にはわかりやすいのではないか、という感想も出ていました。

```js
const s = "ABCDE";

s.slice(0, 4).endsWith("BCD"); // true
```

### `endsWith` と正規表現

`endsWith` に正規表現を渡すと `TypeError` になります。

```js
"abc".endsWith(/c/);
// TypeError
```

これは `includes` や `startsWith` など比較的新しい文字列メソッドにも見られる挙動です。

ただし、単に `RegExp` インスタンスかどうかだけではなく、仕様上は `IsRegExp` によって判定されます。`Symbol.match` を持っている値は、正規表現的なものとして扱われます。

```js
const matcherLike = {
  [Symbol.match]: true
};

"abc".endsWith(matcherLike);
// TypeError
```

これは、将来的に正規表現を受け取るような拡張を可能にするため、今の段階では正規表現っぽいものを明示的に拒否している、という整理でした。

### `includes(searchString, position)`

`includes` は、文字列の中に指定した文字列が含まれるかを調べます。

第2引数 `position` は検索開始位置です。

```js
"ABCDE".includes("BCD");    // true
"ABCDE".includes("BCD", 0); // true
"ABCDE".includes("BCD", 1); // true
"ABCDE".includes("BCD", 2); // false
```

`position` が `2` の場合、対象は `"CDE"` 以降になるため、`"BCD"` は見つかりません。

`includes` も `endsWith` と同様に、正規表現を渡すと `TypeError` になります。

```js
"abc".includes(/b/);
// TypeError
```

### `includes` は generic method

`includes` は generic method です。

つまり、必ずしも本物の文字列オブジェクトに対してだけ使えるわけではなく、`this` に来た値を文字列化して処理できます。

```js
const obj = {
  toString() {
    return "hello includes";
  }
};

console.log(String.prototype.includes.call(obj, "includes"));
// true
```

仕様上は、まず `this` に対して `RequireObjectCoercible` を行い、そのあと `ToString` してから検索します。

そのため、`null` や `undefined` を `this` にすると失敗します。

```js
String.prototype.includes.call(null, "x");
// TypeError
```

### `indexOf(searchString, position)`

`indexOf` は、指定した文字列が最初に現れる位置を返します。見つからない場合は `-1` を返します。

```js
"ABCDE".indexOf("BCD"); // 1
"ABCDE".indexOf("XYZ"); // -1
```

`indexOf` は古いメソッドなので、正規表現を渡しても `TypeError` にはなりません。

```js
"abc/./def".indexOf(/./); // 3
```

これは正規表現としてマッチしているのではなく、`/./` が文字列 `"/./"` に変換されて、その文字列を探しているだけです。

```js
String(/./); // "/./"
```

そのため、正規表現を渡せてしまうけれど、正規表現検索にはならないという紛らわしさがあります。

比較的新しい `includes` や `endsWith` では、このような誤解を避けるために正規表現を拒否している、という整理でした。

### `isWellFormed`

`String.prototype.isWellFormed` は、文字列が well-formed Unicode string かどうかを返します。

特に、サロゲートペアの片割れだけがあるような文字列を検出できます。

```js
"\uD800".isWellFormed(); // false
"abc".isWellFormed();    // true
"😀".isWellFormed();     // true
```

JavaScript の文字列は UTF-16 のコードユニット列なので、仕様上は壊れたサロゲートペアを含む文字列も作れてしまいます。`isWellFormed` はそれをチェックするためのメソッドです。

### `lastIndexOf(searchString, position)`

`lastIndexOf` は、指定した文字列が最後に現れる位置を返します。

```js
"ABCABC".lastIndexOf("ABC"); // 3
```

第2引数 `position` は非常にわかりにくい、という話になりました。

`lastIndexOf` は後ろから検索しますが、`position` は「この位置より後ろは検索しない」という上限のように働きます。

ただし、単純にその位置から文字を比較するというより、検索文字列の長さも考慮した候補位置を後ろから見ていくため、直感的に理解しづらいです。

たとえば検索対象が `"ABCDABCD"`、検索文字列が `"BCD"` の場合、`"BCD"` が始まる候補位置を後ろから見ていきます。

```js
"ABCDABCD".lastIndexOf("BCD");    // 5
"ABCDABCD".lastIndexOf("BCD", 5); // 5
"ABCDABCD".lastIndexOf("BCD", 4); // 1
```

このあたりは、輪読中でも一度混乱しながら仕様を読み直していました。

`lastIndexOf` も古いメソッドなので、正規表現を渡しても `TypeError` にはなりません。`indexOf` と同様、正規表現は文字列化されます。

### `match`

`String.prototype.match` は、正規表現とのマッチ結果を返します。

ただし、必ずしも `RegExp` だけを受け取るわけではありません。引数に `Symbol.match` メソッドがあれば、それを呼びます。

```js
const matcher = {
  [Symbol.match](value) {
    return {
      input: value,
      custom: true
    };
  }
};

console.log("abc".match(matcher));
// { input: "abc", custom: true }
```

`Symbol.match` が返す値は、配列である必要すらありません。任意の値を返せます。

一方、`Symbol.match` がなければ、引数から `RegExp` を作って通常の正規表現マッチを行います。

### `Call` と `Invoke`

仕様内では、関数呼び出しを表す抽象操作として `Call` や `Invoke` が出てきます。

`Call` は、関数オブジェクトを指定した `this` 値で直接呼ぶイメージです。

```js
fn.call(thisValue, arg1, arg2);
```

`Invoke` は、あるオブジェクトの指定プロパティをメソッドとして呼ぶイメージです。

```js
obj[methodName](arg1, arg2);
```

どちらも、最終的には「関数を呼ぶ」処理ですが、`this` が何になるか、どこから関数を取り出すかが違います。

### `IsRegExp` と `Symbol.match`

`IsRegExp` は、値が正規表現として扱われるべきかを判定する抽象操作です。

ざっくり言うと、`Symbol.match` プロパティがあれば、その真偽値を見ます。

```js
const x = {
  [Symbol.match]: true
};

const y = {
  [Symbol.match]: false
};
```

`x` は正規表現的なものとして扱われます。`y` は `Symbol.match` を持っていても、値が falsy なので正規表現扱いされません。

## ECMAScript 2026 / 2027 と Temporal の話

今回、仕様ページを見ている途中で、Temporal が ECMAScript 2026 ではなく ECMAScript 2027 扱いになっていることに気づきました。

Temporal は Stage 4 にはなっているものの、2026 年版には入らず、2027 年版に回ったようです。

ECMAScript の年次仕様は毎年 6 月ごろに確定します。Temporal は大きな機能で、Stage 4 になったタイミングもぎりぎりだったため、2026 年版には間に合わなかったのではないか、という話になりました。

一方で、2026 年版には以下のような提案が入る見込みとして話題に出ていました。

- `await using`
- `Iterator` helpers
- `Iterator.from`
- `Error.isError`
- `Uint8Array` / typed array 関連の機能

`Error.isError` は、内部スロットを見て本物の Error オブジェクトかどうかを判定する、比較的わかりやすい機能として以前にも話題にしていたようです。

## `String.prototype.localeCompare`

今回の中心は `String.prototype.localeCompare` です。

```js
str.localeCompare(that)
str.localeCompare(that, locales)
str.localeCompare(that, locales, options)
```

ECMAScript 本体仕様では、`localeCompare` について最低限のフォールバック仕様が書かれています。

ただし、ECMA-402、つまり Internationalization API を実装している環境では、ECMA-402 側の仕様に従って実装しなければなりません。

現実の JavaScript エンジンでは、通常 ECMA-402 があるため、実際の挙動は ECMA-402 の `Intl.Collator` にかなり依存します。

### ECMA-402 がない場合の位置づけ

ECMAScript 本体仕様には、ECMA-402 がない実装向けの説明があります。

そこでは、`localeCompare` は次のような値を返すとされています。

- 比較対象が `this` より前に並ぶなら正の値
- 比較対象が `this` より後に並ぶなら負の値
- 相対的な順序がない、または同等なら `0`

ただし、実際に返る数値は `-1`、`0`、`1` に限るとは規定されていません。

重要なのは符号です。

```js
console.log("abc".localeCompare("aba")); // positive
console.log("abc".localeCompare("abb")); // positive
console.log("abc".localeCompare("abc")); // 0
console.log("abc".localeCompare("abd")); // negative
console.log("abc".localeCompare("abe")); // negative
```

多くの実装では `-1`、`0`、`1` が返りますが、仕様上は「負・ゼロ・正」の意味だけを使うべきです。

```js
const result = a.localeCompare(b);

if (result < 0) {
  // a は b より前
} else if (result > 0) {
  // a は b より後
} else {
  // 同等
}
```

### `localeCompare` の引数処理

`localeCompare` は generic method です。

まず `this` に対して `RequireObjectCoercible` を行います。そのため、`null` や `undefined` を `this` にすると `TypeError` になります。

```js
try {
  String.prototype.localeCompare.call(null);
} catch (err) {
  console.error(err);
}
```

出力例:

```text
TypeError: String.prototype.localeCompare called on null or undefined
```

その後、`this` と比較対象の値をどちらも文字列に変換します。

```js
String.prototype.localeCompare.call(123, 45);
// "123".localeCompare("45") と同じような扱い
```

第2引数と第3引数は、ECMA-402 では `locales` と `options` として定義されます。

一方、ECMA-402 を持たない実装は、この第2引数・第3引数に別の意味を勝手に与えてはいけない、とされています。

これは、ECMA-402 との互換性を壊さないためです。

### `localeCompare` は `Array.prototype.sort` にそのまま渡せない

`Array.prototype.sort` の比較関数は、2つの引数を受け取ります。

```js
array.sort((a, b) => {
  return a.localeCompare(b);
});
```

一方、`localeCompare` は `this` と第1引数を比較するメソッドです。

そのため、以下のように直接渡すのは適切ではありません。

```js
array.sort(String.prototype.localeCompare); // よくない
```

`sort` から呼ばれるとき、`this` が意図した文字列にならないためです。

正しくは、比較関数の中で明示的に呼びます。

```js
const items = ["réservé", "Premier", "Cliché", "communiqué", "café", "Adieu"];

console.log(
  items.toSorted((a, b) => a.localeCompare(b, "fr"))
);
```

### consistent comparator と total ordering

仕様では、`localeCompare` は2引数のメソッドとして見たとき、文字列全体に対して consistent comparator でなければならない、とされています。

輪読ではここで「全順序」と「半順序」の話になりました。

全順序とは、任意の2つの値を必ず比較できる順序です。

数値は典型的な全順序です。

```text
1 < 2 < 3
```

どの2つを選んでも、どちらが前か後か、または同じかを決められます。

一方、クラスの継承関係のようなものは半順序の例として説明されました。

```text
Object
├── String
└── Number
```

`String` は `Object` の子であり、`Number` も `Object` の子です。しかし、`String` と `Number` の間には「どちらが親か」という関係はありません。

つまり、比較できる組み合わせと比較できない組み合わせがあります。これが半順序です。

`localeCompare` は文字列を並べ替えるために使える必要があるので、全ての文字列同士に対して一貫した比較結果を返さなければなりません。

また、consistent comparator なので、同じ入力に対して呼ぶたびに違う結果を返すようなことは許されません。

```js
// よくない比較関数の例
function randomCompare(a, b) {
  return Math.random() - 0.5;
}
```

`localeCompare` はロケール依存ではあるものの、同じ条件で同じ文字列を比較したら、一貫した結果を返す必要があります。

## canonical equivalence

`localeCompare` の仕様で重要なのが canonical equivalence、正規等価性です。

仕様では、`localeCompare` は Unicode Standard に従った canonical equivalence を認識しなければならない、とされています。

つまり、Unicode 的に正規等価な文字列は、比較結果として `0` を返す必要があります。

### 見た目やコードポイントが違っても同じ扱いになる例

以下のような比較は `0` を返します。

```js
{
  // Å ANGSTROM SIGN vs.
  // Å LATIN CAPITAL LETTER A + COMBINING RING ABOVE
  console.log("\u212B".localeCompare("A\u030A"));

  // Ω OHM SIGN vs.
  // Ω GREEK CAPITAL LETTER OMEGA
  console.log("\u2126".localeCompare("\u03A9"));

  // ṩ LATIN SMALL LETTER S WITH DOT BELOW AND DOT ABOVE vs.
  // s + COMBINING DOT ABOVE + COMBINING DOT BELOW
  console.log("\u1E69".localeCompare("s\u0307\u0323"));

  // ḍ̇ vs. ḍ̇
  console.log("\u1E0B\u0323".localeCompare("\u1E0D\u0307"));

  // 가 HANGUL CHOSEONG KIYEOK + HANGUL JUNGSEONG A vs.
  // 가 HANGUL SYLLABLE GA
  console.log("\u1100\u1161".localeCompare("\uAC00"));

  console.log("㌀".localeCompare("アパート"));
}
```

出力:

```text
0
0
0
0
0
-1
```

最初の5つは正規等価なので `0` です。

最後の `"㌀"` と `"アパート"` は見た目・意味として近いですが、canonical equivalence ではありません。これは compatibility equivalence 側の話になります。

### canonical equivalence と compatibility equivalence

Unicode には、canonical equivalence と compatibility equivalence があります。

canonical equivalence は、Unicode 的に本質的に同じ文字列と見なせるものです。

たとえば、以下は同じ文字を表す別表現です。

```js
"\u212B"   // Å ANGSTROM SIGN
"A\u030A" // A + COMBINING RING ABOVE
```

一方、compatibility equivalence は、互換性上は対応するが、完全に同じ文字として扱うとは限らないものです。

たとえば、`㌀` は「アパート」を1文字にした互換文字です。

```js
"㌀".normalize("NFKC"); // "アパート"
```

しかし、`localeCompare` の仕様では、Unicode の compatibility equivalence や compatibility composition は尊重しないことが推奨されています。

つまり、`"㌀"` と `"アパート"` を同じと扱わない方がよい、ということです。

実際の結果も `0` ではありませんでした。

```js
console.log("㌀".localeCompare("アパート"));
// -1
```

### “honour canonical equivalence” の意味

仕様中に出てくる `honour canonical equivalence` の `honour` は、ここでは「尊重する」「従う」「準拠する」くらいの意味です。

つまり、Unicode Standard の canonical equivalence の定義に従って、正規等価な文字列は同等として扱う、という意味になります。

## language と locale

途中で、language と locale の違いも話題になりました。

language は言語そのものを表します。

```text
en = English
ja = Japanese
fr = French
```

locale は、言語に加えて地域や文化的な慣習も含みます。

```text
en-US = アメリカ英語
en-GB = イギリス英語
ja-JP = 日本語 / 日本
```

たとえば、同じ英語でも、アメリカとイギリスでは日付表記が異なります。

```text
en-US: 05/25/2026
en-GB: 25/05/2026
```

`localeCompare` は名前の通り locale に基づく比較です。文字の並び順は、単なる言語だけでなく、地域や文化的な慣習にも影響されます。

## ECMA-402 側の `localeCompare`

ECMAScript 本体仕様の `localeCompare` は、ECMA-402 がある場合には ECMA-402 の仕様に従います。

ECMA-402 側では、`localeCompare` は内部的に `Intl.Collator` を使う形になっています。

ざっくり言うと、次のような流れです。

```js
const collator = new Intl.Collator(locales, options);
const result = collator.compare(s, that);
```

実際の仕様では、`Construct(%Intl.Collator%, ...)` のような処理で collator を作り、それを使って文字列比較をします。

`Collator` は照合、つまり文字列をどの順序で並べるかを扱うものです。

```js
const collator = new Intl.Collator("de");

console.log(collator.compare("ä", "z"));
// ドイツ語の照合規則に基づく比較
```

## ロケールによる並び順の違い

`localeCompare` は、ロケールによって結果が変わります。

特にわかりやすい例として、`ä` と `z` の順序があります。

```js
{
  const a = "ä";
  const b = "z";

  // ドイツ語では ä は a のバリエーションなので z より前
  console.log(a.localeCompare(b, "de"));

  // スウェーデン語では ä はアルファベットの後半、z の後に位置する
  console.log(a.localeCompare(b, "sv"));
}
```

出力:

```text
-1
1
```

ドイツ語では `ä < z` なので負の値です。

スウェーデン語では `ä > z` なので正の値です。

同じ文字列でも、ロケールによって並び順が変わることが確認できました。

### `z` と `ä` の比較

メモでは以下も試しています。

```js
{
  console.log("z".localeCompare("ä", "de"));
  console.log("z".localeCompare("ä", "en"));
  console.log("z".localeCompare("ä", "sv"));
}
```

出力:

```text
1
1
-1
```

ドイツ語や英語では `z` は `ä` より後ろ扱いですが、スウェーデン語では `ä` が `z` より後ろに来るため、結果が逆になります。

## `ignorePunctuation` オプション

ECMA-402 の `localeCompare` では、第3引数に options を渡せます。

その一つに `ignorePunctuation` があります。

```js
const items = ["réservé", "Premier", "Cliché", "communiqué", "café", "Adieu"];

console.log(
  items.toSorted((a, b) =>
    a.localeCompare(b, "fr", { ignorePunctuation: true })
  )
);

console.log(
  items.toSorted((a, b) =>
    a.localeCompare(b, "fr")
  )
);
```

出力:

```text
Adieu,café,Cliché,communiqué,Premier,réservé
Adieu,café,Cliché,communiqué,Premier,réservé
```

この例では `ignorePunctuation` を指定してもしなくても結果が同じでした。

輪読中でも、このオプションの差が出る良い例を探していましたが、ここでは明確な差分までは確認していません。

## `numeric` オプション

`numeric` オプションを使うと、数字を数値として扱った照合ができます。

```js
["2", "10"].toSorted((a, b) =>
  a.localeCompare(b, "en", { numeric: true })
);
// ["2", "10"]

["2", "10"].toSorted((a, b) =>
  a.localeCompare(b, "en", { numeric: false })
);
// ["10", "2"]
```

`numeric: false` では文字列として比較するため、`"10"` は `"2"` より前に来ます。

`numeric: true` では数値的に比較されるため、`2` が `10` より前になります。

輪読では、日本語の漢数字に対しても試していました。

```js
{
  const nums = ["一", "四十五", "三", "100", "3", "百", "二"];

  console.log(
    nums.toSorted((a, b) =>
      a.localeCompare(b, "ja", { numeric: true })
    )
  );

  console.log(
    nums.toSorted((a, b) =>
      a.localeCompare(b, "ja", { numeric: false })
    )
  );
}
```

出力:

```text
3,100,一,三,四十五,二,百
100,3,一,三,四十五,二,百
```

`numeric: true` は半角数字の `"3"` と `"100"` には効いていますが、漢数字の `"一"`、`"二"`、`"三"`、`"四十五"`、`"百"` を数値として解釈しているわけではなさそうでした。

つまり、`numeric` は任意の言語の数表現を全部数値化する機能ではなく、主に数字列を数値的に照合するためのものだと見てよさそうです。

## ECMA-402 の奥深さ

`localeCompare` を ECMA-402 側まで掘ると、`Intl.Collator` の照合オプションが大量に出てきます。

たとえば、Unicode extension key のようなものがあり、照合規則の細かい指定に関わります。

輪読中では、以下のような話題が出ました。

- `kn` は numeric collation に関係しそう
- `kh` はひらがな・カタカナの優先順位に関係するらしい
- 日本語の照合だけでもかなり複雑
- アラビア語など右から左に書く言語もあり、国際化仕様は非常に大変

結論として、`localeCompare` 自体は小さなメソッドに見えますが、実際には Unicode、ロケール、照合規則、正規化、ECMA-402 などが絡む非常に深い領域だという話になりました。

## `String.prototype.normalize`

残り時間で、`matchAll` に進む代わりに、`localeCompare` と関連が深い `String.prototype.normalize` を読みました。

`normalize` は、Unicode 正規化を行うメソッドです。

```js
str.normalize()
str.normalize(form)
```

`form` には以下の4つを指定できます。

```text
"NFC"
"NFD"
"NFKC"
"NFKD"
```

省略した場合は `"NFC"` になります。

```js
"文字列".normalize();
// "文字列".normalize("NFC") と同じ
```

それ以外の値を指定すると `RangeError` になります。

```js
"abc".normalize("INVALID");
// RangeError
```

### `normalize` の仕様上の流れ

仕様上の処理は、ざっくり次のようなものです。

1. `this` を取得する
2. `RequireObjectCoercible` で `null` / `undefined` を拒否する
3. `this` を文字列化する
4. `form` が省略されていれば `"NFC"` にする
5. `form` が指定されていれば文字列化する
6. `form` が `"NFC"`、`"NFD"`、`"NFKC"`、`"NFKD"` のいずれでもなければ `RangeError`
7. Unicode Standard の指定に従って正規化する
8. 正規化後の文字列を返す

アルゴリズム自体は単純ですが、正規化形式の意味が難しいところです。

## NFC / NFD / NFKC / NFKD

輪読では、`NFC`、`NFD`、`NFKC`、`NFKD` の違いを実験しながら整理しました。

大まかには以下のような関係です。

```text
NFD  = canonical decomposition
NFC  = canonical decomposition + canonical composition

NFKD = compatibility decomposition
NFKC = compatibility decomposition + canonical composition
```

`D` は decomposition、つまり分解です。

`C` は composition、つまり合成です。

`K` が付くものは compatibility、つまり互換等価性まで考慮した分解です。

### `"㌀"` の正規化

`㌀` は「アパート」を1文字にした互換文字です。

```js
{
  console.log("㌀".normalize("NFD"));
  console.log("㌀".normalize("NFKD"), "length", "㌀".normalize("NFKD").length);
  console.log("㌀".normalize("NFC"));
  console.log("㌀".normalize("NFKC"), "length", "㌀".normalize("NFKC").length);
}
```

出力:

```text
㌀
アパート length 5
㌀
アパート length 4
```

`NFD` や `NFC` では、`㌀` はそのままです。

一方、`NFKD` や `NFKC` では `"アパート"` に分解されます。

ただし、`NFKD` では `"パ"` が `"ハ"` + 結合半濁点に分解されているため、length が `5` になります。

```text
ア + ハ + ゚ + ー + ト
```

`NFKC` では、互換分解したあとに canonical composition するため、`"パ"` が合成されて length が `4` になります。

```text
ア + パ + ー + ト
```

### `"アパート"` の正規化

```js
{
  console.log("アパート".normalize("NFD"));
  console.log("アパート".normalize("NFKD"));
  console.log("アパート".normalize("NFC"));
  console.log("アパート".normalize("NFKC"));
}
```

出力:

```text
アパート
アパート
アパート
アパート
```

`NFD` と `NFKD` では、`パ` が `ハ` + 結合半濁点に分解されます。

`NFC` と `NFKC` では、合成済みの `パ` になります。

### 半角カナ `"ｱﾊﾟｰﾄ"` の正規化

```js
{
  console.log("ｱﾊﾟｰﾄ".normalize("NFD"));
  console.log("ｱﾊﾟｰﾄ".normalize("NFKD"));
  console.log("ｱﾊﾟｰﾄ".normalize("NFC"));
  console.log("ｱﾊﾟｰﾄ".normalize("NFKC"));
}
```

出力:

```text
ｱﾊﾟｰﾄ
アパート
ｱﾊﾟｰﾄ
アパート
```

`NFD` と `NFC` では、半角カナはそのままです。

一方、`NFKD` と `NFKC` では、互換文字として全角カナに変換されます。

`NFKD` は分解したままなので `"ハ" + 半濁点` になります。

`NFKC` は合成まで行うので `"パ"` になります。

### code point の確認

メモでは、`NFKD` と `NFKC` の違いを code point でも確認していました。

```js
{
  console.log(String.fromCodePoint("㌀".normalize("NFKD").codePointAt(2)));
  console.log(String.fromCodePoint("㌀".normalize("NFKC").codePointAt(2)));
}
```

出力:

```text
゚
ー
```

`NFKD` の結果は以下です。

```text
ア ハ ゚ ー ト
```

index `2` は結合半濁点です。

`NFKC` の結果は以下です。

```text
ア パ ー ト
```

index `2` は長音記号です。

この実験によって、`NFKD` は互換分解だけ、`NFKC` は互換分解したあとに合成まで行う、という違いがかなり具体的に確認できました。

## macOS のファイル名正規化の話

最後に、macOS の HFS+ ではファイル名が独特な Unicode 正規化形式で扱われるという話も出ました。

よく「NFD っぽい」と言われるものの、厳密には Unicode の標準的な NFD そのものではなく、少し特殊な形式です。

そのため、macOS と他の環境でファイル名を扱うと、見た目は同じなのに内部表現が違う文字列になることがあります。

たとえば、`パ` が1文字として入っている場合と、`ハ` + 結合半濁点として入っている場合です。

```js
"パ".length;      // 1
"パ".length;     // 2
```

見た目は同じでも、JavaScript の文字列としては異なる可能性があります。

正規化は、このような差を吸収するために重要です。

```js
"パ".normalize("NFD") === "パ".normalize("NFD");
// true

"パ".normalize("NFC") === "パ".normalize("NFC");
// true
```

## 今回のまとめ

今回の主題は `String.prototype.localeCompare` でした。

`localeCompare` は単純な文字列比較メソッドに見えますが、実際には以下のような広い仕様領域に関わっています。

- ECMA-402
- `Intl.Collator`
- locale
- language
- Unicode collation
- canonical equivalence
- compatibility equivalence
- Unicode normalization
- `String.prototype.normalize`

特に重要だったのは、`localeCompare` が canonical equivalence を尊重しなければならない点です。

つまり、Unicode 的に正規等価な文字列は `0` を返す必要があります。

一方、compatibility equivalence まで同じ扱いすることは推奨されていません。

その流れで `normalize` も読み、`NFC`、`NFD`、`NFKC`、`NFKD` の違いを実験しました。

```js
"㌀".normalize("NFD");  // "㌀"
"㌀".normalize("NFKD"); // "アパート"
"㌀".normalize("NFC");  // "㌀"
"㌀".normalize("NFKC"); // "アパート"
```

`localeCompare` と `normalize` を通して、JavaScript の文字列処理は単なるコードポイント比較ではなく、Unicode と国際化仕様に深く依存していることが確認できました。

次回は、今回後回しにした `String.prototype.matchAll` から読む予定です。