# ECMAScript 仕様輪読会 第100回: `String.prototype` 周辺

## 今回読んだ範囲

今回の本題は `String.prototype` の以下のメソッドでした。

- `String.prototype.constructor`
- `String.prototype.endsWith`
- `String.prototype.includes`
- `String.prototype.indexOf`
- `String.prototype.isWellFormed`
- `String.prototype.lastIndexOf`
- `String.prototype.match`

最後に `localeCompare` は次回へ回すことになりました。また、`match` は今回先に読んだため、次回は飛ばして `localeCompare` から読む、というメモが残されました。

```txt
次回、matchは先に読んだので、localeCompareを読む（そしてmatchは飛ばす）
```

---

## `String.prototype.constructor`

`String.prototype.constructor` の初期値は `%String%`、つまり組み込みの `String` コンストラクタです。

```js
String.prototype.constructor === String
// true
```

ここは仕様上もほとんど説明する内容はなく、`String.prototype` から `String` コンストラクタを指している、という確認だけでした。

---

## `String.prototype.endsWith(searchString, endPosition?)`

`endsWith` は、文字列が指定した文字列で終わっているかを判定します。

```js
"abcde".endsWith("cde");
// true
```

第2引数 `endPosition` を渡すと、「文字列全体の末尾」ではなく、指定位置を末尾とみなして判定します。

```js
const s = "abcde";

console.log(s.endsWith("cde"));    // true
console.log(s.endsWith("cde", 5)); // true
console.log(s.endsWith("cde", 4)); // false

console.log(s.endsWith("bcd", 4)); // true
console.log(s.endsWith("cd", 4));  // true
console.log(s.endsWith("d", 4));   // true
```

`"abcde"` に対して `endPosition` が `4` の場合、実質的には `"abcd"` の末尾を見ているような扱いになります。そのため `"bcd"`, `"cd"`, `"d"` は `true` になります。

### `endPosition` の扱い

`endPosition` が省略された場合は、文字列の長さが使われます。

```js
"abcde".endsWith("cde");
// "abcde" 全体の末尾を見る
```

一方、`endPosition` が指定された場合は整数化され、さらに `0` から文字列長の範囲に収まるようにクランプされます。つまり、大きすぎる値や小さすぎる値が来ても、文字列の範囲内に丸められます。

### 空文字列の場合

検索文字列が空文字列の場合は `true` になります。空文字列はどの位置にも存在するとみなせるためです。

```js
"abc".endsWith("");
// true
```

### 正規表現は渡せない

`endsWith` の第1引数に正規表現を渡すと `TypeError` になります。

```js
try {
  "a".endsWith(/./);
} catch (e) {
  console.error(e);
}
// TypeError
```

また、実際の `RegExp` インスタンスでなくても、`Symbol.match` を持つオブジェクトは正規表現的なものとして扱われます。

```js
const r = { [Symbol.match]: 1 };

try {
  "".endsWith(r);
} catch (e) {
  console.error(e);
}
// TypeError
```

勉強会中の実行例は次の通りです。

```js
{
  const s = "abcde";
  console.log(s.endsWith("cde"));
  console.log(s.endsWith("cde", 5));
  console.log(s.endsWith("cde", 4));
  console.log(s.endsWith("bcd", 4));
  console.log(s.endsWith("cd", 4));
  console.log(s.endsWith("d", 4));
  console.log(s.endsWith("aabcde"));
}

{
  const r = { [Symbol.match]: 1 };
  try { "".endsWith(r); } catch (e) { console.error(e) }
  try { "a".endsWith(/./); } catch (e) { console.error(e) }
}
```

```txt
true
true
false
true
true
true
false
TypeError: First argument to String.prototype.endsWith must not be a regular expression
TypeError: First argument to String.prototype.endsWith must not be a regular expression
```

### なぜ正規表現で例外にするのか

仕様の Note では、第1引数が正規表現だった場合に例外を投げるのは、将来の仕様拡張の余地を残すためだと説明されています。

もし現時点で正規表現を単に文字列化したり、常に `false` にしたりしてしまうと、将来「正規表現を受け取れる `endsWith`」のような拡張を入れたときに、既存コードの意味が変わってしまいます。

そこで、今は明示的に `TypeError` にしておくことで、「今まで動かなかったコードが将来動くようになる」形にできる、という話でした。

### `endsWith` はジェネリック

`endsWith` は `this` が本物の文字列であることを要求しません。`null` と `undefined` 以外であれば、まず `this` を文字列化して処理します。

この性質は `String.prototype` の多くのメソッドに共通しており、「意図的にジェネリック」と説明されています。

---

