# 第105回 ECMAScript仕様輪読会 — `String.prototype.split` と `String.prototype.startsWith`

## `String.prototype.split`

今回の中心は、文字列を区切って配列にする `String.prototype.split` です。

```js
"a;b;c;".split(";");
// ["a", "b", "c", ""]
```

基本的には、対象文字列を左から右へ検索し、区切り文字が見つかった位置で部分文字列に分割します。区切り文字そのものは、通常、結果の配列には含まれません。

末尾にも区切り文字がある場合、その後ろの空文字列も最後の要素になります。

```js
"a;b;c".split(";");
// ["a", "b", "c"]

"a;b;c;".split(";");
// ["a", "b", "c", ""]
```

形式は次のとおりです。

```js
string.split(separator, limit)
```

- `separator`
  - どこで文字列を分割するかを指定します。
  - 文字列だけでなく、正規表現や `Symbol.split` を持つオブジェクトも指定できます。
- `limit`
  - 結果の配列に含める要素数の上限です。

### 基本的な文字列分割

空文字列でも `undefined` でもない文字列を `separator` に渡した場合、対象文字列の先頭から区切り文字が検索されます。

区切り文字が見つかると、その直前までの部分文字列を結果に追加し、区切り文字の直後から次の検索を続けます。

```js
"a;b;c;".split(";");
// ["a", "b", "c", ""]
```

概念的には、次のように進みます。

```text
対象: a;b;c;
      ^
      最初の ; を発見
      → 直前の "a" を結果へ追加

対象: a;b;c;
        ^
        次の ; を発見
        → 直前の "b" を結果へ追加

対象: a;b;c;
          ^
          次の ; を発見
          → 直前の "c" を結果へ追加

末尾まで到達
→ 最後に残った "" を結果へ追加
```

先頭に区切り文字があれば、最初の要素は空文字列になります。

```js
";a;b".split(";");
// ["", "a", "b"]
```

区切り文字が連続している場合は、その間の空文字列も結果に入ります。

```js
"a;;b".split(";");
// ["a", "", "b"]
```

区切り文字が一度も見つからなければ、対象文字列全体がひとつの要素になります。

```js
"abc".split(";");
// ["abc"]
```

区切り文字には複数文字からなる文字列も使用できます。

```js
"foo--bar--baz".split("--");
// ["foo", "bar", "baz"]
```

### `separator` は文字列とは限らない

`separator` には、文字列のほかに正規表現を渡せます。

```js
"a;b,c".split(/[;,]/);
// ["a", "b", "c"]
```

さらに、`Symbol.split` メソッドを持つ任意のオブジェクトも渡せます。

`separator` がオブジェクトの場合、最初にそのオブジェクトが `Symbol.split` メソッドを持っているかが確認されます。メソッドが見つかった場合、通常の文字列分割処理は行われず、処理全体がそのメソッドへ委譲されます。

```js
function print(value) {
  console.log(JSON.stringify(value));
}

const mySeparator = {
  [Symbol.split](thisValue, limit) {
    print({ thisValue, limit });
    return [];
  },
};

print("a;b;c;".split(mySeparator));
// {"thisValue":"a;b;c;"}
// []

print("a;b;c;".split(mySeparator, 3));
// {"thisValue":"a;b;c;","limit":3}
// []
```

独自の `Symbol.split` メソッドでは、次の値を受け取ります。

- メソッド内の `this`
  - `separator` として渡されたオブジェクト
- 第1引数
  - `split` を呼び出した対象値
- 第2引数
  - `split` に渡された `limit`

重要なのは、独自の `Symbol.split` が分割処理を完全に置き換えられることです。組み込みの `split` は、その返り値を配列に直したり、`limit` に合わせて切り詰めたりしません。

したがって、次のように配列以外を返すことさえできます。

```js
const unusualSeparator = {
  [Symbol.split]() {
    return "配列ではない値";
  },
};

console.log("abc".split(unusualSeparator));
// "配列ではない値"
```

通常は `split` らしく配列を返すべきですが、独自の分割処理を定義した場合、引数の検証、分割、結果の上限処理なども独自実装側の責任になります。

輪読会では、セミコロンを探して独自に分割する処理も実装できるという話が出ました。ただし、組み込みと同じような分割処理を自前で書くのはかなり煩雑なため、実際の実装までは行いませんでした。

