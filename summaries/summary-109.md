# 第109回 ECMAScript仕様輪読会：ジェネレーター関数の作り方とプロトタイプの関係

## 1. 今回読むことになった範囲

今回の本編は、仕様の **27.8「Generator Objects」** から始まりました。

当初は、ジェネレーターオブジェクトの説明から、そのプロトタイプにある `next()`、さらに内部で呼ばれる `GeneratorResume` へ進む予定でした。しかし、読み始めると `GeneratorFunction.prototype` や `GeneratorFunction.prototype.prototype` が登場し、それらの関係を先に整理する必要が出てきました。

そこで、途中から **27.6「GeneratorFunction Objects」** に戻り、次の内容を読み進めています。

- ジェネレーター関数を定義する構文
- `GeneratorFunction` コンストラクターによる動的な生成
- ジェネレーター関数やジェネレーターオブジェクトの継承関係
- `GeneratorFunction` のサブクラス
- ジェネレーター関数の `.prototype` と、呼び出して得られるオブジェクトとの関係
- `.prototype` の共有や差し替えによる影響

今回、特に時間をかけたのは、**「ジェネレーター関数というオブジェクト」と「その関数を呼んで作られるジェネレーターオブジェクト」を区別すること**でした。

```js
function* gen() {
  yield 1;
}

// gen はジェネレーター関数
// iter はジェネレーターオブジェクト
const iter = gen();
```

この二つは、それぞれ別のプロトタイプを持ちます。両方に関係する名前として `GeneratorFunction` や `GeneratorPrototype` が登場するため、仕様の文章を読む際には「いま、どちらを説明しているのか」を確認する必要があります。

## 2. ジェネレーターオブジェクトは、イテレーターでもイテラブルでもある

27.8の冒頭では、ジェネレーターオブジェクトについて、ジェネレーター関数を呼ぶことで作られ、イテレーターとイテラブルの両方のインターフェースに従う、と説明されていました。

具体的には、次の二つの使い方ができます。

```js
function* gen() {
  yield 1;
  yield 2;
}

// イテレーターとして使う
const iter = gen();

console.log(iter.next()); // { value: 1, done: false }
console.log(iter.next()); // { value: 2, done: false }
console.log(iter.next()); // { value: undefined, done: true }
```

```js
// イテラブルとして使う
for (const value of gen()) {
  console.log(value);
}

// 1
// 2
```

`next()` を呼んで値を一つずつ取り出せることが、イテレーターとしての性質です。一方、`for...of` などに渡せることが、イテラブルとしての性質です。

通常のジェネレーターオブジェクトでは、`Symbol.iterator` に対応するメソッドが、自分自身を返します。

```js
const iter = gen();

console.log(iter[Symbol.iterator]() === iter); // true
```

そのため、すでに一部を読み進めたジェネレーターオブジェクトを `for...of` に渡すと、その続きから列挙されます。

### ジェネレーターオブジェクトが継承するもの

続いて、ジェネレーターオブジェクトは、それを作ったジェネレーター関数の `.prototype` の初期値を直接継承し、さらに、その先にある共通の `%GeneratorPrototype%` を間接的に継承する、という説明を読みました。

通常の初期状態を図にすると、次の関係です。

```text
gen() で作られたジェネレーターオブジェクト
  ↓ [[Prototype]]
gen.prototype
  ↓ [[Prototype]]
%GeneratorPrototype%
  ↓ [[Prototype]]
%Iterator.prototype%
  ↓ [[Prototype]]
Object.prototype
  ↓ [[Prototype]]
null
```

ここで `%...%` は、仕様が組み込みオブジェクトを指すために使う表記です。そのままJavaScriptの式として入力できる名前ではありません。

## 3. 共通の `%GeneratorPrototype%` 自体は、ジェネレーターではない

次に読んだのは、ジェネレーターオブジェクトが共通して継承する `%GeneratorPrototype%` の説明です。

このオブジェクトは、次の特徴を持ちます。

- 通常のオブジェクトである。
- ジェネレーターのインスタンスではない。
- ジェネレーターの実行状態を保持する `[[GeneratorState]]` を持たない。
- 自身の `[[Prototype]]` は `%Iterator.prototype%` である。
- ジェネレーターオブジェクトが間接的に継承するプロパティを持つ。

つまり、`next()` などの共通機能を置く場所と、実際に停止・再開する個々のオブジェクトは別です。

```text
%GeneratorPrototype%
  共通のメソッドを置く場所

gen() の戻り値
  個別の実行状態を持つオブジェクト
```

この説明の中で、次の名前が出てきました。

```js
GeneratorFunction.prototype.prototype
```

これは、共通の `%GeneratorPrototype%` を指します。ただし、ここでの `.prototype.prototype` は、**二回プロトタイプチェーンをたどる操作ではありません**。`prototype` という名前の通常のプロパティを二回参照しています。

この違いが、今回の後半でも大きな論点になりました。

### `%GeneratorPrototype%.constructor` の値

この共通オブジェクトにある `constructor` の初期値は、`GeneratorFunction.prototype` です。

```js
const GeneratorFunction = (function* () {}).constructor;
const generatorPrototype = GeneratorFunction.prototype.prototype;

console.log(
  generatorPrototype.constructor === GeneratorFunction.prototype
); // true
```

