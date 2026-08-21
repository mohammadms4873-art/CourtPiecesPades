/* =========================================================
   SPADES 6 PLAYER
   GAME.JS
   BALANCED TEAM AI
   =========================================================

   RULES
   ---------------------------------------------------------
   PLAYERS:
   1, 2, 3, 4, 5, 6

   BLUE TEAM:
   1, 3, 5

   RED TEAM:
   2, 4, 6

   GAME:
   6 ROUNDS

   CARDS:
   9 CARDS PER PLAYER

   STARTERS:
   ROUND 1 -> PLAYER 1
   ROUND 2 -> PLAYER 2
   ROUND 3 -> PLAYER 3
   ROUND 4 -> PLAYER 4
   ROUND 5 -> PLAYER 5
   ROUND 6 -> PLAYER 6

   TRUMP:
   SPADES

   BID:
   0 - 7

   SPECIAL:
   If one team declares 7,
   the other team becomes 2.

   SCORE:
   BID 1-6:
      exact = bid * 10
      extra = +1 each

   BID 7:
      win = +140
      lose = -140

   ========================================================= */


/* =========================================================
   GLOBAL CONFIG
========================================================= */

const GAME_CONFIG = {

  players: 6,

  cardsPerPlayer: 9,

  rounds: 6,

  tricksPerRound: 9,

  trump: "S",

  maxBid: 7,

  minTeamBid: 2,

  specialSevenScore: 140,

  extraTrickScore: 1,

  normalBidMultiplier: 10,

  turnTime: 10000

};


/* =========================================================
   PLAYERS
========================================================= */

const PLAYERS = {

  1: {
    id: 1,
    name: "You",
    team: "blue",
    human: true
  },

  2: {
    id: 2,
    name: "Player 2",
    team: "red",
    human: false
  },

  3: {
    id: 3,
    name: "Player 3",
    team: "blue",
    human: false
  },

  4: {
    id: 4,
    name: "Player 4",
    team: "red",
    human: false
  },

  5: {
    id: 5,
    name: "Player 5",
    team: "blue",
    human: false
  },

  6: {
    id: 6,
    name: "Player 6",
    team: "red",
    human: false
  }

};


/* =========================================================
   TEAM HELPERS
========================================================= */

function getTeam(playerId){

  return PLAYERS[playerId]?.team || null;

}


function getTeammates(playerId){

  const team =
    getTeam(playerId);

  return Object.keys(PLAYERS)
    .map(Number)
    .filter(
      id =>
        id !== Number(playerId) &&
        getTeam(id) === team
    );

}


function isTeammate(a,b){

  return (
    a !== b &&
    getTeam(a) === getTeam(b)
  );

}


function isOpponent(a,b){

  return (
    a !== b &&
    getTeam(a) !== getTeam(b)
  );

}


/* =========================================================
   CARD CREATION
========================================================= */

