/* =========================================================
   SPADES 6 PLAYER
   OFFLINE GAME + PRE-GAME YOUTUBE VIDEO
========================================================= */


/* =========================================================
   TELEGRAM
========================================================= */

const tg =
  window.Telegram &&
  window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

try{

  if(tg){

    tg.ready();
    tg.expand();

  }

}catch(e){}


/* =========================================================
   CONFIGURATION
========================================================= */

/*
   IMPORTANT

   فقط این مقدار را با ID واقعی ویدیوی خودت عوض کن.

   مثال:

   https://www.youtube.com/watch?v=ABC123XYZ

   ID ویدیو:

   ABC123XYZ
*/

const VIDEO_ID = "YOUR_VIDEO_ID_HERE";


/*
   اگر ویدیو ID هنوز قرار داده نشده باشد،
   بازی آفلاین همچنان قابل اجرا است.
*/

const VIDEO_REQUIRED =
  VIDEO_ID &&
  VIDEO_ID !== "YOUR_VIDEO_ID_HERE";


/* =========================================================
   DOM
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   VIDEO
========================================================= */

let youtubePlayer = null;

let videoFinished = false;

let youtubeReady = false;


/* =========================================================
   YOUTUBE API
========================================================= */

window.onYouTubeIframeAPIReady = function(){

  youtubeReady = true;

  createYoutubePlayer();

};


function createYoutubePlayer(){

  if(!VIDEO_REQUIRED){

    $("videoStatus").textContent =
      "VIDEO ID NOT CONFIGURED";

    $("videoContinue")
      .classList.add("show");

    return;

  }

  if(
    typeof YT === "undefined" ||
    !YT.Player
  ){

    $("videoStatus").textContent =
      "Loading video player...";

    return;

  }


  youtubePlayer =
    new YT.Player(
      "spadesPlayer",
      {

        width:"100%",
        height:"100%",

        videoId:VIDEO_ID,

        playerVars:{
          autoplay:0,
          controls:1,
          rel:0,
          playsinline:1,
          modestbranding:1
        },

        events:{

          onReady:function(){

            $("videoStatus").textContent =
              "Watch the complete video before entering the table.";

          },

          onStateChange:function(event){

            if(
              event.data ===
              YT.PlayerState.PLAYING
            ){

              $("videoStatus").textContent =
                "Video is playing...";

            }


            if(
              event.data ===
              YT.PlayerState.PAUSED
            ){

              $("videoStatus").textContent =
                "Video paused.";

            }


            if(
              event.data ===
              YT.PlayerState.BUFFERING
            ){

              $("videoStatus").textContent =
                "Loading video...";

            }


            if(
              event.data ===
              YT.PlayerState.ENDED
            ){

              videoFinished = true;

              $("videoStatus").textContent =
                "Video completed. Enter the table.";

              $("videoContinue")
                .classList.add("show");

            }

          },

          onError:function(event){

            console.error(
              "YouTube error:",
              event.data
            );

            /*
               Do NOT show the old
               "video has not been configured"
               test-video problem.
            */

            $("videoStatus").textContent =
              "This video cannot be played here. Check the VIDEO_ID.";

          }

        }

      }
    );

}


/* =========================================================
   ENTER TABLE
========================================================= */

function enterGameTable(){

  if(
    VIDEO_REQUIRED &&
    !videoFinished
  ){

    showMessage(
      "Please watch the complete video first."
    );

    return;

  }


  $("videoOverlay")
    .classList.remove("show");


  $("roundNumber").textContent =
    "LOBBY";


  $("mainButton").textContent =
    "START GAME";

}


/* =========================================================
   GAME STATE
========================================================= */

const state = {

  started:false,

  round:0,

  starter:1,

  blueBid:0,

  redBid:0,

  blueTricks:0,

  redTricks:0,

  blueScore:0,

  redScore:0,

  blueRoundScores:[],

  redRoundScores:[],

  deck:[],

  hands:{

    1:[],
    2:[],
    3:[],
    4:[],
    5:[],
    6:[]

  },

  aiMemory:{

    played:[],

    bids:[],

    winners:[]

  }

};