このプロパティの属性も確認しました。

| 属性 | 値 |
|---|---|
| `writable` | `false` |
| `enumerable` | `false` |
| `configurable` | `true` |

`constructor` という名前だからといって、ここに「そのオブジェクトを直接作った関数」が必ず入っているわけではありません。この点も、通常のコンストラクター関数を思い浮かべると混乱しやすいところです。

これらの共通オブジェクトの位置づけは、[仕様の「The %GeneratorPrototype% Object」](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-properties-of-generator-prototype)に記載されています。

## 4. ジェネレーター関数を作る三つの構文

複雑な名前の関係を理解するため、27.6「GeneratorFunction Objects」に戻りました。

冒頭には、ジェネレーター関数は通常、次の三つを評価することで作られると書かれています。

1. Generator Declaration：ジェネレーター関数宣言
2. Generator Expression：ジェネレーター関数式
3. Generator Method：ジェネレーターメソッド

輪読では、それぞれ実際にコードを書き、値を取り出しました。

### 4.1. ジェネレーター関数宣言

通常の関数宣言に似ていますが、`function` の後ろに `*` が付きます。

```js
function* generatorDecl() {
  yield 1;
  yield 2;
  yield 3;
}

const iter1 = generatorDecl();

for (const value of iter1) {
  console.log(value);
}

// 1
// 2
// 3
```

このコードでは、まず `generatorDecl` というジェネレーター関数を定義しています。それを呼ぶと、ジェネレーターオブジェクトが返されます。

```js
const iter1 = generatorDecl();
```

さらに `for...of` がそのオブジェクトから値を順番に取り出します。

### 4.2. ジェネレーター関数式

ジェネレーター関数は、式として書くこともできます。

```js
const iter2 = (function* () {
  yield 10;
  yield 20;
  yield 30;
})();

for (const value of iter2) {
  console.log(value);
}

// 10
// 20
// 30
```

この例では、無名のジェネレーター関数を作り、直後の `()` で呼んでいます。

段階を分けると、次のように書けます。

```js
const generatorExpression = function* () {
  yield 10;
  yield 20;
  yield 30;
};

const iter2 = generatorExpression();
```

仕様の構文を確認し、**ジェネレーター関数式には名前があってもなくてもよい**ことも確認しました。

```js
const generatorExpression = function* namedGenerator() {
  yield 10;
};
```

関数式だから必ず無名になる、というわけではありません。

### 4.3. ジェネレーターメソッド

オブジェクトのメソッドとして書く場合は、メソッド名の前に `*` を付けます。

```js
const objectWithIterator = {
  *generatorMethod() {
    yield 100;
    yield 200;
    yield 300;
  }
};

const iter3 = objectWithIterator.generatorMethod();

for (const value of iter3) {
  console.log(value);
}

// 100
// 200
// 300
```

通常のメソッド定義と見比べると、違いが分かります。

```js
const obj = {
  normalMethod() {
    return 100;
  },

  *generatorMethod() {
    yield 100;
  }
};
```

この形式は、オブジェクトリテラルだけでなく、クラスのメソッドにも使えます。

```js
class Example {
  *generatorMethod() {
    yield 100;
    yield 200;
  }
}

for (const value of new Example().generatorMethod()) {
  console.log(value);
}
```

輪読では、この構文を書き慣れていなかったこともあり、コードの修正と構文エラーの確認に時間を使いました。

### 構文エラーの表示について

実験の途中では、コロンが足りないという趣旨のエラーが表示され、最初に疑った場所とは別の場所を修正することになりました。

字幕と最終的なメモには、エラーになったコード全体が残っていないため、原因となった構文を正確に再現することはできません。ただし、会話では、次の点が話題になっています。

- エラー表示の行番号やメッセージから、最初は修正箇所を取り違えた。
- 修正後は、ジェネレーター関数式やメソッドが意図どおり動いた。
- メソッドの `*` は、メソッド名より前に置く。
- エラーメッセージをより分かりやすくできないか、後で検討する話になった。

## 5. `GeneratorFunction` コンストラクターで関数を作る

構文を使う以外に、`GeneratorFunction` という組み込みコンストラクターを呼んで、ジェネレーター関数を作る方法もあります。

ただし、`GeneratorFunction` は、通常のグローバル変数としてそのまま用意されている名前ではありません。

輪読では、すでに作ったジェネレーター関数から取得しました。

```js
const GeneratorFunction = (function* () {}).constructor;
```

この式は、無名のジェネレーター関数を作り、その `constructor` を参照しています。

ここで取得しているのは、ジェネレーターオブジェクトを直接作る関数ではなく、**ジェネレーター関数を作るためのコンストラクター**です。

### 作成には二段階ある

次のコードでは、まず文字列からジェネレーター関数を作ります。

```js
const GeneratorFunction = (function* () {}).constructor;

const generatorFunc = new GeneratorFunction(`
  yield 1;
  yield 2;
  yield 3;
`);
```

この時点の `generatorFunc` は、呼び出せる関数です。続いて、その関数を呼びます。

