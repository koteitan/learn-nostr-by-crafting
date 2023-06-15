const { currUnixtime } = require("./utils.js");
const {
  relayInit,
  getPublicKey,
  getEventHash,
  getSignature,
  finishEvent,
  nip19
} = require("nostr-tools");
require("websocket-polyfill");

/* Bot用の秘密鍵をここに設定 */
const BOT_PRIVATE_KEY_HEX = "6183f8c4a5fbd37fd27c20fbe3fcb8f2a5bb68c4d0aa26c0ff40efd9212d6b58";

const relayUrl = "wss://relay-jp.nostr.wirednet.jp";

/**
 * テキスト投稿イベント(リプライ)を組み立てる
 * @param {string} content 投稿内容
 * @param {import("nostr-tools").Event} targetEvent リプライ対象のイベント
 */
const composeReplyPost = (content, targetEvent) => {
  /* Q-1: これまで学んだことを思い出しながら、
          リプライを表現するイベントを組み立てよう */
  const pubkey = getPublicKey(BOT_PRIVATE_KEY_HEX); // 公開鍵は秘密鍵から導出できる
  const ev = {
    /* Q-2: イベントの pubkey, kind, content を設定してみよう */
    pubkey:pubkey,
    kind:1, 
    content:content,
    tags:[
      ["e",targetEvent.id,""],
      ["p",targetEvent.pubkey,""],
    ],
    created_at: currUnixtime(),
  }
  /* Q-3: イベントのハッシュ値を求めてみよう */
  const id = getEventHash(ev);
  /* Q-4: イベントの署名を生成してみよう */
  const sig = getSignature(ev, BOT_PRIVATE_KEY_HEX);

  return {...ev, id, sig} // イベントにID(ハッシュ値)と署名を設定
};

// リレーにイベントを送信
const publishToRelay = (relay, ev) => {
  const pub = relay.publish(ev);
  pub.on("ok", () => {
    console.log("succeess!");
  });
  pub.on("failed", () => {
    console.log("failed to send event");
  });
};

/* 暴走・無限リプライループ対策 */
// リプライクールタイム
const COOL_TIME_DUR_SEC = 60

// 公開鍵ごとに、最後にリプライを返した時刻(unixtime)を保持するMap
const lastReplyTimePerPubkey = new Map()

// 引数のイベントにリプライしても安全か?
// 対象の発行時刻が古すぎる場合・最後にリプライを返した時点からクールタイム分の時間が経過していない場合、安全でない
const isSafeToReply = ({ pubkey, created_at }) => {
  const now = currUnixtime()
  if (created_at < now - COOL_TIME_DUR_SEC) {
    return false;
  }

  const lastReplyTime = lastReplyTimePerPubkey.get(pubkey)
  if (lastReplyTime !== undefined && now - lastReplyTime < COOL_TIME_DUR_SEC) {
    return false
  }
  lastReplyTimePerPubkey.set(pubkey, now)
  return true
}

// メイン関数
const main = async () => {
  const relay = relayInit(relayUrl);
  relay.on("error", () => {
    console.error("failed to connect");
  });

  await relay.connect();
  console.log("connected to relay");

  /* Q-2: 「このBotの公開鍵へのリプライ」を絞り込むフィルタを設定して、イベントを購読しよう */
  // ヒント: nostr-toolsのgetPublicKey()関数を使って、秘密鍵(BOT_PRIVATE_KEY_HEX)から公開鍵を得ることができます
  const pubkey = getPublicKey(BOT_PRIVATE_KEY_HEX);
  const sub = relay.sub([{
    "kinds":[1],
    "#p":[pubkey]
  }]);

  sub.on("event", (ev) => {
    try {
      // リプライしても安全なら、リプライイベントを組み立てて送信する
      if (isSafeToReply(ev)) {
        const replyPost = composeReplyPost("かっは！", ev);
        publishToRelay(relay, replyPost);
      }
    } catch (err) {
      console.error(err);
    }
  });
};

main().catch((e) => console.error(e));
