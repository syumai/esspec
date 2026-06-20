# ECMAScript仕様輪読会: `GetSubstitution` と `String.prototype.search`

## `GetSubstitution`

今回の中心は、`String.prototype.replace` や `RegExp.prototype[@@replace]` の内部で使われる抽象操作 `GetSubstitution` でした。

これは、置換文字列に含まれる特殊な記法を解釈して、実際に置き換える文字列を作る処理です。

たとえば次のような置換文字列です。

```js
"abcde".replace(/bc/, "[$&]");
```

この `"$&"` は単なる `$` と `&` の2文字ではなく、「マッチした文字列そのもの」を意味します。

```js
console.log("abcde".replace(/bc/, "[$&]"));
// a[bc]de
```

`GetSubstitution` は、こうした `$...` 系の置換記法を1つずつ見て、最終的な置換結果を組み立てます。

## `GetSubstitution` の入力

`GetSubstitution` には、おおまかに次のような情報が渡されます。

- 元の文字列
- マッチした文字列
- マッチした位置
- キャプチャグループの一覧
- 名前付きキャプチャグループの情報
- 置換テンプレート文字列

たとえば次の例では、

```js
"abcde".replace(/b(.)(.)/, "[$2][$1]");
```

正規表現 `/b(.)(.)/` は `"bcd"` にマッチします。

このとき、

- マッチ全体: `"bcd"`
- 1番目のキャプチャ: `"c"`
- 2番目のキャプチャ: `"d"`

となるため、置換文字列 `"[$2][$1]"` は `"d"` と `"c"` を参照します。

```js
console.log("abcde".replace(/b(.)(.)/, "[$2][$1]"));
// a[d][c]e
```

## decimal digit の定義

仕様では、この抽象操作の中で使う「decimal digit」を明示的に定義していました。

ここでいう decimal digit は、Unicode のコード単位で `0x0030` から `0x0039` まで、つまり ASCII の `0` から `9` のことです。

```txt
0 1 2 3 4 5 6 7 8 9
```

仕様文中の

```txt
For the purposes of this abstract operation...
```

は、「この抽象操作においては」という意味です。

つまり、ここで定義している decimal digit は、`GetSubstitution` の説明内で使うための限定的な定義です。

## 置換テンプレートの処理の考え方

`GetSubstitution` は、置換テンプレート文字列を先頭から順番に見ていきます。

たとえば置換テンプレートが次のようなものだったとします。

```js
"[$&]"
```

この中には通常の文字である `[` や `]` と、特殊な置換記法 `$&` が混ざっています。

処理としては、だいたい次のように考えられます。

```txt
置換テンプレートを先頭から読む
特殊な $ 記法があれば解釈する
通常の文字ならそのまま結果に追加する
最後まで読んだら完成
```

仕様上は、残りのテンプレート文字列を保持しながら、先頭部分を切り出して結果に追加していく形になっています。

## `$$`: `$` そのもの

`$$` は、置換後の文字列に `$` を1文字入れるための記法です。

```js
console.log("abcde".replace(/bc/, "$$"));
// a$de
```

`$` は置換テンプレート内で特殊な意味を持つため、文字として `$` を出したい場合は `$$` と書きます。

複数並べた場合も、仕様に従って左から解釈されます。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "$$$$$"));
// a$$$ea$$$e
```

`$$$$$` は少し読みづらいですが、`$$` が `$` に置き換わり、残った `$` からまた次の解釈が行われます。

## `$&`: マッチした文字列そのもの

`$&` は、正規表現にマッチした文字列全体を表します。

```js
console.log("abcdeabcde".replace(/bc/g, "[$&]"));
// a[bc]dea[bc]de
```

この例では `/bc/g` により、2箇所の `"bc"` がマッチしています。

それぞれのマッチ箇所が `[$&]` によって `[bc]` に置き換えられます。

## `` $` ``: マッチ位置より前の文字列