```js
const iter = generatorFunc();

for (const value of iter) {
  console.log(value);
}

// 1
// 2
// 3
```

関係を整理すると、次のようになります。

```text
new GeneratorFunction(...)
  ↓
ジェネレーター関数
  ↓ 関数を呼ぶ
ジェネレーターオブジェクト
  ↓ next() などで読み進める
yield された値
```

輪読中にも、作った関数をもう一回呼ぶ必要があることを確認しました。

## 6. コンストラクターには、仮引数と本文を文字列で渡す

`GeneratorFunction` の最後の引数は、関数本文を表す文字列です。それ以前の引数は、仮引数を表す文字列になります。

まず、仮引数を分けて渡す形です。

```js
const GeneratorFunction = (function* () {}).constructor;

const generatorFunc = new GeneratorFunction(
  "a",
  "b",
  "c",
  `
    yield a;
    yield b;
    yield c;
  `
);

for (const value of generatorFunc(1, 2, 3)) {
  console.log(value);
}

// 1
// 2
// 3
```

今回、特に話題になったのは、仮引数を一つの文字列にまとめられることでした。

```js
const generatorFunc = new GeneratorFunction(
  "a,b,c",
  `
    yield a;
    yield b;
    yield c;
  `
);
```

`"a,b,c"` は、`a,b,c` という名前の一個の引数になるわけではありません。関数定義の丸括弧の中に書くような、仮引数リストとして扱われます。

イメージとしては、次の定義に対応します。

```js
function* example(a, b, c) {
  yield a;
  yield b;
  yield c;
}
```

### デフォルト引数も書ける

仮引数リストとして解釈されるため、デフォルト値も指定できます。

今回のメモに残っている例です。

```js
const GeneratorFunction = (function* () {}).constructor;

const generatorFunc = new GeneratorFunction("a,b,c = 10", `
  yield a;
  yield b;
  yield c;
`);

const iter = generatorFunc(1, 2);

for (const value of iter) {
  console.log(value);
}

// 1
// 2
// 10
```

呼び出しでは `a` と `b` に対応する値だけを渡しています。`c` は省略されているので、デフォルト値の `10` が使われます。

対応する構文で書けば、次の形です。

```js
function* example(a, b, c = 10) {
  yield a;
  yield b;
  yield c;
}
```

輪読では、以前に `Function` コンストラクターを読んだ際にも、このようにカンマを含む文字列やデフォルト引数を試したことを思い出していました。

字幕では、さらに別の仮引数の書き方も試していますが、具体的なコードはメモに残っていません。確認できる要点は、**文字列に単純な引数名を一個ずつ指定するだけの仕組みではない**ということです。

### 通常の `Function` コンストラクターとの共通点

内部では、通常の `Function` コンストラクターと共通する `CreateDynamicFunction` が使われます。

今回確認した違いは、作成する関数の種類として、通常の関数を示す値ではなく、ジェネレーターを示す値を渡していることです。

```text
Function コンストラクター
  → 通常の関数を作る

GeneratorFunction コンストラクター
  → ジェネレーター関数を作る
```

この共通部分の詳細なアルゴリズムには立ち入らず、引数の解釈や振る舞いは、先ほど試したコードで確認できているとして先へ進みました。

## 7. 関係図を読むために、UMLの矢印を確認した

仕様には、ジェネレーター関係のオブジェクトをまとめた図があります。

輪読では、図に含まれる矢印を読み解くために、UMLのクラス図で使われる関係を確認しました。

### 汎化と特化

例として登場したのは、`Person` と `Student`、`Professor` の関係です。

```text
Person
  ├─ Student
  └─ Professor
```

`Person` は、学生や教授に共通する、より一般的な概念です。このように共通する側へまとめて考えるのが汎化です。

逆に、`Student` や `Professor` は `Person` を具体化したものなので、特化したものと考えられます。

UMLでは、一般的な側に白抜きの三角形を向けて表します。また、この関係は `is-a` の関係としても知られています。

一方、汎化・特化という概念と、プログラミング言語の継承機構は、関連はあっても同一ではない、という説明も確認しました。生物の親子関係をそのまま当てはめるものでもありません。

### 実現

もう一つ確認したのが、インターフェースと、それを実装するクラスとの関係です。

```text
インターフェース
  ↑ 実装する
クラス
```

UMLでは、実現は白抜きの三角形と破線で表されます。汎化と似ていますが、線の種類が異なります。

### 依存や関連

そのほかに、破線の矢印や通常の矢印について、依存や関連、参照のような関係を確認しました。

ただし、今回の仕様の図では、見た目だけから関係を判断するよりも、矢印の近くに書かれた `prototype` や `constructor` が、**どちらのオブジェクトのプロパティなのか**を見分けることが重要でした。

実際に、ラベルが複数のオブジェクトから同じくらいの距離にあり、どちらに属するのか読み取りづらい、という場面がありました。

## 8. 関係図で整理した、二つのプロトタイプチェーン

今回の図を理解するには、関数側と、その戻り値側を分けると見通しがよくなります。

### 8.1. ジェネレーター関数自身の継承関係

まず、`function*` で作った関数自身の関係です。

```js
function* gen() {
  yield 1;
}
```

