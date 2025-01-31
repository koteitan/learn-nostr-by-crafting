const { currUnixtime, currUnixtimems} = require("./utils.js");
const {
  relayInit,
  finishEvent,
  getPublicKey,
} = require("nostr-tools");
require("websocket-polyfill");

const DEBUG_FLAG = true;

const trace = (str) => {
  if(DEBUG_FLAG){
    console.log(str);
  }
};

/* 暴走・無限リプライループ対策 */
const COOL_TIME_DUR_SEC = 60
const lastReplyTimePerPubkey = new Map()
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

/* Bot用の秘密鍵をここに設定 */
const BOT_PRIVATE_KEY_HEX = "6183f8c4a5fbd37fd27c20fbe3fcb8f2a5bb68c4d0aa26c0ff40efd9212d6b58";

const relayUrl = "wss://relay-jp.nostr.wirednet.jp";
const nurupotimemap = new Map();
const ranking = new Array();
const rankingnum = 5;

const composeReaction = (targetEvent, dur) => {
  var msg = 
    "ただいまの ｶﾞｯ の記録は―\n"+
    dur + " ミリ秒\n"+
    "でございます";
  var rank = ranking.indexOf(dur);
  if(rank!=-1){
    msg += "\n\n"+(rank+1)+" 位\n"
        +  "に入賞しました";
  }
  const ev = {
    kind   : 1,
    content: msg,
    tags   : [
      ["e",targetEvent.id,""],
      ["p",targetEvent.pubkey,""],
    ],
    created_at: currUnixtime(),
  };

  // イベントID(ハッシュ値)計算・署名
  return finishEvent(ev, BOT_PRIVATE_KEY_HEX);
};
const composeRanking = (targetEvent) => {
  var msg="";
  for(var i=0;i<ranking.length;i++){
    msg+=""+(i+1)+"位: "+ranking[i]+" ミリ秒\n";
  }
  const ev = {
    kind: 1,
    content: msg,
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
  await relay.connect();

  const pubkey = getPublicKey(BOT_PRIVATE_KEY_HEX);
  const subrank = relay.sub([{
    "kinds":[1],
    "#p":[pubkey]
  }]);
  subrank.on("event", (ev) => {
    if(ev.content.includes("ranking")){
      if (isSafeToReply(ev)) {
        const post = composeRanking(ev);
        trace(JSON.stringify(post));
        publishToRelay(relay, post);
      }
    }
  });

  /* search nurupo */
  const subnurupo = relay.sub([{"kinds":[1]}]);
  subnurupo.on("event", (ev) => {
    var now = currUnixtimems();
    try {
      //trace("ev="+JSON.stringify(ev));
      //trace("ev.content="+ev.content);
      if(ev.content == "ぬるぽ"){
        nurupotimemap.set(ev.id, now);
      }
    }catch(err){
      console.error(err);
    }
  });//subnurupo.on

  /* search ga */
  const subga     = relay.sub([{"kinds":[1]}]);
  subga.on("event", (ev) => {
    try {
      //trace("ev="+JSON.stringify(ev));
      //trace("ev.content="+ev.content);
      if(ev.content == "ｶﾞｯ"){
        var gatime = currUnixtimems();
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
            var nurupotime = nurupotimemap.get(replytohex);
            if(nurupotime !== undefined){
              trace("nurupo found");
              nurupotimemap.delete(replytohex);
              var dur = gatime-nurupotime;
              trace("gatime="+gatime);
              trace("nltime="+nurupotime);
              trace("dur   ="+dur);
              ranking.push(dur);
              ranking.sort((a,b)=>a-b);
              ranking.slice(rankingnum);
              if (isSafeToReply(ev)) {
                const post = composeReaction(ev, dur);
                trace(JSON.stringify(post));
                publishToRelay(relay, post);
              }//if issafe
            }else{
              trace("no nurupo");
            }//if ぬるぽ
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
