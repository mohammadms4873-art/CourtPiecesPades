/* =========================================================
   SPADES 6 PLAYER
   OFFLINE • REAL CARDS • PROFESSIONAL MEMORY AI
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
   HELPERS
========================================================= */

const $ = id =>
  document.getElementById(id);


/* =========================================================
   VIDEO
========================================================= */

/*
   Replace this with your own YouTube video ID.
*/

const SPADES_VIDEO_ID =
  "M7lc1UVf-VE";

let spadesPlayer = null;

let videoEnded = false;


function onYouTubeIframeAPIReady(){

  if(
    !window.YT ||
    !YT.Player
  ){

    return;

  }

  spadesPlayer =
    new YT.Player(
      "spadesPlayer",
      {

        width:"100%",
        height:"100%",

        videoId:
          SPADES_VIDEO_ID,

        playerVars:{
          autoplay:0,
          controls:1,
          rel:0,
          playsinline:1
        },

        events:{
          onReady:onVideoReady,
          onStateChange:onVideoState,
          onError:onVideoError
        }

      }
    );

}


function onVideoReady(){

  $("videoStatus").textContent =
    "Press play and watch the video before entering the table.";

}


function onVideoState(event){

  if(
    !window.YT ||
    !YT.PlayerState
  ){

    return;

  }

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
      "Complete the video to continue.";

  }

  if(
    event.data ===
    YT.PlayerState.ENDED
  ){

    videoEnded = true;

    $("videoStatus").textContent =
      "Video completed. You can enter the table.";

    $("videoContinue")
      .classList.add("show");

  }

}


function onVideoError(){

  $("videoStatus").textContent =
    "Video could not be played.";

}


function enterGameTable(){

  /*
     During development, videoEnded can be temporarily
     set to true if you want to test the game without video.
  */

  if(!videoEnded){

    showMessage(
      "Please watch the complete video first."
    );

    return;

  }

  $("spadesVideoOverlay")
    .classList.remove("show");

  $("roundNumber").textContent =
    "LOBBY";

  $("mainButton").textContent =
    "START GAME";

}


/* =========================================================
   CARD ENGINE
========================================================= */

const SUITS = [
  "spades",
  "hearts",
  "diamonds",
  "clubs"
];

const SYMBOL = {
  spades:"♠",
  hearts:"♥",
  diamonds:"♦",
  clubs:"♣"
};

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

