/* =========================================================
   COURT PIECES PADES
   OFFLINE 6 PLAYER GAME ENGINE
========================================================= */


/* =========================================================
   CONSTANTS
========================================================= */

const VIDEO_CHANNEL =
  "https://www.youtube.com/@CourtPiecesPades";

const STORAGE_KEY =
  "courtPiecesPadesOfflineGame";

const VIDEO_KEY =
  "courtPiecesPadesVideoOpened";


const PLAYERS = [
  {
    id:1,
    name:"You",
    team:"blue"
  },
  {
    id:2,
    name:"Player 2",
    team:"red"
  },
  {
    id:3,
    name:"Player 3",
    team:"blue"
  },
  {
    id:4,
    name:"Player 4",
    team:"red"
  },
  {
    id:5,
    name:"Player 5",
    team:"blue"
  },
  {
    id:6,
    name:"Player 6",
    team:"red"
  }
];


const SUITS = [
  "♠",
  "♥",
  "♦",
  "♣"
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
   STATE
========================================================= */

const state = {

  started:false,

  round:0,

  starter:1,

  currentPlayer:1,

  phase:"video",

  blueBid:0,

  redBid:0,

  blueTricks:0,

  redTricks:0,

  blueScore:0,

  redScore:0,

  blueRoundScore:0,

  redRoundScore:0,

  deck:[],

  hands:{},

  trick:[],

  trickNumber:0,

  bidLocked:false,

  playing:false,

  saved:false

};


/* =========================================================
   DOM
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   TELEGRAM OPTIONAL
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
   INIT
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


function init(){

  setupBidButtons();

  createEmptyHands();

  restoreState();

  updateTop();

  updateScore();

  updatePlayers();

  updateVideoButton();

}


/* =========================================================
   VIDEO
========================================================= */

function updateVideoButton(){

  const button =
    $("videoContinue");

  if(!button){
    return;
  }

  /*
     Offline version cannot verify
     actual YouTube watch completion.

     Opening the channel marks
     the video step as completed.
  */

  if(
    localStorage.getItem(
      VIDEO_KEY
    ) === "1"
  ){

    button.textContent =
      "ENTER TABLE";

  }else{

    button.textContent =
      "I WATCHED THE VIDEO • ENTER TABLE";

  }

}


function markVideoOpened(){

  localStorage.setItem(
    VIDEO_KEY,
    "1"
  );

  updateVideoButton();

}


function enterGameTable(){

  /*
     Offline mode:
     user must first open the
     official YouTube channel.
  */

  const opened =
    localStorage.getItem(
      VIDEO_KEY
    );

  if(opened !== "1"){

    showMessage(
      "Please open the official YouTube channel and watch the video first."
    );

    return;

  }


  $("videoOverlay")
    .classList.remove("show");


  state.phase =
    "lobby";

  updateTop();

  saveState();

}


/* =========================================================
   START GAME
========================================================= */

function startGame(){

  if(state.started){

    return;

  }


  state.started = true;

  state.phase =
    "dealing";

  state.round = 0;

  state.starter = 1;

  state.currentPlayer = 1;

  state.blueScore = 0;

  state.redScore = 0;

  state.blueTricks = 0;

  state.redTricks = 0;

  state.blueRoundScore = 0;

  state.redRoundScore = 0;

  state.trick = [];

  state.trickNumber = 0;

  buildDeck();

  shuffleDeck();

  dealNineCards();

  updateTop();

  updateScore();

  updatePlayers();

  saveState();

  startDealAnimation();

}


/* =========================================================
   DECK
========================================================= */

function buildDeck(){

  state.deck = [];

  /*
     52 standard cards
  */

  SUITS.forEach(suit => {

    RANKS.forEach(rank => {

      state.deck.push({

        id:
          rank +
          suit,

        rank:rank,

        suit:suit,

        joker:null

      });

    });

  });


  /*
     Two jokers
  */

  state.deck.push({

    id:"RED_JOKER",

    rank:"JOKER",

    suit:null,

    joker:"red"

  });


  state.deck.push({

    id:"BLACK_JOKER",

    rank:"JOKER",

    suit:null,

    joker:"black"

  });

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffleDeck(){

  for(
    let i =
      state.deck.length - 1;
    i > 0;
    i--
  ){

    const j =
      Math.floor(
        Math.random() *
        (i + 1)
      );

    [
      state.deck[i],
      state.deck[j]
    ] =
    [
      state.deck[j],
      state.deck[i]
    ];

  }

}


/* =========================================================
   DEAL 9 EACH
========================================================= */

function dealNineCards(){

  state.hands = {};

  PLAYERS.forEach(player => {

    state.hands[player.id] = [];

  });


  /*
     First 5 cards
  */

  for(
    let cardNo = 0;
    cardNo < 5;
    cardNo++
  ){

    PLAYERS.forEach(player => {

      state.hands[player.id]
        .push(
          state.deck.shift()
        );

    });

  }


  /*
     Next 4 cards
  */

  for(
    let cardNo = 0;
    cardNo < 4;
    cardNo++
  ){

    PLAYERS.forEach(player => {

      state.hands[player.id]
        .push(
          state.deck.shift()
        );

    });

  }


  renderHands();

}


/* =========================================================
   DEAL ANIMATION
========================================================= */

function startDealAnimation(){

  $("dealOverlay")
    .classList.add("show");


  const container =
    $("dealCards");

  container.innerHTML = "";


  const positions = [

    [-130,-65,-8],
    [-90,-80,-5],
    [-50,-92,-3],
    [-10,-100,0],
    [30,-92,3],
    [70,-80,5],
    [110,-65,8],

    [-80,70,-5],
    [0,86,0],
    [80,70,5]

  ];


  positions.forEach(
    (p,index)=>{

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "deal-card";

      card.textContent =
        index % 2 === 0
          ? "♠"
          : "A";


      card.style.setProperty(
        "--x",
        p[0] + "px"
      );

      card.style.setProperty(
        "--y",
        p[1] + "px"
      );

      card.style.setProperty(
        "--r",
        p[2] + "deg"
      );


      container.appendChild(card);


      setTimeout(
        ()=>{
          card.classList.add(
            "animate"
          );
        },
        index * 100
      );

    }
  );

}


function finishDeal(){

  $("dealOverlay")
    .classList.remove("show");


  state.phase =
    "bidding";


  state.trickNumber = 0;

  state.blueBid = 0;

  state.redBid = 0;

  state.bidLocked = false;

  updateTop();

  startBidding();

  saveState();

}


/* =========================================================
   HAND RENDERING
========================================================= */

function createEmptyHands(){

  for(
    let i=1;
    i<=6;
    i++
  ){

    const hand =
      $("handP" + i);

    if(hand){

      hand.innerHTML = "";

    }

  }

}


function renderHands(){

  createEmptyHands();


  PLAYERS.forEach(
    player=>{

      const hand =
        $("handP" + player.id);

      if(!hand){
        return;
      }


      if(player.id === 4){

        hand.classList.add(
          "bottom-hand"
        );

      }


      const cards =
        state.hands[player.id] ||
        [];


      cards.forEach(
        (card,index)=>{

          const el =
            createCardElement(
              card
            );

          el.dataset.index =
            index;

          if(player.id === 4){

            el.onclick =
              ()=>{
                playHumanCard(index);
              };

          }


          hand.appendChild(el);

        }
      );

    }
  );

}


function createCardElement(card){

  const el =
    document.createElement("div");

  el.className =
    "card";


  if(card.joker === "red"){

    el.classList.add(
      "joker-red"
    );

    el.textContent =
      "🃏";

    return el;

  }


  if(card.joker === "black"){

    el.classList.add(
      "joker-black"
    );

    el.textContent =
      "🃏";

    return el;

  }


  if(
    card.suit === "♥" ||
    card.suit === "♦"
  ){

    el.classList.add(
      "red"
    );

  }else{

    el.classList.add(
      "black"
    );

  }


  el.textContent =
    card.rank +
    card.suit;


  return el;

}


/* =========================================================
   BIDDING
========================================================= */

function setupBidButtons(){

  document
    .querySelectorAll(
      ".bid-button"
    )
    .forEach(button=>{

      button.addEventListener(
        "click",
        ()=>{

          const team =
            button.dataset.team;

          const value =
            Number(
              button.dataset.value
            );

          selectBid(
            team,
            value
          );

        }
      );

    });

}


function selectBid(
  team,
  value
){

  if(state.bidLocked){
    return;
  }


  if(team === "blue"){

    state.blueBid =
      value;

    highlightBid(
      "blue",
      value
    );


    if(value === 7){

      state.redBid = 2;

      highlightBid(
        "red",
        2,
        true
      );

    }

  }else{

    state.redBid =
      value;

    highlightBid(
      "red",
      value
    );


    if(value === 7){

      state.blueBid = 2;

      highlightBid(
        "blue",
        2,
        true
      );

    }

  }


  /*
     If previously 7 is cancelled,
     the other team can be changed again.
  */

  if(
    state.blueBid !== 7 &&
    state.redBid !== 7
  ){

    document
      .querySelectorAll(
        ".bid-button.auto"
      )
      .forEach(
        b =>
        b.classList.remove(
          "auto"
        )
      );

  }


  updateBidTotals();

}


function highlightBid(
  team,
  value,
  automatic=false
){

  document
    .querySelectorAll(
      `.bid-button[data-team="${team}"]`
    )
    .forEach(
      button=>{

        const selected =
          Number(
            button.dataset.value
          ) === value;

        button.classList.toggle(
          "selected",
          selected
        );


        button.classList.toggle(
          "auto",
          selected &&
          automatic
        );

      }
    );

}


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


  if(
    state.blueBid === 7
  ){

    state.redBid = 2;

  }


  if(
    state.redBid === 7
  ){

    state.blueBid = 2;

  }


  state.bidLocked =
    true;


  $("bidOverlay")
    .classList.remove("show");


  state.phase =
    "playing";

  state.round++;

  state.trick = [];

  state.currentPlayer =
    state.starter;

  state.playing = true;

  state.trickNumber = 0;

  updateTop();

  updatePlayers();

  renderHands();

  $("centerText").textContent =
    "PLAYER " +
    state.starter +
    " STARTS";


  saveState();


  /*
     If player 1 is not the
     human seat, bot starts.
     Human seat is Player 4.
  */

  continuePlay();

}


/* =========================================================
   PLAY LOOP
========================================================= */

function continuePlay(){

  if(
    state.trick.length >= 6
  ){

    resolveTrick();

    return;

  }


  updatePlayers();


  if(
    state.currentPlayer === 4
  ){

    /*
       Human player.
       Wait for card click.
    */

    $("centerText").textContent =
      "YOUR TURN";

    return;

  }


  $("centerText").textContent =
    "PLAYER " +
    state.currentPlayer;


  setTimeout(
    botPlay,
    500
  );

}


/* =========================================================
   HUMAN CARD
========================================================= */

function playHumanCard(index){

  if(
    !state.playing ||
    state.currentPlayer !== 4
  ){

    return;

  }


  const hand =
    state.hands[4];


  if(
    !hand ||
    !hand[index]
  ){

    return;

  }


  const card =
    hand[index];


  if(
    !isLegalCard(
      card,
      hand
    )
  ){

    showMessage(
      "You must follow the suit if possible."
    );

    return;

  }


  playCard(
    4,
    index
  );

}


/* =========================================================
   BOT
========================================================= */

function botPlay(){

  if(
    !state.playing
  ){

    return;

  }


  const player =
    state.currentPlayer;


  if(player === 4){

    return;

  }


  const hand =
    state.hands[player];


  if(
    !hand ||
    !hand.length
  ){

    return;

  }


  const legal =
    getLegalCards(
      hand
    );


  if(!legal.length){
    return;
  }


  const selected =
    chooseSmartCard(
      player,
      legal
    );


  const index =
    hand.indexOf(
      selected
    );


  playCard(
    player,
    index
  );

}


/* =========================================================
   PLAY CARD
========================================================= */

function playCard(
  playerId,
  cardIndex
){

  const hand =
    state.hands[playerId];


  if(
    !hand ||
    !hand[cardIndex]
  ){

    return;

  }


  const card =
    hand[cardIndex];


  if(
    !isLegalCard(
      card,
      hand
    )
  ){

    return;

  }


  hand.splice(
    cardIndex,
    1
  );


  state.trick.push({

    player:playerId,

    card:card

  });


  showPlayedCard(
    state.trick.length - 1,
    card
  );


  state.currentPlayer =
    nextPlayer(
      playerId
    );


  renderHands();

  saveState();


  if(
    state.trick.length === 6
  ){

    setTimeout(
      resolveTrick,
      900
    );

    return;

  }


  continuePlay();

}


/* =========================================================
   NEXT PLAYER
========================================================= */

function nextPlayer(
  player
){

  return player >= 6
    ? 1
    : player + 1;

}


/* =========================================================
   LEGAL CARDS
========================================================= */

function getLegalCards(
  hand
){

  if(
    state.trick.length === 0
  ){

    /*
       Joker cannot lead.
       If only jokers remain,
       player is forced to use one.
    */

    const nonJoker =
      hand.filter(
        card =>
          !card.joker
      );

    return nonJoker.length
      ? nonJoker
      : hand;

  }


  const leadCard =
    state.trick[0].card;


  /*
     Joker is always playable
     after a suit has been led.
  */

  const suit =
    leadCard.suit;


  if(!suit){

    return hand;

  }


  const matching =
    hand.filter(
      card =>
        card.suit === suit
    );


  return matching.length
    ? matching
    : hand;

}


function isLegalCard(
  card,
  hand
){

  const legal =
    getLegalCards(
      hand
    );

  return legal.includes(
    card
  );

}


/* =========================================================
   SMART BOT
========================================================= */

function chooseSmartCard(
  player,
  legal
){

  /*
     First player:
     avoid wasting strongest cards.
  */

  if(
    state.trick.length === 0
  ){

    const normal =
      legal.filter(
        c =>
          !c.joker &&
          c.suit !== "♠"
      );


    if(normal.length){

      return normal[
        Math.floor(
          Math.random() *
          normal.length
        )
      ];

    }


    return legal[0];

  }


  const winningNow =
    currentWinningCard();


  /*
     Try to win with the
     smallest possible card.
  */

  const winningCards =
    legal.filter(
      card =>
        compareCards(
          card,
          winningNow,
          state.trick[0].card.suit
        ) > 0
    );


  if(winningCards.length){

    winningCards.sort(
      (a,b)=>
        cardPower(a) -
        cardPower(b)
    );

    return winningCards[0];

  }


  /*
     Otherwise discard weakest.
  */

  const sorted =
    [...legal].sort(
      (a,b)=>
        cardPower(a) -
        cardPower(b)
    );

  return sorted[0];

}


/* =========================================================
   CARD POWER
========================================================= */

function cardPower(card){

  if(
    card.joker === "red"
  ){

    return 1000;

  }

  if(
    card.rank === "A" &&
    card.suit === "♠"
  ){

    return 900;

  }

  if(
    card.joker === "black"
  ){

    return 850;

  }

  if(
    card.rank === "K" &&
    card.suit === "♠"
  ){

    return 800;

  }

  const values = {

    "2":2,
    "3":3,
    "4":4,
    "5":5,
    "6":6,
    "7":7,
    "8":8,
    "9":9,
    "10":10,
    "J":11,
    "Q":12,
    "K":13,
    "A":14

  };


  return values[
    card.rank
  ] || 0;

}


/* =========================================================
   CURRENT WINNER
========================================================= */

function currentWinningCard(){

  if(!state.trick.length){
    return null;
  }


  let winner =
    state.trick[0].card;


  const lead =
    state.trick[0].card.suit;


  state.trick
    .slice(1)
    .forEach(
      item=>{

        if(
          compareCards(
            item.card,
            winner,
            lead
          ) > 0
        ){

          winner =
            item.card;

        }

      }
    );


  return winner;

}


/* =========================================================
   COMPARE CARDS
========================================================= */

function compareCards(
  a,
  b,
  leadSuit
){

  if(
    a.joker === "red"
  ){

    if(
      b.joker === "red"
    ){

      return 0;

    }

    return 1;

  }


  if(
    b.joker === "red"
  ){

    return -1;

  }


  /*
     Ace of spades
     is below red joker.
  */

  if(
    a.rank === "A" &&
    a.suit === "♠"
  ){

    if(
      b.rank === "A" &&
      b.suit === "♠"
    ){

      return 0;

    }

    if(
      b.joker === "black"
    ){

      return 1;

    }

    return 1;

  }


  if(
    b.rank === "A" &&
    b.suit === "♠"
  ){

    if(
      a.joker === "black"
    ){

      return -1;

    }

    return -1;

  }


  /*
     Black joker.
  */

  if(
    a.joker === "black"
  ){

    return b.joker === "black"
      ? 0
      : 1;

  }


  if(
    b.joker === "black"
  ){

    return -1;

  }


  /*
     Spade trump.
  */

  if(
    a.suit === "♠" &&
    b.suit !== "♠"
  ){

    return 1;

  }


  if(
    b.suit === "♠" &&
    a.suit !== "♠"
  ){

    return -1;

  }


  /*
     Different non-trump suits.
  */

  if(
    a.suit !== b.suit
  ){

    if(
      a.suit === leadSuit
    ){

      return 1;

    }

    if(
      b.suit === leadSuit
    ){

      return -1;

    }

    return 0;

  }


  return (
    cardPower(a) -
    cardPower(b)
  );

}


/* =========================================================
   SHOW PLAYED CARD
========================================================= */

function showPlayedCard(
  position,
  card
){

  const cards =
    document.querySelectorAll(
      ".played-card"
    );


  const el =
    cards[position];


  if(!el){
    return;
  }


  el.className =
    "played-card show";


  if(
    card.suit === "♥" ||
    card.suit === "♦" ||
    card.joker === "red"
  ){

    el.classList.add(
      "red"
    );

  }


  if(card.joker){

    el.textContent =
      card.joker === "red"
        ? "🃏"
        : "🃏";

  }else{

    el.textContent =
      card.rank +
      card.suit;

  }

}


/* =========================================================
   RESOLVE TRICK
========================================================= */

function resolveTrick(){

  if(
    state.trick.length !== 6
  ){

    return;

  }


  const lead =
    state.trick[0].card.suit;


  let winner =
    state.trick[0];


  state.trick
    .slice(1)
    .forEach(
      item=>{

        if(
          compareCards(
            item.card,
            winner.card,
            lead
          ) > 0
        ){

          winner =
            item;

        }

      }
    );


  const winnerTeam =
    getTeam(
      winner.player
    );


  if(
    winnerTeam === "blue"
  ){

    state.blueTricks++;

  }else{

    state.redTricks++;

  }


  state.starter =
    winner.player;


  state.currentPlayer =
    winner.player;


  state.trick = [];

  state.trickNumber++;


  updateScore();

  updateTop();

  saveState();


  /*
     Show a short result before
     next trick.
  */

  $("centerText").textContent =
    "PLAYER " +
    winner.player +
    " WINS";


  setTimeout(
    ()=>{

      clearPlayedCards();

      renderHands();

      if(
        state.trickNumber >= 9
      ){

        finishRound();

      }else{

        continuePlay();

      }

    },
    850
  );

}


/* =========================================================
   FINISH ROUND
========================================================= */

function finishRound(){

  state.playing = false;

  state.phase =
    "score";


  const blueRound =
    calculateScore(
      state.blueBid,
      state.blueTricks
    );


  const redRound =
    calculateScore(
      state.redBid,
      state.redTricks
    );


  state.blueRoundScore =
    blueRound;

  state.redRoundScore =
    redRound;


  state.blueScore +=
    blueRound;

  state.redScore +=
    redRound;


  updateScore();

  showScoreboard(
    blueRound,
    redRound
  );


  saveState();

}


/* =========================================================
   SCORE RULES
========================================================= */

function calculateScore(
  bid,
  tricks
){

  /*
     Special rule for 7.

     Exactly:
     +140 when team gets 7 or more.
     -140 when team fails.
  */

  if(
    bid === 7
  ){

    return tricks >= 7
      ? 140
      : -140;

  }


  /*
     1 to 6:

     Failed bid:
     - bid × 10

     Successful:
     bid × 10
     + 1 for every extra trick.
  */

  if(
    tricks < bid
  ){

    return -(
      bid * 10
    );

  }


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
    "9 TRICKS COMPLETED";


  $("scoreBlueBid").textContent =
    state.blueBid;

  $("scoreRedBid").textContent =
    state.redBid;


  $("scoreBlueTricks").textContent =
    state.blueTricks;

  $("scoreRedTricks").textContent =
    state.redTricks;


  $("scoreBlueRound").textContent =
    formatScore(
      blueRound
    );

  $("scoreRedRound").textContent =
    formatScore(
      redRound
    );


  $("scoreBlueTotal").textContent =
    state.blueScore;

  $("scoreRedTotal").textContent =
    state.redScore;


  $("scoreOverlay")
    .classList.add("show");

}


function formatScore(score){

  return score > 0
    ? "+" + score
    : score;

}


/* =========================================================
   NEXT ROUND
========================================================= */

function nextTrick(){

  $("scoreOverlay")
    .classList.remove("show");


  if(
    state.round >= 9
  ){

    finishGame();

    return;

  }


  /*
     New round starts with:
     1 → 2 → 3 → 4 → 5 → 6
  */

  state.starter++;

  if(
    state.starter > 6
  ){

    state.starter = 1;

  }


  state.round++;

  state.phase =
    "dealing";

  state.trickNumber = 0;

  state.blueTricks = 0;

  state.redTricks = 0;

  state.blueBid = 0;

  state.redBid = 0;

  state.bidLocked = false;

  buildDeck();

  shuffleDeck();

  dealNineCards();

  updateTop();

  renderHands();

  saveState();

  startDealAnimation();

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

        card.className =
          "played-card";

        card.textContent =
          "";

      }
    );

}


