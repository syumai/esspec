# ECMAScript仕様輪読会 第102回

## String.prototype.matchAll

今回は `String.prototype.matchAll` から読み始めた。

`matchAll` は、文字列に対して正規表現マッチを行い、その結果を順に返すイテレーターを作るメソッド。  
返ってくる各要素は、`String.prototype.match` や `RegExp.prototype.exec` の結果に近い配列で、先頭要素にマッチ全体、その後ろにキャプチャグループの結果が並ぶ。

```js
[..."abcdeabcde".matchAll(/.c./g)]
// => [
//   ["bcd", index: 1, input: "abcdeabcde", groups: undefined],
//   ["bcd", index: 6, input: "abcdeabcde", groups: undefined]
// ]
```

仕様上の大きなポイントは、`matchAll` に正規表現を渡す場合、その正規表現には `g` フラグが必要ということ。

```js
try {
  console.log(..."abcdeabcde".matchAll(/.c./));
} catch (err) {
  console.error(err);
}

// TypeError: String.prototype.matchAll called with a non-global RegExp argument
```

`matchAll` は複数のマッチ結果をイテレーターで返すため、正規表現がグローバル検索できる必要がある。  
そのため、`/.c./` のように `g` フラグがない正規表現は `TypeError` になる。

一方で、`matchAll` の引数は必ずしも本物の `RegExp` インスタンスである必要はない。  
仕様では、引数がオブジェクトだった場合、まず「これは正規表現として扱うべきものか」を判定し、そのうえで `Symbol.matchAll` メソッドを探す。

たとえば、次のように `Symbol.matchAll` を自前実装したオブジェクトを渡すこともできる。

```js
const myRegExp = {
  [Symbol.match]() {
    return 1;
  },
  [Symbol.matchAll]() {
    return 2;
  },
  flags: "g",
};

console.log("abcdeabcde".matchAll(myRegExp));
// => 2
```

ここで `Symbol.match` を持っていると、正規表現的なオブジェクトとして扱われる。  
その場合、`flags` に `"g"` が含まれているかどうかが確認されるため、`flags: "g"` が必要になる。

一方、`Symbol.match` を持たず、`Symbol.matchAll` だけを持つオブジェクトなら、正規表現としての `g` フラグチェックは通らず、そのまま `Symbol.matchAll` が呼ばれる。

```js
const myRegExp = {
  [Symbol.matchAll]() {
    return 2;
  },
};

console.log("abcdeabcde".matchAll(myRegExp));
// => 2
```

また、文字列を渡すこともできる。  
この場合、内部的にはその文字列から正規表現相当のものが作られ、グローバルマッチとして扱われる。

```js
console.log([..."aaaaaaa".matchAll("a.")]);

// 出力例:
// [
//   ["aa", index: 0, input: "aaaaaaa", groups: undefined],
//   ["aa", index: 2, input: "aaaaaaa", groups: undefined],
//   ["aa", index: 4, input: "aaaaaaa", groups: undefined]
// ]
```

注意点として、文字列 `"a."` は正規表現の `a.` ではなく、文字列パターンとして扱われる。  
ただし、仕様内部では `RegExpCreate` 的な処理を通るため、結果として正規表現的な探索になる。

`null` を渡した場合も、`null` が文字列化されて `"null"` として扱われる。

```js
console.log([..."nullish".matchAll(null)]);

// => [
//   ["null", index: 0, input: "nullish", groups: undefined]
// ]
```

`matchAll` は `split` と同様、入力を変更しないように設計されている、という Note も確認した。  
文字列自体はそもそも immutable だが、引数として渡された正規表現的オブジェクトの状態をなるべく直接変更しない、という意図も含まれていそうだ、という話になった。

## String.prototype.padEnd / padStart

次に `String.prototype.padEnd` と `String.prototype.padStart` を読んだ。

`padEnd` は、文字列の末尾に指定した文字列を足して、指定された長さになるようにする。  
`padStart` は同じことを先頭側で行う。

```js
console.log("abc".padEnd(8));
// => "abc     "

console.log("abc".padEnd(8, "xy"));
// => "abcxyxyx"

console.log("abc".padStart(8));
// => "     abc"

console.log("abc".padStart(8, "xy"));
// => "xyxyxabc"
```

