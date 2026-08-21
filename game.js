/* =========================================================
   SPADES • 6 PLAYER
   GAME.JS
   OFFLINE ENGINE + SMART TEAM AI

   FILE STRUCTURE

   index.html
   game.html
   game.js
   server.js   ← next stage

   RULES
   ---------------------------------------------------------
   • 6 players
   • 2 teams
   • P1 P3 P5 = BLUE
   • P2 P4 P6 = RED
   • 6 rounds
   • Each player starts one round
   • Each player receives 9 cards
   • Spades are always trump
   • Red Joker > Ace of Spades
   • Ace of Spades > Black Joker
   • Black Joker > King of Spades
   • Jokers cannot lead a trick
   ========================================================= */


/* =========================================================
   TELEGRAM
========================================================= */

const tg =
  window.Telegram &&
  window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

try {
  if (tg) {
    tg.ready();
    tg.expand();
  }
} catch (e) {
  console.warn("Telegram initialization error:", e);
}


/* =========================================================
   GLOBAL CONFIG
========================================================= */

const GAME_CONFIG = {

  PLAYER_COUNT: 6,

  ROUNDS: 6,

  CARDS_PER_PLAYER: 9,

  TRICK_COUNT: 9,

  MOVE_TIME: 10000,

  AI_DELAY_MIN: 500,

  AI_DELAY_MAX: 1100,

  TRUMP: "S",

  TEAM_BLUE: [1, 3, 5],

  TEAM_RED: [2, 4, 6],

  MAX_BID: 7,

  MIN_TEAM_BID: 2

};


/* =========================================================
   CARD DEFINITIONS
========================================================= */

const SUITS = {

  S: {
    symbol: "♠",
    name: "SPADES",
    color: "black"
  },

  H: {
    symbol: "♥",
    name: "HEARTS",
    color: "red"
  },

  D: {
    symbol: "♦",
    name: "DIAMONDS",
    color: "red"
  },

  C: {
    symbol: "♣",
    name: "CLUBS",
    color: "black"
  }

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

  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  "J": 11,
  "Q": 12,
  "K": 13,
  "A": 14

};


/* =========================================================
   PLAYERS
========================================================= */

const PLAYERS = {

  1: {
    id: 1,
    name: "You",
    team: "BLUE",
    human: true
  },

  2: {
    id: 2,
    name: "Player 2",
    team: "RED",
    human: false
  },

  3: {
    id: 3,
    name: "Player 3",
    team: "BLUE",
    human: false
  },

  4: {
    id: 4,
    name: "Player 4",
    team: "RED",
    human: false
  },

  5: {
    id: 5,
    name: "Player 5",
    team: "BLUE",
    human: false
  },

  6: {
    id: 6,
    name: "Player 6",
    team: "RED",
    human: false
  }

};


/* =========================================================
   GAME STATE
========================================================= */

const state = {

  started: false,

  phase: "LOBBY",

  round: 0,

  starter: 1,

  currentPlayer: null,

  trickNumber: 0,

  trickLeader: null,

  leadSuit: null,

  trickCards: [],

  deck: [],

  players: {},

  playedCards: [],

  cardMemory: {},

  bids: {

    BLUE: 0,

    RED: 0

  },

  tricks: {

    BLUE: 0,

    RED: 0

  },

  scores: {

    BLUE: 0,

    RED: 0

  },

  roundScores: [],

  history: [],

  timer: null,

  moveLocked: false,

  disconnected: {},

  aiMemory: {

    playedByPlayer: {},

    voidSuits: {},

    knownCards: {}

  }

};


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   CARD CREATION
========================================================= */

function createStandardDeck() {

  const deck = [];

  for (const suit of Object.keys(SUITS)) {

    for (const rank of RANKS) {

      deck.push({
        id: `${rank}${suit}`,
        suit,
        rank,
        value: RANK_VALUE[rank],
        joker: false,
        jokerColor: null
      });

    }

  }

  /*
     Red Joker
  */

  deck.push({
    id: "RJ",
    suit: null,
    rank: "JOKER",
    value: 100,
    joker: true,
    jokerColor: "RED"
  });


  /*
     Black Joker
  */

  deck.push({
    id: "BJ",
    suit: null,
    rank: "JOKER",
    value: 98,
    joker: true,
    jokerColor: "BLACK"
  });


  return deck;
}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(array) {

  const result = [...array];

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      result[i],
      result[j]
    ] = [
      result[j],
      result[i]
    ];

  }

  return result;
}


/* =========================================================
   RESET PLAYERS
========================================================= */

function resetPlayers() {

  state.players = {};

  for (let i = 1; i <= 6; i++) {

    state.players[i] = {

      id: i,

      name:
        PLAYERS[i].name,

      team:
        PLAYERS[i].team,

      human:
        PLAYERS[i].human,

      connected:
        true,

      isAI:
        !PLAYERS[i].human,

      hand: [],

      bid: 0,

      tricks: 0,

      cardsPlayed: [],

      memory: {

        playedCards: [],

        voidSuits: {},

        estimatedCards: []

      }

    };

  }

}


/* =========================================================
   START GAME
========================================================= */

function startGame() {

  if (state.started) {
    return;
  }

  resetGame();

  state.started = true;

  state.phase = "DEALING";

  state.round = 0;

  state.starter = 1;

  updateTop();

  updateScore();

  startRound();

}


/* =========================================================
   RESET GAME
========================================================= */