`` $` `` は、マッチした位置より前にある文字列を表します。

```js
console.log("abcdeabcde".replace(/bc/g, "[$`]"));
```

出力は次のようになります。

```txt
a[a]dea[abcdea]de
```

1回目の `"bc"` は、元の文字列 `"abcdeabcde"` のインデックス1から始まります。

その前にある文字列は `"a"` です。

そのため、1回目の `"bc"` は `"[a]"` に置き換わります。

2回目の `"bc"` は、元の文字列の後半にあります。

その前には `"abcdea"` があるので、2回目は `"[abcdea]"` に置き換わります。

重要なのは、ここで参照される「前の文字列」は、置換途中の文字列ではなく、元の文字列における位置を基準にしていることです。

## `$'`: マッチ位置より後ろの文字列

`$'` は、マッチした文字列より後ろにある文字列を表します。

```js
console.log("abcdeabcde".replace(/bc/g, "[$']"));
```

出力は次のようになります。

```txt
a[deabcde]dea[de]de
```

1回目の `"bc"` の後ろには `"deabcde"` があります。

2回目の `"bc"` の後ろには `"de"` があります。

そのため、それぞれのマッチが、その後ろ側の文字列に置き換えられます。

```js
console.log("abcdeabcde".replace(/bc/g, "[$`]"));
console.log("abcdeabcde".replace(/bc/g, "[$&]"));
console.log("abcdeabcde".replace(/bc/g, "[$']"));
```

```txt
a[a]dea[abcdea]de
a[bc]dea[bc]de
a[deabcde]dea[de]de
```

この3つを並べると、違いがわかりやすいです。

- `` $` ``: マッチより前
- `$&`: マッチそのもの
- `$'`: マッチより後ろ

## `$n`: 番号付きキャプチャの参照

`$1`, `$2` のような記法は、正規表現のキャプチャグループを参照します。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "[$2][$1]"));
```

出力は次のようになります。

```txt
a[d][c]ea[d][c]e
```

正規表現 `/b(.)(.)/g` は `"bcd"` にマッチします。

- `$1`: 1つ目の `.` に対応する `"c"`
- `$2`: 2つ目の `.` に対応する `"d"`

なので、`[$2][$1]` は `[d][c]` になります。

## `$01`, `$02` もキャプチャ参照として扱われる

次の例では `$01`, `$02` を使っています。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "[$02][$01]"));
```

出力は次の通りです。

```txt
a[d][c]ea[d][c]e
```

`$01` は `$1` と同じように扱われ、`$02` は `$2` と同じように扱われます。

つまり、先頭に `0` が付いていても、参照先のキャプチャ番号として解釈されます。

## 2桁のキャプチャ参照

`$12` のように、`$` の後ろに数字が2桁続く場合、仕様はまず2桁のキャプチャ番号として解釈しようとします。

ただし、存在しないキャプチャ番号だった場合には、少し特殊な扱いになります。

たとえば、キャプチャが2個しかないのに `$25` と書いた場合です。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "[$25]"));
```

出力は次のようになります。

```txt
a[d5]ea[d5]e
```

キャプチャは2個しかないので、`$25` を「25番目のキャプチャ」として扱うことはできません。

この場合、仕様は `$2` と通常の文字 `"5"` に分けて解釈します。

そのため、`$2` が `"d"` に置き換わり、後ろの `"5"` はそのまま残ります。

```txt
$25
↓
$2 + "5"
↓
"d" + "5"
↓
"d5"
```

同じ考え方で、`$256` は `$2` と `"56"` のように扱われます。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "[$256]"));
```

```txt
a[d56]ea[d56]e
```

## 存在しない `$3` や `$0`