重要なのは、第1引数は「足す文字数」ではなく「最終的な文字列長」だという点。

```js
"abc".padEnd(8, "xy")
// 元の "abc" は長さ 3
// 目標長は 8
// 追加すべき長さは 5
// "xyxyx" が追加される
// => "abcxyxyx"
```

埋める文字列が必要な長さより長くなる場合は、必要な長さに切り詰められる。  
仕様中では、`fillString` を繰り返し連結し、それを必要な長さに切り詰めた文字列を作る、という説明になっている。

```js
"abc".padEnd(8, "xy")
// fillString: "xy"
// 必要な長さ: 5
// "xyxyxy..." を作って 5 文字に切る
// => "xyxyx" を追加
```

デフォルトの埋め文字は半角スペース。

```js
"abc".padStart(6)
// => "   abc"
```

`padStart` / `padEnd` は intentionally generic なメソッドなので、`this` が文字列プリミティブでなくても、文字列化できる値なら動かせる。  
ただし、`null` や `undefined` を `this` にすると、いつもの `RequireObjectCoercible` により `TypeError` になる。

```js
try {
  console.log(String.prototype.padStart.call(null, 5));
} catch (err) {
  console.error(err);
}

// TypeError: String.prototype.padStart called on null or undefined
```

内部では共通の抽象操作が使われており、`padEnd` と `padStart` の違いは、作った padding を元の文字列の後ろにつけるか、前につけるかだけだった。

また、このあたりで `left-pad` 事件の話も出た。  
昔は左側 padding のために `left-pad` という非常に小さな npm パッケージが広く使われており、それが突然消えたことで React や Babel などの依存関係に影響が出た。  
その後、標準ライブラリに `padStart` / `padEnd` が入ったことで、現在ではこの用途で外部ライブラリに依存する必要はかなり減った。

## 20.1.2.13 ToZeroPaddedDecimalString

`String.prototype.padStart` / `padEnd` の流れで、`ToZeroPaddedDecimalString` という抽象操作も確認した。

これは、数値を10進数文字列にしたうえで、指定された最小長になるように左側を `0` で埋めるための操作。

たとえば、日付や時刻のフォーマットでよくあるような用途に向いている。

```js
// イメージ
ToZeroPaddedDecimalString(7, 2)
// => "07"

ToZeroPaddedDecimalString(123, 2)
// => "123"
```

ここで第2引数は、結果の「最低限ほしい長さ」という意味になる。  
`padStart` の第1引数は「最終的な長さ」だが、実際の動きとしては「足りなければそこまで伸ばす」という意味にも読めるので、`ToZeroPaddedDecimalString` では `minLength` という名前になっている。

文字列がすでにその長さ以上なら、短く切り詰めたりはしない。

```js
// 2 桁以上ほしい
123 -> "123"

// 2 桁に足りない
7 -> "07"
```

内部では先ほどの `StringPad` が再利用されていた。  
仕様の中でも padding 系の処理が共通化されていることを確認した。

## String.prototype.repeat

次に `String.prototype.repeat` を読んだ。

`repeat` は、文字列を指定回数だけ繰り返した新しい文字列を返す。

```js
console.log("abc".repeat(3));
// => "abcabcabc"
```

回数には整数化処理が入る。  
小数を渡すと、`ToIntegerOrInfinity` により 0 に近づく方向へ小数部分が切り落とされる。

```js
console.log("0".repeat(2.5));
// => "00"

console.log("0".repeat(3.5));
// => "000"
```

`-.5` は 0 に近づく方向へ丸められて `-0` 相当になり、結果として空文字になる。

```js
console.log("0".repeat(-.5));
// => ""
```

ただし、明確に負の回数を渡すと `RangeError` になる。

```js
try {
  console.log("0".repeat(-1));
} catch (err) {
  console.error(err);
}

// RangeError: Invalid count value: -1
```

`Infinity` も許されない。  
無限長の文字列は作れないので、これも `RangeError` になる。

また、`repeat` も intentionally generic なメソッドなので、文字列以外を `this` にして呼び出すことができる。  
その場合、`this` は文字列化される。