function resetGame() {

  stopTimer();

  state.started = false;

  state.phase = "LOBBY";

  state.round = 0;

  state.starter = 1;

  state.currentPlayer = null;

  state.trickNumber = 0;

  state.trickLeader = null;

  state.leadSuit = null;

  state.trickCards = [];

  state.deck = [];

  state.playedCards = [];

  state.cardMemory = {};

  state.roundScores = [];

  state.history = [];

  state.moveLocked = false;

  state.disconnected = {};

  state.bids.BLUE = 0;

  state.bids.RED = 0;

  state.tricks.BLUE = 0;

  state.tricks.RED = 0;

  state.scores.BLUE = 0;

  state.scores.RED = 0;

  state.aiMemory = {

    playedByPlayer: {},

    voidSuits: {},

    knownCards: {}

  };

  resetPlayers();

}


/* =========================================================
   START ROUND
========================================================= */

function startRound() {

  if (state.round >= GAME_CONFIG.ROUNDS) {

    finishGame();

    return;

  }

  state.round++;

  state.phase = "DEALING";

  state.trickNumber = 0;

  state.trickCards = [];

  state.leadSuit = null;

  state.trickLeader = state.starter;

  state.currentPlayer = state.starter;

  state.tricks.BLUE = 0;

  state.tricks.RED = 0;

  state.bids.BLUE = 0;

  state.bids.RED = 0;


  dealCards();

  updateTop();

  updateScore();

  renderHands();

  highlightStarter();


  /*
     Bidding after dealing.
  */

  setTimeout(
    startBidding,
    500
  );

}


/* =========================================================
   DEAL CARDS
========================================================= */

function dealCards() {

  state.deck =
    shuffle(
      createStandardDeck()
    );


  for (let i = 1; i <= 6; i++) {

    state.players[i].hand = [];

    state.players[i].cardsPlayed = [];

    state.players[i].tricks = 0;

  }


  /*
     54 cards are available.

     Six players × 9 cards = 54.
  */

  let index = 0;


  /*
     Rotate deal according to starter.
     This keeps the deal structure compatible
     with the six-round table.
  */

  for (
    let cardIndex = 0;
    cardIndex < GAME_CONFIG.CARDS_PER_PLAYER;
    cardIndex++
  ) {

    for (
      let offset = 0;
      offset < GAME_CONFIG.PLAYER_COUNT;
      offset++
    ) {

      const playerId =
        ((state.starter - 1 + offset) % 6) + 1;

      const card =
        state.deck[index++];

      if (card) {

        state.players[playerId]
          .hand
          .push(card);

      }

    }

  }


  /*
     Sort hands.
  */

  for (let i = 1; i <= 6; i++) {

    state.players[i].hand.sort(
      compareCards
    );

  }

}


/* =========================================================
   CARD SORT
========================================================= */

function compareCards(a, b) {

  if (a.joker && !b.joker) {
    return -1;
  }

  if (!a.joker && b.joker) {
    return 1;
  }

  if (a.joker && b.joker) {

    return b.value - a.value;

  }

  if (a.suit !== b.suit) {

    const order = [
      "S",
      "H",
      "D",
      "C"
    ];

    return (
      order.indexOf(a.suit) -
      order.indexOf(b.suit)
    );

  }

  return b.value - a.value;

}


/* =========================================================
   BIDDING
========================================================= */

function startBidding() {

  state.phase = "BIDDING";

  /*
     Offline mode:
     human player chooses through existing UI.
     AI players calculate automatically.
  */

  for (let i = 1; i <= 6; i++) {

    const player =
      state.players[i];

    if (
      player.isAI ||
      !player.connected
    ) {

      player.bid =
        AI.calculateBid(
          player
        );

    }

  }


  /*
     Existing HTML has team bid controls.
     We use player 1's bid as human input.
     Other human players will become network
     players later through server.js.
  */

  if (
    state.players[1].isAI ||
    !state.players[1].connected
  ) {

    state.players[1].bid =
      AI.calculateBid(
        state.players[1]
      );

  }


  calculateTeamBids();

  updateBidUI();


  /*
     If offline all AI except player 1,
     player 1 gets the normal bid UI.
  */

  if (
    typeof buildBidButtons ===
    "function"
  ) {

    try {
      buildBidButtons(
        $("blueBidButtons"),
        "blue"
      );

      buildBidButtons(
        $("redBidButtons"),
        "red"
      );
    } catch (e) {}

  }


  if (
    $("bidOverlay")
  ) {

    $("bidOverlay")
      .classList.add("show");

  }

}


/* =========================================================
   TEAM BID
========================================================= */

function calculateTeamBids() {

  const blue =
    GAME_CONFIG.TEAM_BLUE
      .reduce(
        (sum, id) =>
          sum +
          (
            Number(
              state.players[id].bid
            ) || 0
          ),
        0
      );


  const red =
    GAME_CONFIG.TEAM_RED
      .reduce(
        (sum, id) =>
          sum +
          (
            Number(
              state.players[id].bid
            ) || 0
          ),
        0
      );


  state.bids.BLUE =
    blue;

  state.bids.RED =
    red;

}


/* =========================================================
   UPDATE BID UI
========================================================= */

function updateBidUI() {

  if ($("blueBidTotal")) {

    $("blueBidTotal").textContent =
      state.bids.BLUE;

  }

  if ($("redBidTotal")) {

    $("redBidTotal").textContent =
      state.bids.RED;

  }

}


/* =========================================================
   CONFIRM BIDS
========================================================= */