const RANK_VALUE = {

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


/* =========================================================
   CARD OBJECT
========================================================= */

function makeCard(
  suit,
  rank,
  joker=null
){

  return {

    id:
      joker
        ? joker
        : rank + "_" + suit,

    suit:suit,

    rank:rank,

    joker:joker,

    played:false

  };

}


/* =========================================================
   DECK
========================================================= */

function createDeck(){

  const deck = [];

  for(
    const suit of SUITS
  ){

    for(
      const rank of RANKS
    ){

      deck.push(
        makeCard(
          suit,
          rank
        )
      );

    }

  }

  /*
     Two Jokers
  */

  deck.push(
    makeCard(
      "joker",
      "RJ",
      "red_joker"
    )
  );

  deck.push(
    makeCard(
      "joker",
      "BJ",
      "black_joker"
    )
  );

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
   PLAYER DATA
========================================================= */

const players = [

  {
    id:1,
    name:"YOU",
    team:"blue",
    hand:[]
  },

  {
    id:2,
    name:"PLAYER 2",
    team:"red",
    hand:[]
  },

  {
    id:3,
    name:"PLAYER 3",
    team:"blue",
    hand:[]
  },

  {
    id:4,
    name:"PLAYER 4",
    team:"red",
    hand:[]
  },

  {
    id:5,
    name:"PLAYER 5",
    team:"blue",
    hand:[]
  },

  {
    id:6,
    name:"PLAYER 6",
    team:"red",
    hand:[]
  }

];


/* =========================================================
   GAME STATE
========================================================= */

const state = {

  started:false,

  round:0,

  starter:1,

  currentPlayer:1,

  trick:[],

  leadSuit:null,

  blueBid:2,

  redBid:2,

  blueTricks:0,

  redTricks:0,

  blueScore:0,

  redScore:0,

  blueRoundScores:[],

  redRoundScores:[],

  history:[],

  playedCards:[],

  memory:{

    allPlayed:[],

    bySuit:{
      spades:[],
      hearts:[],
      diamonds:[],
      clubs:[]
    },

    redJokerPlayed:false,

    blackJokerPlayed:false

  }

};


/* =========================================================
   START GAME
========================================================= */

function startGame(){

  if(!videoEnded){

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

  state.currentPlayer = 1;

  state.blueScore = 0;

  state.redScore = 0;

  state.blueTricks = 0;

  state.redTricks = 0;

  state.blueRoundScores = [];

  state.redRoundScores = [];

  state.history = [];

  state.playedCards = [];

  resetMemory();

  dealCards();

  renderAllHands();

  updateScore();

  startBidding();

}


/* =========================================================
   RESET MEMORY
========================================================= */

function resetMemory(){

  state.memory = {

    allPlayed:[],

    bySuit:{
      spades:[],
      hearts:[],
      diamonds:[],
      clubs:[]
    },

    redJokerPlayed:false,

    blackJokerPlayed:false

  };

}


/* =========================================================
   DEAL 5 + 4
========================================================= */

function dealCards(){

  let deck =
    shuffle(
      createDeck()
    );

  players.forEach(
    p => p.hand=[]
  );


  /*
     First 5 cards
  */

  for(
    let n=0;
    n<5;
    n++
  ){

    players.forEach(
      player => {

        player.hand.push(
          deck.pop()
        );

      }
    );

  }


  /*
     Second 4 cards
  */

  for(
    let n=0;
    n<4;
    n++
  ){

    players.forEach(
      player => {

        player.hand.push(
          deck.pop()
        );

      }
    );

  }


  players.forEach(
    p =>
    sortHand(p.hand)
  );

}


/* =========================================================
   SORT HAND
========================================================= */

function sortHand(hand){

  hand.sort(
    (a,b)=>{

      if(a.joker && !b.joker)
        return -1;

      if(!a.joker && b.joker)
        return 1;

      if(a.joker && b.joker){

        return jokerPower(b)
             - jokerPower(a);

      }

      const suitOrder = {
        spades:0,
        hearts:1,
        diamonds:2,
        clubs:3
      };

      if(
        suitOrder[a.suit] !==
        suitOrder[b.suit]
      ){

        return (
          suitOrder[a.suit]
          -
          suitOrder[b.suit]
        );

      }

      return (
        RANK_VALUE[a.rank]
        -
        RANK_VALUE[b.rank]
      );

    }
  );

}


/* =========================================================
   RENDER ALL HANDS
========================================================= */

function renderAllHands(){

  renderHumanHand();

  renderOpponentHand(
    2,
    "handP2"
  );

  renderOpponentHand(
    3,
    null
  );

  renderOpponentHand(
    4,
    "handP4"
  );

  renderOpponentHand(
    5,
    "handP5"
  );

  renderOpponentHand(
    6,
    "handP6"
  );

}


/* =========================================================
   HUMAN HAND
========================================================= */

function renderHumanHand(){

  const container =
    $("humanHand");

  container.innerHTML = "";

  const player =
    players[0];

  player.hand.forEach(
    (card,index)=>{

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "human-card";

      if(
        card.suit === "hearts" ||
        card.suit === "diamonds"
      ){

        el.classList.add(
          "red-suit"
        );

      }else{

        el.classList.add(
          "black-suit"
        );

      }


      if(card.joker){

        el.innerHTML =
          `
          <div class="card-rank">
            ${card.joker === "red_joker"
              ? "JOKER"
              : "JOKER"}
          </div>
          <div class="card-suit">
            🃏
          </div>
          `;

      }else{

        el.innerHTML =
          `
          <div class="card-rank">
            ${card.rank}
          </div>
          <div class="card-suit">
            ${SYMBOL[card.suit]}
          </div>
          `;

      }


      el.dataset.index =
        index;

      el.onclick =
        () =>
        humanPlayCard(index);


      if(
        state.currentPlayer !== 1
      ){

        el.classList.add(
          "illegal"
        );

      }


      container.appendChild(el);

    }
  );

}


/* =========================================================
   OPPONENT HAND
========================================================= */

function renderOpponentHand(
  playerId,
  containerId
){

  if(!containerId){

    return;

  }

  const container =
    $(containerId);

  if(!container){

    return;

  }

  container.innerHTML = "";

  const player =
    players[playerId-1];

  player.hand.forEach(
    card=>{

      const el =
        document.createElement(
          "div"
        );

      el.className =
        "mini-card hidden-card";

      if(card.played){

        el.classList.add(
          "played"
        );

      }

      container.appendChild(
        el
      );

    }
  );

}


/* =========================================================
   BIDDING
========================================================= */

function startBidding(){

  state.blueBid = 2;

  state.redBid =
    calculateAIBid(
      players[1],
      "red"
    );

  if(
    state.redBid === 7
  ){

    state.blueBid = 2;

  }


  buildBlueBidButtons();

  updateBidUI();

  $("bidOverlay")
    .classList.add("show");

}


/* =========================================================
   BLUE BID
========================================================= */

function buildBlueBidButtons(){

  const container =
    $("blueBidButtons");

  container.innerHTML = "";

  for(
    let value=2;
    value<=7;
    value++
  ){

    const button =
      document.createElement(
        "button"
      );

    button.className =
      "bid-button";

    button.textContent =
      value;

    if(
      value === state.blueBid
    ){

      button.classList.add(
        "selected"
      );

    }

    button.onclick =
      ()=>{

        state.blueBid =
          value;

        /*
           7 forces opponent to 2.
        */

        if(value === 7){

          state.redBid = 2;

        }else{

          state.redBid =
            calculateTeamAIBid(
              "red"
            );

        }

        updateBidUI();

      };


    container.appendChild(
      button
    );

  }

}


/* =========================================================
   AI BID
========================================================= */

function calculateAIBid(
  player,
  team
){

  const hand =
    player.hand;

  let strength = 0;

  let spades =
    hand.filter(
      c =>
      c.suit === "spades"
    ).length;

  let jokers =
    hand.filter(
      c => !!c.joker
    ).length;


  hand.forEach(
    card=>{

      if(card.joker){

        strength += 3.5;

        return;

      }

      if(
        card.suit === "spades"
      ){

        if(card.rank === "A")
          strength += 3.4;
        else if(card.rank === "K")
          strength += 2.6;
        else if(card.rank === "Q")
          strength += 1.8;
        else
          strength += .8;

      }else{

        if(card.rank === "A")
          strength += 1.2;

        else if(card.rank === "K")
          strength += .65;

        else if(card.rank === "Q")
          strength += .25;

      }

    }
  );


  strength +=
    spades * .35;

  strength +=
    jokers * 1.3;


  let bid =
    Math.round(
      strength / 2
    );


  bid =
    Math.max(
      2,
      Math.min(
        7,
        bid
      )
    );


  return bid;

}


/* =========================================================
   TEAM AI BID
========================================================= */

function calculateTeamAIBid(team){

  const teamPlayers =
    players.filter(
      p => p.team === team
    );

  let sum = 0;

  teamPlayers.forEach(
    p => {

      sum +=
        calculateAIBid(
          p,
          team
        );

    }
  );


  /*
     Since the team declaration is a single
     target, normalize the individual estimates.
  */

  let bid =
    Math.round(
      sum / 2.7
    );

  return Math.max(
    2,
    Math.min(
      7,
      bid
    )
  );

}


/* =========================================================
   BID UI
========================================================= */

function updateBidUI(){

  $("blueBidTotal").textContent =
    state.blueBid;

  $("redBidTotal").textContent =
    state.redBid;


  document
    .querySelectorAll(
      "#blueBidButtons .bid-button"
    )
    .forEach(
      button=>{

        button.classList.toggle(
          "selected",
          Number(
            button.textContent
          ) === state.blueBid
        );

      }
    );

}


/* =========================================================
   CONFIRM BIDS
========================================================= */

function confirmBids(){

  if(
    state.blueBid < 2 ||
    state.redBid < 2
  ){

    showMessage(
      "Team declaration must be at least 2."
    );

    return;

  }


  if(
    state.blueBid === 7
  ){

    state.redBid = 2;

  }

  else if(
    state.redBid === 7
  ){

    state.blueBid = 2;

  }


  $("bidOverlay")
    .classList.remove("show");


  state.round = 0;

  state.starter = 1;

  state.blueTricks = 0;

  state.redTricks = 0;

  state.currentPlayer = 1;

  updateBidUI();

  startTrick();

}


/* =========================================================
   START TRICK
========================================================= */

function startTrick(){

  state.round++;

  state.trick = [];

  state.leadSuit = null;

  state.currentPlayer =
    state.starter;

  clearPlayedCards();

  highlightCurrentPlayer();

  updateTop();

  $("centerText").textContent =
    "PLAYER " +
    state.starter +
    " STARTS";


  renderAllHands();


  if(
    state.currentPlayer !== 1
  ){

    setTimeout(
      aiTurn,
      850
    );

  }

}


/* =========================================================
   CURRENT PLAYER
========================================================= */

function highlightCurrentPlayer(){

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
      "#player" +
      state.currentPlayer
    );


  if(player){

    player.classList.add(
      "active"
    );

  }

}


/* =========================================================
   HUMAN PLAY
========================================================= */

function humanPlayCard(index){

  if(
    state.currentPlayer !== 1
  ){

    return;

  }


  const player =
    players[0];

  const card =
    player.hand[index];

  if(!card){

    return;

  }


  if(
    !isLegalPlay(
      player,
      card
    )
  ){

    showMessage(
      "You must follow the lead suit if possible."
    );

    return;

  }


  playCard(
    1,
    card
  );

}


/* =========================================================
   LEGAL PLAY
========================================================= */

function isLegalPlay(
  player,
  card
){

  /*
     Joker can never lead a trick.
  */

  if(
    state.trick.length === 0 &&
    card.joker
  ){

    return false;

  }


  if(
    !state.leadSuit
  ){

    return true;

  }


  /*
     Jokers are allowed when void.
  */

  if(card.joker){

    const hasLead =
      player.hand.some(
        c =>
        !c.joker &&
        c.suit ===
        state.leadSuit
      );

    return !hasLead;

  }


  const hasLead =
    player.hand.some(
      c =>
      !c.joker &&
      c.suit ===
      state.leadSuit
    );


  if(!hasLead){

    return true;

  }


  return (
    card.suit ===
    state.leadSuit
  );

}


/* =========================================================
   PLAY CARD
========================================================= */

function playCard(
  playerId,
  card
){

  const player =
    players[playerId-1];

  const index =
    player.hand.findIndex(
      c =>
      c.id === card.id
    );


  if(index < 0){

    return;

  }


  if(
    !isLegalPlay(
      player,
      card
    )
  ){

    return;

  }


  player.hand.splice(
    index,
    1
  );


  card.played = true;


  if(
    state.trick.length === 0
  ){

    if(!card.joker){

      state.leadSuit =
        card.suit;

    }

  }


  state.trick.push({

    playerId:playerId,

    card:card

  });


  rememberCard(card);

  renderAllHands();

  showPlayedCard(
    playerId,
    card
  );


  state.currentPlayer =
    nextPlayer(
      playerId
    );


  highlightCurrentPlayer();


  if(
    state.trick.length === 6
  ){

    setTimeout(
      resolveTrick,
      850
    );

    return;

  }


  $("centerText").textContent =
    "PLAYER " +
    state.currentPlayer +
    " TURN";


  if(
    state.currentPlayer !== 1
  ){

    setTimeout(
      aiTurn,
      550
    );

  }

}


/* =========================================================
   NEXT PLAYER
========================================================= */

function nextPlayer(id){

  return id >= 6
    ? 1
    : id + 1;

}


/* =========================================================
   AI TURN
========================================================= */

function aiTurn(){

  if(
    state.currentPlayer === 1
  ){

    renderHumanHand();

    return;

  }


  const player =
    players[
      state.currentPlayer-1
    ];


  if(!player){

    return;

  }


  const card =
    chooseAIPlay(
      player
    );


  if(card){

    playCard(
      player.id,
      card
    );

  }

}


/* =========================================================
   PROFESSIONAL AI
========================================================= */

function chooseAIPlay(player){

  const legal =
    player.hand.filter(
      card =>
      isLegalPlay(
        player,
        card
      )
    );


  if(!legal.length){

    return player.hand[0];

  }


  /*
     Lead
  */

  if(
    state.trick.length === 0
  ){

    return chooseLeadCard(
      player,
      legal
    );

  }


  /*
     Following
  */

  return chooseFollowingCard(
    player,
    legal
  );

}


/* =========================================================
   LEAD CARD
========================================================= */

function chooseLeadCard(
  player,
  legal
){

  /*
     Professional lead:
     Prefer controlled strong cards,
     but protect high trump cards.
  */

  const nonTrump =
    legal.filter(
      c =>
      !c.joker &&
      c.suit !== "spades"
    );


  const safe =
    nonTrump.length
      ? nonTrump
      : legal;


  safe.sort(
    (a,b)=>
      leadScore(
        a,
        player
      ) -
      leadScore(
        b,
        player
      )
  );


  return safe[0];

}


function leadScore(
  card,
  player
){

  if(card.joker)
    return 100;

  if(card.suit === "spades"){

    if(card.rank === "A")
      return 90;

    if(card.rank === "K")
      return 70;

    return 45 +
      RANK_VALUE[card.rank];

  }


  /*
     High non-trump cards
     can create tricks.
  */

  if(card.rank === "A")
    return 10;

  if(card.rank === "K")
    return 25;

  if(card.rank === "Q")
    return 35;

  return 50 +
    RANK_VALUE[card.rank];

}


/* =========================================================
   FOLLOW CARD
========================================================= */

function chooseFollowingCard(
  player,
  legal
){

  const winning =
    legal.filter(
      card =>
      wouldWinIfPlayed(
        card,
        player.id
      )
    );


  const losing =
    legal.filter(
      card =>
      !wouldWinIfPlayed(
        card,
        player.id
      )
    );


  const team =
    player.team;


  const currentTeamTricks =
    team === "blue"
      ? state.blueTricks
      : state.redTricks;


  const bid =
    team === "blue"
      ? state.blueBid
      : state.redBid;


  const need =
    bid -
    currentTeamTricks;


  /*
     Team still needs tricks:
     try to win.
  */

  if(
    need > 0 &&
    winning.length
  ){

    winning.sort(
      (a,b)=>
        cardPower(a) -
        cardPower(b)
    );

    return winning[0];

  }


  /*
     Team already reached bid:
     avoid unnecessary trick.
  */

  if(
    need <= 0 &&
    losing.length
  ){

    losing.sort(
      (a,b)=>
        discardValue(a) -
        discardValue(b)
    );

    return losing[0];

  }


  /*
     No losing card:
     take cheapest winning card.
  */

  if(winning.length){

    winning.sort(
      (a,b)=>
        cardPower(a) -
        cardPower(b)
    );

    return winning[0];

  }


  return legal[0];

}


/* =========================================================
   CARD POWER
========================================================= */

function cardPower(card){

  if(
    card.joker ===
    "red_joker"
  ){

    return 1000;

  }

  if(
    card.joker ===
    "black_joker"
  ){

    return 800;

  }

  if(
    card.suit ===
    "spades"
  ){

    return 500 +
      RANK_VALUE[card.rank];

  }

  return RANK_VALUE[card.rank];

}


/* =========================================================
   JOKER POWER
========================================================= */

function jokerPower(card){

  if(
    card.joker ===
    "red_joker"
  ){

    return 1000;

  }

  if(
    card.joker ===
    "black_joker"
  ){

    return 800;

  }

  return 0;

}


/* =========================================================
   DISCARD VALUE
========================================================= */

function discardValue(card){

  if(card.joker)
    return 1000;

  if(card.suit === "spades")
    return 500 + RANK_VALUE[card.rank];

  return RANK_VALUE[card.rank];

}


/* =========================================================
   WOULD WIN
========================================================= */

function wouldWinIfPlayed(
  card,
  playerId
){

  const hypothetical =
    state.trick.concat({

      playerId,

      card

    });


  let winner =
    hypothetical[0];


  for(
    let i=1;
    i<hypothetical.length;
    i++
  ){

    const candidate =
      hypothetical[i];


    if(
      beats(
        candidate.card,
        winner.card
      )
    ){

      winner =
        candidate;

    }

  }


  return (
    winner.playerId ===
    playerId
  );

}


/* =========================================================
   CARD COMPARISON
========================================================= */

function beats(
  candidate,
  current
){

  /*
     Red Joker
  */

  if(
    candidate.joker ===
    "red_joker"
  ){

    return (
      current.joker !==
      "red_joker"
    );

  }


  /*
     Current red Joker wins.
  */

  if(
    current.joker ===
    "red_joker"
  ){

    return false;

  }


  /*
     Black Joker
  */

  if(
    candidate.joker ===
    "black_joker"
  ){

    return (
      current.joker !==
      "red_joker" &&
      current.joker !==
      "black_joker"
    );

  }


  if(
    current.joker ===
    "black_joker"
  ){

    return false;

  }


  /*
     Candidate trump.
  */

  if(
    candidate.suit === "spades"
  ){

    if(
      current.suit !== "spades"
    ){

      return true;

    }

    return (
      RANK_VALUE[candidate.rank]
      >
      RANK_VALUE[current.rank]
    );

  }


  /*
     Candidate non-trump
     cannot beat trump.
  */

  if(
    current.suit === "spades"
  ){

    return false;

  }


  /*
     Only same lead suit
     can beat.
  */

  if(
    candidate.suit !==
    current.suit
  ){

    return false;

  }


  return (
    RANK_VALUE[candidate.rank]
    >
    RANK_VALUE[current.rank]
  );

}


/* =========================================================
   RESOLVE TRICK
========================================================= */

function resolveTrick(){

  let winner =
    state.trick[0];


  for(
    let i=1;
    i<state.trick.length;
    i++
  ){

    const candidate =
      state.trick[i];

    if(
      beats(
        candidate.card,
        winner.card
      )
    ){

      winner =
        candidate;

    }

  }


  const winnerPlayer =
    players[
      winner.playerId-1
    ];


  if(
    winnerPlayer.team === "blue"
  ){

    state.blueTricks++;

  }else{

    state.redTricks++;

  }


  $("centerText").textContent =
    "PLAYER " +
    winner.playerId +
    " WINS";


  setTimeout(
    endTrick,
    1000
  );

}


/* =========================================================
   END TRICK
========================================================= */

function endTrick(){

  const blueRound =
    calculateScore(
      state.blueBid,
      state.blueTricks
    ) -
    previousRoundScore(
      state.blueRoundScores
    );


  const redRound =
    calculateScore(
      state.redBid,
      state.redTricks
    ) -
    previousRoundScore(
      state.redRoundScores
    );


  state.blueScore =
    state.blueRoundScores.reduce(
      (a,b)=>a+b,
      0
    ) +
    blueRound;


  state.redScore =
    state.redRoundScores.reduce(
      (a,b)=>a+b,
      0
    ) +
    redRound;


  state.blueRoundScores.push(
    blueRound
  );

  state.redRoundScores.push(
    redRound
  );


  state.history.push({

    trick:state.round,

    blueTricks:state.blueTricks,

    redTricks:state.redTricks,

    blueRound,

    redRound,

    blueTotal:state.blueScore,

    redTotal:state.redScore

  });


  updateScore();


  showScoreboard(
    blueRound,
    redRound
  );

}


/* =========================================================
   PREVIOUS SCORE
========================================================= */

function previousRoundScore(
  history
){

  return history.reduce(
    (a,b)=>a+b,
    0
  );

}


/* =========================================================
   SCORING
========================================================= */

function calculateScore(
  bid,
  tricks
){

  /*
     Special 7:
     exactly +140 / -140.
  */

  if(
    bid === 7
  ){

    return tricks >= 7
      ? 140
      : -140;

  }


  /*
     Bid 2-6.

     Exact:
     bid × 10

     Every extra:
     +1

     Failed:
     -bid × 10
  */

  if(
    tricks < bid
  ){

    return -(bid * 10);

  }


  return (
    bid * 10
  ) +
  (
    tricks - bid
  );

}


/* =========================================================
   SHOW SCOREBOARD
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


  if(
    state.round >= 9
  ){

    $("scoreNextButton").textContent =
      "FINAL RESULT";

  }else{

    $("scoreNextButton").textContent =
      "NEXT TRICK";

  }


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


  if(
    state.round >= 9
  ){

    finishGame();

    return;

  }


  /*
     Starter:
     1 → 2 → 3 → 4 → 5 → 6 → 1
  */

  state.starter =
    nextPlayer(
      state.starter
    );


  startTrick();

}


/* =========================================================
   MEMORY
========================================================= */

function rememberCard(card){

  state.memory.allPlayed.push(
    card
  );


  if(
    card.suit !== "joker" &&
    state.memory.bySuit[card.suit]
  ){

    state.memory.bySuit[
      card.suit
    ].push(card);

  }


  if(
    card.joker === "red_joker"
  ){

    state.memory.redJokerPlayed =
      true;

  }


  if(
    card.joker === "black_joker"
  ){

    state.memory.blackJokerPlayed =
      true;

  }


  /*
     Mark all players' equivalent
     cards as known played.
  */

  players.forEach(
    player=>{

      player.hand.forEach(
        c=>{

          if(
            c.id === card.id
          ){

            c.played = true;

          }

        }
      );

    }
  );

}


/* =========================================================
   PLAYED CARD UI
========================================================= */

function showPlayedCard(
  playerId,
  card
){

  const index =
    state.trick.length-1;

  const elements =
    document.querySelectorAll(
      ".played-card"
    );

  const el =
    elements[index];

  if(!el){

    return;

  }


  el.className =
    "played-card show";


  if(
    card.suit === "hearts" ||
    card.suit === "diamonds"
  ){

    el.classList.add(
      "red-suit"
    );

  }


  if(card.joker){

    el.innerHTML =
      `
      <div>JOKER</div>
      <div>🃏</div>
      `;

  }else{

    el.innerHTML =
      `
      <div>${card.rank}</div>
      <div>${SYMBOL[card.suit]}</div>
      `;

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

        card.className =
          "played-card";

        card.innerHTML = "";

      }
    );

}


/* =========================================================
   UPDATE TOP
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
    $("spadesVideoOverlay")
      .classList.contains("show")
  ){

    goHome();

    return;

  }


  if(
    state.started
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

  renderAllHands();

}


/* =========================================================
   START
========================================================= */

init();
