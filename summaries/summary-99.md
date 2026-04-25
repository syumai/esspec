# ECMAScript仕様輪読会 第99回

## 前回の振り返り

今回の本編に入る前に、まず前回の到達点が整理されました。ここでは `Date` と `String` 周辺で前回見た内容を短く振り返っています。

前回扱ったポイントは主に次のとおりです。

- `Date.prototype.toUTCString()` は RFC 7231 の HTTP-date 形式をベースにした UTC 文字列表現を返す
- 出力は必ず `GMT` で終わる
- 1万年以上の年や負の年も表現できる
- `valueOf()` は内部スロットに入っている値を返す
- `ToPrimitive` の挙動を少し実験し、`Symbol.toPrimitive` の上書きや `defineProperty` での変更も確認した
- `String()` と `new String()` は返り値が違う
- `String.fromCharCode()` と `String.fromCodePoint()` は似ているが、Unicode の扱いがかなり違う

特に `String()` と `new String()` の違いは今回の本編にも繋がるため、再確認されました。

```js
const s1 = String(1);
const s2 = String(1);
const s3 = new String(1);
const s4 = new String(1);

console.log(s1 === s2); // true
console.log(s3 === s4); // false
console.log(typeof s1); // "string"
console.log(typeof s3); // "object"
```

ここでの確認事項は単純で、`String(x)` はプリミティブ文字列を返し、`new String(x)` は `String` オブジェクトを返す、ということです。同じ `"1"` を表していても、後者はオブジェクトなので参照比較では一致しません。

また、`fromCharCode()` と `fromCodePoint()` の違いも前回内容として再確認されました。`fromCharCode()` は UTF-16 のコードユニット寄りの古い API で、`fromCodePoint()` は Unicode コードポイントを直接扱いやすい API です。BMP 外の文字、つまりサロゲートペアを必要とする文字では差がはっきり出ます。

---

## String.raw

今回最初の本題は `String.raw` でした。参加者の感覚としても「普段かなり使わない API」ですが、タグ付きテンプレートリテラルを理解するには良い題材、という位置づけで読み進められました。

### 何をする関数か

`String.raw` は、タグ関数として使うことを前提に設計された関数です。普通のテンプレートリテラルでは、`\n` のようなエスケープシーケンスは改行として解釈されます。しかし `String.raw` をタグとして使うと、バックスラッシュを“生のまま”保持した文字列を作れます。

輪読会では Windows パスの例が非常にわかりやすいとして取り上げられました。

```js
const filePath = String.raw`C:\Development\profile\new.html`;
console.log(`The file was uploaded from: ${filePath}`);
```

出力は次のようになります。

```txt
The file was uploaded from: C:\Development\profile\new.html
```

一方、普通のテンプレートリテラルだとこうなります。

```js
const filePath = `C:\Development\profile\new.html`;
console.log(`The file was uploaded from: ${filePath}`);
```

```txt
The file was uploaded from: C:Developmentprofile
ew.html
```

ここで起きているのは、`\n` が改行として解釈され、`\D` や `\p` のような部分も「そのまま見た目通り残ってくれる」とは限らない、という問題です。Windows パスや正規表現のようにバックスラッシュを大量に含む場面では、`String.raw` はかなり実用的です。

### `${}` の補間はどうなるのか

`raw` という名前から「全部そのままになるのでは」と思いがちですが、補間そのものは普通に行われます。生になるのは主にエスケープシーケンスの扱いです。

```js
const name = "Bob";

console.log(String.raw`Hi\n${name}!`);
console.log(String.raw`Hi \${name}!`);
```

```txt
Hi\nBob!
Hi \${name}!
```

この確認から、会では次のように整理されました。

- `String.raw` でも `${...}` の補間は行われる
- `\n` は改行にならず、文字列 `\` と `n` の並びとして残る
- 補間自体を止めたいなら、ドル記号側をエスケープする必要がある

### `template.raw` の中身を見る

その後、`String.raw` の仕組みを理解するために、独自タグ関数 `myRaw` を作って、テンプレートに渡されるオブジェクトを直接観察しました。

```js
function myRaw(template, ...subs) {
  console.log(JSON.stringify({ template, subs }, null, 2));
  console.log(JSON.stringify({ "template.raw": template.raw }, null, 2));
  return String.raw(template, ...subs);
}

