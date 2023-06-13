const { currUnixtime, getCliArg } = require("./utils.js");
const {
  relayInit,
  getPublicKey,
  getEventHash,
  getSignature,
  nip19
} = require("nostr-tools");
require("websocket-polyfill");

/* 自分の秘密鍵をhex形式に変換して、ここに設定*/
const PRIVATE_KEY_HEX = '1cf02a1e8b2a1212b2966e4abe58e14b88e35c8af60f867a6ba29061fe95c9e7'; //いやん

const relayUrl = "wss://relay-jp.nostr.wirednet.jp";

/**
 * テキスト投稿イベント(リプライ)を組み立てる
 * @param {string} content 投稿内容
 * @param {string} targetPubkey リプライ対象の公開鍵(hex)
 * @param {string} targetEventId リプライ対象の投稿のイベントID(hex)
 */
const composeReplyPost = (content, targetPubkey, targetEventId) => {
  const myPubkey = getPublicKey(PRIVATE_KEY_HEX);

  // 発展課題のヒント: NIP-27に準拠するには、ここでcontentに手を加えることになります

  const ev = {
    pubkey: myPubkey,
    kind: 1,
    content:"nostr:"+targetPubkey+" "+content,
    tags: [
      /* Q-1: リプライ対象の公開鍵を指すpタグを書いてみよう */
      ["p",nip19.decode(targetPubkey).data,""],
      /* Q-2: リプライ対象の投稿を指すeタグを書いてみよう */
      ["e",nip19.decode(targetEventId).data,""],
    ],
    created_at: currUnixtime(),
  };
  const id = getEventHash(ev);
  const sig = getSignature(ev, PRIVATE_KEY_HEX);

  return { ...ev, id, sig };
};

const main = async (content) => {
  const relay = relayInit(relayUrl);
  relay.on("error", () => {
    console.error("failed to connect");
  });

  await relay.connect();
  const replyPost = composeReplyPost(
    content,
    /* Q-3: Nostr上の好きな投稿を選び、その投稿のイベントIDと投稿者の公開鍵を調べて、ここに設定してみよう */
    // ヒント-1: まずは、1-3節の演習で作った投稿にリプライしてみるといいでしょう。必要な2つのデータはログに出力されたイベントの中にあります
    // ヒント-2: 「リプライ実装チェッカー(bot)」の投稿にリプライすると、実装が正しいか判定してリプライで結果を教えてくれます。詳しくはREADMEの「ヒント」の項を参照してください
    // ヒント-3: npmスクリプト sub-reply を使って自分へのリプライを確認できます。詳しくはREADMEの「npmスクリプト」の項を参照してください
    "npub1y75tnycxnpp8z23fkql4xn597x3alnd728xa93ujxtxvxrktvm5qf3rg9u",
    "note1pqzj6te5d2wjlr4fguvz5wa97mv03hacr6lcxn9td2xnmfmwzavs2mvxns"
  );
  const pub = relay.publish(replyPost);

  pub.on("ok", () => {
    console.log("succeess!");
    relay.close();
  });
  pub.on("failed", () => {
    console.log("failed to send event");
    relay.close();
  });
};

const content = getCliArg("error: リプライの内容をコマンドライン引数として設定してください");
main(content).catch((e) => console.error(e));
