"use strict";

/*
=========================================================
 SPADES • 6 PLAYER OFFLINE GAME ENGINE
=========================================================

 IMPORTANT:

 - NO YouTube
 - NO YouTube iframe
 - NO external API
 - 6 PLAYERS
 - 6 ROUNDS
 - 9 CARDS PER PLAYER
 - DEAL = 5 + 4
 - STARTERS = P1 → P2 → P3 → P4 → P5 → P6
 - BLUE = P1/P3/P5
 - RED  = P2/P4/P6
 - SMART BALANCED AI
 - CARD MEMORY
 - TEAM SUPPORT
 - JOKERS INCLUDED
 - READY FOR FUTURE SERVER.JS
=========================================================
*/


/* =======================================================
   CONSTANTS
======================================================= */

const GAME_CONFIG = {

  players: 6,

  rounds: 6,

  cardsPerPlayer: 9,

  dealParts: [5, 4],

  tricksPerRound: 9,

  starterOrder: [1,2,3,4,5,6],

  entryCost: 50,

  winnerReward: 100

};


const TEAM = {

  blue: [1,3,5],

  red: [2,4,6]

};


/* =======================================================
   CARD DATA
======================================================= */

const SUITS = [

  {
    key:"spades",
    symbol:"♠",
    color:"black"
  },

  {
    key:"hearts",
    symbol:"♥",
    color:"red"
  },

  {
    key:"diamonds",
    symbol:"♦",
    color:"red"
  },

  {
    key:"clubs",
    symbol:"♣",
    color:"black"
  }

];


const RANKS = [

  {
    rank:"2",
    value:2
  },

  {
    rank:"3",
    value:3
  },

  {
    rank:"4",
    value:4
  },

  {
    rank:"5",
    value:5
  },

  {
    rank:"6",
    value:6
  },

  {
    rank:"7",
    value:7
  },

  {
    rank:"8",
    value:8
  },

  {
    rank:"9",
    value:9
  },

  {
    rank:"10",
    value:10
  },

  {
    rank:"J",
    value:11
  },

  {
    rank:"Q",
    value:12
  },

  {
    rank:"K",
    value:13
  },

  {
    rank:"A",
    value:14
  }

];


/* =======================================================
   STATE
======================================================= */

const state = {

  started:false,

  phase:"idle",

  round:0,

  starter:1,

  trick:0,

  currentPlayer:1,

  currentSuit:null,

  leadPlayer:null,

  deck:[],

  hands:{},

  playedCards:[],

  roundWinner:null,

  blueBid:0,

  redBid:0,

  blueTricks:0,

  redTricks:0,

  blueScore:0,

  redScore:0,

  blueRoundScore:0,

  redRoundScore:0,

  history:[],

  playedMemory:[],

  seenCards:{},

  aiMemory:{},

  players:{}

};


/* =======================================================
   INITIALIZE PLAYERS
======================================================= */

function initializePlayers(){

  state.players = {};

  for(let p=1;p<=6;p++){

    state.players[p] = {

      id:p,

      name:
        p === 1
          ? "You"
          : "Player " + p,

      team:
        TEAM.blue.includes(p)
          ? "blue"
          : "red",

      human:true,

      connected:true,

      isAI:false,

      bid:0,

      tricks:0,

      hand:[]

    };

  }

}


/* =======================================================
   DOM HELPER
======================================================= */

function $(id){

  return document.getElementById(id);

}


/* =======================================================
   SHUFFLE
======================================================= */

function shuffle(array){

  const result =
    array.slice();

  for(
    let i=result.length-1;
    i>0;
    i--
  ){

    const j =
      Math.floor(
        Math.random() * (i+1)
      );

    [
      result[i],
      result[j]
    ] =
    [
      result[j],
      result[i]
    ];

  }

  return result;

}


/* =======================================================
   CREATE DECK
======================================================= */

function createDeck(){

  const deck = [];

  for(const suit of SUITS){

    for(const rank of RANKS){

      deck.push({

        id:
          rank.rank +
          "_" +
          suit.key,

        rank:
          rank.rank,

        value:
          rank.value,

        suit:
          suit.key,

        symbol:
          suit.symbol,

        color:
          suit.color,

        joker:false

      });

    }

  }


  /*
     RED JOKER
  */

  deck.push({

    id:"red_joker",

    rank:"JOKER",

    value:16,

    suit:"joker",

    symbol:"🃏",

    color:"red",

    joker:true,

    jokerColor:"red"

  });


  /*
     BLACK JOKER
  */

  deck.push({

    id:"black_joker",

    rank:"JOKER",

    value:15,

    suit:"joker",

    symbol:"🃏",

    color:"black",

    joker:true,

    jokerColor:"black"

  });


  return shuffle(deck);

}


