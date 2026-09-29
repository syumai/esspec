# ECMAScript仕様輪読会 第107回

## `String.prototype.toString()` と文字列の取り出し

今回最初に読んだのは、`String.prototype.toString()` です。このメソッドは、受け取った値から**プリミティブな文字列**を取り出して返します。受け付けるのは、文字列プリミティブか、文字列を内部に保持する `String` オブジェクトです。それ以外の値には `TypeError` を投げます。

`String` オブジェクトは、文字列プリミティブとは異なるオブジェクトです。`new String("bbb")` で作ったものや、`String` を継承したクラスのインスタンスには、内部の文字列を保持する `[[StringData]]` があります。

```js
class StringSub extends String {}

console.log(String.prototype.toString.call("aaa"));               // "aaa"
console.log(String.prototype.toString.call(new String("bbb")));   // "bbb"
console.log(String.prototype.toString.call(new StringSub("ccc"))); // "ccc"

String.prototype.toString.call(1);  // TypeError
String.prototype.toString.call({}); // TypeError
```

輪読会では `.call()` を使い、メソッドの `this` を差し替えて確かめました。`String` のサブクラスは受け付けられますが、数値や普通のオブジェクトは受け付けられません。**任意の値を文字列に変換する汎用メソッドではない**、というのがポイントです。

仕様の注記では、通常の `String` オブジェクトについては `valueOf()` と同じ結果を返すと説明されています。今回確認した範囲では、両者は内部の文字列を取り出す同じ処理を使っていました。ただし、サブクラス側でメソッドを上書きする場合など、メソッド呼び出しの結果まで常に同一とは限らない点にも触れました。

この性質を、仕様でいう *intentionally generic*（意図的に汎用的）との対比で確認しました。最近読んでいた汎用メソッドなら、別種の値を `this` にして使える場合があります。一方、`String.prototype.toString()` は文字列または `[[StringData]]` を持つオブジェクトに対象を限定しています。比較として、`Number.prototype.toString()` も数値を取り出す処理を使うため、同様に任意のオブジェクトへ使えるわけではない、という話になりました。

## `String.prototype.toWellFormed()` とサロゲート

次に読んだ `toWellFormed()` は、文字列中の**対応相手を持たないサロゲート**を、置換文字 `U+FFFD`（`�`）に置き換えた文字列を返すメソッドです。正しく組になっているサロゲートペアや、通常の文字はそのまま残します。

このメソッドの前半では `this` が文字列に変換できる値かを確認し、文字列に変換してから内容を調べます。ここは、内部の文字列を厳密に取り出す `String.prototype.toString()` との違いです。

### コードユニットとコードポイント

議論の中心になったのは、JavaScriptの文字列を読むときの二つの単位でした。

- **UTF-16コードユニット**：16ビット単位。文字列の `length` や添字は、この単位で扱います。
- **Unicodeコードポイント**：Unicodeで文字に割り当てられる値。UTF-16では、通常は１コードユニット、補助平面の文字は２コードユニットの組で表現します。

たとえば輪読会で使った「𩸽」は、見た目は一文字ですが、UTF-16では前半の *リーディングサロゲート* と後半の *トレーリングサロゲート* からなるペアです。

```js
const s = "𩸽";

console.log(s.length); // 2
console.log(s[0]);     // 前半のコードユニット
console.log(s[1]);     // 後半のコードユニット
```

途中で、文字列を「コードユニットの列」と呼ぶ説明と、仕様中の「UTF-16で符号化されたコードポイントの列」という説明の関係を確認しました。重要なのは、**二つで一つのコードポイントになる場合がある**ことと、JavaScriptの文字列には**片方だけのサロゲートも存在できる**ことです。したがって、すべての文字列が正しいサロゲートペアだけで構成されるわけではありません。

### 文字列の位置から何を読み取るか

`toWellFormed()` の説明を理解するため、輪読会では仕様の `CodePointAt` も読みました。これは文字列とコードユニット単位の位置を受け取り、その位置から読める情報を返す操作です。返す情報には、読み取ったコードポイント、消費したコードユニット数、対応相手のないサロゲートだったかどうかが含まれます。

検討したケースは大きく四つです。

| その位置から見えるもの | 消費するコードユニット | 判定 |
|---|---:|---|
| サロゲートではない通常の値 | 1 | 有効 |
| リーディング＋トレーリングの正しいペア | 2 | 有効 |
| 単独のトレーリングサロゲート | 1 | 対応相手なし |
| 後ろにトレーリングサロゲートがないリーディングサロゲート | 1 | 対応相手なし |