```text
gen
  ↓ [[Prototype]]
GeneratorFunction.prototype
  ↓ [[Prototype]]
Function.prototype
  ↓ [[Prototype]]
Object.prototype
  ↓ [[Prototype]]
null
```

このため、ジェネレーター関数でも、通常の関数と同様に `call`、`apply`、`bind` などを継承して利用できます。

```js
const iter = gen.call(null);

console.log(iter.next()); // { value: 1, done: false }
```

`GeneratorFunction.prototype` には、`Symbol.toStringTag` の値として `"GeneratorFunction"` も設定されています。

なお、輪読中には呼び出し可能性について言及する場面もありましたが、ここは区別が必要です。**個々のジェネレーター関数は呼び出せますが、共通の `GeneratorFunction.prototype` 自体は関数オブジェクトではありません。** `Function.prototype` を継承していても、それだけで関数になるわけではありません。[仕様の「Properties of the GeneratorFunction Prototype Object」](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-properties-of-generatorfunction-prototype)

### 8.2. ジェネレーターオブジェクトの継承関係

一方、関数を呼んだ戻り値は、別のチェーンに属します。

```js
const iter = gen();
```

```text
iter
  ↓ [[Prototype]]
gen.prototype
  ↓ [[Prototype]]
GeneratorFunction.prototype.prototype
  ＝ %GeneratorPrototype%
  ↓ [[Prototype]]
%Iterator.prototype%
  ↓ [[Prototype]]
Object.prototype
  ↓ [[Prototype]]
null
```

関数側と戻り値側を並べると、違いが明確になります。

| 対象 | 直接の `[[Prototype]]` |
|---|---|
| ジェネレーター関数 `gen` | `GeneratorFunction.prototype` |
| ジェネレーターオブジェクト `gen()` | 通常は `gen.prototype` |

### `.prototype` と `[[Prototype]]` は別

今回の混乱の中心には、次の二つの違いがありました。

```js
gen.prototype
```

```js
Object.getPrototypeOf(gen)
```

前者は、`gen` の `prototype` という名前のプロパティを参照します。

後者は、`gen` 自身が何を継承しているか、つまり内部の `[[Prototype]]` を取得します。

```js
const GeneratorFunction = (function* () {}).constructor;

function* gen() {
  yield 1;
}

const iter = gen();

console.log(
  Object.getPrototypeOf(gen) === GeneratorFunction.prototype
); // true

console.log(
  Object.getPrototypeOf(iter) === gen.prototype
); // true
```

また、次の二つも別の操作です。

```js
GeneratorFunction.prototype.prototype
```

```js
Object.getPrototypeOf(GeneratorFunction.prototype)
```

```text
GeneratorFunction.prototype.prototype
  → 共通のジェネレーター用オブジェクト

Object.getPrototypeOf(GeneratorFunction.prototype)
  → Function.prototype
```

「プロトタイプのプロトタイプ」という言い方だけでは、この二つが区別できません。そのため、プロパティの参照なのか、継承先をたどっているのかを明示する必要があります。

## 9. `GeneratorFunction` コンストラクターの説明

関係図を確認した後は、コンストラクターの説明を順番に読みました。

### `Function` のサブクラスである

`GeneratorFunction` は、`Function` のサブクラスとして定義されています。

ここでの `Function` は、単に「関数一般」を意味する普通名詞ではなく、組み込みの `Function` コンストラクターです。

コンストラクター自身については、次の関係になっています。

```js
const GeneratorFunction = (function* () {}).constructor;

console.log(
  Object.getPrototypeOf(GeneratorFunction) === Function
); // true
```

図の中でも、`Function` と `GeneratorFunction` が並ぶ列が、この関係を表しているのではないか、という確認がありました。

また、仕様の等幅・太字による表記に何らかの約束があるのではないか、という話も出ました。ただし、その場では表記規則の詳細までは確認していません。

### `new` がなくても関数を作れる

次の二つの呼び出しは、同じ引数なら同等の働きをします。

```js
const generatorFunc1 = GeneratorFunction("yield 1;");
const generatorFunc2 = new GeneratorFunction("yield 1;");
```

どちらも、新しいジェネレーター関数を作ります。

```js
console.log(generatorFunc1().next());
// { value: 1, done: false }

console.log(generatorFunc2().next());
// { value: 1, done: false }
```

これは、同じオブジェクトが返るという意味ではなく、関数を生成する操作として同等だという意味です。

輪読では、この説明の英文を読む際に、`is equivalent to` の前後を分けると意味が取りやすい、という確認もしました。

```text
GeneratorFunction(...) という関数呼び出し
  は、
同じ引数を渡す new GeneratorFunction(...)
  と同等である
```

通常の `Function` コンストラクターにも、同様の説明があったことを思い出していました。

## 10. `extends` とサブクラスの説明

次に、`GeneratorFunction` は、クラス定義の `extends` の対象として使えることを読みました。

```js
const GeneratorFunction = (function* () {}).constructor;

class MyGeneratorFunction extends GeneratorFunction {
  constructor(...args) {
    super(...args);
  }
}
```

### `extends clause` の `clause` は何か

英文を読む中で、`extends clause` の訳し方が話題になりました。

ここでの `clause` は、構文の一部分を意味する「節」や「句」です。