```js
console.log(String.prototype.repeat.call({}, 3));
// => "[object Object][object Object][object Object]"
```

ただし、`null` や `undefined` を `this` にすると `TypeError`。

```js
try {
  console.log(String.prototype.repeat.call(null, 3));
} catch (err) {
  console.error(err);
}

// TypeError: String.prototype.repeat called on null or undefined
```

仕様の Note では、このメソッドは `this` を文字列化したものを、`count` 回繰り返した文字列を作る、と説明されていた。  
アルゴリズム本体とほぼ同じ内容だが、利用者向けの説明としてはこの Note の方がわかりやすい。

## String.prototype.replace

最後に `String.prototype.replace` に入った。  
ここはかなり複雑で、今回は `GetSubstitution` の細かい中身までは読まず、`replace` 本体の大枠と動作例を確認した。

`replace` は、対象文字列の中から検索対象を探し、見つかった部分を置換する。  
第1引数は検索対象、第2引数は置換内容。

```js
const paragraph = "I think Ruth's dog is cuter than your dog!";

console.log(paragraph.replace("Ruth's", "my"));
// => "I think my dog is cuter than your dog!"
```

第1引数に文字列を渡した場合、最初に見つかった1箇所だけが置換される。

```js
console.log(paragraph.replace("dog", "ferret"));
// => "I think Ruth's ferret is cuter than your dog!"
```

すべて置換したい場合は `replaceAll` を使う。

```js
console.log(paragraph.replaceAll("dog", "ferret"));
// => "I think Ruth's ferret is cuter than your ferret!"
```

ただし、昔から `replace` でも正規表現に `g` フラグを付ければ全置換はできた。

```js
console.log(paragraph.replace(/dog/g, "ferret"));
// => "I think Ruth's ferret is cuter than your ferret!"
```

このため、`replaceAll` は「正規表現を明示的に書かなくても、文字列検索で全部置換できるようにする」ために追加されたものだと考えられる。  
特に、ユーザー入力をそのまま検索文字列として使いたい場合、正規表現に変換するとエスケープが必要になるので、`replaceAll` の方が扱いやすい。

## replace と RegExp

第1引数に正規表現を渡すこともできる。

```js
const paragraph = "I think Ruth's dog is cuter than your dog!";
const regex = /Dog/i;

console.log(paragraph.replace(regex, "ferret"));
// => "I think Ruth's ferret is cuter than your dog!"
```

ここでは `/Dog/i` により、大文字小文字を区別せずに `dog` を探している。  
`replace` なので、`g` フラグがなければ最初の1箇所だけが置換される。

```js
paragraph.replace(/dog/i, "ferret")
// => 最初の dog だけ

paragraph.replace(/dog/gi, "ferret")
// => すべての dog が対象
```

仕様上は、検索対象がオブジェクトだった場合、まず `Symbol.replace` メソッドを持っているかを確認する。  
持っていれば、通常の文字列検索処理ではなく、その `Symbol.replace` が呼ばれる。

## Symbol.replace の自前実装

`replace` の第1引数には、`Symbol.replace` を持つオブジェクトを渡せる。  
これは `RegExp` 以外のオブジェクトでも、独自の置換ロジックを定義できるということ。

```js
const myRegExp = {
  [Symbol.replace](thisValue, replaceValue) {
    return thisValue + replaceValue;
  },
};

console.log(
  "I think Ruth's dog is cuter than your dog!".replace(myRegExp, "ferret")
);

// => "I think Ruth's dog is cuter than your dog!ferret"
```

この例では、通常の検索・置換はまったく行っていない。  
`replace` は第1引数の `Symbol.replace` を見つけたので、それを呼び出し、その戻り値をそのまま `replace` の結果にしている。

`Symbol.replace` には、元の文字列と置換値が渡される。  
そのため、独自の置換プロトコルを作ることができる。

ただし、実際にこういう自前実装をする機会は多くなさそうだ、という話になった。

## Functional replace

`replace` の第2引数には、文字列だけでなく関数も渡せる。  
この場合、マッチした内容に応じて動的に置換文字列を作れる。

```js
const paragraph = "I think Ruth's dog is cuter than your dog!";

console.log(paragraph.replace("dog", (m) => m.toUpperCase()));
// => "I think Ruth's DOG is cuter than your dog!"
```