### 値の変換と処理順序

独自の `Symbol.split` が見つからなかった場合は、通常の文字列分割へ進みます。

分割対象は文字列へ変換されます。また、通常の分割処理で使われる `separator` も文字列へ変換されます。

```js
String.prototype.split.call(12345, "3");
// ["12", "45"]
```

ただし、独自の `Symbol.split` がある場合は、対象を文字列に変換する前にそのメソッドへ処理が渡されます。独自実装は元の対象値を第1引数として受け取れます。

こうした処理の順番は、内部実装上の些細な違いとは限りません。JavaScriptでは、次の操作にユーザーコードを介入させられるためです。

- `Symbol.split` プロパティの取得
- Proxyによるプロパティ取得の監視
- getterの実行
- `toString` の実行
- 変換中の例外

たとえば、`limit` が `0` なら最終結果は空配列ですが、それより前に行われるプロパティ取得や値の変換が例外を投げる可能性はあります。

```js
const separator = {
  toString() {
    throw new Error("separatorの文字列化に失敗");
  },
};

"abc".split(separator, 0);
// Errorになる可能性がある
```

そのため、仕様上の処理順を入れ替えると、Proxyや変換処理の副作用を通じて外部から違いを観測できる場合があります。

## `limit` の扱い

`limit` は、結果の配列に含める要素数の上限です。

```js
"a;b;c;".split(";", 1);
// ["a"]

"a;b;c;".split(";", 2);
// ["a", "b"]

"a;b;c;".split(";");
// ["a", "b", "c", ""]
```

上限に到達した時点で処理は終了します。残りの文字列を最後の要素へまとめるわけではありません。

```js
"a;b;c".split(";", 2);
// ["a", "b"]

// ["a", "b;c"] にはならない
```

### `limit` を省略した場合

`limit` を省略した場合、実質的な上限として `2 ** 32 - 1` が使われます。

```js
2 ** 32 - 1;
// 4294967295
```

これはJavaScriptの配列長の上限とも関係する値です。通常の文字列分割では、事実上、十分に大きな上限として機能します。

```js
"a;b;c;".split(";", 2 ** 32 - 1);
// ["a", "b", "c", ""]
```

### 明示的に渡した `limit` は32ビット符号なし整数になる

明示的に渡した `limit` は、32ビット符号なし整数相当の値へ変換されます。

そのため、単純に非常に大きな数を渡せばよいとは限りません。

```js
function print(value) {
  console.log(JSON.stringify(value));
}

print("a;b;c;".split(";", 2 ** 32 - 1));
// ["a","b","c",""]

print("a;b;c;".split(";", 2 ** 32));
// []

print("a;b;c;".split(";", 2 ** 32 + 1));
// ["a"]
```

`2 ** 32` は変換後に `0` となり、`2 ** 32 + 1` は `1` となります。32ビットの範囲を一周して先頭へ戻るような挙動です。

`Infinity` と `-Infinity` も、この変換では `0` になります。

```js
"a;b;c;".split(";", Infinity);
// []

"a;b;c;".split(";", -Infinity);
// []
```

`limit` が `0` なら、結果は空配列です。

```js
"a;b;c;".split(";", 0);
// []
```

なお、独自の `Symbol.split` が使われる場合は、組み込み側ではこの変換を行いません。独自メソッドには、元の `limit` がそのまま渡されます。

## `separator` が `undefined` の場合

区切り文字が `undefined` の場合、対象文字列全体をひとつの要素として持つ配列が返ります。

引数を省略した場合も、明示的に `undefined` を渡した場合も同様です。

```js
"a;b;c;".split();
// ["a;b;c;"]

"a;b;c;".split(undefined);
// ["a;b;c;"]

"a;b;c;".split(undefined, 1);
// ["a;b;c;"]
```

ただし、`limit` が `0` なら空配列です。

```js
"a;b;c;".split(undefined, 0);
// []
```

## 空文字列を区切り文字にした場合

`separator` が空文字列の場合、対象文字列はECMAScriptのコードユニット単位に分割されます。

```js
"a;b;c;".split("");
// ["a", ";", "b", ";", "c", ";"]

"a;b;c;".split("", 3);
// ["a", ";", "b"]

"a;b;c;".split("", 1000);
// ["a", ";", "b", ";", "c", ";"]

"あいうえお".split("");
// ["あ", "い", "う", "え", "お"]
```