## `String.prototype.includes(searchString, position?)`

`includes` は、指定した文字列が含まれるかどうかを返します。

```js
"abcdefghij".includes("bcd");
// true
```

第2引数 `position` を渡すと、その位置以降を検索します。

```js
const s = "abcdefghij";

console.log(s.includes("bcd"));    // true
console.log(s.includes("bcd", 0)); // true
console.log(s.includes("bcd", 1)); // true
console.log(s.includes("bcd", 2)); // false
console.log(s.includes("bcd", 3)); // false
console.log(s.includes("bcd", 4)); // false
```

`"bcd"` はインデックス `1` から始まっているため、検索開始位置が `0` または `1` なら見つかります。しかし `2` 以降から探すと見つかりません。

### `position` の扱い

`position` が省略されると、`undefined` が整数化され、結果的に `0` として扱われます。

仕様上は、`ToIntegerOrInfinity(undefined)` の結果が `0` になることを前提にしています。

その後、`position` は `0` から文字列長の範囲にクランプされます。

### 正規表現は渡せない

`includes` も `endsWith` と同じく、第1引数に正規表現を渡すと `TypeError` になります。

```js
const r = { [Symbol.match]: 1 };

try {
  "".includes(r);
} catch (e) {
  console.error(e);
}

try {
  "a".includes(/./);
} catch (e) {
  console.error(e);
}
```

```txt
TypeError: First argument to String.prototype.includes must not be a regular expression
TypeError: First argument to String.prototype.includes must not be a regular expression
```

勉強会中の例です。

```js
{
  const s = "abcdefghij";
  console.log(s.includes("bcd"));
  console.log(s.includes("bcd", 0));
  console.log(s.includes("bcd", 1));
  console.log(s.includes("bcd", 2));
  console.log(s.includes("bcd", 3));
  console.log(s.includes("bcd", 4));
  console.log(s.includes("aabcde"));
}

{
  const r = { [Symbol.match]: 1 };
  try { "".includes(r); } catch (e) { console.error(e) }
  try { "a".includes(/./); } catch (e) { console.error(e) }
}
```

```txt
true
true
true
false
false
false
false
TypeError: First argument to String.prototype.includes must not be a regular expression
TypeError: First argument to String.prototype.includes must not be a regular expression
```

### 内部では前方検索を使う

`includes` は内部的には、指定位置以降に検索文字列が出現するかを調べます。仕様では `StringIndexOf` という抽象操作が使われます。

これは大まかには次のような処理です。

- 検索対象の文字列と、探す文字列を受け取る
- 指定された開始位置から前方向に探す
- 見つかればその位置を返す
- 見つからなければ `not-found` を返す

`includes` はこの結果を見て、見つかったなら `true`、見つからなければ `false` を返します。

`indexOf` と違って、`includes` は位置ではなく真偽値を返すのがポイントです。

### 空文字列の扱い

空文字列はどの位置にも存在するとみなされます。そのため、空文字列を検索すると基本的には `true` になります。

仕様中の `StringIndexOf` でも、検索文字列が空文字列の場合は特別扱いされます。全位置を走査する必要がないためです。

---

## ジェネリックメソッドとしての `includes`

`includes` の Note でも、このメソッドがジェネリックであることが説明されます。

つまり、普通はこう使います。

```js
const s = "abcde";

console.log(s.includes("bcd"));
// true
```

しかし、`String.prototype.includes` を取り出して、別の `this` に対して呼び出すこともできます。

```js
const s = "abcde";

console.log(String.prototype.includes.call(s, "bcd"));
// true
```

さらに、`this` は文字列そのものでなくても構いません。`null` と `undefined` でなければ文字列化されます。

```js
console.log({}.toString());
// "[object Object]"

console.log(String.prototype.includes.call({}, "[object"));
// true
```

これは、`{}` が文字列化されると `"[object Object]"` になるためです。

勉強会中には、この例を使って「`this object` を文字列に変換した結果に対して検索する」という仕様の説明を確認しました。

```js
{
  const s = "abcde";
  console.log(s.includes("bcd"));
  console.log(String.prototype.includes.call(s, "bcd"));
}

{
  console.log({}.toString())
  console.log(String.prototype.includes.call({}, "[object"));
}
```

```txt
true
true
[object Object]
true
```

---

## `String.prototype.indexOf(searchString, position?)`

`indexOf` は、指定した文字列が最初に現れる位置を返します。見つからなければ `-1` を返します。

```js
"abcdeabcde".indexOf("bcd");
// 1
```

第2引数 `position` を渡すと、その位置以降から検索します。