```js
class MyGeneratorFunction extends GeneratorFunction {
  // ...
}
```

このうち、次の部分を指しています。

```js
extends GeneratorFunction
```

輪読では、`if` 文に含まれる `else` 節のように、より大きな構文の一部として考えるとよい、という説明がありました。

また、文と式についても整理しています。

- 式は、評価によって値が得られるもの。
- 文は、処理の流れや実行する内容を記述するもの。
- 節・句は、より大きな構文を構成する部分。

厳密には `extends` の後ろに書く対象の式は評価されますが、`extends clause` という名前は、その式を含む構文上のまとまりを指します。

### `super(...)` が必要な理由

サブクラスのインスタンスにもジェネレーター関数としての振る舞いを持たせるには、`GeneratorFunction` のコンストラクターを通じて、必要な内部状態を持つオブジェクトを作る必要があります。

そのため、今回書いた明示的なコンストラクターでは、次の呼び出しを行います。

```js
super(...args);
```

これは、名前だけを継承するための記述ではなく、関数として動作するための初期化にも関係しています。

メモでは、引数なしでサブクラスのインスタンスを作っています。

```js
const myGeneratorFunction = new MyGeneratorFunction();
```

同じ仕組みに本文を渡せば、次のように、呼び出せるジェネレーター関数を作れます。

```js
const myGeneratorFunction = new MyGeneratorFunction(
  "yield 1; yield 2;"
);

for (const value of myGeneratorFunction()) {
  console.log(value);
}

// 1
// 2
```

## 11. 「サブクラスのインスタンスを作る構文がない」とはどういう意味か

コンストラクターの説明で、最も時間をかけたのが、次の二つの内容でした。

- ジェネレーター関数を定義する構文は、`GeneratorFunction` の直接のインスタンスを作る。
- `GeneratorFunction` のサブクラスのインスタンスを作る専用の構文はない。

この意味を理解するため、通常のジェネレーター関数と、サブクラスのインスタンスを比較しました。

### 通常のジェネレーター関数には、専用の構文がある

```js
function* countUp() {
  yield 1;
  yield 2;
  yield 3;
}
```

この `function*` という構文で作られるのは、通常のジェネレーター関数です。

今回の言葉遣いでは、これが「構文的な方法」に当たります。

一方、次のようにコンストラクターを呼ぶ方法もあります。

```js
const generatorFunc = new GeneratorFunction(`
  yield 1;
  yield 2;
  yield 3;
`);
```

こちらは、ジェネレーター関数を定義する専用の構文を使う代わりに、コンストラクターを呼んで生成しています。

輪読では、これを「非構文的な方法」と呼んでいました。

### サブクラスのインスタンスは作れる

先ほどのクラスを使えば、サブクラスのインスタンスを生成できます。

```js
class MyGeneratorFunction extends GeneratorFunction {
  constructor(...args) {
    super(...args);
  }
}

const myGeneratorFunction = new MyGeneratorFunction(
  "yield 1;"
);
```

つまり、「サブクラスのインスタンスは作れない」という意味ではありません。

### `function*` でサブクラスを指定する方法がない

存在しないのは、`function*` などの専用構文を使いながら、その生成先を `MyGeneratorFunction` に指定する方法です。

```js
function* ordinaryGenerator() {
  yield 1;
}

// これを書いても、MyGeneratorFunction のインスタンスにはならない。
```

比較すると、次のようになります。

| 作りたいもの | ジェネレーター定義の専用構文 | コンストラクター呼び出し |
|---|---|---|
| 通常のジェネレーター関数 | `function*` などで作れる | `new GeneratorFunction(...)` で作れる |
| `MyGeneratorFunction` のインスタンス | 専用の構文はない | `new MyGeneratorFunction(...)` で作れる |

「非構文的」という言い方には注意が必要です。`new MyGeneratorFunction(...)` 自体も、当然JavaScriptの構文です。

ここでは、**ジェネレーター関数定義の専用構文による生成か、コンストラクター呼び出しによる生成か**を区別しています。この文脈を共有するのに、輪読ではかなり時間をかけました。

途中では、ジェネレーターオブジェクトの `constructor` と、ジェネレーター関数の `constructor` を取り違えかける場面もありました。説明の対象は、関数の呼び出し結果ではなく、`countUp` のような関数自身です。

```js
const GeneratorFunction = (function* () {}).constructor;

function* countUp() {
  yield 1;
}

console.log(countUp.constructor === GeneratorFunction); // true
```

会話では、この制約から、サブクラス化して使うのは扱いづらく、欲しい振る舞いをジェネレーター関数の中に直接書く方が自然ではないか、という感想が出ました。これは利用上の感想であり、継承を禁止する仕様ではありません。

## 12. コンストラクターとプロトタイプのプロパティ

その後、`GeneratorFunction` の各種プロパティを確認しました。

### コンストラクター自身のプロパティ

`GeneratorFunction` コンストラクターには、次のようなプロパティがあります。

```js
const GeneratorFunction = (function* () {}).constructor;

console.log(GeneratorFunction.name);   // "GeneratorFunction"
console.log(GeneratorFunction.length); // 1
```