ここで重要なのは、「人間が認識する1文字」でも「Unicodeのコードポイント」でもなく、UTF-16のコードユニット単位だという点です。

BMP外の文字は、UTF-16ではサロゲートペアという2個のコードユニットで表現されます。そのため、空文字列による `split` では途中で分断されます。

```js
"𩸽".split("");
// ["\ud867", "\ude3d"]
```

絵文字のように、複数のコードポイントを組み合わせて画面上の1文字を構成するものは、さらに細かく分かれます。

```js
"👨‍👩‍👦".split("");
// サロゲートペアやゼロ幅接合子を含む
// 複数のコードユニットへ分割される
```

したがって、Unicode文字を見た目上の1文字単位で分割する用途には、`split("")` は適していません。

コードポイント単位でよければ、文字列のイテレーターを使えます。

```js
[..."𩸽"];
// ["𩸽"]
```

ただし、これでも複数のコードポイントからなる絵文字などは、必ずしもひとつにまとまりません。書記素クラスタ、つまり利用者が見た目上ひとつの文字だと認識する単位で分けるには、`Intl.Segmenter` など別の仕組みが必要です。

## 対象文字列自体が空文字列の場合

対象文字列が空文字列のときは、区切り文字が空文字列にマッチできるかどうかによって結果が変わります。

区切り文字が空文字列にマッチできる場合は、空配列になります。

```js
"".split("");
// []

"".split(new RegExp(""));
// []

"".split(/.*/);
// []
```

一方、区切り文字が空文字列にマッチしない場合は、空文字列をひとつ含む配列になります。

```js
"".split(";");
// [""]

"".split();
// [""]
```

この差は、次のように整理できます。

```text
空の入力にseparatorがマッチできる
→ 分割結果は []

空の入力にseparatorがマッチできない
→ 入力全体である空文字列が残り、[""] になる
```

## 正規表現を区切りにする場合

正規表現オブジェクトは `Symbol.split` を持っています。そのため、正規表現を `separator` に渡した場合、単純な文字列検索ではなく、正規表現側の分割処理へ委譲されます。

```js
"a;b;c;".split(new RegExp(""));
// ["a", ";", "b", ";", "c", ";"]

"a;b;c;".split(/[ab]/);
// ["", ";", ";c;"]
```

`/[ab]/` は `a` または `b` に一致します。

```text
対象: a;b;c;
      ^ ^
      aとbが区切りになる

aの前   → ""
aとbの間 → ";"
bの後   → ";c;"
```

したがって、結果は次のようになります。

```js
["", ";", ";c;"]
```

### `g` フラグは必須ではない

輪読会では、`g` フラグの有無も確認しました。

```js
"a;b;c;".split(/[ab]/);
// ["", ";", ";c;"]

"a;b;c;".split(/[ab]/g);
// ["", ";", ";c;"]
```

この例では結果に違いはありません。

`replaceAll` に正規表現を渡す場合は `g` フラグが必要でしたが、`split` では必須ではありません。正規表現による分割の進行は、正規表現の `g` フラグだけに任されているわけではなく、正規表現の `Symbol.split` 側で制御されます。

### 空文字列に一致できる正規表現

空文字列に一致できる正規表現で分割する場合でも、入力の先頭、末尾、直前の一致の末尾にある空文字列を際限なく拾うわけではありません。

```js
"a;b;c;".split(/(?:)/);
// ["a", ";", "b", ";", "c", ";"]
```

空文字列への一致を同じ位置で繰り返すと、処理位置が進まず無限ループになり得ます。そのため、正規表現による分割には、同じ位置で空の一致を繰り返さず、処理を前へ進めるための規則があります。

輪読会では、仕様の注記に書かれている「空文字列の区切りは入力の先頭と末尾の空部分にはマッチせず、直前の区切りの末尾にある空部分にも続けてマッチしない」という説明を確認しました。

## `split` は intentionally generic

仕様上、`String.prototype.split` は intentionally generic とされています。

これは、文字列オブジェクトだけにしか適用できないメソッドではなく、文字列へ変換可能な別の値にも明示的に適用できるという意味です。