/* =======================================================
   DEAL 5 + 4
======================================================= */

function dealCards(){

  state.deck =
    createDeck();

  state.hands = {};

  for(let p=1;p<=6;p++){

    state.hands[p] = [];

  }


  /*
     First 5
  */

  dealPart(5);


  /*
     Second 4
  */

  dealPart(4);


  for(let p=1;p<=6;p++){

    state.hands[p] =
      sortHand(
        state.hands[p]
      );

    state.players[p].hand =
      state.hands[p];

  }


  updateAllHands();

}


/* =======================================================
   DEAL PART
======================================================= */

function dealPart(count){

  for(let c=0;c<count;c++){

    for(let p=1;p<=6;p++){

      const card =
        state.deck.pop();

      if(card){

        state.hands[p].push(
          card
        );

      }

    }

  }

}


/* =======================================================
   SORT HAND
======================================================= */

function sortHand(hand){

  const suitOrder = {

    spades:4,

    hearts:3,

    diamonds:2,

    clubs:1,

    joker:5

  };


  return hand
    .slice()
    .sort((a,b)=>{

      if(
        suitOrder[a.suit] !==
        suitOrder[b.suit]
      ){

        return (
          suitOrder[b.suit] -
          suitOrder[a.suit]
        );

      }

      return b.value-a.value;

    });

}


/* =======================================================
   CARD TEXT
======================================================= */

function cardText(card){

  if(!card){

    return "";

  }


  if(card.joker){

    return card.jokerColor === "red"
      ? "🃏"
      : "🃏";

  }


  return (
    card.rank +
    card.symbol
  );

}


/* =======================================================
   CARD CSS
======================================================= */

function cardClass(card){

  if(
    card &&
    card.color === "red"
  ){

    return "red-card";

  }

  return "black-card";

}


/* =======================================================
   UPDATE HANDS
======================================================= */

function updateAllHands(){

  for(let p=1;p<=6;p++){

    const container =
      $("handP"+p);

    if(!container){

      continue;

    }


    container.innerHTML = "";


    const hand =
      state.hands[p] || [];


    /*
       Other players:
       show card backs/count.
    */

    if(p !== 1){

      for(
        let i=0;
        i<hand.length;
        i++
      ){

        const card =
          document.createElement(
            "div"
          );

        card.className =
          "mini-card";

        card.textContent =
          "♠";

        container.appendChild(
          card
        );

      }

      continue;

    }


    /*
       Human player:
       show real cards.
    */

    hand.forEach(
      card=>{

        const el =
          document.createElement(
            "div"
          );

        el.className =
          "mini-card " +
          cardClass(card);

        el.textContent =
          cardText(card);

        container.appendChild(
          el
        );

      }
    );

  }

}


/* =======================================================
   UPDATE SCORE
======================================================= */

function updateScore(){

  if($("blueScore")){

    $("blueScore").textContent =
      state.blueScore;

  }

  if($("redScore")){

    $("redScore").textContent =
      state.redScore;

  }

}


/* =======================================================
   UPDATE TOP
======================================================= */

function updateTop(){

  if($("roundNumber")){

    $("roundNumber").textContent =
      "ROUND " +
      Math.max(
        1,
        state.round
      ) +
      " / " +
      GAME_CONFIG.rounds;

  }

}


/* =======================================================
   STATUS
======================================================= */

function setStatus(text){

  if($("statusLine")){

    $("statusLine").textContent =
      text;

  }

}


/* =======================================================
   START GAME
======================================================= */

function startGame(){

  if(state.started){

    return;

  }


  initializePlayers();


  state.started = true;

  state.phase = "dealing";

  state.round = 1;

  state.starter = 1;

  state.trick = 0;

  state.blueScore = 0;

  state.redScore = 0;

  state.history = [];

  state.playedMemory = [];

  state.seenCards = {};

  state.aiMemory = {};


  updateTop();

  updateScore();

  setStatus(
    "Round 1 • Player 1 starts"
  );


  startRound();

}


/* =======================================================
   START ROUND
======================================================= */