/* =========================================================
   PLAYER TEAM
========================================================= */

function getTeam(
  player
){

  return (
    player === 1 ||
    player === 3 ||
    player === 5
  )
    ? "blue"
    : "red";

}


/* =========================================================
   PLAYER UI
========================================================= */

function updatePlayers(){

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


  if(
    state.playing
  ){

    const player =
      document.querySelector(
        ".p" +
        state.currentPlayer
      );

    if(player){

      player.classList.add(
        "active"
      );

    }

  }

}


/* =========================================================
   TOP
========================================================= */

function updateTop(){

  if(
    state.phase === "video"
  ){

    $("roundNumber").textContent =
      "VIDEO";

    return;

  }


  if(
    state.phase === "lobby"
  ){

    $("roundNumber").textContent =
      "LOBBY";

    return;

  }


  if(
    state.round > 0
  ){

    $("roundNumber").textContent =
      "ROUND " +
      state.round +
      " / 9";

  }

}


/* =========================================================
   SCORE
========================================================= */

function updateScore(){

  $("blueScore").textContent =
    state.blueScore;

  $("redScore").textContent =
    state.redScore;

}


/* =========================================================
   FINAL RESULT
========================================================= */

function finishGame(){

  state.phase =
    "finished";

  state.started =
    false;

  state.playing =
    false;


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


  saveState();

}