console.log(myRaw`a${1}b${2}c${3}\n`);
```

観察結果は次のとおりです。

```txt
{
  "template": [
    "a",
    "b",
    "c",
    "\n"
  ],
  "subs": [
    1,
    2,
    3
  ]
}
{
  "template.raw": [
    "a",
    "b",
    "c",
    "\\n"
  ]
}
a1b2c3\n
```

ここで重要なのは、`template` と `template.raw` が別物だという点です。

- `template` 側は「調理済み（cooked）」で、`\n` は実際の改行として解釈済み
- `template.raw` 側は「生（raw）」で、`\\n` のように元の記述に近い形を保持する

会では `cooked` / `raw` という呼び方そのものにも触れられ、「raw に対して cooked という語を使っているのが仕様っぽくて面白い」といった反応がありました。

### `.raw` はどこから来るのか

「なぜテンプレート配列に `.raw` プロパティがあるのか」も話題になり、タグ付きテンプレートリテラルの仕様側まで遡って確認されました。結論としては、テンプレートオブジェクトが生成されるときに `raw` 用の別オブジェクトが作られ、それが `.raw` として結び付けられる、という仕組みです。

さらに、実験の中で次の点も見えました。

- テンプレートオブジェクトは拡張不可
- 配列っぽく見えても、要素の再代入はできない
- `.raw` 側も専用の固定的な値として扱われる

つまり、タグ関数に渡ってくるテンプレートは「ただの配列」ではなく、仕様がかなり強く形を決めた特別な値です。

---

## String.prototype オブジェクトそのもの

次に読まれたのは `String.prototype` 自体の説明でした。ここはメソッド個別の話というより、「`String.prototype` はどういうオブジェクトなのか」という土台の確認です。

会で押さえられたポイントは次のとおりです。

- `String.prototype` は組み込みの特別なオブジェクト
- 文字列用の exotic object である
- `[[StringData]]` という内部スロットを持つ
- その初期値は空文字列
- `length` は 0
- プロトタイプは `Object.prototype`

特に面白がられていたのは、「`String.prototype` 自体が `[[StringData]]` を持っている」という点です。そのため、`String.prototype.valueOf()` を直接呼ぶと空文字列が返ります。

```js
const s1 = String(1);
const s3 = new String(1);

console.log(s1.valueOf());                // "1"
console.log(s3.valueOf());                // "1"
console.log(String.prototype.valueOf());  // ""
```

ここでの理解はこうです。

- プリミティブ文字列に対する `valueOf()` はその文字列を返す
- `new String(1)` のような文字列オブジェクトに対する `valueOf()` も内部スロット内の `"1"` を返す
- しかし `String.prototype` 自体の `[[StringData]]` は空なので、空文字列が返る

### String exotic object とは何か

`String.prototype` は「string exotic object」だと書かれており、この言い方も少し掘られました。ここでいう exotic object は、普通のオブジェクトとは異なる内部メソッドを持つオブジェクトです。

会では、文字列に対して次のような振る舞いがあることと結びつけて理解されました。

- `"abc"[0]` のように添字アクセスできる
- ただし、それは普通の配列とは違う
- 文字列の一文字を書き換えることはできない
- こうした挙動を実現するために、内部的なプロパティ取得や定義の仕組みが普通と違う

つまり、見た目は配列っぽくインデックスで読めるが、実体は文字列専用ルールを持ったオブジェクトだ、という理解です。

---

## String.prototype.at

休憩前後で、次の中心テーマが `String.prototype.at` でした。

### まず気づいたこと: 仕様文の定型句が抜けている

読み始めてすぐ、「この節だけ `This method performs the following steps when called:` という定型句が抜けている」という指摘が出ました。これは内容上の大問題ではないものの、編集上の抜け漏れに見える、という扱いでした。

Scrapbox にも次のメモが残されています。

```txt
22.1.3.1 String.prototype.atに、This method performs the following steps when called:が無い
```

会の空気としては「読解に支障は少ないが、仕様書の体裁としてはミスっぽい」という感じです。

### `at()` の動き

`at()` は最近の API で、配列の `at()` と似た使い方ができます。要点は次のとおりです。

- 負のインデックスが使える
- 範囲外なら `undefined`
- 小数は 0 方向に切り捨てられる
- 文字列を“コードユニット単位”で見る

実験はこうでした。

```js
console.log("𩸽".at(0));
console.log("鱧".at(0));