リーディングサロゲートとトレーリングサロゲートは、ペアの**前半と後半**を指す名前です。前半だけがある場合も、後半だけがある場合も、ペアとしては成立しません。

`toWellFormed()` は文字列を先頭から確認し、対応相手のないサロゲートなら `U+FFFD` を結果に追加します。有効なものは保持します。読み進める位置はコードユニット単位なので、正しいペアを読んだときは２つ分、そうでないときは１つ分進める必要があります。単に毎回１ずつ進めると、正しいペアの後半をもう一度読んでしまいます。

会中では `CodePointAt` が *Static Semantics* の項にあることも話題になりました。静的意味論は、文法だけでは表しきれない、ソースコードを読む段階で決まる規則などに用いられます。一方で、ここでの操作は文字列メソッドの説明からも参照されています。「静的意味論の項にあるから実行時には使わない」と単純には分けられないことを確認しました。

### 実行して確かめた結果

```js
const s = "𩸽";
const leadingSurrogate = s[0];
const trailingSurrogate = s[1];

console.log(s.toWellFormed());                  // "𩸽"
console.log(leadingSurrogate.toWellFormed());   // "�"
console.log(trailingSurrogate.toWellFormed());  // "�"

console.log(leadingSurrogate.charCodeAt(0));                    // 55399
console.log(trailingSurrogate.charCodeAt(0));                   // 56893
console.log(leadingSurrogate.toWellFormed().charCodeAt(0));     // 65533
console.log(trailingSurrogate.toWellFormed().charCodeAt(0));    // 65533
```

正しいペアのままなら「𩸽」が残ります。前半または後半を単独の文字列にすると、どちらも `�` に置き換わります。表示だけでは単独のサロゲートと置換後の文字が似て見えるため、`charCodeAt(0)` で数値を比べました。**異なる壊れたサロゲートが、同じ置換文字 `U+FFFD`（十進数で65533）になる**ことが分かります。

## `trim()`、`trimStart()`、`trimEnd()`

後半は文字列の端にある空白を取り除くメソッドを読みました。共通の処理に「先頭」「末尾」「両方」のどれを対象にするかを渡す構成です。

| メソッド | 取り除く場所 |
|---|---|
| `trim()` | 先頭と末尾 |
| `trimStart()` | 先頭だけ |
| `trimEnd()` | 末尾だけ |

`trim()` の仕様には、`this` が `String` オブジェクトであることを要求しない、**意図的に汎用的なメソッド**だという注記があります。先に読んだ `String.prototype.toString()` と対照的です。`trimEnd()` と `trimStart()` も、共通の文字列トリミング処理にそれぞれ末尾・先頭の指定を渡すことを確認しました。

### 「空白」に含まれるもの

ここで取り除く対象は、普段入力する半角スペースだけではありません。仕様では、**White Space** と **Line Terminator** を合わせて対象とします。

輪読会では、White Space 側のタブ、垂直タブ、フォームフィード、非改行スペースや、Unicodeの *Space Separator* カテゴリに属する文字を確認しました。通常の半角スペース `U+0020` や非改行スペース `U+00A0` も、このカテゴリに含まれます。Line Terminator 側には、改行（LF）、復帰（CR）、行区切り（LS）、段落区切り（PS）があります。

この範囲を調べる際にも、コードユニットの並びをUTF-16で符号化されたコードポイントとして解釈する、という仕様の説明が出てきました。先ほどの `toWellFormed()` で確認した区別が、ここでも関係します。

### 先頭・末尾の違いをコードで確認

共同編集の実行環境で、スペース、改行、タブを文字列の両端に置いて試しました。表示を見分けやすくするため、`JSON.stringify()` で改行やタブをエスケープして出力しています。

```js
const string = ` 
		 aa 
`;

const print = (value) => console.log(JSON.stringify(value));

print(string);
print(string.trim());
print(string.trimStart());
print(string.trimEnd());
```

```text
" \n\t\t aa \n"
"aa"
"aa \n"
" \n\t\t aa"
```

`trim()` は両端を取り、`trimStart()` は後ろのスペースと改行を残し、`trimEnd()` は前のスペース・改行・タブを残します。途中の文字は対象ではありません。実例には複数種類の空白が入っていますが、どのメソッドも**指定された側に連続している対象文字**を取り除く、という振る舞いを確認できました。

今回は `String.prototype.trimStart()` まで読み終えました。次回は `String.prototype[Symbol.iterator]()` から読む予定です。