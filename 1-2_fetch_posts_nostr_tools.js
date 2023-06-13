const { currUnixtime } = require("./utils.js");
const { relayInit } = require("nostr-tools");
require("websocket-polyfill");

const relayUrl = "wss://relay-jp.nostr.wirednet.jp";

const main = async () => {
  /* Q-1: nostr-toolsのRelayオブジェクトを初期化してみよう */
  const relay = relayInit(relayUrl); 
  relay.on("error", () => {
    console.error("failed to connect");
  });

  /* Q-2: Relayオブジェクトのメソッドを呼び出して、リレーに接続してみよう */
  await relay.connect(); 

  /* Q-3: Relayオブジェクトのメソッドを使って、イベントを購読してみよう */
  const sub = relay.sub([{"authors":['4c5d5379a066339c88f6e101e3edb1fbaee4ede3eea35ffc6f1c664b3a4383ee']}]);

  // メッセージタイプごとにリスナーを設定できる
  sub.on("event", (ev) => {
    // Nostrイベントのオブジェクトがコールバックに渡る
    console.log(ev);
  });

  sub.on("eose", () => {
    console.log("****** EOSE ******");
  });
};

main().catch((e) => console.error(e));