const s = "あいうえお";
console.log(s.at(0));
console.log(s.at(4));
console.log(s.at(4.5));
console.log(s.at(-5));
console.log(s.at(-5.5));
console.log(s.at(-6));
console.log(s.at(5));
String.prototype.at.call(null);
```

出力は次のようになります。

```txt
�
鱧
あ
お
お
あ
あ
undefined
undefined
TypeError: String.prototype.at called on null or undefined
```

ここで整理されたポイントはかなり多いです。

- `"あいうえお".at(4.5)` が `"お"` になるのは、小数部が切り捨てられるから
- `-5.5` も `-5` として扱われる
- `-6` は範囲外なので `undefined`
- `null` や `undefined` をレシーバーにすると `TypeError`
- `𩸽` のような BMP 外文字は UTF-16 上では 2 つのコードユニットなので、`at(0)` は“文字全体”ではなく前半だけ返してしまう

つまり `at()` は「文字っぽく見える単位」ではなく、「UTF-16 コードユニット」で動く API です。ここが直感を裏切るところでした。

### `at()` は実質ジェネリックではないか

仕様本文には `charAt()` などと違って `at()` に “intentionally generic” という注記がありません。しかし、実際の定義を見ると `this` を文字列化して使っているため、`null` / `undefined` 以外にはかなり広く使えます。

そのため会では、「注記がないだけで、定義上は実質ジェネリックに見える」という話になりました。これは終盤の `concat()` の議論にも繋がります。

---

## charAt / charCodeAt / codePointAt

ここからは、似て非なる三兄弟の比較が続きました。

### charAt

`charAt()` は指定位置の 1 文字を返しますが、ここでいう 1 文字もコードユニット単位です。範囲外なら空文字列を返します。

```js
console.log("𩸽".charAt(0));
console.log("𩸽".charAt(1));
console.log("𩸽".charAt(-1));
console.log("𩸽".charAt(2));
```

```txt
�
�


```

BMP 外文字では前半・後半どちらも単独では壊れた見え方になります。また、範囲外は `undefined` ではなく空文字列です。

### charCodeAt

`charCodeAt()` は同じ位置のコードユニット値を数値で返します。範囲外は `NaN` です。

```js
console.log("𩸽".charCodeAt(0));
console.log("𩸽".charCodeAt(1));
console.log("𩸽".charCodeAt(-1));
console.log("𩸽".charCodeAt(2));
```

```txt
55399
56893
NaN
NaN
```

ここでも返っているのは Unicode コードポイントではなく、UTF-16 の各コードユニットです。

### codePointAt

`codePointAt()` は名前の通りコードポイント寄りの API ですが、これも完全に“文字単位”ではありません。開始位置がサロゲートペアの先頭なら全体を読めますが、後半側を指すと後半コードユニット単体の値が返ります。

```js
console.log("𩸽".codePointAt(0));
console.log("𩸽".codePointAt(1));
console.log("𩸽".codePointAt(-1));
console.log("𩸽".codePointAt(2));
console.log(String.fromCodePoint("𩸽".codePointAt(0)));
console.log(String.fromCodePoint("𩸽".codePointAt(1)));
```

```txt
171581
56893
undefined
undefined
𩸽
�
```

この比較から会で強調されていたのは次の点です。

- `codePointAt(0)` は `𩸽` 全体のコードポイントを返せる
- しかし `codePointAt(1)` は“後半コードユニット単体”を返す
- したがって `codePointAt()` があるからといって、`for (let i = 0; i < str.length; i++)` のようなコードユニット基準のループが安全になるわけではない

これは実務的にも重要で、「文字列長が 2 なのに見た目は 1 文字」という UTF-16 固有のややこしさが、かなり丁寧に確認されました。

---

## charAt と at の違い

この会では `charAt()` と `at()` の違いも自然に比較されました。挙動の違いをまとめるとこうです。

- `charAt()` は範囲外で空文字列
- `at()` は範囲外で `undefined`
- `charAt()` は負インデックスに特別対応していない
- `at()` は負インデックスを後ろから数える形で扱える
- どちらもコードユニット単位なので、サロゲートペアをまたぐと“1文字”にはならない

見た目は似ていますが、API 設計の思想はかなり違う、という話でした。

---

## 文字列メソッドのジェネリック性

`charAt()` には仕様注記として「intentionally generic」とあります。つまり、`this` が本物の文字列オブジェクトでなくても、文字列化できるなら使えるということです。

これを実際に試した例がこちらです。

```js
const obj = {
  charAt: String.prototype.charAt,
};