```js
String.prototype.split.call({}, " ");
// ["[object", "Object]"]
```

通常のオブジェクトを文字列化すると、次の文字列になります。

```js
String({});
// "[object Object]"
```

それを半角スペースで分割したため、次の結果になります。

```js
["[object", "Object]"]
```

数値などにも適用できます。

```js
String.prototype.split.call(12345, "3");
// ["12", "45"]
```

もっとも、実際のアプリケーションコードでは、先に明示的に文字列へ変換した方が意図を読み取りやすい場合が多いでしょう。

```js
String(12345).split("3");
// ["12", "45"]
```

仕様に intentionally generic と書かれているのは、このような呼び出しが偶然動いているのではなく、意図的に許容されていることを示しています。

## `String.prototype.startsWith`

続いて、文字列が指定した文字列で始まるかを判定する `String.prototype.startsWith` を読みました。

```js
"Apple".startsWith("App");
// true
```

形式は次のとおりです。

```js
string.startsWith(searchString, position)
```

- `searchString`
  - 比較対象となる文字列
- `position`
  - 比較を開始する位置
  - 省略時は `0`

メソッド名は複数形の `startsWith` であり、`startWith` ではありません。

### 基本的な動作

対象文字列の指定位置から、`searchString` と同じ長さの部分を取り出し、一致するかを判定します。

```js
"Apple".startsWith("App");
// true

"Apple".startsWith("ple", 1);
// false

"Apple".startsWith("ple", 2);
// true

"Apple".startsWith("ple", 3);
// false
```

`position` を省略すると先頭の `0` が使われます。

```js
"Apple".startsWith("App");
// 位置0から "App" と比較
```

`position` を指定すると、その位置を新たな先頭として扱います。

```js
"Apple".startsWith("ple", 2);
// 位置2から始まる文字列が "ple" なので true
```

`startsWith` は、指定位置より後ろを広く検索するメソッドではありません。指定位置で直ちに一致しなければ `false` です。

```js
"Apple".startsWith("ple", 1);
// false
```

`"ple"` は位置2にはありますが、指定された位置1では始まっていません。そのため、位置2まで探しに行くことはありません。

## `position` の変換と範囲制限

`position` は整数相当の値へ変換された後、`0` から対象文字列の長さまでの範囲に収められます。

負の位置は `0` として扱われます。

```js
"Apple".startsWith("App", -1);
// true
```

非常に大きな位置は、文字列末尾の位置までに制限されます。

```js
"Apple".startsWith("e", 100);
// false
```

### `Infinity`

`Infinity` は、範囲制限によって文字列末尾の位置として扱われます。

```js
"Apple".startsWith("", Infinity);
// true

"Apple".startsWith("e", Infinity);
// false
```

文字列末尾から非空文字列 `"e"` が始まることはないため、後者は `false` です。

`-Infinity` は先頭位置へ制限されます。

```js
"Apple".startsWith("App", -Infinity);
// true
```

`split` の `limit` では `Infinity` が32ビット符号なし整数への変換によって `0` になりましたが、`startsWith` の `position` では変換方法とその後の範囲制限が異なります。同じ数値を渡しても、引数ごとに挙動が違う点に注意が必要です。

## 空文字列の検索

検索文字列が空文字列なら、`startsWith` は `true` になります。

```js
"Apple".startsWith("");
// true

"Apple".startsWith("", 1);
// true

"Apple".startsWith("", 100);
// true

"".startsWith("");
// true

"Apple".startsWith("", Infinity);
// true
```

大きすぎる `position` も先に文字列末尾までに収められます。その位置から長さ0の文字列を比較するため、一致します。

空文字列は、文字列中のどの有効な位置からも始まっていると考えられます。

## 検索文字列が残りの長さを超える場合

指定位置から文字列末尾までの長さより、検索文字列の方が長い場合、一致は不可能なので `false` になります。

```js
"abc".startsWith("abcd");
// false

"Apple".startsWith("Apple!", 0);
// false
```

輪読会では、仕様が部分文字列を比較する前にこの条件を確認している理由も議論されました。

範囲外の終了位置を指定して部分文字列を作っても、最終的には不一致と判定できそうに見えます。しかし、仕様内で使われる部分文字列操作へ範囲内の位置だけを渡すことや、不一致が明らかな段階で処理を終えることを意図した構成だと考えられます。