また、`GeneratorFunction.prototype` というプロパティは、共通のジェネレーター関数用プロトタイプオブジェクトを指します。

このプロパティは、書き換えも再定義もできない属性になっています。

```js
console.log(
  Object.getOwnPropertyDescriptor(GeneratorFunction, "prototype")
);

// {
//   value: ...,
//   writable: false,
//   enumerable: false,
//   configurable: false
// }
```

輪読では、`configurable: false` である点に反応がありました。

### `GeneratorFunction.prototype` 自体のプロパティ

続いて、共通のプロトタイプオブジェクトを見ました。

主な対応は、次のとおりです。

| プロパティ | 初期値 |
|---|---|
| `constructor` | `GeneratorFunction` |
| `prototype` | `%GeneratorPrototype%` |
| `Symbol.toStringTag` | `"GeneratorFunction"` |

特に二行目が、繰り返し登場した関係です。

```js
GeneratorFunction.prototype.prototype
// → %GeneratorPrototype%
```

### 個々のジェネレーター関数の `length` と `name`

個々のジェネレーター関数については、`length` と `name` に通常の関数と同様の規則が適用されます。

```js
function* example(a, b) {
  yield a;
  yield b;
}

console.log(example.name);   // "example"
console.log(example.length); // 2
```

`length` は、列挙される値の数ではありません。仮引数に関する情報です。

今回、この部分は、以前に通常の関数で読んだ内容と共通するとして、詳しくは立ち入りませんでした。

## 13. 個々のジェネレーター関数の `.prototype` は、いつ作られるのか

今回の後半で最も重要だったのは、個々のジェネレーター関数が持つ `.prototype` の説明です。

仕様の文章は、次の二段階に分けて理解できます。

1. **ジェネレーター関数を作るとき**、別の通常のオブジェクトも作り、それを関数の `.prototype` の初期値にする。
2. **その関数を呼ぶとき**、`.prototype` の値を、新しいジェネレーターオブジェクトの継承先に使う。

ここで、「何を作るたびに新しいオブジェクトが作られるのか」を取り違えないことが重要です。

```js
function* gen() {
  yield 1;
}
```

この関数が作られるときに、対応する `gen.prototype` 用のオブジェクトも作られます。

その後、同じ関数を複数回呼びます。

```js
const iter1 = gen();
const iter2 = gen();
```

`iter1` と `iter2` は別のオブジェクトですが、通常、直接の継承先は同じ `gen.prototype` です。

```text
iter1 ── [[Prototype]] ──┐
                        ├── gen.prototype
iter2 ── [[Prototype]] ──┘
```

**呼び出しのたびに、専用のプロトタイプオブジェクトが一個ずつ作られるわけではありません。** この点は、輪読中に実験しながら認識を修正しました。[仕様の「GeneratorFunction Instances: prototype」](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-generatorfunction-instances-prototype)

### 別の関数なら、それぞれ別の `.prototype` がある

関数を二つ定義した場合は、それぞれに対応するオブジェクトが作られます。

```js
function* gen1() {
  yield 1;
}

function* gen2() {
  yield 1;
}

console.log(gen1.prototype === gen2.prototype); // false
```

この関係と、同じ関数から作った複数のジェネレーターが継承先を共有することは、区別する必要があります。

## 14. 実験1：二つのジェネレーターが同じ `.prototype` を使う

今回のメモに残っている、共有関係を確認するコードです。

```js
function* gen() {
  yield 1;
}

const genProto = gen.prototype;
genProto.a = 1;

const iter1 = gen();
const iter1Proto = Object.getPrototypeOf(iter1);
console.log(iter1Proto.a);

const iter2 = gen();
const iter2Proto = Object.getPrototypeOf(iter2);
console.log(iter2Proto.a);

console.log(iter1Proto === genProto);
console.log(iter2Proto === genProto);
```

出力は次のとおりでした。

```text
1
1
true
true
```

最初に、関数の `.prototype` が指すオブジェクトへ、`a` を追加しています。

```js
gen.prototype.a = 1;
```

その後に作った `iter1` と `iter2` は、どちらも同じオブジェクトを継承します。

```js
Object.getPrototypeOf(iter1) === gen.prototype; // true
Object.getPrototypeOf(iter2) === gen.prototype; // true
```

ここで取得しているのは、同じ内容を持つコピーではありません。**同一のオブジェクトへの参照**です。

そのため、次の比較も成り立ちます。

```js
console.log(iter1Proto === iter2Proto); // true
```

### 途中で混乱した `.prototype` の参照先

実験の途中では、ジェネレーターオブジェクト自身から `.prototype` を取得しようとして混乱する場面がありました。

通常、継承先を調べるには、次のように書きます。

```js
Object.getPrototypeOf(iter1)
```

次の式とは意味が違います。

```js
iter1.prototype
```

一方、関数が持っているプロパティを調べるなら、こちらです。

```js
gen.prototype
```

どのオブジェクトを見ているのかを明確にするため、実験では名前を整理し、ジェネレーター関数を `gen`、呼び出し結果を `iter1`、`iter2` として説明し直しました。

## 15. `this` を使った実験が、意図したものにならなかった理由