function confirmBids() {

  /*
     Read player 1's selected bid
     from existing UI.
  */

  const blueSelected =
    readSelectedBid(
      "blueBidButtons"
    );


  const redSelected =
    readSelectedBid(
      "redBidButtons"
    );


  if (
    blueSelected !== null
  ) {

    state.players[1].bid =
      blueSelected;

  }


  /*
     If P1 is human and its selected bid
     is not available, keep calculated value.
  */

  calculateTeamBids();


  /*
     Team minimum.
  */

  if (
    state.bids.BLUE <
      GAME_CONFIG.MIN_TEAM_BID &&
    state.bids.RED <
      GAME_CONFIG.MIN_TEAM_BID
  ) {

    showMessage(
      "At least one team must declare 2 or more."
    );

    return;

  }


  state.phase = "PLAYING";

  state.trickNumber = 0;

  state.trickCards = [];

  state.leadSuit = null;


  if ($("bidOverlay")) {

    $("bidOverlay")
      .classList.remove("show");

  }


  startTrick();

}


/* =========================================================
   READ BID
========================================================= */

function readSelectedBid(containerId) {

  const container =
    $(containerId);

  if (!container) {
    return null;
  }

  const selected =
    container.querySelector(
      ".bid-button.selected"
    );

  if (!selected) {
    return null;
  }

  const value =
    Number(
      selected.textContent
    );

  return Number.isFinite(value)
    ? value
    : null;

}


/* =========================================================
   START TRICK
========================================================= */

function startTrick() {

  if (
    state.trickNumber >=
    GAME_CONFIG.TRICK_COUNT
  ) {

    finishRound();

    return;

  }


  state.trickNumber++;

  state.phase = "PLAYING";

  state.trickCards = [];

  state.leadSuit = null;

  state.trickLeader =
    state.starter +
    (
      (state.trickNumber - 1) %
      GAME_CONFIG.PLAYER_COUNT
    );

  state.currentPlayer =
    state.trickLeader;


  /*
     Normalize player number.
  */

  if (
    state.currentPlayer > 6
  ) {

    state.currentPlayer -= 6;

  }


  clearPlayedCards();

  highlightCurrentPlayer();

  updateCenter();


  processCurrentPlayer();

}


/* =========================================================
   CURRENT PLAYER
========================================================= */

function processCurrentPlayer() {

  if (
    state.phase !== "PLAYING"
  ) {

    return;

  }


  const player =
    state.players[
      state.currentPlayer
    ];


  if (!player) {
    return;
  }


  /*
     Player disconnected:
     immediately hand seat to AI.
  */

  if (
    !player.connected
  ) {

    player.isAI = true;

  }


  if (player.isAI) {

    const delay =
      randomInt(
        GAME_CONFIG.AI_DELAY_MIN,
        GAME_CONFIG.AI_DELAY_MAX
      );


    setTimeout(
      () => {

        const card =
          AI.chooseCard(
            player,
            state
          );

        if (card) {

          playCard(
            player.id,
            card.id,
            true
          );

        }

      },
      delay
    );


    return;

  }


  /*
     Human player.
     Offline demo waits for UI click.
  */

  startMoveTimer(
    player.id
  );

}


/* =========================================================
   PLAY CARD
========================================================= */

function playCard(
  playerId,
  cardId,
  fromAI = false
) {

  if (
    state.phase !== "PLAYING"
  ) {

    return false;

  }


  if (
    state.moveLocked
  ) {

    return false;

  }


  if (
    playerId !==
    state.currentPlayer
  ) {

    return false;

  }


  const player =
    state.players[playerId];

  if (!player) {
    return false;
  }


  const cardIndex =
    player.hand.findIndex(
      card =>
        card.id === cardId
    );


  if (
    cardIndex === -1
  ) {

    return false;

  }


  const card =
    player.hand[cardIndex];


  /*
     Legal move check.
  */

  if (
    !isLegalMove(
      player,
      card
    )
  ) {

    if (!fromAI) {

      showMessage(
        "You must follow the lead suit when possible."
      );

    }

    return false;

  }


  stopTimer();


  player.hand.splice(
    cardIndex,
    1
  );


  player.cardsPlayed.push(
    card
  );


  state.playedCards.push({
    playerId,
    card
  });


  state.trickCards.push({
    playerId,
    card
  });


  rememberPlayedCard(
    playerId,
    card
  );


  /*
     Detect void suit.
  */

  updateVoidMemory(
    playerId,
    card
  );


  /*
     First card defines lead suit,
     except Joker.
  */

  if (
    state.trickCards.length === 1
  ) {

    if (!card.joker) {

      state.leadSuit =
        card.suit;

    }

  }


  renderPlayedCard(
    playerId,
    card
  );


  renderHands();


  /*
     Four cards have been played.
  */

  if (
    state.trickCards.length >= 6
  ) {

    resolveTrick();

    return true;

  }


  /*
     Next player.
  */

  state.currentPlayer =
    nextPlayer(
      playerId
    );


  highlightCurrentPlayer();

  updateCenter();

  processCurrentPlayer();

  return true;

}


/* =========================================================
   NEXT PLAYER
========================================================= */

function nextPlayer(
  playerId
) {

  let next =
    playerId + 1;

  if (next > 6) {
    next = 1;
  }

  return next;

}


/* =========================================================
   LEGAL MOVE
========================================================= */

function isLegalMove(
  player,
  card
) {

  /*
     First card:
     Joker cannot lead.
  */

  if (
    state.trickCards.length === 0
  ) {

    return !card.joker;

  }


  /*
     Joker can be played anywhere
     after the lead.
  */

  if (card.joker) {
    return true;
  }


  /*
     If there is a lead suit,
     player must follow it if possible.
  */

  if (state.leadSuit) {

    const hasLead =
      player.hand.some(
        c =>
          !c.joker &&
          c.suit ===
            state.leadSuit
      );


    if (hasLead) {

      return (
        card.suit ===
        state.leadSuit
      );

    }

  }


  return true;

}


