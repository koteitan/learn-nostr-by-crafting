const { currUnixtime } = require("./utils.js");
const {
  relayInit,
  getPublicKey,
  finishEvent,
  nip19,
} = require("nostr-tools");
require("websocket-polyfill");

/* Q-1: Bot用に新しい秘密鍵を生成して、ここに設定しよう */
const BOT_PRIVATE_KEY_HEX = "6183f8c4a5fbd37fd27c20fbe3fcb8f2a5bb68c4d0aa26c0ff40efd9212d6b58";

const relayUrl = "wss://relay-jp.nostr.wirednet.jp";

/**
 * メタデータ(プロフィール)イベントを組み立てる
 */
const composeMetadata = () => {
  /* Q-2: Botアカウントのプロフィールを設定しよう  */
  const profile = {
    name: "koteitan-enshu-bot", // スクリーンネーム
    display_name: "こていたんえんしゅうぼっと", // 表示名
    about: "botつくるよ", // 説明欄(bio)
  };

  /* Q-3: メタデータ(プロフィール)イベントのフィールドを埋めよう */
  // pubkeyは以下の処理で自動で設定されるため、ここで設定する必要はありません
  const ev = {
    kind: 0,
    content: JSON.stringify(profile),
    tags: [],
    created_at: currUnixtime(),
  };

  // イベントID(ハッシュ値)計算・署名
  return finishEvent(ev, BOT_PRIVATE_KEY_HEX);
}

const main = async () => {
  const relay = relayInit(relayUrl);
  relay.on("error", () => {
    console.error("failed to connect");
  });

  await relay.connect();

  // メタデータ(プロフィール)イベントを組み立てる
  const metadata = composeMetadata();

  // メタデータイベントを送信
  const pub = relay.publish(metadata);
  pub.on("ok", () => {
    console.log("succeess!");
    relay.close();
  });
  pub.on("failed", () => {
    console.log("failed to send event");
    relay.close();
  });
};

main().catch((e) => console.error(e));