キャプチャが2個しかない状態で `$3` を指定すると、対応するキャプチャが存在しません。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "[$3]"));
```

出力は次のようになります。

```txt
a[$3]ea[$3]e
```

この場合、`$3` は置換されず、そのまま文字列として残ります。

`$0` も特別にマッチ全体を表すわけではありません。

```js
console.log("abcdeabcde".replace(/b(.)(.)/g, "[$0]"));
```

```txt
a[$0]ea[$0]e
```

JavaScript の置換テンプレートでは、マッチ全体は `$0` ではなく `$&` で参照します。

```js
console.log("abcde".replace(/bc/, "[$&]"));
// a[bc]de
```

## キャプチャ番号は最大2桁まで読む

仕様上、`$` の後ろに数字が続く場合でも、キャプチャ番号として見るのは最大2桁です。

そのため、`$100` は「100番目のキャプチャ」としては扱われません。

基本的には `$10` と、その後ろの `"0"` として解釈されます。

輪読会では、100個のキャプチャを作る例も試していました。

```js
{
  let src = "b";
  src += "(.)".repeat(100);
  const regexp = new RegExp(src);
  const target = "abcdef".repeat(50);

  let replacement = "";
  for (let i = 0; i < 100; i++) {
    replacement += `[$${i + 1}]`;
  }

  console.log(target.replace(regexp, replacement));
}
```

この例では `$1` から `$99` まではキャプチャ参照として解釈されます。

しかし `$100` は、100番目のキャプチャ参照ではなく、`$10` と `"0"` の組み合わせとして扱われます。

そのため、最後の方に「10番目のキャプチャ + `0`」のような結果が現れます。

## `$<name>`: 名前付きキャプチャの参照

`$<name>` は、名前付きキャプチャグループを参照します。

```js
console.log("abcdeabcde".replace(/(?<name>b.)/g, "[$<name>]"));
```

出力は次のようになります。

```txt
a[bc]dea[bc]de
```

正規表現 `(?<name>b.)` は、`b` から始まる2文字を `name` という名前でキャプチャします。

置換テンプレートの `$<name>` は、その名前付きキャプチャの内容に置き換わります。

## 複数の名前付きキャプチャ

複数の名前付きキャプチャも使えます。

```js
console.log(
  "abcdeabcde".replace(
    /(?<undefined>b.)(?<name>d.)/g,
    "[$<undefined>][$<name>]"
  )
);
```

出力は次の通りです。

```txt
a[bc][de]a[bc][de]
```

この正規表現では、

- `(?<undefined>b.)`: `"bc"` を `undefined` という名前でキャプチャ
- `(?<name>d.)`: `"de"` を `name` という名前でキャプチャ

しています。

そのため、置換テンプレート側で `$<undefined>` と `$<name>` を使って、それぞれ参照できます。

ここで `undefined` という名前を使っていますが、これは文字列としての名前です。

JavaScript の値 `undefined` そのものとは別です。

## 日本語の名前付きキャプチャ

名前付きキャプチャの名前には、日本語も使えます。

```js
console.log("abcdeabcde".replace(/(?<あいうえお>b.)/g, "[$<あいうえお>]"));
```

出力は次のようになります。

```txt
a[bc]dea[bc]de
```

これは、名前付きキャプチャの名前が ECMAScript の識別子名に近いルールで定義されているためです。

JavaScript の識別子には Unicode の文字が使えるので、日本語の名前も有効です。

## 数字から始まる名前は使えない

一方で、数字から始まる名前は使えません。

```js
// SyntaxError
console.log("abcdeabcde".replace(/(?<0abc>b.)/g, "[$<0abc>]"));
```

これは正規表現の構文エラーになります。

```txt
SyntaxError: Invalid regular expression: /(?<0abc>b.)/g: Invalid capture group name
```

名前付きキャプチャの名前は、識別子として妥当である必要があります。

識別子の先頭には数字を置けないため、`0abc` は不正です。

輪読会では `eval` を使って、この構文エラーを実行時に捕まえる例も試していました。

```js
try {
  eval(`console.log("abcdeabcde".replace(/(?<0abc>b.)/g, "[$<0abc>]"));`);
} catch (err) {
  console.error(err);
}
```

通常、正規表現リテラルの構文エラーはパース時に発生するため、そのまま書くとスクリプト全体がエラーになります。

`eval` の中に入れることで、その評価時の例外として扱えるようにしています。

## 日付の並び替え例

名前付きキャプチャは、日付のフォーマット変換のような用途でわかりやすく使えます。

```js
console.log(
  "2026-06-09".replace(
    /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
    "$<day>/$<month>/$<year>"
  )
);
```

出力は次の通りです。

```txt
09/06/2026
```

番号付きキャプチャでも同じことはできます。

```js
"2026-06-09".replace(
  /(\d{4})-(\d{2})-(\d{2})/,
  "$3/$2/$1"
);
```

ただし、名前付きキャプチャを使うと、どの値を参照しているかが読みやすくなります。

```js
"$<day>/$<month>/$<year>"
```

この方が `$3/$2/$1` よりも意図が明確です。

## 名前付きキャプチャの名前と識別子

名前付きキャプチャの名前には、ECMAScript の識別子に近い制約があります。

識別子の先頭に使える文字と、2文字目以降に使える文字は異なります。

たとえば数字は、識別子の途中には使えますが、先頭には使えません。

```js
const abc1 = 1; // OK
const 1abc = 1; // SyntaxError
```

名前付きキャプチャでも同様に、数字始まりは不正になります。

```js
/(?<abc1>b.)/;  // OK
/(?<1abc>b.)/;  // SyntaxError
```

この識別子ルールの背景には Unicode の `ID_Start` や `ID_Continue` といった分類があります。

- `ID_Start`: 識別子の先頭に使える文字
- `ID_Continue`: 識別子の2文字目以降に使える文字

ECMAScript は、この Unicode 側の定義を参照しつつ、 `$` や `_` など ECMAScript 固有の文字も識別子として扱います。

## `GetSubstitution` のまとめ

`GetSubstitution` が扱う主な置換記法は次の通りです。

```txt
$$        $ そのもの
$&        マッチした文字列全体
$`        マッチ位置より前の文字列
$'        マッチ位置より後ろの文字列
$n        n番目のキャプチャ
$nn       nn番目のキャプチャ。ただし最大2桁まで
$<name>   名前付きキャプチャ
```