/* =========================================================
   TRICK WINNER
========================================================= */

function resolveTrick() {

  state.phase =
    "RESOLVING";


  const winner =
    determineTrickWinner(
      state.trickCards
    );


  const winnerPlayer =
    state.players[
      winner.playerId
    ];


  if (
    winnerPlayer
  ) {

    winnerPlayer.tricks++;

    state.tricks[
      winnerPlayer.team
    ]++;

  }


  /*
     AI memory.
  */

  rememberTrickResult(
    winner.playerId
  );


  state.phase =
    "TRICK_COMPLETE";


  /*
     Winner starts next trick.
  */

  state.starter =
    winner.playerId;


  state.trickCards = [];


  setTimeout(
    () => {

      if (
        state.trickNumber >=
        GAME_CONFIG.TRICK_COUNT
      ) {

        finishRound();

      } else {

        state.currentPlayer =
          winner.playerId;

        startNextTrickFromWinner();

      }

    },
    650
  );

}


/* =========================================================
   START NEXT TRICK
========================================================= */

function startNextTrickFromWinner() {

  state.phase =
    "PLAYING";

  state.trickCards = [];

  state.leadSuit = null;

  state.trickLeader =
    state.starter;

  state.currentPlayer =
    state.starter;

  clearPlayedCards();

  highlightCurrentPlayer();

  updateCenter();

  processCurrentPlayer();

}


/* =========================================================
   DETERMINE WINNER
========================================================= */

function determineTrickWinner(
  trick
) {

  let winner =
    trick[0];


  for (
    let i = 1;
    i < trick.length;
    i++
  ) {

    const candidate =
      trick[i];


    if (
      beatsCard(
        candidate.card,
        winner.card
      )
    ) {

      winner =
        candidate;

    }

  }


  return winner;

}


/* =========================================================
   CARD COMPARISON
========================================================= */

function beatsCard(
  candidate,
  current
) {

  /*
     Red Joker
  */

  if (
    candidate.joker &&
    candidate.jokerColor === "RED"
  ) {

    return true;

  }


  /*
     Current red Joker cannot be beaten.
  */

  if (
    current.joker &&
    current.jokerColor === "RED"
  ) {

    return false;

  }


  /*
     Black Joker
  */

  if (
    candidate.joker &&
    candidate.jokerColor === "BLACK"
  ) {

    if (
      current.joker
    ) {

      return (
        current.jokerColor !==
        "RED"
      );

    }

    /*
       Black Joker beats
       King of Spades and below.
    */

    return (
      current.suit === "S" &&
      current.value < 14
    );

  }


  /*
     Candidate is normal card,
     current is black Joker.
  */

  if (
    current.joker &&
    current.jokerColor === "BLACK"
  ) {

    return false;

  }


  /*
     Spade beats non-spade.
  */

  if (
    candidate.suit === "S" &&
    current.suit !== "S"
  ) {

    return true;

  }


  if (
    candidate.suit !== "S" &&
    current.suit === "S"
  ) {

    return false;

  }


  /*
     Different non-trump suits:
     candidate cannot beat current.
  */

  if (
    candidate.suit !==
    current.suit
  ) {

    return false;

  }


  return (
    candidate.value >
    current.value
  );

}


/* =========================================================
   FINISH ROUND
========================================================= */

function finishRound() {

  state.phase =
    "ROUND_COMPLETE";


  const blueScore =
    calculateTeamRoundScore(
      state.bids.BLUE,
      state.tricks.BLUE
    );


  const redScore =
    calculateTeamRoundScore(
      state.bids.RED,
      state.tricks.RED
    );


  state.scores.BLUE +=
    blueScore;

  state.scores.RED +=
    redScore;


  state.roundScores.push({

    round:
      state.round,

    starter:
      state.starter,

    blueBid:
      state.bids.BLUE,

    redBid:
      state.bids.RED,

    blueTricks:
      state.tricks.BLUE,

    redTricks:
      state.tricks.RED,

    blueScore,

    redScore,

    blueTotal:
      state.scores.BLUE,

    redTotal:
      state.scores.RED

  });


  state.history.push(
    createRoundSnapshot()
  );


  updateScore();

  showRoundScoreboard();


}


/* =========================================================
   ROUND SCORE
========================================================= */

function calculateTeamRoundScore(
  bid,
  tricks
) {

  bid =
    Number(bid) || 0;

  tricks =
    Number(tricks) || 0;


  /*
     Special 7.
  */

  if (bid === 7) {

    return tricks >= 7
      ? 140
      : -140;

  }


  /*
     Failed bid.
  */

  if (tricks < bid) {

    return -(bid * 10);

  }


  /*
     Successful bid.

     Exact:
     bid × 10

     Extra:
     +1 each
  */

  return (
    bid * 10
  ) +
  (
    tricks - bid
  );

}


/* =========================================================
   ROUND SNAPSHOT
========================================================= */

function createRoundSnapshot() {

  return {

    round:
      state.round,

    starter:
      state.starter,

    blue: {

      bid:
        state.bids.BLUE,

      tricks:
        state.tricks.BLUE,

      score:
        state.scores.BLUE

    },

    red: {

      bid:
        state.bids.RED,

      tricks:
        state.tricks.RED,

      score:
        state.scores.RED

    }

  };

}


/* =========================================================
   SCOREBOARD UI
========================================================= */