```js
const s = "abcdeabcde";

console.log(s.indexOf("bcd"));    // 1
console.log(s.indexOf("bcd", 0)); // 1
console.log(s.indexOf("bcd", 1)); // 1
console.log(s.indexOf("bcd", 2)); // 6
console.log(s.indexOf("bcd", 3)); // 6
console.log(s.indexOf("bcd", 4)); // 6
console.log(s.indexOf("aabcde")); // -1
```

`"abcdeabcde"` には `"bcd"` が2回出てきます。

```txt
abcdeabcde
 ^    ^
 1    6
```

開始位置が `0` または `1` なら最初の `"bcd"` が見つかり、開始位置が `2` 以降なら次の `"bcd"` が見つかります。

### `includes` との違い

`includes` と `indexOf` は似ていますが、戻り値が違います。

```js
"abcde".includes("bcd");
// true

"abcde".indexOf("bcd");
// 1
```

`includes` は「あるかどうか」だけを返します。`indexOf` は「どこにあるか」を返します。

### 正規表現を渡しても例外にならない

ここで `includes` や `endsWith` と違う重要な点があります。

`indexOf` は第1引数に正規表現を渡しても `TypeError` になりません。

```js
try {
  "".indexOf(/./);
  console.log("no error");
} catch (e) {
  console.error(e);
}
```

```txt
no error
```

`Symbol.match` を持つオブジェクトでも例外にはなりません。

```js
const r = { [Symbol.match]: 1 };

try {
  "".indexOf(r);
  console.log("no error");
} catch (e) {
  console.error(e);
}
```

```txt
no error
```

これは、`indexOf` が古くからあるメソッドであり、後から追加された `includes` などとは歴史的な事情が違うためだろう、という話になりました。

`includes` や `endsWith` は、将来の正規表現対応の余地を残すために正規表現を拒否します。一方、古い `indexOf` ではそのような拒否を入れると既存の挙動を壊す可能性があります。

勉強会中の例です。

```js
{
  const s = "abcdeabcde";
  console.log(s.indexOf("bcd"));
  console.log(s.indexOf("bcd", 0));
  console.log(s.indexOf("bcd", 1));
  console.log(s.indexOf("bcd", 2));
  console.log(s.indexOf("bcd", 3));
  console.log(s.indexOf("bcd", 4));
  console.log(s.indexOf("aabcde"));
}

{
  const r = { [Symbol.match]: 1 };
  try { "".indexOf(r); console.log("no error"); } catch (e) { console.error(e) }
  try { "a".indexOf(/./); console.log("no error"); } catch (e) { console.error(e) }
}

{
  console.log({}.toString())
  console.log(String.prototype.indexOf.call({}, "obj"));
  try { String.prototype.indexOf.call(null, "obj"); } catch (e) { console.error(e) }
}
```

```txt
1
1
1
6
6
6
-1
no error
no error
[object Object]
1
TypeError: String.prototype.indexOf called on null or undefined
```

### `indexOf` もジェネリック

`indexOf` も `this` を文字列化して処理します。

```js
console.log(String.prototype.indexOf.call({}, "obj"));
// 1
```

`{}` は `"[object Object]"` になるため、`"obj"` はインデックス `1` に見つかります。

ただし `this` が `null` または `undefined` の場合は、文字列化できる対象ではないため `TypeError` になります。

```js
String.prototype.indexOf.call(null, "obj");
// TypeError
```

---

## `String.prototype.isWellFormed()`

`isWellFormed` は、文字列が well-formed な Unicode 文字列かどうかを判定します。

ここで問題になるのはサロゲートペアです。JavaScript の文字列は UTF-16 のコードユニット列なので、サロゲートペアの片割れだけが存在するような文字列を作れてしまいます。

たとえば `"𩸽"` はサロゲートペアで表現される文字です。

```js
console.log("𩸽".isWellFormed());
// true
```

しかし、インデックスで片方だけ取り出すと、サロゲートペアの前半または後半だけになります。これは well-formed ではありません。

```js
console.log("𩸽"[0].isWellFormed());
// false

console.log("𩸽"[1].isWellFormed());
// false
```

勉強会中の例です。

```js
{
  console.log("𩸽".isWellFormed());
  console.log("𩸽"[0].isWellFormed());
  console.log("𩸽"[1].isWellFormed());
}
```

```txt
true
false
false
```

`isWellFormed` 自体の仕様上の処理はかなり薄く、`this` を文字列化したうえで、その文字列が well-formed Unicode かどうかを抽象操作に渡して判定する、という流れでした。

---

## `String.prototype.lastIndexOf(searchString, position?)`