function startRound(){

  if(
    state.round >
    GAME_CONFIG.rounds
  ){

    finishGame();

    return;

  }


  state.phase = "dealing";

  state.trick = 0;

  state.blueTricks = 0;

  state.redTricks = 0;

  state.blueRoundScore = 0;

  state.redRoundScore = 0;

  state.currentSuit = null;

  state.playedCards = [];

  state.roundWinner = null;

  state.currentPlayer =
    state.starter;


  clearPlayedCards();

  highlightStarter();


  showDealAnimation(
    ()=>{
      dealCards();

      startBidding();

    }
  );

}


/* =======================================================
   DEAL ANIMATION
======================================================= */

function showDealAnimation(
  callback
){

  const overlay =
    $("dealOverlay");

  const container =
    $("dealCards");

  if(!overlay){

    callback();

    return;

  }


  overlay.classList.add(
    "show"
  );


  container.innerHTML = "";


  const positions = [];


  /*
     5 cards
  */

  for(let i=0;i<5;i++){

    positions.push({

      x:
        -115 +
        i*58,

      y:
        -55 +
        (i%2)*6,

      r:
        -7 +
        i*3

    });

  }


  /*
     4 cards
  */

  for(let i=0;i<4;i++){

    positions.push({

      x:
        -87 +
        i*58,

      y:
        63 +
        (i%2)*4,

      r:
        -5 +
        i*3

    });

  }


  positions.forEach(
    (pos,i)=>{

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "deal-card";

      card.textContent =
        "♠";


      card.style.setProperty(
        "--x",
        pos.x+"px"
      );

      card.style.setProperty(
        "--y",
        pos.y+"px"
      );

      card.style.setProperty(
        "--r",
        pos.r+"deg"
      );


      container.appendChild(
        card
      );


      setTimeout(
        ()=>{
          card.classList.add(
            "animate"
          );
        },
        i*100
      );

    }
  );


  const continueButton =
    $("dealContinue");

  if(continueButton){

    continueButton.disabled =
      false;

  }

}


/* =======================================================
   FINISH DEAL
======================================================= */

function finishDeal(){

  $("dealOverlay")
    .classList.remove(
      "show"
    );


  startBidding();

}


/* =======================================================
   BIDDING
======================================================= */

function startBidding(){

  state.phase =
    "bidding";


  state.blueBid =
    aiTeamBid(
      "blue"
    );

  state.redBid =
    aiTeamBid(
      "red"
    );


  buildBidButtons(
    $("blueBidButtons"),
    "blue"
  );

  buildBidButtons(
    $("redBidButtons"),
    "red"
  );


  updateBidTotals();


  /*
     Offline demo:
     player 1 uses a sensible AI-assisted
     default declaration.
  */

  const playerBid =
    calculateIndividualBid(
      1
    );


  state.players[1].bid =
    playerBid;


  if(
    state.blueBid < 2
  ){

    state.blueBid =
      Math.max(
        2,
        playerBid
      );

  }


  updateBidTotals();


  $("bidOverlay")
    .classList.add(
      "show"
    );

}


/* =======================================================
   BUILD BID BUTTONS
======================================================= */

function buildBidButtons(
  container,
  team
){

  if(!container){

    return;

  }


  container.innerHTML = "";


  for(let i=0;i<=7;i++){

    const button =
      document.createElement(
        "button"
      );

    button.className =
      "bid-button";

    button.textContent =
      i;


    if(
      (team === "blue" &&
       i === state.blueBid) ||

      (team === "red" &&
       i === state.redBid)
    ){

      button.classList.add(
        "selected"
      );

    }


    button.onclick =
      ()=>{
        selectBid(
          team,
          i,
          button
        );
      };


    container.appendChild(
      button
    );

  }

}


/* =======================================================
   SELECT BID
======================================================= */