function showRoundScoreboard() {

  if ($("scoreSubtitle")) {

    $("scoreSubtitle").textContent =
      "ROUND " +
      state.round +
      " / 6";

  }


  if ($("scoreBlueBid")) {

    $("scoreBlueBid").textContent =
      state.bids.BLUE;

  }


  if ($("scoreRedBid")) {

    $("scoreRedBid").textContent =
      state.bids.RED;

  }


  if ($("scoreBlueTricks")) {

    $("scoreBlueTricks").textContent =
      state.tricks.BLUE;

  }


  if ($("scoreRedTricks")) {

    $("scoreRedTricks").textContent =
      state.tricks.RED;

  }


  const blueRound =
    state.roundScores[
      state.roundScores.length - 1
    ].blueScore;


  const redRound =
    state.roundScores[
      state.roundScores.length - 1
    ].redScore;


  if ($("scoreBlueRound")) {

    $("scoreBlueRound").textContent =
      blueRound;

  }


  if ($("scoreRedRound")) {

    $("scoreRedRound").textContent =
      redRound;

  }


  if ($("scoreBlueTotal")) {

    $("scoreBlueTotal").textContent =
      state.scores.BLUE;

  }


  if ($("scoreRedTotal")) {

    $("scoreRedTotal").textContent =
      state.scores.RED;

  }


  if ($("scoreOverlay")) {

    $("scoreOverlay")
      .classList.add("show");

  }


  /*
     Existing HTML button calls nextTrick().
     We redefine its meaning for 6-round system.
  */

}


/* =========================================================
   NEXT ROUND
========================================================= */

function nextTrick() {

  if ($("scoreOverlay")) {

    $("scoreOverlay")
      .classList.remove("show");

  }


  /*
     IMPORTANT:

     There are NOT 9 rounds.

     Each round contains 9 tricks/cards.

     After 9 tricks:
     round ends.

     Starter changes:
     1 → 2 → 3 → 4 → 5 → 6
  */

  if (
    state.round >=
    GAME_CONFIG.ROUNDS
  ) {

    finishGame();

    return;

  }


  state.starter++;

  if (
    state.starter > 6
  ) {

    state.starter = 1;

  }


  startRound();

}


/* =========================================================
   FINAL GAME
========================================================= */

function finishGame() {

  state.phase =
    "FINISHED";

  stopTimer();


  const blue =
    state.scores.BLUE;

  const red =
    state.scores.RED;


  if ($("finalBlueScore")) {

    $("finalBlueScore").textContent =
      blue;

  }


  if ($("finalRedScore")) {

    $("finalRedScore").textContent =
      red;

  }


  const blueTricks =
    state.history.reduce(
      (sum, r) =>
        sum + r.blue.tricks,
      0
    );


  const redTricks =
    state.history.reduce(
      (sum, r) =>
        sum + r.red.tricks,
      0
    );


  if ($("finalBlueTricks")) {

    $("finalBlueTricks").textContent =
      blueTricks +
      " TRICKS WON";

  }


  if ($("finalRedTricks")) {

    $("finalRedTricks").textContent =
      redTricks +
      " TRICKS WON";

  }


  let winner =
    "DRAW";


  if (blue > red) {

    winner =
      "🔵 BLUE TEAM";

  } else if (red > blue) {

    winner =
      "🔴 RED TEAM";

  }


  if ($("winnerName")) {

    $("winnerName").textContent =
      winner;

  }


  if ($("resultOverlay")) {

    $("resultOverlay")
      .classList.add("show");

  }

}


/* =========================================================
   SMART AI
========================================================= */