共有関係を調べる途中では、ジェネレーター関数の本文で `this.a` を設定・加算する実験も行いました。

そこで、一見すると二つのジェネレーターが同じ状態を共有しているような結果になりました。しかし、参加者から、**その `this` はジェネレーターオブジェクトではなく、グローバルオブジェクトを指しているのではないか**という指摘がありました。

重要なのは、次の関係が自動では成立しないことです。

```js
const iter = gen();

// gen の本文の this が、自動的に iter になるわけではない。
```

ジェネレーター関数の `this` は、基本的に通常の関数と同じく、呼び出し方などで決まります。

例えば、非strictの通常のスクリプトで単純に関数として呼ぶと、`this` がグローバルオブジェクトになる場合があります。strictモードでは、同じような呼び方で `undefined` になります。

次は、その違いを明確にするための補足例です。

```js
function* example() {
  "use strict";
  yield this;
}

const receiver = { name: "receiver" };
const iter = example.call(receiver);

console.log(iter.next().value === receiver); // true
```

ジェネレーター本文の `this` を使っても、それが呼び出し結果の `iter` を指すとは限りません。

また、本文中に初期化処理を書いた実験では、それが最初の `next()` のタイミングで実行されるため、値の変化を見ようとするたびに初期化してしまう問題もありました。最初の `next()` をそれぞれ一回呼び、初期化と加算のタイミングを分ける工夫をしましたが、最終的には `this` の問題があると分かり、外側からプロトタイプを直接調べる実験に切り替えています。

## 16. 実験2：共有するプロトタイプの値を変更するとどうなるか

次の実験では、関数本文から `gen.prototype.a` を明示的に参照しました。

```js
function* gen() {
  yield gen.prototype.a;
}

const genProto = gen.prototype;
genProto.a = 1;

const iter1 = gen();
const iter1Proto = Object.getPrototypeOf(iter1);
console.log(iter1Proto.a);

console.log(iter1.next());

iter1Proto.a++;

const iter2 = gen();
const iter2Proto = Object.getPrototypeOf(iter2);
console.log(iter2Proto.a);

console.log(iter2.next());

console.log(iter1Proto === genProto);
console.log(iter2Proto === genProto);
```

出力は次のとおりです。

```text
1
{ value: 1, done: false }
2
{ value: 2, done: false }
true
true
```

### 最初は `a` が `1`

最初に、共有するオブジェクトへ値を設定しています。

```js
const genProto = gen.prototype;
genProto.a = 1;
```

`iter1` の直接の継承先は `genProto` なので、そこから取得する `a` は `1` です。

```js
console.log(iter1Proto.a); // 1
```

また、ジェネレーター本文も同じオブジェクトを参照しています。

```js
yield gen.prototype.a;
```

そのため、`iter1.next()` で取り出す値も `1` です。

### 継承先のオブジェクトを直接変更する

次に、次の処理をします。

```js
iter1Proto.a++;
```

`iter1Proto` は `gen.prototype` と同じオブジェクトなので、これは共有されている `a` を `2` にしています。

```text
iter1Proto
    ＝ genProto
    ＝ gen.prototype
```

### 後から作ったジェネレーターも変更後の値を見る

その後、`iter2` を作ります。

```js
const iter2 = gen();
```

`iter2` も同じオブジェクトを継承するので、`a` は `2` です。

```js
console.log(iter2Proto.a); // 2
console.log(iter2.next()); // { value: 2, done: false }
```

この実験から、個々のジェネレーターオブジェクトが別々であることと、プロトタイプを共有していることは、両立すると分かります。

### 関数本文が参照しているものにも注意する

本文にある次の式は、継承されたプロパティを暗黙に読む構文ではありません。

```js
gen.prototype.a
```

関数自身の名前 `gen` を参照し、その `prototype` プロパティから `a` を読んでいます。

輪読では、「関数の中から、その関数自身を参照できるので、この書き方はできる」と確認しました。

## 17. 実験3：`.prototype` を別のオブジェクトに差し替える

最後に、ジェネレーター関数の `.prototype` は書き換えられることを確認しました。

今回のメモのコードです。

```js
function* gen() {
  yield 1;
}

const genProto = gen.prototype;
genProto.a = 1;

const iter1 = gen();
const iter1Proto = Object.getPrototypeOf(iter1);
console.log(iter1Proto.a);

// Writable: true
gen.prototype = {};

const iter2 = gen();
const iter2Proto = Object.getPrototypeOf(iter2);
console.log(iter2Proto.a);

console.log(iter1Proto === genProto);
console.log(iter2Proto === genProto);
```

出力は次のとおりでした。

```text
1
undefined
true
false
```

### 差し替え前に作ったものは、元のオブジェクトを継承する

`iter1` は、差し替え前に作られています。

```js
const iter1 = gen();
```

そのため、継承先は元の `genProto` のままです。

```js
console.log(iter1Proto === genProto); // true
```

### 差し替え後に作ったものは、新しいオブジェクトを継承する

次の代入で、関数の `.prototype` が別のオブジェクトを指すようになります。

```js
gen.prototype = {};
```

この後で作った `iter2` は、新しい空のオブジェクトを継承します。

```js
const iter2 = gen();
```