`lastIndexOf` は、指定した文字列が最後に現れる位置を返します。見つからなければ `-1` を返します。

```js
"abcdeabcde".lastIndexOf("bcd");
// 6
```

`indexOf` が前から探すのに対して、`lastIndexOf` は後ろ側から探します。

```js
const s = "abcdeabcde";

console.log(s.lastIndexOf("bcd"));    // 6
console.log(s.lastIndexOf("bcd", 6)); // 6
console.log(s.lastIndexOf("bcd", 5)); // 1
console.log(s.lastIndexOf("bcd", 4)); // 1
console.log(s.lastIndexOf("bcd", 3)); // 1
console.log(s.lastIndexOf("bcd", 2)); // 1
console.log(s.lastIndexOf("abcdee")); // -1
```

`"abcdeabcde"` の `"bcd"` はインデックス `1` と `6` にあります。

```txt
abcdeabcde
 ^    ^
 1    6
```

`position` を省略すると、文字列の末尾側から検索します。そのため `6` が返ります。

`position` を `5` にすると、インデックス `6` から始まる `"bcd"` は検索範囲外になるため、前の `"bcd"` である `1` が返ります。

### `position` の意味が `indexOf` と違う

`indexOf(searchString, position)` の `position` は「ここから前方向に探す」という意味でした。

一方、`lastIndexOf(searchString, position)` の `position` は「ここより後ろは見ない」という上限のように働きます。

そのため、`lastIndexOf` の第2引数は少し直感的でない、という話になりました。

### `position` 省略時の扱い

`lastIndexOf` では、`position` が省略された場合、`+Infinity` のように扱われます。その後、文字列長に応じた範囲へクランプされるため、結果的に文字列全体を後ろから探すことになります。

`indexOf` や `includes` では省略時に `0` 相当でしたが、`lastIndexOf` では末尾側から探すため、扱いが異なります。

### 正規表現を渡しても例外にならない

`lastIndexOf` も `indexOf` と同じく、正規表現を渡しても例外になりません。

```js
const r = { [Symbol.match]: 1 };

try {
  "".lastIndexOf(r);
  console.log("no error");
} catch (e) {
  console.error(e);
}

try {
  "a".lastIndexOf(/./);
  console.log("no error");
} catch (e) {
  console.error(e);
}
```

```txt
no error
no error
```

勉強会中の例です。

```js
{
  const s = "abcdeabcde";
  console.log(s.lastIndexOf("bcd"));
  console.log(s.lastIndexOf("bcd", 6));
  console.log(s.lastIndexOf("bcd", 5));
  console.log(s.lastIndexOf("bcd", 4));
  console.log(s.lastIndexOf("bcd", 3));
  console.log(s.lastIndexOf("bcd", 2));
  console.log(s.lastIndexOf("abcdee"));
}

{
  const r = { [Symbol.match]: 1 };
  try { "".lastIndexOf(r); console.log("no error"); } catch (e) { console.error(e) }
  try { "a".lastIndexOf(/./); console.log("no error"); } catch (e) { console.error(e) }
}

{
  console.log({}.toString())
  console.log(String.prototype.lastIndexOf.call({}, "obj"));
  try { String.prototype.lastIndexOf.call(null, "obj"); } catch (e) { console.error(e) }
}
```

```txt
6
6
1
1
1
1
-1
no error
no error
[object Object]
1
TypeError: String.prototype.lastIndexOf called on null or undefined
```

### `lastIndexOf` もジェネリック

`lastIndexOf` も `this` を文字列化します。

```js
console.log(String.prototype.lastIndexOf.call({}, "obj"));
// 1
```

`{}` が `"[object Object]"` になるため、`"obj"` が見つかります。

`null` や `undefined` を `this` にすると `TypeError` です。

---

## `String.prototype.match(regexp)`

最後に `match` を読みました。

`match` は、通常は正規表現に対して文字列をマッチさせるメソッドです。

```js
const s = "abcdeabcde";

console.log(s.match("bcd"));
console.log(s.match(/bcd/));
```

実行結果では、どちらも `"bcd"` にマッチします。

```txt
bcd
bcd
```

ただし、仕様上の流れを見ると、`String.prototype.match` は単に「正規表現で検索する」だけのメソッドではありません。

### `Symbol.match` があればそれを使う

`match` に渡された値がオブジェクトで、`Symbol.match` メソッドを持っている場合、`String.prototype.match` はそれを呼び出します。

```js
const r = {
  [Symbol.match]: (...args) => {
    console.log(
      JSON.stringify({ args }, null, 2)
    );
    return {};
  }
};

const s = "abcdeabcde";
console.log(s.match(r));
```