const AI = {


  /* =======================================================
     CALCULATE BID
  ======================================================= */

  calculateBid(player) {

    const hand =
      player.hand;


    let strength = 0;

    let sureWins = 0;

    let possibleWins = 0;


    /*
       Jokers.
    */

    for (const card of hand) {

      if (
        card.joker &&
        card.jokerColor === "RED"
      ) {

        sureWins += 1;

        continue;

      }


      if (
        card.joker &&
        card.jokerColor === "BLACK"
      ) {

        possibleWins += 1;

        continue;

      }


      /*
         Spades.
      */

      if (card.suit === "S") {

        if (card.rank === "A") {

          sureWins++;

        } else if (
          card.value >= 13
        ) {

          possibleWins += .8;

        } else if (
          card.value >= 11
        ) {

          possibleWins += .55;

        }

      }


      /*
         High cards in other suits.
      */

      else if (
        card.value === 14
      ) {

        possibleWins += .75;

      }

      else if (
        card.value === 13
      ) {

        possibleWins += .35;

      }

    }


    /*
       Suit shortages can be valuable
       because they allow trumping.
    */

    const counts =
      countSuits(hand);


    for (const suit of [
      "H",
      "D",
      "C"
    ]) {

      if (
        counts[suit] === 0
      ) {

        strength += .55;

      }

    }


    strength +=
      sureWins +
      possibleWins +
      strength;


    let bid =
      Math.floor(
        strength
      );


    /*
       Natural range.
    */

    bid =
      clamp(
        bid,
        0,
        7
      );


    /*
       Avoid overly aggressive AI.
    */

    if (
      bid >= 6 &&
      sureWins < 4
    ) {

      bid = 5;

    }


    /*
       Strong hand.
    */

    if (
      sureWins >= 5 &&
      bid < 5
    ) {

      bid = 5;

    }


    return bid;

  },


  /* =======================================================
     CHOOSE CARD
  ======================================================= */

  chooseCard(
    player,
    game
  ) {

    const legal =
      player.hand.filter(
        card =>
          isLegalMove(
            player,
            card
          )
      );


    if (
      legal.length === 0
    ) {

      return null;

    }


    /*
       Leading the trick.
    */

    if (
      game.trickCards.length === 0
    ) {

      return this.chooseLead(
        player,
        legal,
        game
      );

    }


    /*
       We are following.
    */

    return this.chooseFollow(
      player,
      legal,
      game
    );

  },


  /* =======================================================
     LEAD
  ======================================================= */

  chooseLead(
    player,
    legal,
    game
  ) {

    /*
       Never lead Joker.
    */

    const nonJokers =
      legal.filter(
        c => !c.joker
      );


    if (
      nonJokers.length === 0
    ) {

      return legal[0];

    }


    /*
       Try to lead a strong but
       not unnecessarily expensive card.
    */

    const spades =
      nonJokers.filter(
        c =>
          c.suit === "S"
      );


    /*
       If player has strong spade,
       lead it strategically.
    */

    if (
      spades.length > 0 &&
      this.partnerNeedsSupport(
        player,
        game
      )
    ) {

      return this.pickHighest(
        spades
      );

    }


    /*
       Lead from shortest suit.
       This can create a future void.
    */

    const suitGroups =
      groupBySuit(
        nonJokers
      );


    let bestSuit = null;

    let bestLength = Infinity;


    for (const suit of [
      "H",
      "D",
      "C",
      "S"
    ]) {

      const count =
        suitGroups[suit]
          ? suitGroups[suit].length
          : 0;


      if (
        count > 0 &&
        count < bestLength
      ) {

        bestLength =
          count;

        bestSuit =
          suit;

      }

    }


    if (bestSuit) {

      const cards =
        suitGroups[bestSuit];


      /*
         Natural lead:
         medium/high card.
      */

      return this.pickStrategicLead(
        cards
      );

    }


    return this.pickLowest(
      nonJokers
    );

  },


  /* =======================================================
     FOLLOW
  ======================================================= */

  chooseFollow(
    player,
    legal,
    game
  ) {

    const currentWinner =
      getCurrentWinner(
        game.trickCards
      );


    const partnerId =
      getPartner(
        player.id
      );


    const partnerAlreadyWinning =
      currentWinner &&
      getTeam(
        currentWinner.playerId
      ) === player.team;


    /*
       If teammate already has the trick,
       play the cheapest safe card.
    */

    if (
      partnerAlreadyWinning
    ) {

      return this.chooseDiscard(
        legal,
        game
      );

    }


    /*
       Try to win the trick.
    */

    const winningCards =
      legal.filter(
        card =>
          wouldBeatCurrent(
            card,
            game.trickCards
          )
      );


    if (
      winningCards.length > 0
    ) {

      /*
         Prefer the cheapest winning card.
      */

      return this.pickCheapestWinner(
        winningCards
      );

    }


    /*
       Cannot win:
       discard safely.
    */

    return this.chooseDiscard(
      legal,
      game
    );

  },


  /* =======================================================
     DISCARD
  ======================================================= */

  chooseDiscard(
    legal,
    game
  ) {

    /*
       Avoid throwing away important cards.
    */

    const sorted =
      [...legal].sort(
        (a, b) =>
          this.cardRisk(a) -
          this.cardRisk(b)
      );


    return sorted[0];

  },


  /* =======================================================
     CARD RISK
  ======================================================= */

  cardRisk(card) {

    if (
      card.joker &&
      card.jokerColor === "RED"
    ) {

      return 1000;

    }


    if (
      card.joker &&
      card.jokerColor === "BLACK"
    ) {

      return 700;

    }


    if (
      card.suit === "S" &&
      card.rank === "A"
    ) {

      return 600;

    }


    if (
      card.suit === "S"
    ) {

      return 300 +
        card.value;

    }


    return card.value;

  },


  /* =======================================================
     CHEAPEST WINNER
  ======================================================= */

  pickCheapestWinner(
    cards
  ) {

    return [...cards]
      .sort(
        (a, b) =>
          cardPower(a) -
          cardPower(b)
      )[0];

  },


  /* =======================================================
     LEAD STRATEGY
  ======================================================= */

  pickStrategicLead(
    cards
  ) {

    if (
      cards.length === 1
    ) {

      return cards[0];

    }


    const sorted =
      [...cards].sort(
        (a, b) =>
          a.value -
          b.value
      );


    /*
       Prefer a medium card.
    */

    const middle =
      Math.floor(
        sorted.length / 2
      );


    return sorted[middle];

  },


  /* =======================================================
     HIGHEST
  ======================================================= */

  pickHighest(cards) {

    return [...cards]
      .sort(
        (a, b) =>
          cardPower(b) -
          cardPower(a)
      )[0];

  },


  /* =======================================================
     LOWEST
  ======================================================= */

  pickLowest(cards) {

    return [...cards]
      .sort(
        (a, b) =>
          cardPower(a) -
          cardPower(b)
      )[0];

  },


  /* =======================================================
     PARTNER SUPPORT
  ======================================================= */

  partnerNeedsSupport(
    player,
    game
  ) {

    const partner =
      getPartner(
        player.id
      );


    if (!partner) {
      return false;
    }


    const p =
      game.players[
        partner
      ];


    if (!p) {
      return false;
    }


    /*
       If partner has already won many tricks,
       don't waste high cards.
    */

    if (
      p.tricks >=
      p.bid
    ) {

      return false;

    }


    return true;

  }

};


/* =========================================================
   AI MEMORY
========================================================= */

function rememberPlayedCard(
  playerId,
  card
) {

  state.aiMemory
    .playedByPlayer[playerId] ||= [];


  state.aiMemory
    .playedByPlayer[playerId]
    .push(card.id);


  state.aiMemory
    .knownCards[card.id] =
      playerId;


  state.cardMemory[card.id] =
    playerId;

}