console.log(obj.charAt(0));
console.log(obj.charAt(1));
console.log(obj.charAt(2));
```

```txt
[
o
b
```

`obj` 自体が文字列ではないのに動くのは、内部で `"[object Object]"` に文字列化されて、その先頭から読んでいるからです。

さらに、`at()` についても実質同じように使えることが確認されました。

```js
const fakeStr = { length: 1, toString: () => "a" };

console.log(String.prototype.charAt.call(fakeStr, 0)); // a
console.log(String.prototype.at.call(fakeStr, 0));     // a
```

会ではこの結果を受けて、

- `charAt()` は明示的にジェネリック
- `at()` も定義を見る限り事実上ジェネリック
- なのに注記が揃っていないのは仕様書の編集上の不統一かもしれない

という見方が共有されました。

---

## String.prototype.concat

最後に読まれたのは `String.prototype.concat` です。ここはかなり素直な API で、「レシーバーを文字列化し、各引数も文字列化して順に連結するだけ」という理解でほぼ足ります。

### 基本理解

`concat()` の本質はコードユニット列の連結です。複雑な Unicode 解釈をしてくれるわけではなく、単に並べるだけです。

そのため、逆に言えばサロゲートペアの前半と後半を別々に取り出して連結すれば、元の文字に戻せます。

```js
const parts = [
  "𩸽".charAt(0),
  "𩸽".charAt(1),
  "𩸽".charAt(0),
  "𩸽".charAt(1),
];

console.log("".concat(...parts));
```

```txt
𩸽𩸽
```

これは「壊れた文字を直してくれる」のではなく、「前半と後半を元通りの順で並べたので結果的に復元された」というだけです。`concat()` はあくまで連結しかしていません。

### 家族絵文字の例

さらに難しい例として、家族絵文字 `👨‍👩‍👧‍👦` でも実験されました。

```js
{
  const parts = "👨‍👩‍👧‍👦".split("");
  console.log(parts);
  console.log("".concat(...parts));
}

{
  const parts = [..."👨‍👩‍👧‍👦"];
  console.log(parts);
  console.log("".concat(...parts));
}
```

出力は次のようになります。

```txt
�,�,‍,�,�,‍,�,�,‍,�,�
👨‍👩‍👧‍👦
👨,‍,👩,‍,👧,‍,👦
👨‍👩‍👧‍👦
```

ここで比較されたのは次の2通りです。

- `split("")` はコードユニット単位で分解するので、サロゲートペアが壊れる
- スプレッド構文 `[...str]` は文字列イテレータを使うので、コードポイント単位で分解される
- ただし家族絵文字全体は 1 つの書記素クラスタであっても、コードポイント単位では `👨`, `‍`, `👩`, `‍`, `👧`, `‍`, `👦` に分かれる
- どちらの場合も `concat()` で元の並びに戻せば、見た目上は元の絵文字に復元される

このあたりから、会話は「コードユニット」「コードポイント」「書記素クラスタ」が全部別物である、という Unicode 文字列処理の難しさに広がっていきました。

---

## 終盤の所感と仕様書への指摘

最後の方では、`String.prototype.at` や `concat` の記述に関して、仕様書の注記が揃っていないのではないか、という話になりました。

主な指摘は次の2つです。

- `String.prototype.at` にだけ定型句 `This method performs the following steps when called:` が欠けている
- `at` や `concat` は実質ジェネリックに見えるのに、その旨の注記が省かれている箇所がある

会の雰囲気としては、「読めなくなるほどの欠陥ではないが、ECMAScript 仕様書はこういう小さな編集ミスも実際にある」という確認でした。過去に参加者が仕様書へ小さな修正をコントリビュートした話も出ており、今回の件も気が向けば直せそう、という締めでした。

---

## この回で得られた理解の要点

この回の主題を一言でまとめると、`String` 周りの API は見た目以上に「UTF-16 のコードユニット」と強く結びついている、ということでした。

特に確認された理解は次のとおりです。

- `String.raw` はタグ付きテンプレートリテラルの raw/cooked の差を露出させる API
- `String.prototype` 自体が `[[StringData]]` を持つ特別なオブジェクト
- `at()`, `charAt()`, `charCodeAt()`, `codePointAt()` は似ているが、返り値と Unicode の扱いがかなり違う
- `codePointAt()` ですら、コードユニット基準の添字操作と組み合わせると安全ではない
- `concat()` は賢い Unicode API ではなく、あくまで連結 API
- 仕様書本文にはときどき注記抜けや体裁の不揃いがある

全体として、今回の輪読会は `String.raw` と各種文字列アクセス API を通じて、JavaScript の文字列処理が「見た目の文字」ではなく「UTF-16 の内部表現」に強く支配されていることを、実例つきで丁寧に確認する回になっていました。