/* =========================================================
   PLAY AGAIN
========================================================= */

function playAgain(){

  localStorage.removeItem(
    STORAGE_KEY
  );


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


  if(
    state.started &&
    state.playing
  ){

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

      alert(
        message
      );

    }

  }catch(e){

    alert(
      message
    );

  }

}


/* =========================================================
   SAVE
========================================================= */

function saveState(){

  try{

    const data = {

      started:
        state.started,

      round:
        state.round,

      starter:
        state.starter,

      currentPlayer:
        state.currentPlayer,

      phase:
        state.phase,

      blueBid:
        state.blueBid,

      redBid:
        state.redBid,

      blueTricks:
        state.blueTricks,

      redTricks:
        state.redTricks,

      blueScore:
        state.blueScore,

      redScore:
        state.redScore,

      blueRoundScore:
        state.blueRoundScore,

      redRoundScore:
        state.redRoundScore,

      hands:
        state.hands,

      trick:
        state.trick,

      trickNumber:
        state.trickNumber

    };


    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );


    state.saved = true;

  }catch(e){

    console.log(
      "Save error:",
      e
    );

  }

}


/* =========================================================
   RESTORE
========================================================= */

function restoreState(){

  try{

    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );


    if(!raw){

      return;

    }


    const saved =
      JSON.parse(raw);


    if(!saved){

      return;

    }


    /*
       Do not restore an active
       mid-trick game automatically.
       The player can start a fresh
       offline match.
    */

  }catch(e){

    console.log(
      "Restore error:",
      e
    );

  }

}