実用上よく使うのは `$1`, `$2`, `$<name>` あたりです。

`$&`, `` $` ``, `$'` も仕様としては重要ですが、読み手に負担がかかりやすいので、使いすぎるとコードの意図が読みにくくなりそうだという話も出ていました。

## `String.prototype.search`

後半では `String.prototype.search` を読みました。

`search` は、文字列の中から正規表現にマッチする位置を探し、そのインデックスを返します。

```js
console.log("abcdeabcde".search(/bc/));
// 1
```

`"bc"` はインデックス1から始まるので、結果は `1` です。

見つからない場合は `-1` を返します。

```js
console.log("abcdeabcde".search(/bd/));
// -1
```

## `search` の基本的な流れ

`String.prototype.search` は、まず `this` 値を文字列として扱います。

ただし、`null` や `undefined` に対して呼ばれた場合はエラーになります。

```js
String.prototype.search.call(null, /a/);
// TypeError
```

その後、引数がオブジェクトで、かつ `Symbol.search` メソッドを持っている場合は、それを呼び出します。

つまり、`search` は正規表現専用ではありません。

`Symbol.search` を持つオブジェクトを渡すことができます。

## 独自の `Symbol.search`

輪読会では、独自の `Symbol.search` を持つオブジェクトを試していました。

```js
const mySearcher = {
  [Symbol.search](thisValue) {
    console.log(JSON.stringify({ thisValue }, null, 2));
    return "xyz";
  }
};

console.log("abcdeabcde".search(mySearcher));
```

出力は次のようになります。

```txt
{
  "thisValue": "abcdeabcde"
}
xyz
```

ここで重要なのは、`search` の戻り値が必ず数値に変換されるわけではないことです。

`Symbol.search` が `"xyz"` を返したら、そのまま `"xyz"` が返ります。

```js
return "xyz";
```

この結果、`search` の返り値も `"xyz"` になります。

通常の正規表現を使った場合はインデックスまたは `-1` が返りますが、独自の `Symbol.search` を使う場合は、そのメソッドの返り値がそのまま外に出ます。

## `Symbol.search` がない場合

引数が `Symbol.search` を持っていない場合、`search` は引数から正規表現を作ります。