/* =========================================================
   CARD DATA
========================================================= */

const SUITS = [

  {
    name:"spades",
    symbol:"♠",
    color:"black"
  },

  {
    name:"hearts",
    symbol:"♥",
    color:"red"
  },

  {
    name:"diamonds",
    symbol:"♦",
    color:"red"
  },

  {
    name:"clubs",
    symbol:"♣",
    color:"black"
  }

];


const RANKS = [

  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A"

];


/* =========================================================
   CREATE DECK
========================================================= */

function createDeck(){

  const deck = [];


  SUITS.forEach(suit=>{

    RANKS.forEach((rank,index)=>{

      deck.push({

        id:
          suit.name +
          "_" +
          rank,

        suit:suit.name,

        symbol:suit.symbol,

        color:suit.color,

        rank,

        value:index + 2,

        joker:false

      });

    });

  });


  /*
     Real red and black jokers.
  */

  deck.push({

    id:"red_joker",

    suit:"joker",

    symbol:"★",

    color:"red",

    rank:"JOKER",

    value:16,

    joker:true,

    jokerColor:"red"

  });


  deck.push({

    id:"black_joker",

    suit:"joker",

    symbol:"★",

    color:"black",

    rank:"JOKER",

    value:15,

    joker:true,

    jokerColor:"black"

  });


  return deck;

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(array){

  for(
    let i=array.length-1;
    i>0;
    i--
  ){

    const j =
      Math.floor(
        Math.random()*(i+1)
      );

    [
      array[i],
      array[j]
    ] =
    [
      array[j],
      array[i]
    ];

  }

  return array;

}


/* =========================================================
   START GAME
========================================================= */

function startGame(){

  if(
    !videoFinished &&
    VIDEO_REQUIRED
  ){

    $("videoOverlay")
      .classList.add("show");

    showMessage(
      "Watch the video before entering the table."
    );

    return;

  }


  if(state.started){

    return;

  }


  state.started = true;

  state.round = 0;

  state.starter = 1;

  state.blueScore = 0;

  state.redScore = 0;

  state.blueTricks = 0;

  state.redTricks = 0;

  state.blueRoundScores = [];

  state.redRoundScores = [];

  state.aiMemory = {

    played:[],
    bids:[],
    winners:[]

  };


  updateScore();

  updateTop();

  dealNewGame();

}


/* =========================================================
   DEAL NEW GAME
========================================================= */

function dealNewGame(){

  state.deck =
    shuffle(
      createDeck()
    );


  Object.keys(state.hands)
    .forEach(
      player => {
        state.hands[player] = [];
      }
    );


  /*
     54 cards cannot give 9 cards
     to all 6 players.

     Therefore two jokers are kept
     outside the normal 52-card deal
     and are inserted according to
     the game rules.

     For the visual/offline prototype:
     each player receives 9 cards.
  */

  const baseDeck =
    state.deck.filter(
      card => !card.joker
    );


  shuffle(baseDeck);


  for(let p=1;p<=6;p++){

    state.hands[p] =
      baseDeck.slice(
        (p-1)*9,
        p*9
      );

  }


  renderAllHands();


  startDealAnimation();

}


/* =========================================================
   RENDER HANDS
========================================================= */

function renderAllHands(){

  for(let p=1;p<=6;p++){

    renderHand(
      p,
      state.hands[p]
    );

  }

}


function renderHand(
  player,
  cards
){

  const element =
    $("handP"+player);

  if(!element)return;

  element.innerHTML = "";


  cards.forEach(
    (card,index)=>{

      const el =
        createCardElement(card);

      el.style.zIndex =
        index + 1;

      element.appendChild(el);

    }
  );

}


/* =========================================================
   CARD ELEMENT
========================================================= */

function createCardElement(card){

  const el =
    document.createElement("div");

  el.className =
    "card";


  if(card.color === "red"){

    el.classList.add(
      "red-card"
    );

  }


  if(card.joker){

    el.classList.add(
      "joker"
    );

    el.innerHTML = `
      <span class="corner">
        J<br>★
      </span>
      <span class="big-suit">
        ${card.symbol}
      </span>
    `;

    return el;

  }


  el.innerHTML = `
    <span class="corner">
      ${card.rank}<br>${card.symbol}
    </span>

    <span class="big-suit">
      ${card.symbol}
    </span>
  `;


  return el;

}


/* =========================================================
   DEAL ANIMATION
========================================================= */

function startDealAnimation(){

  $("centerText").textContent =
    "DEALING 5 + 4";


  const cards =
    document.querySelectorAll(
      ".hand .card"
    );


  cards.forEach(
    card=>{

      card.style.opacity = "0";

      card.style.transform =
        "translateY(-35px) scale(.7)";

    }
  );


  /*
     First 5 cards.
  */

  for(let i=0;i<5;i++){

    setTimeout(
      ()=>{
        revealCardNumber(i);
      },
      i*90
    );

  }


  /*
     Second 4 cards.
  */

  for(let i=5;i<9;i++){

    setTimeout(
      ()=>{
        revealCardNumber(i);
      },
      700+(i-5)*100
    );

  }


  setTimeout(
    startBidding,
    1600
  );

}


function revealCardNumber(index){

  for(let p=1;p<=6;p++){

    const cards =
      document.querySelectorAll(
        "#handP"+p+" .card"
      );


    if(cards[index]){

      cards[index].style.opacity =
        "1";

      cards[index].style.transform =
        "translateY(0) scale(1)";

    }

  }

}


/* =========================================================
   BIDDING
========================================================= */

function startBidding(){

  $("centerText").textContent =
    "TEAM BIDDING";


  state.blueBid = 0;
  state.redBid = 0;


  buildBidButtons(
    $("blueBidButtons"),
    "blue"
  );

  buildBidButtons(
    $("redBidButtons"),
    "red"
  );


  updateBidTotals();


  $("bidOverlay")
    .classList.add("show");

}


/* =========================================================
   BID BUTTONS
========================================================= */

function buildBidButtons(
  container,
  team
){

  container.innerHTML = "";


  for(let i=0;i<=7;i++){

    const button =
      document.createElement("button");

    button.className =
      "bid-button";

    button.textContent =
      i;


    button.onclick =
      ()=>selectBid(
        team,
        i,
        button
      );


    container.appendChild(
      button
    );

  }

}


/* =========================================================
   SELECT BID
========================================================= */

function selectBid(
  team,
  value,
  button
){

  button.parentElement
    .querySelectorAll(
      ".bid-button"
    )
    .forEach(
      b =>
      b.classList.remove(
        "selected"
      )
    );


  button.classList.add(
    "selected"
  );


  if(team === "blue"){

    state.blueBid =
      value;

  }else{

    state.redBid =
      value;

  }


  /*
     ONLY 7 automatically
     makes the other team 2.
  */

  if(
    team === "blue" &&
    value === 7
  ){

    state.redBid = 2;

    markAutoBid(
      $("redBidButtons"),
      2
    );

  }


  if(
    team === "red" &&
    value === 7
  ){

    state.blueBid = 2;

    markAutoBid(
      $("blueBidButtons"),
      2
    );

  }


  updateBidTotals();

}


/* =========================================================
   AUTO BID
========================================================= */

function markAutoBid(
  container,
  value
){

  container
    .querySelectorAll(
      ".bid-button"
    )
    .forEach(
      button=>{

        const selected =
          Number(
            button.textContent
          ) === value;


        button.classList.toggle(
          "selected",
          selected
        );

        button.classList.toggle(
          "auto",
          selected
        );

      }
    );

}


/* =========================================================
   BID TOTAL
========================================================= */

function updateBidTotals(){

  $("blueBidTotal").textContent =
    state.blueBid;

  $("redBidTotal").textContent =
    state.redBid;

}


/* =========================================================
   CONFIRM BIDS
========================================================= */

function confirmBids(){

  if(
    state.blueBid < 2 &&
    state.redBid < 2
  ){

    showMessage(
      "At least one team must declare 2 or more."
    );

    return;

  }


  state.aiMemory.bids.push({

    round:state.round + 1,

    blue:state.blueBid,

    red:state.redBid

  });


  $("bidOverlay")
    .classList.remove("show");


  startRound();

}


/* =========================================================
   ROUND
========================================================= */

function startRound(){

  state.round++;

  updateTop();

  highlightStarter();

  clearPlayedCards();


  $("centerText").textContent =
    "PLAYER " +
    state.starter +
    " STARTS";


  /*
     Offline AI demonstration.

     Six players play one card
     automatically.
  */

  setTimeout(
    playSmartTrick,
    700
  );

}


/* =========================================================
   SMART TRICK
========================================================= */

function playSmartTrick(){

  const played = [];


  for(let i=0;i<6;i++){

    const player =
      (
        state.starter +
        i -
        1
      ) % 6 + 1;


    const hand =
      state.hands[player];


    if(!hand.length){

      continue;

    }


    const card =
      chooseSmartCard(
        player,
        hand,
        played
      );


    const index =
      hand.indexOf(card);


    if(index >= 0){

      hand.splice(
        index,
        1
      );

    }


    played.push({

      player,
      card

    });


    state.aiMemory.played.push({

      round:state.round,

      player,

      card:card.id

    });


    renderHand(
      player,
      hand
    );


    showPlayedCard(
      i,
      card
    );

  }


  setTimeout(
    ()=>finishTrick(
      played
    ),
    2400
  );

}


/* =========================================================
   SMART AI
========================================================= */

function chooseSmartCard(
  player,
  hand,
  played
){

  /*
     First player:
     prefer a medium card.
  */

  if(!played.length){

    return chooseLeadCard(
      hand
    );

  }


  const leadSuit =
    played[0].card.joker
      ? null
      : played[0].card.suit;


  const sameSuit =
    hand.filter(
      card =>
        !card.joker &&
        card.suit === leadSuit
    );


  /*
     Follow suit if possible.
  */

  if(sameSuit.length){

    /*
       Try not to waste
       the strongest card.
    */

    return sameSuit
      .sort(
        (a,b)=>
        a.value-b.value
      )[0];

  }


  /*
     If no suit, play a
     strong spade when useful.
  */

  const spades =
    hand.filter(
      card =>
        card.suit === "spades"
    );


  if(spades.length){

    return spades
      .sort(
        (a,b)=>
        a.value-b.value
      )[0];

  }


  /*
     Otherwise lowest card.
  */

  return hand
    .slice()
    .sort(
      (a,b)=>
      a.value-b.value
    )[0];

}


function chooseLeadCard(hand){

  const nonSpades =
    hand.filter(
      card =>
        !card.joker &&
        card.suit !== "spades"
    );


  if(nonSpades.length){

    return nonSpades
      .sort(
        (a,b)=>
        a.value-b.value
      )[0];

  }


  return hand
    .slice()
    .sort(
      (a,b)=>
      a.value-b.value
    )[0];

}


/* =========================================================
   PLAY CARD VISUAL
========================================================= */

function showPlayedCard(
  index,
  card
){

  const element =
    document.querySelectorAll(
      ".played-card"
    )[index];


  if(!element)return;


  element.innerHTML = "";


  if(card.joker){

    element.textContent =
      "★";

    element.style.color =
      card.jokerColor === "red"
        ? "#b71919"
        : "#111";

  }else{

    element.textContent =
      card.rank +
      card.symbol;

    element.style.color =
      card.color === "red"
        ? "#b71919"
        : "#111";

  }


  setTimeout(
    ()=>{
      element.classList.add(
        "show"
      );
    },
    index*250
  );

}


/* =========================================================
   TRICK WINNER
========================================================= */

function getTrickWinner(
  played
){

  if(!played.length){
    return null;
  }


  const lead =
    played[0].card;


  let winner =
    played[0];


  played.forEach(
    item=>{

      if(
        beats(
          item.card,
          winner.card,
          lead
        )
      ){

        winner =
          item;

      }

    }
  );


  return winner;

}


/* =========================================================
   CARD COMPARISON
========================================================= */

function beats(
  candidate,
  current,
  lead
){

  /*
     Red Joker
  */

  if(
    candidate.joker &&
    candidate.jokerColor === "red"
  ){

    return !(
      current.joker &&
      current.jokerColor === "red"
    );

  }


  /*
     Current Red Joker
  */

  if(
    current.joker &&
    current.jokerColor === "red"
  ){

    return false;

  }


  /*
     Ace of Spades
  */

  if(
    candidate.suit === "spades" &&
    candidate.rank === "A"
  ){

    if(
      current.joker &&
      current.jokerColor === "black"
    ){

      return true;

    }

    return true;

  }


  /*
     Black Joker
  */

  if(
    candidate.joker &&
    candidate.jokerColor === "black"
  ){

    return !(
      current.joker
    );

  }


  if(
    current.joker
  ){

    return false;

  }


  /*
     Spades trump.
  */

  if(
    candidate.suit === "spades" &&
    current.suit !== "spades"
  ){

    return true;

  }


  if(
    candidate.suit !== "spades" &&
    current.suit === "spades"
  ){

    return false;

  }


  /*
     Must follow lead.
  */

  if(
    candidate.suit === lead.suit &&
    current.suit !== lead.suit
  ){

    return true;

  }


  if(
    candidate.suit !== lead.suit &&
    current.suit === lead.suit
  ){

    return false;

  }


  return candidate.value >
    current.value;

}


/* =========================================================
   FINISH TRICK
========================================================= */

function finishTrick(
  played
){

  const winner =
    getTrickWinner(
      played
    );


  if(!winner){

    return;

  }


  const winningPlayer =
    winner.player;


  state.aiMemory.winners.push({

    round:state.round,

    player:winningPlayer,

    card:winner.card.id

  });


  if(
    [1,3,5].includes(
      winningPlayer
    )
  ){

    state.blueTricks++;

  }else{

    state.redTricks++;

  }


  /*
     The game uses 9 tricks.
     Score is finalized after
     the complete 9-trick round.
  */

  if(
    state.round >= 9
  ){

    finishGame();

    return;

  }


  const roundScoreBlue =
    calculateScore(
      state.blueBid,
      state.blueTricks
    );


  const roundScoreRed =
    calculateScore(
      state.redBid,
      state.redTricks
    );


  state.blueScore =
    roundScoreBlue;

  state.redScore =
    roundScoreRed;


  updateScore();

  showScoreboard(
    roundScoreBlue,
    roundScoreRed
  );

}


/* =========================================================
   SCORE
========================================================= */

function calculateScore(
  bid,
  tricks
){

  /*
     Special 7:
     exactly +140 or -140.
  */

  if(bid === 7){

    return tricks >= 7
      ? 140
      : -140;

  }


  /*
     Missed bid.
  */

  if(tricks < bid){

    return -(bid * 10);

  }


  /*
     Exact bid = bid × 10.
     Every extra trick = +1.
  */

  return (
    bid * 10
  ) +
  (
    tricks - bid
  );

}


/* =========================================================
   SCOREBOARD
========================================================= */

function showScoreboard(
  blueRound,
  redRound
){

  $("scoreSubtitle").textContent =
    "TRICK " +
    state.round +
    " / 9";


  $("scoreBlueBid").textContent =
    state.blueBid;

  $("scoreRedBid").textContent =
    state.redBid;


  $("scoreBlueTricks").textContent =
    state.blueTricks;

  $("scoreRedTricks").textContent =
    state.redTricks;


  $("scoreBlueRound").textContent =
    blueRound;

  $("scoreRedRound").textContent =
    redRound;


  $("scoreBlueTotal").textContent =
    state.blueScore;

  $("scoreRedTotal").textContent =
    state.redScore;


  $("scoreOverlay")
    .classList.add("show");

}


/* =========================================================
   NEXT TRICK
========================================================= */

function nextTrick(){

  $("scoreOverlay")
    .classList.remove("show");


  clearPlayedCards();


  /*
     1 → 2 → 3 → 4 → 5 → 6
  */

  state.starter++;


  if(
    state.starter > 6
  ){

    state.starter = 1;

  }


  startRound();

}


/* =========================================================
   TOP
========================================================= */

function updateTop(){

  if(
    state.round === 0
  ){

    $("roundNumber").textContent =
      "LOBBY";

  }else{

    $("roundNumber").textContent =
      "TRICK " +
      state.round +
      " / 9";

  }

}


/* =========================================================
   SCORE DISPLAY
========================================================= */

function updateScore(){

  $("blueScore").textContent =
    state.blueScore;

  $("redScore").textContent =
    state.redScore;

}


/* =========================================================
   STARTER HIGHLIGHT
========================================================= */

function highlightStarter(){

  document
    .querySelectorAll(
      ".player"
    )
    .forEach(
      p =>
      p.classList.remove(
        "active"
      )
    );


  const player =
    document.querySelector(
      ".p" +
      state.starter
    );


  if(player){

    player.classList.add(
      "active"
    );

  }

}


/* =========================================================
   CLEAR PLAYED
========================================================= */

function clearPlayedCards(){

  document
    .querySelectorAll(
      ".played-card"
    )
    .forEach(
      card=>{

        card.classList.remove(
          "show"
        );

        card.textContent = "";

      }
    );

}


/* =========================================================
   FINAL
========================================================= */

function finishGame(){

  $("scoreOverlay")
    .classList.remove("show");


  /*
     Calculate final score
     from the complete 9 tricks.
  */

  state.blueScore =
    calculateScore(
      state.blueBid,
      state.blueTricks
    );


  state.redScore =
    calculateScore(
      state.redBid,
      state.redTricks
    );


  updateScore();


  $("finalBlueScore").textContent =
    state.blueScore;

  $("finalRedScore").textContent =
    state.redScore;


  $("finalBlueTricks").textContent =
    state.blueTricks +
    " TRICKS WON";

  $("finalRedTricks").textContent =
    state.redTricks +
    " TRICKS WON";


  if(
    state.blueScore >
    state.redScore
  ){

    $("winnerName").textContent =
      "🔵 BLUE TEAM";

  }

  else if(
    state.redScore >
    state.blueScore
  ){

    $("winnerName").textContent =
      "🔴 RED TEAM";

  }

  else{

    $("winnerName").textContent =
      "DRAW";

  }


  $("resultOverlay")
    .classList.add("show");

}


/* =========================================================
   PLAY AGAIN
========================================================= */

function playAgain(){

  location.reload();

}


/* =========================================================
   HOME
========================================================= */

function goHome(){

  window.location.href =
    "index.html";

}


/* =========================================================
   BACK
========================================================= */

function goBack(){

  if(
    $("videoOverlay")
      .classList.contains("show")
  ){

    goHome();

    return;

  }


  if(state.started){

    showMessage(
      "The current game is in progress."
    );

    return;

  }


  goHome();

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
  message
){

  try{

    if(
      tg &&
      typeof tg.showAlert ===
      "function"
    ){

      tg.showAlert(
        message
      );

    }else{

      alert(message);

    }

  }catch(e){

    alert(message);

  }

}


/* =========================================================
   INIT
========================================================= */

function init(){

  updateTop();

  updateScore();

  createHandsForPreview();


  /*
     If video is not configured,
     the offline game remains available.
  */

  if(!VIDEO_REQUIRED){

    videoFinished = true;

    $("videoStatus").textContent =
      "Offline mode ready.";

    $("videoContinue")
      .classList.add("show");

  }

}


function createHandsForPreview(){

  for(let p=1;p<=6;p++){

    const hand =
      $("handP"+p);

    if(!hand)continue;

    hand.innerHTML = "";

    for(let i=0;i<9;i++){

      const card =
        document.createElement("div");

      card.className =
        "card";

      card.style.opacity =
        "0";

      card.textContent =
        "♠";

      hand.appendChild(card);

    }

  }

}


init();