const SUITS = [
  "S",
  "H",
  "D",
  "C"
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
  rank
){

  return {

    suit,
    rank,

    value:
      RANK_VALUE[rank],

    id:
      rank + suit

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

  deck.push({

    suit:"JOKER",

    rank:"RED",

    value:16,

    id:"RED_JOKER"

  });


  deck.push({

    suit:"JOKER",

    rank:"BLACK",

    value:15,

    id:"BLACK_JOKER"

  });


  return deck;

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(array){

  const copy =
    [...array];

  for(
    let i=copy.length-1;
    i>0;
    i--
  ){

    const j =
      Math.floor(
        Math.random() *
        (i+1)
      );

    [
      copy[i],
      copy[j]
    ] =
    [
      copy[j],
      copy[i]
    ];

  }

  return copy;

}


/* =========================================================
   GAME STATE
========================================================= */

const game = {

  started:false,

  round:0,

  starter:1,

  turn:1,

  deck:[],

  hands:{},

  currentTrick:[],

  playedCards:[],

  trickHistory:[],

  blueBid:0,

  redBid:0,

  blueTricks:0,

  redTricks:0,

  blueScore:0,

  redScore:0,

  blueRoundScores:[],

  redRoundScores:[],

  blueBidHistory:[],

  redBidHistory:[],

  blueTrickHistory:[],

  redTrickHistory:[],

  /*
     Memory
  */

  memory:{

    playedByPlayer:{},

    playedBySuit:{

      S:[],
      H:[],
      D:[],
      C:[]

    },

    remainingCards:[],

    knownVoid:{},

    trickWinners:[]

  }

};


/* =========================================================
   RESET GAME
========================================================= */

function resetGame(){

  game.started = false;

  game.round = 0;

  game.starter = 1;

  game.turn = 1;

  game.deck = [];

  game.hands = {};

  game.currentTrick = [];

  game.playedCards = [];

  game.trickHistory = [];

  game.blueBid = 0;

  game.redBid = 0;

  game.blueTricks = 0;

  game.redTricks = 0;

  game.blueScore = 0;

  game.redScore = 0;

  game.blueRoundScores = [];

  game.redRoundScores = [];

  game.blueBidHistory = [];

  game.redBidHistory = [];

  game.blueTrickHistory = [];

  game.redTrickHistory = [];

  game.memory = {

    playedByPlayer:{},

    playedBySuit:{
      S:[],
      H:[],
      D:[],
      C:[]
    },

    remainingCards:[],

    knownVoid:{},

    trickWinners:[]

  };


  for(
    let i=1;
    i<=6;
    i++
  ){

    game.memory
      .playedByPlayer[i] = [];

    game.memory
      .knownVoid[i] = {

        S:false,
        H:false,
        D:false,
        C:false

      };

  }

}


/* =========================================================
   DEAL
========================================================= */

function dealCards(){

  game.deck =
    shuffle(
      createDeck()
    );


  game.hands = {};


  for(
    let i=1;
    i<=6;
    i++
  ){

    game.hands[i] = [];

  }


  /*
     54 cards are available.

     6 players × 9 = 54
  */

  let index = 0;


  for(
    let cardIndex=0;
    cardIndex<
    GAME_CONFIG.cardsPerPlayer;
    cardIndex++
  ){

    for(
      let player=1;
      player<=6;
      player++
    ){

      game.hands[player]
        .push(
          game.deck[index++]
        );

    }

  }


  game.memory.remainingCards =
    game.deck.map(
      card => card.id
    );

}


/* =========================================================
   SORT HAND
========================================================= */

function sortHand(hand){

  return hand.sort(
    (a,b)=>{

      const trumpA =
        a.suit === "S";

      const trumpB =
        b.suit === "S";


      if(trumpA && !trumpB)
        return -1;

      if(!trumpA && trumpB)
        return 1;


      if(a.suit !== b.suit){

        return a.suit.localeCompare(
          b.suit
        );

      }


      return b.value-a.value;

    }
  );

}


/* =========================================================
   CARD HELPERS
========================================================= */

function isJoker(card){

  return card &&
    card.suit === "JOKER";

}


function isTrump(card){

  return (
    card &&
    card.suit === "S"
  );

}


function cardPower(card){

  if(!card)
    return -Infinity;


  if(
    card.id ===
    "RED_JOKER"
  ){

    return 100;

  }


  if(
    card.id ===
    "BLACK_JOKER"
  ){

    return 95;

  }


  if(
    card.id === "AS"
  ){

    return 90;

  }


  if(
    card.suit === "S"
  ){

    return 60 +
      card.value;

  }


  return card.value;

}


/* =========================================================
   FOLLOW SUIT
========================================================= */

function getLegalCards(
  playerId
){

  const hand =
    game.hands[playerId] || [];


  if(
    game.currentTrick.length === 0
  ){

    /*
       Joker cannot lead.
    */

    const nonJokers =
      hand.filter(
        card =>
          !isJoker(card)
      );


    return nonJokers.length
      ? nonJokers
      : hand;

  }


  const leadCard =
    game.currentTrick[0].card;


  const leadSuit =
    leadCard.suit;


  /*
     Jokers can be used anywhere.
  */

  if(
    leadSuit === "JOKER"
  ){

    return hand;

  }


  const sameSuit =
    hand.filter(
      card =>
        card.suit === leadSuit
    );


  if(sameSuit.length){

    return [
      ...sameSuit,
      ...hand.filter(
        card =>
          isJoker(card)
      )
    ];

  }


  /*
     No lead suit:
     player can play anything.
  */

  return hand;

}


/* =========================================================
   TRICK WINNER
========================================================= */

function getTrickWinner(
  trick = game.currentTrick
){

  if(!trick.length)
    return null;


  const lead =
    trick[0].card;


  const leadSuit =
    lead.suit;


  let winner =
    trick[0];


  for(
    let i=1;
    i<trick.length;
    i++
  ){

    const current =
      trick[i];


    if(
      beatsCard(
        current.card,
        winner.card,
        leadSuit
      )
    ){

      winner =
        current;

    }

  }


  return winner.playerId;

}


/* =========================================================
   CARD COMPARISON
========================================================= */

function beatsCard(
  candidate,
  current,
  leadSuit
){

  if(!candidate)
    return false;


  if(!current)
    return true;


  /*
     Red Joker
  */

  if(
    candidate.id ===
    "RED_JOKER"
  ){

    return true;

  }


  /*
     Current Red Joker
  */

  if(
    current.id ===
    "RED_JOKER"
  ){

    return false;

  }


  /*
     Black Joker
  */

  if(
    candidate.id ===
    "BLACK_JOKER"
  ){

    return (
      current.id !==
      "RED_JOKER"
    );

  }


  if(
    current.id ===
    "BLACK_JOKER"
  ){

    return false;

  }


  /*
     Trump beats non-trump
  */

  const candidateTrump =
    candidate.suit === "S";

  const currentTrump =
    current.suit === "S";


  if(
    candidateTrump &&
    !currentTrump
  ){

    return true;

  }


  if(
    !candidateTrump &&
    currentTrump
  ){

    return false;

  }


  /*
     Neither is trump.
     Must follow lead suit.
  */

  if(
    candidate.suit !==
    leadSuit
  ){

    return false;

  }


  if(
    current.suit !==
    leadSuit
  ){

    return true;

  }


  return (
    candidate.value >
    current.value
  );

}


/* =========================================================
   CURRENT WINNING CARD
========================================================= */

function getCurrentWinningEntry(){

  if(
    !game.currentTrick.length
  ){

    return null;

  }


  let winner =
    game.currentTrick[0];


  for(
    let i=1;
    i<game.currentTrick.length;
    i++
  ){

    const candidate =
      game.currentTrick[i];


    if(
      beatsCard(
        candidate.card,
        winner.card,
        game.currentTrick[0].card.suit
      )
    ){

      winner =
        candidate;

    }

  }


  return winner;

}


/* =========================================================
   CAN WIN TRICK
========================================================= */

function canWinTrick(
  playerId,
  card
){

  const legal =
    getLegalCards(
      playerId
    );


  if(
    !legal.some(
      c => c.id === card.id
    )
  ){

    return false;

  }


  const testTrick =
    [
      ...game.currentTrick,
      {
        playerId,
        card
      }
    ];


  return (
    getTrickWinner(
      testTrick
    ) === playerId
  );

}


/* =========================================================
   MEMORY
========================================================= */

function rememberCard(
  playerId,
  card
){

  if(!card)
    return;


  game.memory
    .playedByPlayer[playerId]
    .push(card);


  if(
    game.memory.playedBySuit[card.suit]
  ){

    game.memory
      .playedBySuit[card.suit]
      .push(card);

  }


  game.memory
    .remainingCards =
    game.memory.remainingCards
      .filter(
        id =>
          id !== card.id
      );

}


/* =========================================================
   VOID MEMORY
========================================================= */

function updateVoidMemory(
  playerId,
  card
){

  if(
    game.currentTrick.length < 1
  ){

    return;

  }


  const leadSuit =
    game.currentTrick[0].card.suit;


  if(
    card.suit !== leadSuit &&
    !isJoker(card)
  ){

    game.memory
      .knownVoid[playerId]
      [leadSuit] = true;

  }

}


/* =========================================================
   REMAINING CARDS BY SUIT
========================================================= */

function remainingCardsOfSuit(
  suit
){

  return game.memory
    .remainingCards
    .filter(
      id =>
        id.endsWith(suit)
    );

}


/* =========================================================
   COUNT PLAYED SUIT
========================================================= */

function countPlayedSuit(
  suit
){

  return (
    game.memory
      .playedBySuit[suit] || []
  ).length;

}


/* =========================================================
   AI BID
========================================================= */

function estimateBid(
  playerId
){

  const hand =
    game.hands[playerId] || [];


  let strength = 0;


  let trumpCount =
    hand.filter(
      card =>
        card.suit === "S"
    ).length;


  let jokerCount =
    hand.filter(
      card =>
        isJoker(card)
    ).length;


  /*
     High cards
  */

  hand.forEach(
    card=>{

      if(
        card.id ===
        "RED_JOKER"
      ){

        strength += 3.5;

      }

      else if(
        card.id ===
        "BLACK_JOKER"
      ){

        strength += 3;

      }

      else if(
        card.suit === "S" &&
        card.rank === "A"
      ){

        strength += 3;

      }

      else if(
        card.suit === "S" &&
        card.rank === "K"
      ){

        strength += 2;

      }

      else if(
        card.value >= 13
      ){

        strength += .8;

      }

      else if(
        card.value === 12
      ){

        strength += .4;

      }

    }
  );


  /*
     Trump bonus
  */

  if(trumpCount >= 4)
    strength += 1;

  if(trumpCount >= 6)
    strength += 1;


  /*
     Joker bonus
  */

  strength +=
    jokerCount * 1.2;


  /*
     Short suits can create
     trump opportunities.
  */

  const suitCounts = {

    H:0,
    D:0,
    C:0

  };


  hand.forEach(
    card=>{

      if(
        suitCounts[card.suit] !==
        undefined
      ){

        suitCounts[card.suit]++;

      }

    }
  );


  Object.values(
    suitCounts
  ).forEach(
    count=>{

      if(count <= 1)
        strength += .6;

    }
  );


  let bid =
    Math.round(
      strength
    );


  bid =
    Math.max(
      0,
      Math.min(
        7,
        bid
      )
    );


  return bid;

}


/* =========================================================
   TEAM BID
========================================================= */

function estimateTeamBid(
  team
){

  const members =
    Object.keys(PLAYERS)
      .map(Number)
      .filter(
        id =>
          getTeam(id) === team
      );


  const bids =
    members.map(
      id =>
        estimateBid(id)
    );


  let total =
    bids.reduce(
      (a,b)=>a+b,
      0
    );


  /*
     Team minimum is 2.
  */

  total =
    Math.max(
      2,
      total
    );


  /*
     Team declaration is limited.
  */

  return Math.min(
    7,
    total
  );

}


/* =========================================================
   TEAM TARGET
========================================================= */

function getTeamTarget(
  playerId
){

  return getTeam(playerId) === "blue"
    ? game.blueBid
    : game.redBid;

}


/* =========================================================
   TEAM TRICKS
========================================================= */

function getTeamTricks(
  team
){

  return team === "blue"
    ? game.blueTricks
    : game.redTricks;

}


/* =========================================================
   TEAM STATUS
========================================================= */

function getTeamStatus(
  playerId
){

  const team =
    getTeam(playerId);


  const target =
    getTeamTarget(playerId);


  const current =
    getTeamTricks(team);


  const difference =
    target-current;


  if(
    difference > 0
  ){

    return "NEED";

  }


  if(
    difference === 0
  ){

    return "SAFE";

  }


  return "OVER";

}


/* =========================================================
   IS TEAMMATE CURRENT WINNER
========================================================= */

function isTeammateWinning(
  playerId
){

  const winner =
    getCurrentWinningEntry();


  if(!winner)
    return false;


  return isTeammate(
    playerId,
    winner.playerId
  );

}


/* =========================================================
   IS OPPONENT WINNING
========================================================= */

function isOpponentWinning(
  playerId
){

  const winner =
    getCurrentWinningEntry();


  if(!winner)
    return false;


  return isOpponent(
    playerId,
    winner.playerId
  );

}


/* =========================================================
   CARD RISK
========================================================= */

function cardRisk(card){

  if(!card)
    return 999;


  if(
    card.id ===
    "RED_JOKER"
  ){

    return 100;

  }


  if(
    card.id ===
    "BLACK_JOKER"
  ){

    return 90;

  }


  if(
    card.id === "AS"
  ){

    return 85;

  }


  if(
    card.suit === "S"
  ){

    return (
      50 +
      card.value
    );

  }


  return card.value;

}


/* =========================================================
   LOWEST SAFE CARD
========================================================= */

function lowestCard(
  cards
){

  if(!cards.length)
    return null;


  return [...cards]
    .sort(
      (a,b)=>
        cardPower(a) -
        cardPower(b)
    )[0];

}


/* =========================================================
   HIGHEST WINNING CARD
========================================================= */

function smallestWinningCard(
  playerId,
  legal
){

  const winners =
    legal.filter(
      card =>
        canWinTrick(
          playerId,
          card
        )
    );


  if(!winners.length)
    return null;


  return [...winners]
    .sort(
      (a,b)=>
        cardPower(a) -
        cardPower(b)
    )[0];

}


/* =========================================================
   SACRIFICE CARD
========================================================= */

function findSacrificeCard(
  legal
){

  if(!legal.length)
    return null;


  /*
     Prefer non-trump low card.
  */

  const nonTrump =
    legal.filter(
      card =>
        !isTrump(card) &&
        !isJoker(card)
    );


  if(nonTrump.length){

    return lowestCard(
      nonTrump
    );

  }


  return lowestCard(
    legal
  );

}


/* =========================================================
   SUPPORT TEAMMATE
========================================================= */

function supportTeammate(
  playerId,
  legal
){

  const winner =
    getCurrentWinningEntry();


  if(!winner)
    return null;


  if(
    !isTeammate(
      playerId,
      winner.playerId
    )
  ){

    return null;

  }


  /*
     Teammate already wins.
     Play the cheapest legal card.
  */

  return findSacrificeCard(
    legal
  );

}


/* =========================================================
   STOP OPPONENT
========================================================= */

function stopOpponent(
  playerId,
  legal
){

  const winningCard =
    smallestWinningCard(
      playerId,
      legal
    );


  return winningCard;

}


/* =========================================================
   BALANCED AI CARD SCORE
========================================================= */

function scoreAICard(
  playerId,
  card
){

  let score = 0;


  const legal =
    getLegalCards(
      playerId
    );


  const teamStatus =
    getTeamStatus(
      playerId
    );


  const winner =
    getCurrentWinningEntry();


  const teammateWinning =
    isTeammateWinning(
      playerId
    );


  const opponentWinning =
    isOpponentWinning(
      playerId
    );


  /*
     First card of trick
  */

  if(
    !winner
  ){

    /*
       Lead strong cards only when
       team still needs tricks.
    */

    if(
      teamStatus === "NEED"
    ){

      score +=
        cardPower(card) * .25;

    }

    else{

      score -=
        cardPower(card) * .15;

    }


    /*
       Avoid wasting Joker as lead.
    */

    if(isJoker(card))
      score -= 100;


    /*
       Strong trump is valuable.
    */

    if(isTrump(card))
      score += 5;


    return score;

  }


  /*
     Teammate is winning:
     DON'T steal the trick.
  */

  if(
    teammateWinning
  ){

    if(
      canWinTrick(
        playerId,
        card
      )
    ){

      score -=
        80 +
        cardRisk(card);

    }else{

      score += 40;

      /*
         Prefer cheap sacrifice.
      */

      score -=
        cardRisk(card) * .25;

    }


    return score;

  }


  /*
     Opponent is winning.
  */

  if(
    opponentWinning
  ){

    if(
      teamStatus === "NEED"
    ){

      if(
        canWinTrick(
          playerId,
          card
        )
      ){

        /*
           Win, but don't use
           the strongest possible
           card if a cheaper one works.
        */

        score += 80;

        score -=
          cardRisk(card) * .15;

      }else{

        score -=
          cardRisk(card) * .2;

      }

    }

    else{

      /*
         Team already reached bid.
         Avoid unnecessary win.
      */

      if(
        canWinTrick(
          playerId,
          card
        )
      ){

        score -=
          70 +
          cardRisk(card) * .25;

      }else{

        score += 25;

        score -=
          cardRisk(card) * .2;

      }

    }


    return score;

  }


  return score;

}


/* =========================================================
   CHOOSE AI CARD
========================================================= */

function chooseAICard(
  playerId
){

  const legal =
    getLegalCards(
      playerId
    );


  if(!legal.length)
    return null;


  /*
     If teammate is already winning,
     explicitly protect teammate.
  */

  const teammateCard =
    supportTeammate(
      playerId,
      legal
    );


  if(teammateCard){

    return teammateCard;

  }


  /*
     If opponent wins and team needs
     a trick, try smallest winning card.
  */

  if(
    isOpponentWinning(
      playerId
    ) &&
    getTeamStatus(playerId) ===
      "NEED"
  ){

    const winning =
      stopOpponent(
        playerId,
        legal
      );


    if(winning){

      return winning;

    }

  }


  /*
     Otherwise evaluate all cards.
  */

  let bestCard =
    legal[0];

  let bestScore =
    -Infinity;


  for(
    const card of legal
  ){

    let score =
      scoreAICard(
        playerId,
        card
      );


    /*
       Small natural variation.
       Prevents robotic identical play.
    */

    score +=
      (Math.random() - .5) *
      4;


    if(
      score >
      bestScore
    ){

      bestScore =
        score;

      bestCard =
        card;

    }

  }


  return bestCard;

}


/* =========================================================
   PLAY CARD
========================================================= */

function playCard(
  playerId,
  card
){

  if(!card)
    return false;


  const legal =
    getLegalCards(
      playerId
    );


  const allowed =
    legal.some(
      c =>
        c.id === card.id
    );


  if(!allowed){

    console.warn(
      "Illegal card:",
      playerId,
      card
    );

    return false;

  }


  updateVoidMemory(
    playerId,
    card
  );


  game.hands[playerId] =
    game.hands[playerId]
      .filter(
        c =>
          c.id !== card.id
      );


  game.currentTrick.push({

    playerId,

    card

  });


  game.playedCards.push({

    playerId,

    card

  });


  rememberCard(
    playerId,
    card
  );


  /*
     Update UI if available.
  */

  renderPlayedCard(
    playerId,
    card
  );


  /*
     Continue trick.
  */

  if(
    game.currentTrick.length === 6
  ){

    finishCurrentTrick();

    return true;

  }


  nextTurn();

  return true;

}


/* =========================================================
   NEXT TURN
========================================================= */

function nextTurn(){

  const currentIndex =
    game.currentTrick.length;


  const order = [];


  for(
    let i=0;
    i<6;
    i++
  ){

    const player =
      (
        game.starter -
        1 +
        i
      ) % 6 + 1;


    order.push(
      player
    );

  }


  game.turn =
    order[currentIndex];


  processTurn();

}


/* =========================================================
   PROCESS TURN
========================================================= */

function processTurn(){

  const playerId =
    game.turn;


  if(
    PLAYERS[playerId].human
  ){

    enableHumanTurn();

    return;

  }


  /*
     AI delay creates natural play.
  */

  const delay =
    500 +
    Math.random() * 500;


  setTimeout(
    ()=>{

      const card =
        chooseAICard(
          playerId
        );


      playCard(
        playerId,
        card
      );

    },
    delay
  );

}


/* =========================================================
   HUMAN TURN
========================================================= */

function enableHumanTurn(){

  /*
     game.html can call
     window.playHumanCard(cardId)
  */

  if(
    typeof window.updateGameUI ===
    "function"
  ){

    window.updateGameUI();

  }

}


/* =========================================================
   HUMAN CARD
========================================================= */

window.playHumanCard =
function(cardId){

  if(
    game.turn !== 1
  ){

    return false;

  }


  const card =
    game.hands[1]
      .find(
        c =>
          c.id === cardId
      );


  if(!card)
    return false;


  return playCard(
    1,
    card
  );

};


/* =========================================================
   FINISH TRICK
========================================================= */

function finishCurrentTrick(){

  const winner =
    getTrickWinner(
      game.currentTrick
    );


  if(!winner)
    return;


  const winnerTeam =
    getTeam(winner);


  if(
    winnerTeam === "blue"
  ){

    game.blueTricks++;

  }else{

    game.redTricks++;

  }


  game.memory
    .trickWinners
    .push({

      trick:
        game.trickHistory.length + 1,

      playerId:
        winner,

      team:
        winnerTeam

    });


  game.trickHistory.push({

    cards:
      [...game.currentTrick],

    winner,

    team:
      winnerTeam

  });


  /*
     Last trick?
  */

  if(
    game.trickHistory.length >=
    GAME_CONFIG.tricksPerRound
  ){

    finishRound();

    return;

  }


  /*
     Winner starts next trick.
  */

  game.starter =
    winner;

  game.currentTrick = [];

  game.turn =
    winner;


  setTimeout(
    ()=>{

      clearPlayedUI();

      processTurn();

    },
    800
  );

}


/* =========================================================
   FINISH ROUND
========================================================= */

function finishRound(){

  const blueRound =
    calculateScore(
      game.blueBid,
      game.blueTricks
    );


  const redRound =
    calculateScore(
      game.redBid,
      game.redTricks
    );


  game.blueRoundScores
    .push(
      blueRound
    );


  game.redRoundScores
    .push(
      redRound
    );


  game.blueScore =
    game.blueRoundScores
      .reduce(
        (a,b)=>a+b,
        0
      );


  game.redScore =
    game.redRoundScores
      .reduce(
        (a,b)=>a+b,
        0
      );


  game.blueTrickHistory
    .push(
      game.blueTricks
    );


  game.redTrickHistory
    .push(
      game.redTricks
    );


  showRoundScore(
    blueRound,
    redRound
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
     7 is always exactly
     +140 or -140.
  */

  if(
    bid === 7
  ){

    return tricks >= 7
      ? 140
      : -140;

  }


  /*
     Bid failed.
  */

  if(
    tricks < bid
  ){

    return -(
      bid *
      GAME_CONFIG.normalBidMultiplier
    );

  }


  /*
     Successful bid.

     Base:
     bid × 10

     Extra:
     +1 each
  */

  return (
    bid *
    GAME_CONFIG.normalBidMultiplier
  ) +
  (
    tricks - bid
  );

}


/* =========================================================
   NEXT ROUND
========================================================= */

function nextRound(){

  if(
    game.round >=
    GAME_CONFIG.rounds
  ){

    finishGame();

    return;

  }


  game.round++;

  /*
     Round starter is fixed:
     1,2,3,4,5,6
  */

  game.starter =
    game.round;


  game.turn =
    game.starter;


  game.blueTricks = 0;

  game.redTricks = 0;

  game.currentTrick = [];

  game.trickHistory = [];

  dealCards();

  beginBidding();

}


/* =========================================================
   BEGIN BIDDING
========================================================= */

function beginBidding(){

  /*
     AI bids are estimated
     from their own cards.
  */

  let blueBid =
    estimateTeamBid(
      "blue"
    );


  let redBid =
    estimateTeamBid(
      "red"
    );


  /*
     Special 7 rule.

     ONLY 7 triggers
     automatic 2.
  */

  if(
    blueBid === 7
  ){

    redBid = 2;

  }


  else if(
    redBid === 7
  ){

    blueBid = 2;

  }


  /*
     If player 1 is human,
     game.html can override
     blue bid with actual
     player selection.
  */

  game.blueBid =
    blueBid;

  game.redBid =
    redBid;


  game.blueBidHistory
    .push(
      blueBid
    );


  game.redBidHistory
    .push(
      redBid
    );


  /*
     Start first trick.
  */

  startRoundPlay();

}


/* =========================================================
   START ROUND PLAY
========================================================= */

function startRoundPlay(){

  game.currentTrick = [];

  game.turn =
    game.starter;


  processTurn();

}


/* =========================================================
   ROUND SCORE UI
========================================================= */

function showRoundScore(
  blueRound,
  redRound
){

  if(
    typeof window.showScoreboard ===
    "function"
  ){

    window.showScoreboard({

      blueBid:
        game.blueBid,

      redBid:
        game.redBid,

      blueTricks:
        game.blueTricks,

      redTricks:
        game.redTricks,

      blueRound,

      redRound,

      blueTotal:
        game.blueScore,

      redTotal:
        game.redScore

    });

  }


  else{

    console.log(
      "ROUND SCORE",
      {
        blueRound,
        redRound,
        blueTotal:
          game.blueScore,
        redTotal:
          game.redScore
      }
    );

  }

}


/* =========================================================
   FINAL GAME
========================================================= */

function finishGame(){

  game.started =
    false;


  if(
    typeof window.showFinalResult ===
    "function"
  ){

    window.showFinalResult({

      blueScore:
        game.blueScore,

      redScore:
        game.redScore,

      blueTricks:
        game.blueTrickHistory
          .reduce(
            (a,b)=>a+b,
            0
          ),

      redTricks:
        game.redTrickHistory
          .reduce(
            (a,b)=>a+b,
            0
          )

    });

  }


  else{

    console.log(
      "FINAL RESULT",
      game
    );

  }

}


/* =========================================================
   UI: PLAYED CARD
========================================================= */

function renderPlayedCard(
  playerId,
  card
){

  /*
     Existing game.html can
     display played cards.

     The function intentionally
     remains safe if UI is absent.
  */

  if(
    typeof window.renderPlayedCardUI ===
    "function"
  ){

    window.renderPlayedCardUI(
      playerId,
      card,
      game.currentTrick.length
    );

  }

}


/* =========================================================
   UI CLEAR
========================================================= */

function clearPlayedUI(){

  if(
    typeof window.clearPlayedCardsUI ===
    "function"
  ){

    window.clearPlayedCardsUI();

  }

}


/* =========================================================
   START GAME
========================================================= */

function startGame(){

  resetGame();

  game.started =
    true;


  game.round = 0;

  game.starter = 1;

  game.turn = 1;


  /*
     First round:
     starter = player 1
  */

  nextRound();

}


/* =========================================================
   PUBLIC API
========================================================= */

window.SpadesGame = {

  state:
    game,

  config:
    GAME_CONFIG,

  start:
    startGame,

  reset:
    resetGame,

  nextRound:
    nextRound,

  chooseAICard:
    chooseAICard,

  getLegalCards:
    getLegalCards,

  calculateScore:
    calculateScore,

  getTrickWinner:
    getTrickWinner,

  getTeam:
    getTeam,

  getTeammates:
    getTeammates,

  isTeammate:
    isTeammate,

  isOpponent:
    isOpponent,

  estimateBid:
    estimateBid,

  estimateTeamBid:
    estimateTeamBid

};


/* =========================================================
   DEBUG HELPERS
========================================================= */

window.SpadesDebug = {

  getGame(){
    return game;
  },


  getHand(playerId){

    return game.hands[playerId] || [];

  },


  getMemory(){

    return game.memory;

  },


  getCurrentTrick(){

    return game.currentTrick;

  },


  getAIChoice(playerId){

    return chooseAICard(
      playerId
    );

  },


  getLegal(playerId){

    return getLegalCards(
      playerId
    );

  }

};


/* =========================================================
   AUTO INITIALIZATION
========================================================= */

resetGame();


console.log(
  "♠ SPADES 6 PLAYER AI READY"
);

console.log(
  "Rounds:",
  GAME_CONFIG.rounds
);

console.log(
  "Cards per player:",
  GAME_CONFIG.cardsPerPlayer
);

console.log(
  "Starters: 1 → 2 → 3 → 4 → 5 → 6"
);

console.log(
  "Blue: 1,3,5 | Red: 2,4,6"
);