第1引数が文字列の場合、置換関数は最初に見つかった1箇所に対してだけ呼ばれる。

置換関数には、少なくとも次のような情報が渡る。

```js
paragraph.replace("dog", (searchValue, position, thisValue) => {
  console.log({ searchValue, position, thisValue });
  return searchValue.toUpperCase();
});
```

出力は次のようになる。

```js
{
  "searchValue": "dog",
  "position": 15,
  "thisValue": "I think Ruth's dog is cuter than your dog!"
}
```

つまり、文字列検索による functional replacement では、主に次の情報が使える。

```js
searchValue // マッチした文字列
position    // マッチ開始位置
thisValue   // 元の文字列全体
```

正規表現を使い、さらに `g` フラグを付けると、マッチごとに置換関数が呼ばれる。

```js
console.log(paragraph.replace(/dog/g, (m) => m.toUpperCase()));
// => "I think Ruth's DOG is cuter than your DOG!"
```

中身を確認すると、2回呼ばれていることがわかる。

```js
paragraph.replace(/dog/g, (searchValue, position, thisValue) => {
  console.log(JSON.stringify({ searchValue, position, thisValue }, null, 2));
  return searchValue.toUpperCase();
});
```

出力:

```js
{
  "searchValue": "dog",
  "position": 15,
  "thisValue": "I think Ruth's dog is cuter than your dog!"
}
{
  "searchValue": "dog",
  "position": 38,
  "thisValue": "I think Ruth's dog is cuter than your dog!"
}
```

この複数回呼び出しは、`String.prototype.replace` 本体が直接やっているというより、正規表現側の `RegExp.prototype[Symbol.replace]` が担当している。  
つまり、`replace` に正規表現を渡した場合、文字列側の単純な置換ロジックではなく、正規表現オブジェクトの `Symbol.replace` 実装に処理が委譲される。

## replace 本体の大まかな流れ

今回確認した範囲では、`String.prototype.replace` は大きく次のように振る舞う。

まず、`this` が `null` や `undefined` でないか確認する。  
これは他の `String.prototype` メソッドと同じく、`RequireObjectCoercible` によるチェック。

次に、検索対象 `searchValue` がオブジェクトなら、`Symbol.replace` メソッドを探す。  
見つかった場合は、それを呼び出して、その結果を返す。

```js
"abc".replace(searchValue, replaceValue)

// searchValue[Symbol.replace] があれば、そちらに委譲される
```

`Symbol.replace` がなければ、通常の文字列置換として処理される。  
この場合、`this` と `searchValue` は文字列化される。

その後、元の文字列の中から `searchString` を探す。  
見つからなければ、元の文字列をそのまま返す。

```js
"abc".replace("x", "y")
// => "abc"
```

見つかった場合は、元の文字列を次の3つに分ける。

```js
const input = "I think Ruth's dog is cuter than your dog!";
const search = "dog";

// イメージ
preceding   = "I think Ruth's "
matched     = "dog"
following   = " is cuter than your dog!"
```

そして、置換値を作る。  
第2引数が関数なら、その関数を呼んだ結果を文字列化する。  
第2引数が文字列なら、置換文字列として扱う。

最後に、次の3つを連結して返す。

```js
preceding + replacement + following
```

この中で、置換文字列に `$&` や `$1` のような特殊な記法が含まれる場合の処理は `GetSubstitution` が担当する。  
ただし、この `GetSubstitution` はかなり複雑なため、今回は中身までは読まず、次回以降に回すことになった。

## 次回に持ち越した部分

`replace` の中で使われる `GetSubstitution` は、置換文字列中の特殊パターンを処理するための抽象操作。

たとえば、次のような置換記法に関係する。

```js
"abc".replace("b", "[$&]")
// => "a[b]c"
```

また、正規表現のキャプチャグループや名前付きキャプチャにも関わる。

```js
"2026-06-09".replace(/(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/, "$<day>/$<month>/$<year>")
// => "09/06/2026"
```

今回の後半で `replace` 本体だけでもかなり情報量が多かったため、`GetSubstitution` の詳細、特に `$` を使った置換パターンや named capture の扱いは次回読むことになった。