そのオブジェクトには `a` がないので、参照結果は `undefined` です。

```js
console.log(iter2Proto.a); // undefined
console.log(iter2Proto === genProto); // false
```

関係は、次のようになります。

```text
差し替え前

iter1 ── [[Prototype]] ──→ 元のオブジェクト
                              ↑
                         gen.prototype


差し替え後

iter1 ── [[Prototype]] ──→ 元のオブジェクト

iter2 ── [[Prototype]] ──→ 新しい空のオブジェクト
                              ↑
                         gen.prototype
```

`.prototype` の差し替えは、すでに作ったジェネレーターオブジェクトの継承先を、自動的に変更する操作ではありません。

### オブジェクトの変更と、参照先の差し替えは違う

前の実験と比較すると、違いが明確です。

```js
gen.prototype.a = 2;
```

これは、現在参照しているオブジェクトの中身を変えます。

```js
gen.prototype = {};
```

こちらは、`gen.prototype` が指すオブジェクトを変更します。

| 操作 | 何が変わるか |
|---|---|
| `gen.prototype.a = 2` | 共有オブジェクトのプロパティ |
| `gen.prototype = {}` | 関数の `.prototype` の参照先 |

輪読では、このような経路でもジェネレーターのプロトタイプ関係を変えられることに、驚きや扱いづらさを感じる反応がありました。

補足すると、単純な `{}` に差し替えた場合、その先には通常の `%GeneratorPrototype%` がいません。そのため、新しいオブジェクトからは、共通の `next()` なども通常どおりには継承されなくなります。今回の最後のコードは、`iter2` の継承先を調べるところまでで、`iter2.next()` は呼んでいません。

## 18. 今回のプロパティ属性で、区別すべき三か所

今回の会話では、どの `prototype` を説明しているのかが、何度も分かりづらくなりました。

特に、次の三つは別のプロパティです。

```js
GeneratorFunction.prototype
GeneratorFunction.prototype.prototype
gen.prototype
```

属性を並べると、違いが分かります。

| プロパティ | `writable` | `enumerable` | `configurable` |
|---|---:|---:|---:|
| `GeneratorFunction.prototype` | `false` | `false` | `false` |
| `GeneratorFunction.prototype.prototype` | `false` | `false` | `true` |
| 個々の関数の `gen.prototype` | `true` | `false` | `false` |

最後の実験で差し替えられたのは、三行目の `gen.prototype` です。

```js
gen.prototype = {};
```

また、`writable: false` という属性は、そのプロパティが指すオブジェクトの中身まで変更不能にするものではありません。プロパティの参照先を書き換えられるかどうかと、参照先のオブジェクトが変更可能かどうかも、別の話です。

## 19. ジェネレーターの利用場面についての話

終盤では、ここまで複雑なプロトタイプ関係を、普段どれほど意識するか、という話になりました。

参加者の間でも、ジェネレーターをあまり見かけないという感覚と、実際に使ったことがあるという経験の両方がありました。

利用例として挙がったのは、次のようなものです。

- 値を少しずつ取り出す処理
- 処理の進捗を段階的に示すこと
- ストリームを作ること
- 特に、非同期ジェネレーターによる逐次的な値の受け渡し

今回深く扱ったのは、そうした処理の書き方そのものより、背後にある関数とオブジェクトの構造でした。

ジェネレーターを使う際に、毎回これらのプロトタイプを操作する必要があるわけではありません。一方で、仕様を読むためには、普段は意識しない構造も区別しなければならず、それが今回の難しさにつながっていました。

## 20. 今回の終了位置と、次回の予定

今回は、27.8「Generator Objects」から読み始めましたが、途中で27.6「GeneratorFunction Objects」に戻り、ジェネレーター関数の生成方法とプロトタイプの関係を詳しく確認する回になりました。

そのため、当初の目的だった `GeneratorResume` の詳細には到達していません。

次回は、ジェネレーターオブジェクト側に戻り、共通の `%GeneratorPrototype%` の `constructor` より後、特に `next()` から読み進める予定になりました。

```text
ジェネレーターオブジェクトの next()
  ↓
GeneratorResume
  ↓
停止していた処理の再開
```

間にある27.7「AsyncGeneratorFunction Objects」は、今回確認した関数生成やプロパティの説明と共通する部分が多そうだとして、いったん飛ばす方針です。ただし、これは今回の読み進め方の判断であり、同期ジェネレーターと非同期ジェネレーターの実行動作まで同じだと確認したわけではありません。

今回の到達点は、次の関係を、実際のコードと比較結果で確かめたことでした。

```js
function* gen() {
  yield 1;
}

// 関数を作ると、その関数用の .prototype も用意される。
const genProto = gen.prototype;

// 同じ関数から作ったオブジェクトは、通常これを共有する。
const iter1 = gen();
const iter2 = gen();

console.log(Object.getPrototypeOf(iter1) === genProto); // true
console.log(Object.getPrototypeOf(iter2) === genProto); // true

// 差し替え後に作るオブジェクトには、新しい値が使われる。
gen.prototype = {};

const iter3 = gen();

console.log(Object.getPrototypeOf(iter1) === genProto); // true
console.log(Object.getPrototypeOf(iter3) === genProto); // false
```