## 正規表現は渡せない

`startsWith` の第1引数に正規表現を渡すと、`TypeError` になります。

```js
"Apple".startsWith(/App/);
// TypeError:
// First argument to String.prototype.startsWith
// must not be a regular expression
```

正規表現でない値は、通常の文字列へ変換されます。

```js
"Apple".startsWith({
  toString() {
    return "App";
  },
});
// true
```

正規表現自体も、文字列化するだけなら可能です。

```js
String(/App/);
// "/App/"
```

しかし、正規表現を暗黙に `"/App/"` という文字列へ変換して比較すると、利用者の意図とは違う処理が黙って実行される可能性があります。そのため、現在の `startsWith` は正規表現を明示的に拒否します。

### 将来の拡張余地に関する注記

仕様の注記では、正規表現を渡したときに例外を投げる挙動について、将来のECMAScriptで正規表現などを受け入れる拡張を追加できる余地を残すためのものだと説明されています。

したがって、`startsWith` が例外を投げるかどうかを利用して、値が正規表現かどうかを判定すべきではありません。

```js
function isRegExpLike(value) {
  try {
    "".startsWith(value);
    return false;
  } catch {
    return true;
  }
}
```

このような判定は、将来 `startsWith` が受け入れる値の範囲を拡張した場合に壊れる可能性があります。

つまり、現在 `TypeError` になることは事実ですが、そのエラーを別用途の型判定APIとして利用することまでは互換性の対象として想定されていません。

## `startsWith` も intentionally generic

`startsWith` も、文字列以外の値へ明示的に適用できます。

```js
String.prototype.startsWith.call({}, "[obj");
// true
```

通常のオブジェクトは `"[object Object]"` へ変換されます。

```js
String({});
// "[object Object]"
```

この文字列は `"[obj"` で始まるため、結果は `true` です。

```js
"[object Object]".startsWith("[obj");
// true
```

この挙動も偶然ではなく、仕様上 intentionally generic として意図されています。

実際のコードでは、明示的に文字列へ変換した方が読みやすい場合があります。

```js
String({}).startsWith("[obj");
// true
```

## 次回扱うロケール依存の大小文字変換

残り時間では、次回読む予定の `String.prototype.toLocaleLowerCase` と `String.prototype.toLocaleUpperCase` を少し試しました。

今回確認したのは主に `toLocaleUpperCase` です。

```js
function print(value) {
  console.log(JSON.stringify(value));
}

print("abcde".toLocaleUpperCase());
print("ａｂｃｄｅ".toLocaleUpperCase());
print("ぁぃぅぇぉ".toLocaleUpperCase());
print("à".toLocaleUpperCase());
print("🔡🔠".toLocaleUpperCase());
```

結果は次のようになりました。

```text
"ABCDE"
"ＡＢＣＤＥ"
"ぁぃぅぇぉ"
"À"
"🔡🔠"
```

ASCIIの小文字は、通常どおり大文字になります。

```js
"abcde".toLocaleUpperCase();
// "ABCDE"
```

全角ラテン文字も、対応する大文字へ変換されます。

```js
"ａｂｃｄｅ".toLocaleUpperCase();
// "ＡＢＣＤＥ"
```

小書きのひらがなは、ラテン文字における大文字・小文字の関係とは異なるため変化しません。

```js
"ぁぃぅぇぉ".toLocaleUpperCase();
// "ぁぃぅぇぉ"
```

アクセント記号を持つ文字でも、Unicode上で対応する大文字が定義されていれば変換されます。

```js
"à".toLocaleUpperCase();
// "À"
```

絵文字にも変化はありません。

```js
"🔡🔠".toLocaleUpperCase();
// "🔡🔠"
```

通常の `toLowerCase` や `toUpperCase` の大小文字対応には、Unicode Character Databaseや `SpecialCasing.txt` の情報が関係します。

ロケール依存版の `toLocaleLowerCase`、`toLocaleUpperCase` について詳しく理解するには、ECMAScript本体のECMA-262だけでなく、国際化APIを定義するECMA-402側の仕様も確認する必要があります。

この部分は今回、本格的な仕様読解までは進めず、UnicodeやECMA-402側の対応表を含めて次回確認することになりました。