function selectBid(
  team,
  value,
  button
){

  const parent =
    button.parentElement;


  parent
    .querySelectorAll(
      ".bid-button"
    )
    .forEach(
      b=>{
        b.classList.remove(
          "selected"
        );
      }
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


  updateBidTotals();

}


/* =======================================================
   BID TOTAL
======================================================= */

function updateBidTotals(){

  if($("blueBidTotal")){

    $("blueBidTotal").textContent =
      state.blueBid;

  }

  if($("redBidTotal")){

    $("redBidTotal").textContent =
      state.redBid;

  }

}


/* =======================================================
   CONFIRM BIDS
======================================================= */

function confirmBids(){

  /*
     At least one team must reach 2.
  */

  if(
    state.blueBid < 2 &&
    state.redBid < 2
  ){

    state.blueBid = 2;

  }


  state.blueBid =
    Math.max(
      0,
      Math.min(
        7,
        state.blueBid
      )
    );


  state.redBid =
    Math.max(
      0,
      Math.min(
        7,
        state.redBid
      )
    );


  /*
     7 is a high-risk declaration.
     Opponent receives minimum 2.
  */

  if(
    state.blueBid === 7
  ){

    state.redBid =
      Math.max(
        2,
        state.redBid
      );

  }


  if(
    state.redBid === 7
  ){

    state.blueBid =
      Math.max(
        2,
        state.blueBid
      );

  }


  $("bidOverlay")
    .classList.remove(
      "show"
    );


  state.phase =
    "playing";


  state.trick = 0;

  state.currentPlayer =
    state.starter;


  setStatus(
    "Bids confirmed • " +
    "Player " +
    state.starter +
    " starts"
  );


  startNextTrick();

}


/* =======================================================
   START TRICK
======================================================= */

function startNextTrick(){

  if(
    state.trick >=
    GAME_CONFIG.tricksPerRound
  ){

    finishRound();

    return;

  }


  state.trick++;

  state.playedCards = [];

  state.currentSuit = null;

  state.leadPlayer =
    state.currentPlayer;


  clearPlayedCards();


  highlightPlayer(
    state.currentPlayer
  );


  setStatus(
    "Trick " +
    state.trick +
    " / 9 • Player " +
    state.currentPlayer +
    " plays"
  );


  playCurrentTurn();

}


/* =======================================================
   CURRENT TURN
======================================================= */

function playCurrentTurn(){

  const player =
    state.currentPlayer;


  if(
    state.players[player].isAI
  ){

    setTimeout(
      ()=>{
        aiPlayTurn(
          player
        );
      },
      600 +
      Math.random()*500
    );

    return;

  }


  /*
     Offline mode:
     AI controls all non-P1 players.
     P1 gets a natural automatic move
     for complete offline testing.
  */

  setTimeout(
    ()=>{
      aiPlayTurn(
        player
      );
    },
    player === 1
      ? 800
      : 550 +
        Math.random()*450
  );

}


/* =======================================================
   LEGAL CARDS
======================================================= */

function getLegalCards(
  player
){

  const hand =
    state.hands[player] || [];


  if(
    !state.currentSuit
  ){

    /*
       Joker cannot lead.
    */

    const nonJoker =
      hand.filter(
        c=>!c.joker
      );


    return nonJoker.length
      ? nonJoker
      : hand.slice(0,1);

  }


  const suitCards =
    hand.filter(
      c=>
        !c.joker &&
        c.suit ===
        state.currentSuit
    );


  if(
    suitCards.length
  ){

    return suitCards;

  }


  /*
     No lead suit:
     any card, including joker.
  */

  return hand.slice();

}


/* =======================================================
   AI PLAY
======================================================= */

function aiPlayTurn(player){

  const legal =
    getLegalCards(
      player
    );


  if(!legal.length){

    return;

  }


  const card =
    chooseBalancedAI(
      player,
      legal
    );


  playCard(
    player,
    card
  );

}


/* =======================================================
   BALANCED SMART AI
======================================================= */

function chooseBalancedAI(
  player,
  legal
){

  if(legal.length === 1){

    return legal[0];

  }


  const team =
    state.players[player].team;


  const teammate =
    getBestTeammate(
      player,
      team
    );


  /*
     If trick is empty:
     lead strategically.
  */

  if(
    state.playedCards.length === 0
  ){

    return chooseLeadCard(
      player,
      legal
    );

  }


  const winner =
    getCurrentTrickWinner();


  /*
     If teammate currently wins:
     conserve strength.
  */

  if(
    winner &&
    state.players[winner.player].team === team
  ){

    return chooseConservativeCard(
      legal
    );

  }


  /*
     Otherwise try to win with
     the cheapest useful card.
  */

  return chooseWinningCard(
    legal
  );

}


/* =======================================================
   AI LEAD
======================================================= */

function chooseLeadCard(
  player,
  legal
){

  const hand =
    state.hands[player];


  /*
     Strong spade lead when needed.
  */

  const spades =
    legal.filter(
      c=>
        c.suit === "spades"
    );


  if(
    spades.length >= 2
  ){

    const highest =
      spades
        .slice()
        .sort(
          (a,b)=>
            b.value-a.value
        )[0];


    /*
       Don't waste Joker on lead.
    */

    if(
      highest &&
      highest.value >= 13
    ){

      return highest;

    }

  }


  /*
     Prefer a suit where the player
     has fewer cards.
  */

  const suits =
    ["hearts","diamonds","clubs","spades"];


  let best = null;


  for(
    const suit of suits
  ){

    const cards =
      legal.filter(
        c=>c.suit===suit
      );


    if(!cards.length){

      continue;

    }


    const candidate =
      cards
        .slice()
        .sort(
          (a,b)=>
            a.value-b.value
        )[0];


    if(
      !best ||
      candidate.value <
      best.value
    ){

      best =
        candidate;

    }

  }


  return best ||
    legal[0];

}


/* =======================================================
   AI CONSERVATIVE
======================================================= */

function chooseConservativeCard(
  legal
){

  /*
     Prefer lowest non-joker.
  */

  const normal =
    legal.filter(
      c=>!c.joker
    );


  if(normal.length){

    return normal
      .slice()
      .sort(
        (a,b)=>
          a.value-b.value
      )[0];

  }


  return legal
    .slice()
    .sort(
      (a,b)=>
        a.value-b.value
    )[0];

}


/* =======================================================
   AI WINNING CARD
======================================================= */

function chooseWinningCard(
  legal
){

  const winning =
    legal.filter(
      card =>
        canCardWinCurrentTrick(
          card
        )
    );


  if(winning.length){

    return winning
      .slice()
      .sort(
        (a,b)=>
          cardStrength(a) -
          cardStrength(b)
      )[0];

  }


  return chooseConservativeCard(
    legal
  );

}


/* =======================================================
   CARD STRENGTH
======================================================= */

function cardStrength(card){

  if(!card){

    return 0;

  }


  if(card.joker){

    return card.value;

  }


  if(
    card.suit === "spades"
  ){

    return 100 +
      card.value;

  }


  return card.value;

}


/* =======================================================
   CAN WIN
======================================================= */

function canCardWinCurrentTrick(
  card
){

  if(
    !state.playedCards.length
  ){

    return true;

  }


  const current =
    getCurrentTrickWinner();


  if(!current){

    return true;

  }


  return compareCards(
    card,
    current.card,
    state.currentSuit
  ) > 0;

}


/* =======================================================
   COMPARE CARDS
======================================================= */

function compareCards(
  a,
  b,
  leadSuit
){

  if(!b){

    return 1;

  }


  if(!a){

    return -1;

  }


  /*
     Red Joker
  */

  if(
    a.joker &&
    a.jokerColor === "red"
  ){

    if(
      b.joker &&
      b.jokerColor === "red"
    ){

      return 0;

    }

    return 1;

  }


  /*
     Red Joker always highest.
  */

  if(
    b.joker &&
    b.jokerColor === "red"
  ){

    return -1;

  }


  /*
     Black Joker
  */

  if(
    a.joker &&
    a.jokerColor === "black"
  ){

    if(
      b.joker
    ){

      return (
        a.value -
        b.value
      );

    }

    return 1;

  }


  if(
    b.joker &&
    b.jokerColor === "black"
  ){

    return -1;

  }


  /*
     Spades trump.
  */

  if(
    a.suit === "spades" &&
    b.suit !== "spades"
  ){

    return 1;

  }


  if(
    a.suit !== "spades" &&
    b.suit === "spades"
  ){

    return -1;

  }


  /*
     Same suit.
  */

  if(
    a.suit === b.suit
  ){

    return (
      a.value -
      b.value
    );

  }


  /*
     Different non-trump suits:
     lead suit wins.
  */

  if(
    a.suit === leadSuit &&
    b.suit !== leadSuit
  ){

    return 1;

  }


  if(
    a.suit !== leadSuit &&
    b.suit === leadSuit
  ){

    return -1;

  }


  return 0;

}


/* =======================================================
   PLAY CARD
======================================================= */

function playCard(
  player,
  card
){

  const hand =
    state.hands[player];


  const index =
    hand.findIndex(
      c=>c.id === card.id
    );


  if(index < 0){

    return;

  }


  /*
     Joker cannot lead.
  */

  if(
    !state.currentSuit &&
    card.joker
  ){

    const alternative =
      hand.find(
        c=>!c.joker
      );

    if(alternative){

      card =
        alternative;

    }

  }


  /*
     Follow suit rule.
  */

  if(
    state.currentSuit
  ){

    const legal =
      getLegalCards(
        player
      );


    if(
      !legal.some(
        c=>c.id===card.id
      )
    ){

      card =
        legal[0];

    }

  }


  /*
     Remove card.
  */

  const realIndex =
    hand.findIndex(
      c=>c.id===card.id
    );


  hand.splice(
    realIndex,
    1
  );


  /*
     Set lead suit.
  */

  if(
    !state.currentSuit &&
    !card.joker
  ){

    state.currentSuit =
      card.suit;

  }


  state.playedCards.push({

    player,

    card

  });


  rememberPlayedCard(
    card
  );


  renderPlayedCard(
    state.playedCards.length-1,
    card
  );


  updateAllHands();


  const next =
    getNextPlayer(
      player
    );


  if(
    state.playedCards.length <
    GAME_CONFIG.players
  ){

    state.currentPlayer =
      next;

    highlightPlayer(
      next
    );


    setStatus(
      "Trick " +
      state.trick +
      " / 9 • Player " +
      next +
      " plays"
    );


    setTimeout(
      playCurrentTurn,
      500
    );


    return;

  }


  /*
     All 6 players played.
  */

  setTimeout(
    finishTrick,
    850
  );

}


/* =======================================================
   NEXT PLAYER
======================================================= */

function getNextPlayer(
  player
){

  return player >= 6
    ? 1
    : player+1;

}


/* =======================================================
   RENDER PLAYED
======================================================= */

function renderPlayedCard(
  index,
  card
){

  const cards =
    document.querySelectorAll(
      ".played-card"
    );


  if(!cards[index]){

    return;

  }


  const el =
    cards[index];


  el.textContent =
    cardText(card);


  el.classList.remove(
    "red-card"
  );


  if(
    card.color === "red"
  ){

    el.classList.add(
      "red-card"
    );

  }


  requestAnimationFrame(
    ()=>{
      el.classList.add(
        "show"
      );
    }
  );

}


/* =======================================================
   FINISH TRICK
======================================================= */

function finishTrick(){

  const winner =
    getCurrentTrickWinner();


  if(!winner){

    return;

  }


  state.roundWinner =
    winner.player;


  const winnerTeam =
    state.players[
      winner.player
    ].team;


  if(
    winnerTeam === "blue"
  ){

    state.blueTricks++;

  }else{

    state.redTricks++;

  }


  /*
     Winner starts next trick.
  */

  state.currentPlayer =
    winner.player;


  setStatus(
    "Player " +
    winner.player +
    " won the trick"
  );


  setTimeout(
    ()=>{
      startNextTrick();
    },
    900
  );

}


/* =======================================================
   CURRENT TRICK WINNER
======================================================= */

function getCurrentTrickWinner(){

  if(
    !state.playedCards.length
  ){

    return null;

  }


  let best =
    state.playedCards[0];


  for(
    let i=1;
    i<state.playedCards.length;
    i++
  ){

    const item =
      state.playedCards[i];


    if(
      compareCards(
        item.card,
        best.card,
        state.currentSuit
      ) > 0
    ){

      best =
        item;

    }

  }


  return best;

}


/* =======================================================
   CARD MEMORY
======================================================= */

function rememberPlayedCard(
  card
){

  state.playedMemory.push(
    card.id
  );


  state.seenCards[
    card.id
  ] = true;


  for(
    const p of Object.keys(
      state.aiMemory
    )
  ){

    state.aiMemory[p] =
      state.playedMemory
        .slice();

  }

}


/* =======================================================
   AI MEMORY
======================================================= */

function getRemainingCards(){

  const deck =
    createFullDeckUnshuffled();


  return deck.filter(
    card =>
      !state.seenCards[
        card.id
      ]
  );

}


/* =======================================================
   FULL DECK FOR MEMORY
======================================================= */

function createFullDeckUnshuffled(){

  const deck = [];


  for(const suit of SUITS){

    for(const rank of RANKS){

      deck.push({

        id:
          rank.rank +
          "_" +
          suit.key,

        rank:
          rank.rank,

        value:
          rank.value,

        suit:
          suit.key,

        symbol:
          suit.symbol,

        color:
          suit.color,

        joker:false

      });

    }

  }


  deck.push({

    id:"red_joker",

    rank:"JOKER",

    value:16,

    suit:"joker",

    symbol:"🃏",

    color:"red",

    joker:true,

    jokerColor:"red"

  });


  deck.push({

    id:"black_joker",

    rank:"JOKER",

    value:15,

    suit:"joker",

    symbol:"🃏",

    color:"black",

    joker:true,

    jokerColor:"black"

  });


  return deck;

}


/* =======================================================
   INDIVIDUAL BID
======================================================= */

function calculateIndividualBid(
  player
){

  const hand =
    state.hands[player] || [];


  if(!hand.length){

    return 2;

  }


  let score = 0;


  for(const card of hand){

    if(card.joker){

      score +=
        card.jokerColor === "red"
          ? 2.2
          : 1.5;

      continue;

    }


    if(
      card.suit === "spades"
    ){

      if(card.value >= 14){

        score += 1.8;

      }else if(card.value >= 12){

        score += 1.1;

      }else if(card.value >= 10){

        score += .65;

      }

    }else{

      if(card.value === 14){

        score += .75;

      }else if(card.value === 13){

        score += .4;

      }

    }

  }


  /*
     Natural balanced bid.
  */

  let bid =
    Math.round(
      score
    );


  return Math.max(
    0,
    Math.min(
      7,
      bid
    )
  );

}


/* =======================================================
   TEAM BID
======================================================= */

function aiTeamBid(
  team
){

  const players =
    TEAM[team];


  let total = 0;


  for(
    const p of players
  ){

    total +=
      calculateIndividualBid(
        p
      );

  }


  /*
     Balanced AI:
     don't blindly overbid.
  */

  if(total > 7){

    total = 7;

  }


  return Math.max(
    2,
    total
  );

}


/* =======================================================
   TEAMMATE
======================================================= */

function getBestTeammate(
  player,
  team
){

  const teammates =
    TEAM[team]
      .filter(
        p=>p!==player
      );


  if(!teammates.length){

    return null;

  }


  return teammates[0];

}


/* =======================================================
   HIGHLIGHT PLAYER
======================================================= */

function highlightPlayer(
  player
){

  document
    .querySelectorAll(
      ".player"
    )
    .forEach(
      el=>{
        el.classList.remove(
          "active"
        );
      }
    );


  const el =
    document.querySelector(
      ".p"+player
    );


  if(el){

    el.classList.add(
      "active"
    );

  }

}


/* =======================================================
   HIGHLIGHT STARTER
======================================================= */

function highlightStarter(){

  highlightPlayer(
    state.starter
  );

}


/* =======================================================
   CLEAR PLAYED
======================================================= */

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


/* =======================================================
   FINISH ROUND
======================================================= */

function finishRound(){

  state.phase =
    "round-result";


  state.blueRoundScore =
    calculateScore(
      state.blueBid,
      state.blueTricks
    );


  state.redRoundScore =
    calculateScore(
      state.redBid,
      state.redTricks
    );


  state.blueScore +=
    state.blueRoundScore;


  state.redScore +=
    state.redRoundScore;


  state.history.push({

    round:
      state.round,

    starter:
      state.starter,

    blueBid:
      state.blueBid,

    redBid:
      state.redBid,

    blueTricks:
      state.blueTricks,

    redTricks:
      state.redTricks,

    blueScore:
      state.blueRoundScore,

    redScore:
      state.redRoundScore

  });


  updateScore();

  showScoreboard();


}


/* =======================================================
   SCORE RULES
======================================================= */

function calculateScore(
  bid,
  tricks
){

  /*
     7 declaration:
     exact +140 / -140
  */

  if(
    bid === 7
  ){

    return tricks >= 7
      ? 140
      : -140;

  }


  /*
     Failed bid
  */

  if(
    tricks < bid
  ){

    return -(bid * 10);

  }


  /*
     Successful bid:
     10 points per bid
     +1 per extra trick
  */

  return (
    bid * 10
  ) +
  (
    tricks - bid
  );

}


/* =======================================================
   SCOREBOARD
======================================================= */

function showScoreboard(){

  if($("scoreSubtitle")){

    $("scoreSubtitle").textContent =
      "ROUND " +
      state.round +
      " / 6";

  }


  if($("scoreBlueBid")){

    $("scoreBlueBid").textContent =
      state.blueBid;

  }

  if($("scoreRedBid")){

    $("scoreRedBid").textContent =
      state.redBid;

  }

  if($("scoreBlueTricks")){

    $("scoreBlueTricks").textContent =
      state.blueTricks;

  }

  if($("scoreRedTricks")){

    $("scoreRedTricks").textContent =
      state.redTricks;

  }

  if($("scoreBlueRound")){

    $("scoreBlueRound").textContent =
      state.blueRoundScore;

  }

  if($("scoreRedRound")){

    $("scoreRedRound").textContent =
      state.redRoundScore;

  }

  if($("scoreBlueTotal")){

    $("scoreBlueTotal").textContent =
      state.blueScore;

  }

  if($("scoreRedTotal")){

    $("scoreRedTotal").textContent =
      state.redScore;

  }


  $("scoreOverlay")
    .classList.add(
      "show"
    );

}


/* =======================================================
   NEXT ROUND
======================================================= */

function nextRound(){

  $("scoreOverlay")
    .classList.remove(
      "show"
    );


  /*
     Exactly 6 rounds.
  */

  if(
    state.round >=
    GAME_CONFIG.rounds
  ){

    finishGame();

    return;

  }


  /*
     Starter:
     1 → 2 → 3 → 4 → 5 → 6
  */

  state.starter++;


  if(
    state.starter > 6
  ){

    state.starter = 1;

  }


  state.round++;


  updateTop();


  startRound();

}


/* =======================================================
   FINAL GAME
======================================================= */

function finishGame(){

  state.phase =
    "finished";


  if($("finalBlueScore")){

    $("finalBlueScore").textContent =
      state.blueScore;

  }

  if($("finalRedScore")){

    $("finalRedScore").textContent =
      state.redScore;

  }

  if($("finalBlueTricks")){

    $("finalBlueTricks").textContent =
      state.history.reduce(
        (sum,r)=>
          sum+r.blueTricks,
        0
      ) +
      " TRICKS";

  }

  if($("finalRedTricks")){

    $("finalRedTricks").textContent =
      state.history.reduce(
        (sum,r)=>
          sum+r.redTricks,
        0
      ) +
      " TRICKS";

  }


  let winner =
    "DRAW";


  if(
    state.blueScore >
    state.redScore
  ){

    winner =
      "🔵 BLUE TEAM";

  }


  if(
    state.redScore >
    state.blueScore
  ){

    winner =
      "🔴 RED TEAM";

  }


  if($("winnerName")){

    $("winnerName").textContent =
      winner;

  }


  $("resultOverlay")
    .classList.add(
      "show"
    );

}


/* =======================================================
   AI TAKEOVER
=======================================================

 Future server.js will call:

   setPlayerAI(playerId, true)

 when a human disconnects.

======================================================= */

function setPlayerAI(
  playerId,
  enabled=true
){

  const player =
    state.players[playerId];


  if(!player){

    return;

  }


  player.isAI =
    enabled;

  player.human =
    !enabled;

  player.connected =
    !enabled;


  const status =
    $("statusP"+playerId);


  if(status){

    status.textContent =
      enabled
        ? "AI • ACTIVE"
        : "HUMAN";

  }

}


/* =======================================================
   HUMAN RECONNECT
======================================================= */

function restoreHumanPlayer(
  playerId
){

  const player =
    state.players[playerId];


  if(!player){

    return;

  }


  player.isAI =
    false;

  player.human =
    true;

  player.connected =
    true;


  const status =
    $("statusP"+playerId);


  if(status){

    status.textContent =
      "HUMAN";

  }

}


/* =======================================================
   RESET
======================================================= */

function playAgain(){

  location.reload();

}


/* =======================================================
   HOME
======================================================= */

function goHome(){

  /*
     No YouTube here.
     Return directly to index.
  */

  window.location.href =
    "index.html";

}


/* =======================================================
   BACK
======================================================= */

function goBack(){

  if(
    state.phase ===
    "finished"
  ){

    goHome();

    return;

  }


  if(
    state.started
  ){

    setStatus(
      "Game is currently in progress"
    );

    return;

  }


  goHome();

}


/* =======================================================
   OFFLINE MODE
======================================================= */

function enableOfflineMode(){

  /*
     P1 is human seat.
     Other seats are simulated AI
     until server.js connects real players.
  */

  for(let p=2;p<=6;p++){

    setPlayerAI(
      p,
      true
    );

  }

}


/* =======================================================
   INITIALIZATION
======================================================= */

function initGame(){

  initializePlayers();

  enableOfflineMode();

  updateTop();

  updateScore();

  updateAllHands();

  setStatus(
    "Offline mode • Ready"
  );

}


/* =======================================================
   GLOBAL EXPORT
=======================================================

 Makes future server.js integration easy.

======================================================= */

window.SpadesGame = {

  state,

  startGame,

  setPlayerAI,

  restoreHumanPlayer,

  getLegalCards,

  playCard,

  calculateScore,

  nextRound,

  finishGame

};


/* =======================================================
   START
======================================================= */

initGame();