/* =========================================================
   VOID SUIT MEMORY
========================================================= */

function updateVoidMemory(
  playerId,
  card
) {

  if (
    !state.trickCards.length
  ) {

    return;

  }


  if (
    card.joker
  ) {

    return;

  }


  /*
     If player played another suit
     while lead suit existed,
     they were void in lead suit.
  */

  if (
    state.leadSuit &&
    card.suit !==
      state.leadSuit
  ) {

    const player =
      state.players[playerId];


    player.memory
      .voidSuits[
        state.leadSuit
      ] = true;


    state.aiMemory
      .voidSuits[playerId] ||= {};


    state.aiMemory
      .voidSuits[playerId][
        state.leadSuit
      ] = true;

  }

}


/* =========================================================
   TRICK MEMORY
========================================================= */

function rememberTrickResult(
  winnerId
) {

  const winner =
    state.players[
      winnerId
    ];


  if (!winner) {
    return;
  }


  winner.memory
    .playedCards
    .push(
      ...state.trickCards.map(
        x => x.card.id
      )
    );

}


/* =========================================================
   CURRENT TRICK WINNER
========================================================= */

function getCurrentWinner(
  trick
) {

  if (
    !trick ||
    trick.length === 0
  ) {

    return null;

  }


  return determineTrickWinner(
    trick
  );

}


/* =========================================================
   WOULD BEAT CURRENT
========================================================= */

function wouldBeatCurrent(
  card,
  trick
) {

  if (
    !trick ||
    trick.length === 0
  ) {

    return true;

  }


  const winner =
    determineTrickWinner(
      trick
    );


  return beatsCard(
    card,
    winner.card
  );

}


/* =========================================================
   TEAM
========================================================= */

function getTeam(
  playerId
) {

  return GAME_CONFIG.TEAM_BLUE.includes(
    playerId
  )
    ? "BLUE"
    : "RED";

}


/* =========================================================
   PARTNER
========================================================= */

function getPartner(
  playerId
) {

  const team =
    getTeam(
      playerId
    );


  const players =
    team === "BLUE"
      ? GAME_CONFIG.TEAM_BLUE
      : GAME_CONFIG.TEAM_RED;


  return players.find(
    id =>
      id !== playerId
  ) || null;

}


/* =========================================================
   SUIT COUNT
========================================================= */

function countSuits(
  hand
) {

  const result = {

    S: 0,
    H: 0,
    D: 0,
    C: 0

  };


  for (const card of hand) {

    if (
      !card.joker &&
      result[card.suit] !==
        undefined
    ) {

      result[card.suit]++;

    }

  }


  return result;

}


/* =========================================================
   GROUP SUITS
========================================================= */

function groupBySuit(
  cards
) {

  const result = {

    S: [],
    H: [],
    D: [],
    C: []

  };


  for (const card of cards) {

    if (
      !card.joker &&
      result[card.suit]
    ) {

      result[card.suit]
        .push(card);

    }

  }


  return result;

}


/* =========================================================
   CARD POWER
========================================================= */

function cardPower(
  card
) {

  if (
    card.joker &&
    card.jokerColor === "RED"
  ) {

    return 1000;

  }


  if (
    card.joker &&
    card.jokerColor === "BLACK"
  ) {

    return 900;

  }


  if (
    card.suit === "S"
  ) {

    return 500 +
      card.value;

  }


  return card.value;

}


/* =========================================================
   RENDER HANDS
========================================================= */

function renderHands() {

  for (let i = 1; i <= 6; i++) {

    const hand =
      $("handP" + i);


    if (!hand) {
      continue;
    }


    hand.innerHTML = "";


    const player =
      state.players[i];


    if (!player) {
      continue;
    }


    /*
       Human player sees real cards.

       AI cards remain hidden.
    */

    for (
      let index = 0;
      index < player.hand.length;
      index++
    ) {

      const card =
        player.hand[index];


      const element =
        document.createElement("div");


      element.className =
        "mini-card";


      if (
        player.human &&
        player.connected
      ) {

        element.textContent =
          cardLabel(card);

      } else {

        element.textContent =
          "♠";

      }


      element.dataset.cardId =
        card.id;


      /*
         Human card selection.
      */

      if (
        player.id === 1 &&
        player.human &&
        player.connected &&
        state.currentPlayer === 1 &&
        state.phase === "PLAYING"
      ) {

        element.style.pointerEvents =
          "auto";

        element.style.cursor =
          "pointer";


        element.onclick =
          () => {

            playCard(
              1,
              card.id,
              false
            );

          };

      }


      hand.appendChild(
        element
      );

    }

  }

}


/* =========================================================
   CARD LABEL
========================================================= */

function cardLabel(
  card
) {

  if (card.joker) {

    return card.jokerColor === "RED"
      ? "🃏R"
      : "🃏B";

  }


  return (
    card.rank +
    SUITS[card.suit].symbol
  );

}


/* =========================================================
   PLAYED CARD UI
========================================================= */

function renderPlayedCard(
  playerId,
  card
) {

  const cards =
    document.querySelectorAll(
      ".played-card"
    );


  if (!cards.length) {
    return;
  }


  const index =
    state.trickCards.length - 1;


  if (
    index < 0 ||
    index >= cards.length
  ) {

    return;

  }


  const element =
    cards[index];


  element.textContent =
    cardLabel(card);


  element.classList.remove(
    "show"
  );


  requestAnimationFrame(
    () => {

      element.classList.add(
        "show"
      );

    }
  );

}


/* =========================================================
   HIGHLIGHT STARTER
========================================================= */