```txt
{
  "args": [
    "abcdeabcde"
  ]
}
[object Object]
```

ここでは、`r[Symbol.match]` が呼ばれ、その引数として対象文字列 `"abcdeabcde"` が渡されています。

戻り値は `{}` ですが、`match` はそれをそのまま返します。つまり、`Symbol.match` を自分で実装した場合、必ずしも通常のマッチ結果の配列を返す必要はありません。

```js
const matcher = {
  [Symbol.match](str) {
    return { input: str, custom: true };
  }
};

console.log("abc".match(matcher));
// { input: "abc", custom: true }
```

この仕組みにより、独自のマッチャーオブジェクトを作れます。

### `Symbol.match` がなければ `RegExp` を作る

渡された値に `Symbol.match` がなければ、`match` はその値から `RegExp` オブジェクトを作り、その正規表現の `@@match` メソッドを呼び出します。

そのため、文字列を渡しても正規表現として扱われます。

```js
"abcdeabcde".match("bcd");
// /bcd/ に近い形で扱われる
```

勉強会では、この中で出てくる `RegExpCreate` が少し気になる、という話も出ました。

特に、文字列から正規表現を作るときにどのようにパターンとして解釈されるのか、また最近の正規表現フラグ、たとえば `v` フラグなども関係してきそうだ、という話になりました。

ただし `RegExpCreate` や `RegExpInitialize` の詳細は、この場では深追いせず、必要であれば `matchAll` などを読むときに改めて見ることになりました。

### `Call` と `Invoke`

`match` の仕様を読む中で、抽象操作 `Call` と `Invoke` の違いにも触れました。

大まかには、`Call` は関数オブジェクトを直接呼ぶ操作です。

```js
fn.call(thisValue, arg)
```

のようなイメージです。

一方、`Invoke` は、あるオブジェクトの指定プロパティをメソッドとして呼び出す操作です。

```js
obj[methodKey](arg)
```

のようなイメージです。

`match` では、カスタムの `Symbol.match` が見つかった場合は、それを取得して `Call` します。一方、通常の `RegExp` を作った後は、その正規表現オブジェクトに対して `Symbol.match` メソッドを `Invoke` します。

---

## `IsRegExp` と `Symbol.match`

今回、`endsWith` や `includes` の正規表現拒否、そして `match` のカスタムマッチャーの話で、`Symbol.match` が何度も出てきました。

`IsRegExp` は単に `value instanceof RegExp` のような判定だけをしているわけではありません。

大まかには次のような考え方です。

- オブジェクトでなければ正規表現ではない
- `Symbol.match` プロパティがあれば、その真偽値を使う
- `Symbol.match` がなければ、内部的に正規表現として作られたものかを見る

そのため、次のようなオブジェクトも正規表現的なものとして扱われます。

```js
const r = {
  [Symbol.match]: true
};
```

この結果、`endsWith` や `includes` に渡すと `TypeError` になります。

```js
"abc".includes(r);
// TypeError
```

一方、`indexOf` や `lastIndexOf` はこのチェックを行わないため、例外になりません。

---

## 今回の重要な整理

今回読んだ範囲では、似たような文字列検索メソッドでも、歴史的経緯や仕様設計によって挙動が違うことが確認されました。

```js
"abc".includes(/a/);
// TypeError

"abc".endsWith(/c/);
// TypeError

"abc".indexOf(/a/);
// 例外にはならない

"abc".lastIndexOf(/a/);
// 例外にはならない
```

また、多くの `String.prototype` メソッドはジェネリックであり、`this` を文字列化して処理します。

```js
String.prototype.includes.call({}, "[object");
// true

String.prototype.indexOf.call({}, "obj");
// 1
```

ただし、`null` と `undefined` は `RequireObjectCoercible` によって拒否されます。

```js
String.prototype.indexOf.call(null, "x");
// TypeError
```

Unicode 的には、JavaScript の文字列が UTF-16 コードユニット列であるため、サロゲートペアの片割れを作れてしまうこと、そしてそれを `isWellFormed` で判定できることも確認しました。

```js
"𩸽".isWellFormed();    // true
"𩸽"[0].isWellFormed(); // false
"𩸽"[1].isWellFormed(); // false
```

最後に、`match` は単なる正規表現検索ではなく、`Symbol.match` によって独自のマッチ処理へ委譲できるメソッドであることを確認しました。

```js
const matcher = {
  [Symbol.match](str) {
    return `matched against: ${str}`;
  }
};

"abc".match(matcher);
// "matched against: abc"
```

次回は、今回飛ばした `String.prototype.localeCompare` から読む予定です。