const { currUnixtime, getCliArg } = require("./utils.js");
const {
  relayInit,
  getPublicKey,
  finishEvent
} = require("nostr-tools");
require("websocket-polyfill");

const DEBUG_FLAG = false;

const trace = (str) => {
  if(DEBUG_FLAG){
    console.log(str);
  }
};

/* Bot用の秘密鍵をここに設定 */
const BOT_PRIVATE_KEY_HEX = "6183f8c4a5fbd37fd27c20fbe3fcb8f2a5bb68c4d0aa26c0ff40efd9212d6b58";

const relayUrl = "wss://relay-jp.nostr.wirednet.jp";

/**
 * リアクションイベントを組み立てる
 * @param {import("nostr-tools").Event} targetEvent リアクション対象のイベント
 */
const composeReaction = (targetEvent, dur) => {
  /* Q-1: リアクションイベントのフィールドを埋めよう  */
  const ev = {
    kind: 1,
    content:
      "ただいまの ｶﾞｯ の記録は―\n"+
      dur + " 秒\n"+
      "でございます"
    ,
    tags:[
      ["e",targetEvent.id,""],
      ["p",targetEvent.pubkey,""],
    ],
    created_at: currUnixtime(),
  };

  // イベントID(ハッシュ値)計算・署名
  return finishEvent(ev, BOT_PRIVATE_KEY_HEX);
};

// リレーにイベントを送信
const publishToRelay = (relay, ev) => {
  const pub = relay.publish(ev);
  pub.on("ok", () => {
    trace("succeess!");
  });
  pub.on("failed", () => {
    trace("failed to send event");
  });
};

const main = async () => {
  const relay = relayInit(relayUrl);
  relay.on("error", () => {
    console.error("failed to connect");
  });
  const relay2 = relayInit(relayUrl);
  relay2.on("error", () => {
    console.error("failed to connect");
  });

  await relay.connect();
  await relay2.connect();

  /* Q-2: すべてのテキスト投稿を購読しよう */
  const sub = relay.sub([{"kinds":[1]}]);
  sub.on("event", (ev) => {
    try {
      /* Q-3: 「受信した投稿のcontentに対象の単語が含まれていたら、
              その投稿イベントにリアクションする」ロジックを完成させよう */
      // ヒント: ある文字列に指定の単語が含まれているかを判定するには、includes()メソッドを使うとよいでしょう
      //trace("target word="+targetWord);
      //trace("ev="+JSON.stringify(ev));
      //trace("ev.content="+ev.content);
      if(ev.content.includes("ｶﾞｯ")){
        trace("ga found");
        if(Array.isArray(ev.tags)){ // tag was found
          //find etag
          trace("ev.tags found");
          var replytohex = "";
          for(var t=0;t<ev.tags.length;t++){
            if(ev.tags[t][0] == "e"){ // found
              replytohex = ev.tags[t][1];
            }
          }
          if(replytohex != ""){ // etag was found
            trace("e tags found, hex = "+replytohex);
            const sub2 = relay2.sub([{"kinds":[1],"ids":[replytohex]}]);
            sub2.on("event", (ev2) => {
              trace("ev2 = "+JSON.stringify(ev2));
              if(ev2.content.includes("ぬるぽ")){
                trace("nurupo found");
                var nurupotime = ev2.created_at;
                var gatime = ev.created_at;
                var dur = gatime-nurupotime;
                trace("gatime="+gatime);
                trace("nltime="+nurupotime);
                trace("dur   ="+dur);
                const post = composeReaction(ev, dur);
                trace(JSON.stringify(post));
                publishToRelay(relay, post);
              }//if ぬるぽ
            }); // sub.on
          }//if(replytohex != "")
        } // Array.isArray(ev.tags)
      }// if includes
    } catch (err) {
      console.error(err);
    }
  });
};

// コマンドライン引数をリアクション対象の単語とする
main().catch((e) => console.error(e));