function highlightStarter() {

  document
    .querySelectorAll(
      ".player"
    )
    .forEach(
      player =>
        player.classList.remove(
          "active"
        )
    );


  const player =
    document.querySelector(
      ".p" +
      state.starter
    );


  if (player) {

    player.classList.add(
      "active"
    );

  }

}


/* =========================================================
   HIGHLIGHT CURRENT
========================================================= */

function highlightCurrentPlayer() {

  document
    .querySelectorAll(
      ".player"
    )
    .forEach(
      player =>
        player.classList.remove(
          "active"
        )
    );


  const player =
    document.querySelector(
      ".p" +
      state.currentPlayer
    );


  if (player) {

    player.classList.add(
      "active"
    );

  }

}


/* =========================================================
   CENTER
========================================================= */

function updateCenter() {

  if (!$("centerText")) {
    return;
  }


  if (
    state.phase === "PLAYING"
  ) {

    $("centerText").textContent =
      "PLAYER " +
      state.currentPlayer;

  }

}


/* =========================================================
   TOP
========================================================= */

function updateTop() {

  if (!$("roundNumber")) {
    return;
  }


  if (
    state.round === 0
  ) {

    $("roundNumber").textContent =
      "LOBBY";

    return;

  }


  $("roundNumber").textContent =
    "ROUND " +
    state.round +
    " / 6";

}


/* =========================================================
   SCORE UI
========================================================= */

function updateScore() {

  if ($("blueScore")) {

    $("blueScore").textContent =
      state.scores.BLUE;

  }


  if ($("redScore")) {

    $("redScore").textContent =
      state.scores.RED;

  }

}


/* =========================================================
   TIMER
========================================================= */

function startMoveTimer(
  playerId
) {

  stopTimer();


  let remaining =
    GAME_CONFIG.MOVE_TIME;


  state.timer =
    setTimeout(
      () => {

        handleTimeout(
          playerId
        );

      },
      remaining
    );

}


/* =========================================================
   STOP TIMER
========================================================= */

function stopTimer() {

  if (
    state.timer
  ) {

    clearTimeout(
      state.timer
    );

    state.timer = null;

  }

}


/* =========================================================
   TIMEOUT
========================================================= */

function handleTimeout(
  playerId
) {

  const player =
    state.players[playerId];


  if (!player) {
    return;
  }


  /*
     Human timeout:
     AI takes over for this turn.
  */

  player.connected =
    false;

  player.isAI =
    true;


  state.disconnected[
    playerId
  ] = true;


  showMessage(
    "Player " +
    playerId +
    " timed out. AI took over."
  );


  processCurrentPlayer();

}


/* =========================================================
   HUMAN DISCONNECT
========================================================= */

function disconnectPlayer(
  playerId
) {

  const player =
    state.players[playerId];


  if (!player) {
    return;

  }


  player.connected =
    false;

  player.isAI =
    true;


  state.disconnected[
    playerId
  ] = true;


  /*
     If it is their turn,
     AI immediately continues.
  */

  if (
    state.currentPlayer ===
    playerId &&
    state.phase === "PLAYING"
  ) {

    processCurrentPlayer();

  }

}


/* =========================================================
   HUMAN RECONNECT
========================================================= */

function reconnectPlayer(
  playerId
) {

  const player =
    state.players[playerId];


  if (!player) {
    return;
  }


  player.connected =
    true;

  player.isAI =
    false;


  delete state.disconnected[
    playerId
  ];


  renderHands();

}


/* =========================================================
   CLEAR PLAYED
========================================================= */

function clearPlayedCards() {

  document
    .querySelectorAll(
      ".played-card"
    )
    .forEach(
      card => {

        card.classList.remove(
          "show"
        );

        card.textContent =
          "";

      }
    );

}


/* =========================================================
   PLAY AGAIN
========================================================= */

function playAgain() {

  if ($("resultOverlay")) {

    $("resultOverlay")
      .classList.remove("show");

  }


  resetGame();

  startGame();

}


/* =========================================================
   HOME
========================================================= */

function goHome() {

  window.location.href =
    "index.html";

}


/* =========================================================
   BACK
========================================================= */

function goBack() {

  if (
    state.phase ===
    "PLAYING"
  ) {

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
) {

  try {

    if (
      tg &&
      typeof tg.showAlert ===
        "function"
    ) {

      tg.showAlert(
        message
      );

    } else {

      console.log(
        message
      );

    }

  } catch (e) {

    console.log(
      message
    );

  }

}


/* =========================================================
   UTILITY
========================================================= */

function clamp(
  value,
  min,
  max
) {

  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );

}


function randomInt(
  min,
  max
) {

  return Math.floor(
    Math.random() *
      (
        max -
        min +
        1
      )
  ) + min;

}


/* =========================================================
   INIT
========================================================= */

function initGameEngine() {

  resetGame();

  updateTop();

  updateScore();

  renderHands();

}


/* =========================================================
   PUBLIC API
   These functions will be used by server.js later.
========================================================= */

window.SpadesGame = {

  state,

  startGame,

  startRound,

  playCard,

  disconnectPlayer,

  reconnectPlayer,

  calculateTeamRoundScore,

  determineTrickWinner,

  isLegalMove,

  AI,

  createStandardDeck

};


/* =========================================================
   COMPATIBILITY
   Existing game.html buttons call these names.
========================================================= */

window.startGame =
  startGame;

window.confirmBids =
  confirmBids;

window.nextTrick =
  nextTrick;

window.playAgain =
  playAgain;

window.goHome =
  goHome;

window.goBack =
  goBack;


/* =========================================================
   INIT
========================================================= */

initGameEngine();