つまり、次のような呼び出しも可能です。

```js
console.log("abcdeabcde".search("bc"));
```

これは内部的には `"bc"` を使って正規表現的な検索を行います。

ただし、`search` の詳細な実体は `RegExp.prototype[@@search]` 側にあります。

`String.prototype.search` 自体はかなり薄いラッパーで、最終的には正規表現側の `@@search` に処理を委ねます。

## `RegExp.prototype[@@search]` と `lastIndex`

`RegExp.prototype[@@search]` の仕様には `lastIndex` が出てきます。

`lastIndex` は、正規表現オブジェクトが持つ状態です。

特に `g` フラグや `y` フラグが関わると、マッチ開始位置に影響します。

ただし、`search` ではこの `lastIndex` の扱いが少しややこしいです。

議論では、`search` は基本的に外から見た `lastIndex` の状態を変更しないようにしているのではないか、という話になりました。

内部的には正規表現実行のために `lastIndex` が動く可能性がありますが、その変更が外に漏れないように戻しているように見える、という読み方です。

## sticky フラグ `y`

`lastIndex` に関係する例として、sticky フラグ `y` も確認しました。

```js
const str = "#foo#";
const regex = /foo/y;

regex.lastIndex = 1;
console.log(regex.test(str)); // true

regex.lastIndex = 5;
console.log(regex.test(str)); // false
```

`y` フラグ付きの正規表現は、`lastIndex` の位置からマッチしなければ失敗します。

`/foo/y` に対して `lastIndex = 1` の場合、文字列 `"#foo#"` のインデックス1から `"foo"` が始まるので成功します。

一方、`lastIndex = 5` の場合、その位置から `"foo"` は始まらないので失敗します。

失敗した後、`lastIndex` はリセットされます。

```js
const str = "#foo#";
const regex = /foo/y;

regex.lastIndex = 1;
console.log(regex.test(str)); // true

regex.lastIndex = 5;
console.log(regex.test(str)); // false
console.log(regex.lastIndex); // 0
```

## `search` と sticky フラグ

輪読会では、`search` と sticky フラグの関係も試していました。

```js
const regex1 = /bc/y;
regex1.lastIndex = 5;

console.log("abcdeabcde".search(regex1));
```

出力は次の通りです。

```txt
-1
```

このあたりは、`search` が `lastIndex` をどう扱うのか、`RegExp.prototype[@@search]` 側の仕様をもう少し読む必要がありそうだ、という結論になりました。

`String.prototype.search` 自体は単純ですが、実際の正規表現検索の挙動は `RegExp.prototype[@@search]` と `RegExpExec` 側に寄っています。

## 今回読んだ範囲の整理

今回の主な内容は次の2つでした。

```txt
1. GetSubstitution
   replace 系の置換テンプレートを解釈する内部処理

2. String.prototype.search
   文字列から正規表現または Symbol.search オブジェクトで検索するメソッド
```

`GetSubstitution` では、置換テンプレートの `$` 記法をかなり細かく確認しました。

特に重要だったのは次の点です。

```js
console.log("abcdeabcde".replace(/bc/g, "[$`]"));
// マッチより前

console.log("abcdeabcde".replace(/bc/g, "[$&]"));
// マッチそのもの

console.log("abcdeabcde".replace(/bc/g, "[$']"));
// マッチより後ろ

console.log("abcdeabcde".replace(/b(.)(.)/g, "[$2][$1]"));
// 番号付きキャプチャ

console.log("2026-06-09".replace(
  /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/,
  "$<day>/$<month>/$<year>"
));
// 名前付きキャプチャ
```

`search` では、通常の正規表現検索に加えて、`Symbol.search` によるカスタム検索ができることを確認しました。

```js
const mySearcher = {
  [Symbol.search](value) {
    return "custom result";
  }
};

console.log("abc".search(mySearcher));
// custom result
```

次回は、今回少し気になった `RegExp.prototype[@@search]` の `lastIndex` 周辺を確認しつつ、`String.prototype.replaceAll` に進む予定です。