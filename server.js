"use strict";

/*
=========================================================
 COURT PIECES SPADES
 PROFESSIONAL RAILWAY SERVER
=========================================================

 FEATURES
 --------------------------------------------------------
 • Node.js
 • WebSocket
 • Railway compatible
 • Public rooms
 • Private rooms
 • 6 players per room
 • 6 rounds
 • 9 cards per player
 • Server-side deck
 • Server-side game state
 • 5 second turn timer
 • AI replacement after timeout/disconnect
 • Reconnect support
 • Team system
 • Spades always trump
 • Joker support
 • Server validation
=========================================================
*/

const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 3000);

const MAX_PLAYERS = 6;
const CARDS_PER_PLAYER = 9;
const TOTAL_ROUNDS = 6;
const TURN_TIME = 5000;
const RECONNECT_GRACE = 30000;

const ROOM_TYPES = {
    PUBLIC: "public",
    PRIVATE: "private"
};

const GAME_PHASES = {
    WAITING: "waiting",
    DEALING: "dealing",
    BIDDING: "bidding",
    PLAYING: "playing",
    ROUND_RESULT: "round_result",
    FINAL: "final"
};


/* =========================================================
   HTTP SERVER
========================================================= */

const httpServer = http.createServer((req, res) => {

    if (req.url === "/health") {

        res.writeHead(200, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            status: "ok",
            service: "court-pieces-spades",
            uptime: process.uptime(),
            rooms: rooms.size
        }));

        return;
    }

    res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end(
        "COURT PIECES SPADES SERVER ONLINE"
    );
});


/* =========================================================
   WEBSOCKET
========================================================= */

const wss = new WebSocket.Server({
    server: httpServer
});


/* =========================================================
   STORAGE
========================================================= */

const rooms = new Map();

const sessions = new Map();


/* =========================================================
   UTILITIES
========================================================= */

function id(prefix = "") {

    return (
        prefix +
        crypto.randomBytes(8).toString("hex")
    );

}


function randomCode(length = 6) {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < length; i++) {

        result +=
            chars[
                Math.floor(
                    Math.random() * chars.length
                )
            ];

    }

    return result;

}


function now() {
    return Date.now();
}


function safeName(name) {

    if (
        typeof name !== "string"
    ) {

        return "Player";

    }

    return name
        .trim()
        .replace(/[<>]/g, "")
        .slice(0, 24)
        || "Player";

}


function clamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );

}


function send(ws, type, payload = {}) {

    if (
        !ws ||
        ws.readyState !== WebSocket.OPEN
    ) {

        return;

    }

    ws.send(
        JSON.stringify({
            type,
            ...payload
        })
    );

}


function broadcast(room, type, payload = {}) {

    for (const player of room.players) {

        if (
            player &&
            player.socket
        ) {

            send(
                player.socket,
                type,
                payload
            );

        }

    }

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


function createDeck() {

    const deck = [];

    for (const suit of SUITS) {

        for (const rank of RANKS) {

            deck.push({
                id: `${rank}_${suit}_${crypto.randomBytes(3).toString("hex")}`,
                rank,
                suit,
                joker: false
            });

        }

    }

    /*
       Two jokers.
    */

    deck.push({
        id: `joker_red_${crypto.randomBytes(3).toString("hex")}`,
        rank: "JOKER",
        suit: "red",
        joker: true,
        jokerColor: "red"
    });

    deck.push({
        id: `joker_black_${crypto.randomBytes(3).toString("hex")}`,
        rank: "JOKER",
        suit: "black",
        joker: true,
        jokerColor: "black"
    });

    return shuffle(deck);

}


function shuffle(array) {

    const copy = [...array];

    for (
        let i = copy.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            copy[i],
            copy[j]
        ] = [
            copy[j],
            copy[i]
        ];

    }

    return copy;

}


/* =========================================================
   CARD VALUE
========================================================= */

function rankValue(card) {

    if (!card) {
        return 0;
    }

    if (card.joker) {

        if (
            card.jokerColor === "red"
        ) {

            return 100;

        }

        return 80;

    }

    const values = {

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

    return values[card.rank] || 0;

}


/* =========================================================
   PLAYER
========================================================= */

function createPlayer(
    playerId,
    name,
    seat,
    isAI = false
) {

    return {

        id: playerId,

        name,

        seat,

        team:
            seat % 2 === 1
                ? "blue"
                : "red",

        isAI,

        connected: isAI,

        socket: null,

        reconnectUntil: 0,

        hand: [],

        bid: null,

        tricks: 0,

        totalScore: 0,

        currentTurn: false

    };

}


/* =========================================================
   ROOM
========================================================= */

class GameRoom {

    constructor(
        roomId,
        type = ROOM_TYPES.PUBLIC,
        ownerId = null
    ) {

        this.id = roomId;

        this.type = type;

        this.code =
            type === ROOM_TYPES.PRIVATE
                ? randomCode()
                : null;

        this.ownerId =
            ownerId;

        this.phase =
            GAME_PHASES.WAITING;

        this.players =
            new Array(MAX_PLAYERS)
                .fill(null);

        this.round = 0;

        this.starter = 1;

        this.turnSeat = null;

        this.turnTimer = null;

        this.turnStartedAt = 0;

        this.deck = [];

        this.tableCards = [];

        this.trump = "spades";

        this.blueBid = 0;

        this.redBid = 0;

        this.blueRoundScore = 0;

        this.redRoundScore = 0;

        this.blueScore = 0;

        this.redScore = 0;

        this.history = [];

        this.createdAt = now();

        this.updatedAt = now();

    }


    /* =====================================================
       ROOM STATE
    ===================================================== */

    publicState() {

        return {

            roomId: this.id,

            type: this.type,

            code: this.code,

            phase: this.phase,

            round: this.round,

            totalRounds: TOTAL_ROUNDS,

            starter: this.starter,

            turnSeat: this.turnSeat,

            trump: this.trump,

            blueBid: this.blueBid,

            redBid: this.redBid,

            blueScore: this.blueScore,

            redScore: this.redScore,

            players:
                this.players.map(
                    player => {

                        if (!player) {
                            return null;
                        }

                        return {

                            id: player.id,

                            name: player.name,

                            seat: player.seat,

                            team: player.team,

                            isAI: player.isAI,

                            connected:
                                player.connected,

                            cards:
                                player.seat === this.turnSeat
                                    ? player.hand.length
                                    : player.hand.length

                        };

                    }
                )

        };

    }


    /* =====================================================
       FIND PLAYER
    ===================================================== */

    getPlayer(playerId) {

        return this.players.find(
            player =>
                player &&
                player.id === playerId
        );

    }


    getPlayerBySeat(seat) {

        return this.players[seat - 1];

    }


    /* =====================================================
       ADD PLAYER
    ===================================================== */

    addPlayer(
        playerId,
        name
    ) {

        /*
           Reconnect to existing seat.
        */

        const existing =
            this.getPlayer(playerId);

        if (existing) {

            existing.name =
                safeName(name);

            existing.isAI = false;

            existing.connected = true;

            existing.reconnectUntil = 0;

            return existing;

        }


        const emptySeat =
            this.players.findIndex(
                player => !player
            );


        if (emptySeat === -1) {

            return null;

        }


        const seat =
            emptySeat + 1;


        const player =
            createPlayer(
                playerId,
                safeName(name),
                seat,
                false
            );


        this.players[emptySeat] =
            player;


        this.updatedAt = now();


        return player;

    }


    /* =====================================================
       REMOVE / DISCONNECT
    ===================================================== */

    disconnectPlayer(player) {

        if (!player) {
            return;
        }

        player.connected = false;

        player.socket = null;

        player.reconnectUntil =
            now() + RECONNECT_GRACE;


        /*
           If game is already running,
           convert the player to temporary AI.
        */

        if (
            this.phase !==
            GAME_PHASES.WAITING
        ) {

            player.isAI = true;

            this.broadcastState();

            /*
               If disconnected player currently
               has the turn, AI acts immediately.
            */

            if (
                this.turnSeat ===
                player.seat
            ) {

                this.cancelTurnTimer();

                setTimeout(
                    () => {

                        this.aiPlayTurn(
                            player.seat
                        );

                    },
                    150
                );

            }

        }

    }


    /* =====================================================
       BROADCAST STATE
    ===================================================== */

    broadcastState() {

        broadcast(
            this,
            "ROOM_STATE",
            {
                state:
                    this.publicState()
            }
        );

    }


    /* =====================================================
       START GAME
    ===================================================== */

    startGame() {

        if (
            this.phase !==
            GAME_PHASES.WAITING
        ) {

            return;

        }


        /*
           Require 6 seats.

           AI can be inserted later if desired,
           but initial online table is intended
           for six real players.
        */

        const occupied =
            this.players.filter(
                Boolean
            ).length;


        if (
            occupied < MAX_PLAYERS
        ) {

            return;

        }


        this.round = 0;

        this.starter = 1;

        this.blueScore = 0;

        this.redScore = 0;

        this.history = [];


        this.startRound();

    }


    /* =====================================================
       START ROUND
    ===================================================== */

    startRound() {

        this.cancelTurnTimer();

        this.round++;

        if (
            this.round >
            TOTAL_ROUNDS
        ) {

            this.finishGame();

            return;

        }


        this.phase =
            GAME_PHASES.DEALING;


        this.deck =
            createDeck();


        this.tableCards = [];


        this.blueBid = 0;

        this.redBid = 0;


        for (
            const player
            of this.players
        ) {

            if (!player) {
                continue;
            }

            player.hand = [];

            player.bid = null;

            player.tricks = 0;

            player.currentTurn = false;

        }


        /*
           54 cards exist because of
           52 standard cards + 2 jokers.

           Only 54 cards are required:
           6 players × 9 cards = 54.
        */

        for (
            let i = 0;
            i < CARDS_PER_PLAYER;
            i++
        ) {

            for (
                let seat = 1;
                seat <= MAX_PLAYERS;
                seat++
            ) {

                const player =
                    this.getPlayerBySeat(
                        seat
                    );

                if (!player) {
                    continue;
                }

                const card =
                    this.deck.pop();

                if (card) {

                    player.hand.push(
                        card
                    );

                }

            }

        }


        this.phase =
            GAME_PHASES.BIDDING;


        this.broadcastState();


        broadcast(
            this,
            "ROUND_STARTED",
            {
                round:
                    this.round,

                starter:
                    this.starter,

                cardsPerPlayer:
                    CARDS_PER_PLAYER
            }
        );


        /*
           Each player receives
           only their own cards.
        */

        this.sendPrivateHands();


        /*
           For now bidding is server controlled
           through messages.
        */

    }


    /* =====================================================
       PRIVATE HANDS
    ===================================================== */

    sendPrivateHands() {

        for (
            const player
            of this.players
        ) {

            if (
                !player ||
                !player.socket
            ) {

                continue;

            }


            send(
                player.socket,
                "YOUR_HAND",
                {
                    cards:
                        player.hand
                }
            );

        }

    }


    /* =====================================================
       BIDDING
    ===================================================== */

    submitBid(
        playerId,
        value
    ) {

        if (
            this.phase !==
            GAME_PHASES.BIDDING
        ) {

            return;

        }


        const player =
            this.getPlayer(
                playerId
            );


        if (!player) {
            return;
        }


        const bid =
            clamp(
                Number(value) || 0,
                0,
                7
            );


        player.bid = bid;


        /*
           Team total.
        */

        const bluePlayers =
            this.players.filter(
                p =>
                    p &&
                    p.team === "blue"
            );


        const redPlayers =
            this.players.filter(
                p =>
                    p &&
                    p.team === "red"
            );


        this.blueBid =
            bluePlayers.reduce(
                (sum, p) =>
                    sum + (p.bid || 0),
                0
            );


        this.redBid =
            redPlayers.reduce(
                (sum, p) =>
                    sum + (p.bid || 0),
                0
            );


        /*
           The maximum team declaration
           is 7.
        */

        this.blueBid =
            clamp(
                this.blueBid,
                0,
                7
            );


        this.redBid =
            clamp(
                this.redBid,
                0,
                7
            );


        this.broadcastState();


        /*
           Once all six have bid,
           start playing.
        */

        const allBids =
            this.players.every(
                p =>
                    p &&
                    p.bid !== null
            );


        if (allBids) {

            this.beginPlaying();

        }

    }


    /* =====================================================
       BEGIN PLAYING
    ===================================================== */

    beginPlaying() {

        this.phase =
            GAME_PHASES.PLAYING;


        this.turnSeat =
            this.starter;


        this.broadcastState();


        this.startTurnTimer();

    }


    /* =====================================================
       TURN TIMER
    ===================================================== */

    startTurnTimer() {

        this.cancelTurnTimer();


        const player =
            this.getPlayerBySeat(
                this.turnSeat
            );


        if (!player) {
            return;
        }


        player.currentTurn =
            true;


        this.turnStartedAt =
            now();


        broadcast(
            this,
            "TURN_START",
            {

                seat:
                    this.turnSeat,

                timeout:
                    TURN_TIME,

                startedAt:
                    this.turnStartedAt

            }
        );


        this.turnTimer =
            setTimeout(
                () => {

                    this.handleTurnTimeout();

                },
                TURN_TIME
            );

    }


    cancelTurnTimer() {

        if (
            this.turnTimer
        ) {

            clearTimeout(
                this.turnTimer
            );

            this.turnTimer =
                null;

        }

    }


    /* =====================================================
       TIMEOUT
    ===================================================== */

    handleTurnTimeout() {

        this.turnTimer =
            null;


        const seat =
            this.turnSeat;


        const player =
            this.getPlayerBySeat(
                seat
            );


        if (!player) {
            return;
        }


        broadcast(
            this,
            "TURN_TIMEOUT",
            {
                seat
            }
        );


        /*
           AI immediately takes over
           for this move.
        */

        this.aiPlayTurn(
            seat
        );

    }


    /* =====================================================
       PLAY CARD
    ===================================================== */

    playCard(
        playerId,
        cardId
    ) {

        if (
            this.phase !==
            GAME_PHASES.PLAYING
        ) {

            return;

        }


        const player =
            this.getPlayer(
                playerId
            );


        if (!player) {
            return;
        }


        if (
            player.seat !==
            this.turnSeat
        ) {

            send(
                player.socket,
                "ERROR",
                {
                    message:
                        "Not your turn."
                }
            );

            return;

        }


        const cardIndex =
            player.hand.findIndex(
                card =>
                    card.id === cardId
            );


        if (
            cardIndex === -1
        ) {

            send(
                player.socket,
                "ERROR",
                {
                    message:
                        "Card not found."
                }
            );

            return;

        }


        const card =
            player.hand[
                cardIndex
            ];


        /*
           Validate card according
           to current trick.
        */

        if (
            !this.isLegalCard(
                player,
                card
            )
        ) {

            send(
                player.socket,
                "ERROR",
                {
                    message:
                        "Illegal card."
                }
            );

            return;

        }


        this.cancelTurnTimer();


        player.hand.splice(
            cardIndex,
            1
        );


        player.currentTurn =
            false;


        this.tableCards.push({

            seat:
                player.seat,

            playerId:
                player.id,

            card

        });


        broadcast(
            this,
            "CARD_PLAYED",
            {

                seat:
                    player.seat,

                card

            }
        );


        /*
           Six cards = trick complete.
        */

        if (
            this.tableCards.length ===
            MAX_PLAYERS
        ) {

            this.finishTrick();

            return;

        }


        this.turnSeat =
            this.nextSeat(
                this.turnSeat
            );


        this.startTurnTimer();

    }


    /* =====================================================
       LEGAL CARD
    ===================================================== */

    isLegalCard(
        player,
        card
    ) {

        if (
            this.tableCards.length === 0
        ) {

            /*
               Jokers cannot lead.
            */

            if (card.joker) {

                return false;

            }

            return true;

        }


        /*
           Determine leading suit.
        */

        const lead =
            this.tableCards[0].card;


        if (lead.joker) {

            return true;

        }


        /*
           Player has a card of lead suit?
        */

        const hasLeadSuit =
            player.hand.some(
                c =>
                    !c.joker &&
                    c.suit ===
                    lead.suit
            );


        if (
            !hasLeadSuit
        ) {

            return true;

        }


        /*
           Must follow suit.
        */

        if (card.joker) {

            return true;

        }


        return (
            card.suit ===
            lead.suit
        );

    }


    /* =====================================================
       NEXT SEAT
    ===================================================== */

    nextSeat(seat) {

        return (
            seat % MAX_PLAYERS
        ) + 1;

    }


    /* =====================================================
       TRICK WINNER
    ===================================================== */

    determineTrickWinner() {

        if (
            this.tableCards.length === 0
        ) {

            return null;

        }


        const leadCard =
            this.tableCards[0].card;


        let winner =
            this.tableCards[0];


        for (
            let i = 1;
            i < this.tableCards.length;
            i++
        ) {

            const current =
                this.tableCards[i];


            if (
                this.beats(
                    current.card,
                    winner.card,
                    leadCard
                )
            ) {

                winner =
                    current;

            }

        }


        return winner;

    }


    /* =====================================================
       CARD COMPARISON
    ===================================================== */

    beats(
        challenger,
        currentWinner,
        leadCard
    ) {

        /*
           Red Joker
        */

        if (
            challenger.joker &&
            challenger.jokerColor ===
            "red"
        ) {

            return true;

        }


        if (
            currentWinner.joker &&
            currentWinner.jokerColor ===
            "red"
        ) {

            return false;

        }


        /*
           Black Joker
        */

        if (
            challenger.joker &&
            challenger.jokerColor ===
            "black"
        ) {

            return !currentWinner.joker;

        }


        if (
            currentWinner.joker &&
            currentWinner.jokerColor ===
            "black"
        ) {

            return false;

        }


        /*
           Spade beats non-spade.
        */

        if (
            challenger.suit ===
            "spades" &&
            currentWinner.suit !==
            "spades"
        ) {

            return true;

        }


        if (
            challenger.suit !==
            "spades" &&
            currentWinner.suit ===
            "spades"
        ) {

            return false;

        }


        /*
           Same effective suit.
        */

        return (
            challenger.suit ===
            currentWinner.suit &&
            rankValue(challenger) >
            rankValue(currentWinner)
        );

    }


    /* =====================================================
       FINISH TRICK
    ===================================================== */

    finishTrick() {

        this.cancelTurnTimer();


        const winner =
            this.determineTrickWinner();


        if (!winner) {
            return;
        }


        const winningPlayer =
            this.getPlayerBySeat(
                winner.seat
            );


        if (winningPlayer) {

            winningPlayer.tricks++;

        }


        const winningTeam =
            winningPlayer
                ? winningPlayer.team
                : null;


        broadcast(
            this,
            "TRICK_RESULT",
            {

                winnerSeat:
                    winner.seat,

                winningTeam,

                cards:
                    this.tableCards

            }
        );


        /*
           Next trick starts with winner.
        */

        this.starter =
            winner.seat;


        this.turnSeat =
            winner.seat;


        this.tableCards = [];


        /*
           Everyone has played all 9 cards.
        */

        const cardsRemaining =
            this.players.every(
                p =>
                    !p ||
                    p.hand.length === 0
            );


        if (cardsRemaining) {

            this.finishRound();

            return;

        }


        this.broadcastState();


        setTimeout(
            () => {

                this.startTurnTimer();

            },
            500
        );

    }


    /* =====================================================
       SCORE
    ===================================================== */

    calculateTeamScore(
        bid,
        tricks
    ) {

        /*
           Special 7:
           exactly +140 or -140.
        */

        if (
            bid === 7
        ) {

            return tricks >= 7
                ? 140
                : -140;

        }


        /*
           Zero bid.
        */

        if (
            bid === 0
        ) {

            return 0;

        }


        /*
           Failed bid.
        */

        if (
            tricks < bid
        ) {

            return -(bid * 10);

        }


        /*
           Exact bid + extras.
        */

        return (
            bid * 10
        ) +
        (
            tricks - bid
        );

    }


    /* =====================================================
       FINISH ROUND
    ===================================================== */

    finishRound() {

        this.cancelTurnTimer();


        const bluePlayers =
            this.players.filter(
                p =>
                    p &&
                    p.team === "blue"
            );


        const redPlayers =
            this.players.filter(
                p =>
                    p &&
                    p.team === "red"
            );


        const blueTricks =
            bluePlayers.reduce(
                (sum, p) =>
                    sum + p.tricks,
                0
            );


        const redTricks =
            redPlayers.reduce(
                (sum, p) =>
                    sum + p.tricks,
                0
            );


        this.blueRoundScore =
            this.calculateTeamScore(
                this.blueBid,
                blueTricks
            );


        this.redRoundScore =
            this.calculateTeamScore(
                this.redBid,
                redTricks
            );


        this.blueScore +=
            this.blueRoundScore;


        this.redScore +=
            this.redRoundScore;


        this.history.push({

            round:
                this.round,

            blueBid:
                this.blueBid,

            redBid:
                this.redBid,

            blueTricks,

            redTricks,

            blueScore:
                this.blueRoundScore,

            redScore:
                this.redRoundScore

        });


        this.phase =
            GAME_PHASES.ROUND_RESULT;


        broadcast(
            this,
            "ROUND_RESULT",
            {

                round:
                    this.round,

                blueBid:
                    this.blueBid,

                redBid:
                    this.redBid,

                blueTricks,

                redTricks,

                blueRoundScore:
                    this.blueRoundScore,

                redRoundScore:
                    this.redRoundScore,

                blueTotal:
                    this.blueScore,

                redTotal:
                    this.redScore

            }
        );


        this.broadcastState();


        /*
           Six rounds completed.
        */

        if (
            this.round >=
            TOTAL_ROUNDS
        ) {

            setTimeout(
                () => {

                    this.finishGame();

                },
                1200
            );

            return;

        }


        /*
           Next round starter:
           1 → 2 → 3 → 4 → 5 → 6
        */

        this.starter =
            this.round + 1;


        setTimeout(
            () => {

                this.startRound();

            },
            1500
        );

    }


    /* =====================================================
       FINAL GAME
    ===================================================== */

    finishGame() {

        this.cancelTurnTimer();


        this.phase =
            GAME_PHASES.FINAL;


        let winner =
            "draw";


        if (
            this.blueScore >
            this.redScore
        ) {

            winner =
                "blue";

        }

        else if (
            this.redScore >
            this.blueScore
        ) {

            winner =
                "red";

        }


        broadcast(
            this,
            "GAME_FINISHED",
            {

                winner,

                blueScore:
                    this.blueScore,

                redScore:
                    this.redScore,

                history:
                    this.history

            }
        );


        this.broadcastState();

    }


    /* =====================================================
       AI
    ===================================================== */

    aiPlayTurn(seat) {

        if (
            this.phase !==
            GAME_PHASES.PLAYING
        ) {

            return;

        }


        if (
            this.turnSeat !==
            seat
        ) {

            return;

        }


        const player =
            this.getPlayerBySeat(
                seat
            );


        if (!player) {
            return;
        }


        player.isAI = true;


        const card =
            this.chooseAICard(
                player
            );


        if (!card) {

            /*
               Safety fallback.
            */

            const fallback =
                player.hand[0];

            if (!fallback) {
                return;
            }

            this.playCard(
                player.id,
                fallback.id
            );

            return;

        }


        broadcast(
            this,
            "AI_ACTION",
            {

                seat,

                cardId:
                    card.id

            }
        );


        this.playCard(
            player.id,
            card.id
        );

    }


    /* =====================================================
       SMART AI
    ===================================================== */

    chooseAICard(player) {

        const legalCards =
            player.hand.filter(
                card =>
                    this.isLegalCard(
                        player,
                        card
                    )
            );


        if (
            legalCards.length === 0
        ) {

            return null;

        }


        /*
           First player of trick:
           avoid leading joker.
        */

        if (
            this.tableCards.length === 0
        ) {

            return this.chooseLeadCard(
                player,
                legalCards
            );

        }


        /*
           Try to win the current trick
           with the cheapest possible card.
        */

        const currentWinner =
            this.determineTrickWinner();


        const lead =
            this.tableCards[0].card;


        const winningCards =
            legalCards.filter(
                card =>
                    this.beats(
                        card,
                        currentWinner.card,
                        lead
                    )
            );


        /*
           Team-aware AI:
           if teammate currently wins,
           try to play the lowest safe card.
        */

        const teammateWinning =
            currentWinner &&
            this.getPlayerBySeat(
                currentWinner.seat
            ) &&
            this.getPlayerBySeat(
                currentWinner.seat
            ).team === player.team;


        if (
            teammateWinning
        ) {

            return this.lowestRiskCard(
                legalCards
            );

        }


        /*
           Otherwise win with
           the lowest winning card.
        */

        if (
            winningCards.length
        ) {

            return winningCards.sort(
                (a, b) =>
                    rankValue(a) -
                    rankValue(b)
            )[0];

        }


        /*
           Cannot win:
           dump the lowest card.
        */

        return this.lowestRiskCard(
            legalCards
        );

    }


    /* =====================================================
       AI LEAD
    ===================================================== */

    chooseLeadCard(
        player,
        cards
    ) {

        /*
           Prefer non-trump cards.
        */

        const nonTrump =
            cards.filter(
                card =>
                    !card.joker &&
                    card.suit !== "spades"
            );


        if (
            nonTrump.length
        ) {

            /*
               Prefer a suit with
               fewer cards.
            */

            const counts = {};

            for (
                const card
                of nonTrump
            ) {

                counts[card.suit] =
                    (counts[card.suit] || 0) +
                    1;

            }


            nonTrump.sort(
                (a, b) => {

                    const countDiff =
                        counts[a.suit] -
                        counts[b.suit];

                    if (
                        countDiff !== 0
                    ) {

                        return countDiff;

                    }

                    return (
                        rankValue(a) -
                        rankValue(b)
                    );

                }
            );


            return nonTrump[0];

        }


        return this.lowestRiskCard(
            cards
        );

    }


    /* =====================================================
       LOWEST RISK
    ===================================================== */

    lowestRiskCard(cards) {

        return [...cards].sort(
            (a, b) => {

                /*
                   Keep jokers valuable.
                */

                if (
                    a.joker !==
                    b.joker
                ) {

                    return (
                        a.joker
                            ? 1
                            : -1
                    );

                }


                return (
                    rankValue(a) -
                    rankValue(b)
                );

            }
        )[0];

    }

}


/* =========================================================
   ROOM CREATION
========================================================= */

function createRoom(
    type,
    ownerId
) {

    let roomId;

    do {

        roomId =
            id("room_");

    } while (
        rooms.has(roomId)
    );


    const room =
        new GameRoom(
            roomId,
            type,
            ownerId
        );


    rooms.set(
        roomId,
        room
    );


    return room;

}


/* =========================================================
   FIND PUBLIC ROOM
========================================================= */

function findAvailablePublicRoom() {

    for (
        const room
        of rooms.values()
    ) {

        if (
            room.type ===
            ROOM_TYPES.PUBLIC &&
            room.phase ===
            GAME_PHASES.WAITING &&
            room.players.filter(
                Boolean
            ).length < MAX_PLAYERS
        ) {

            return room;

        }

    }


    return null;

}


/* =========================================================
   CLEAN ROOMS
========================================================= */

setInterval(
    () => {

        const current =
            now();


        for (
            const [roomId, room]
            of rooms
        ) {

            /*
               Remove completely empty rooms.
            */

            const activePlayers =
                room.players.filter(
                    p =>
                        p &&
                        (
                            p.connected ||
                            p.reconnectUntil >
                            current
                        )
                );


            if (
                activePlayers.length === 0
            ) {

                room.cancelTurnTimer();

                rooms.delete(
                    roomId
                );

            }

        }

    },
    60000
);


/* =========================================================
   WEBSOCKET CONNECTION
========================================================= */

wss.on(
    "connection",
    (ws) => {

        const connectionId =
            id("conn_");


        ws.connectionId =
            connectionId;


        sessions.set(
            connectionId,
            {
                ws,
                room: null,
                player: null
            }
        );


        send(
            ws,
            "CONNECTED",
            {
                connectionId
            }
        );


        ws.on(
            "message",
            raw => {

                handleMessage(
                    ws,
                    raw
                );

            }
        );


        ws.on(
            "close",
            () => {

                handleDisconnect(
                    ws
                );

            }
        );


        ws.on(
            "error",
            () => {

                handleDisconnect(
                    ws
                );

            }
        );

    }
);


/* =========================================================
   MESSAGE HANDLER
========================================================= */

function handleMessage(
    ws,
    raw
) {

    let message;

    try {

        message =
            JSON.parse(
                raw.toString()
            );

    }

    catch {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Invalid JSON."
            }
        );

        return;

    }


    const session =
        sessions.get(
            ws.connectionId
        );


    if (!session) {
        return;
    }


    switch (
        message.type
    ) {

        case "CREATE_ROOM":

            handleCreateRoom(
                ws,
                message
            );

            break;


        case "JOIN_PUBLIC":

            handleJoinPublic(
                ws,
                message
            );

            break;


        case "JOIN_PRIVATE":

            handleJoinPrivate(
                ws,
                message
            );

            break;


        case "START_GAME":

            handleStartGame(
                ws
            );

            break;


        case "BID":

            handleBid(
                ws,
                message
            );

            break;


        case "PLAY_CARD":

            handlePlayCard(
                ws,
                message
            );

            break;


        case "RECONNECT":

            handleReconnect(
                ws,
                message
            );

            break;


        case "PING":

            send(
                ws,
                "PONG",
                {
                    time:
                        now()
                }
            );

            break;


        default:

            send(
                ws,
                "ERROR",
                {
                    message:
                        "Unknown message type."
                }
            );

    }

}


/* =========================================================
   CREATE ROOM
========================================================= */

function handleCreateRoom(
    ws,
    message
) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (
        session.room
    ) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Already inside a room."
            }
        );

        return;

    }


    const playerId =
        typeof message.playerId ===
        "string"
            ? message.playerId
            : id("player_");


    const name =
        safeName(
            message.name
        );


    const type =
        message.private
            ? ROOM_TYPES.PRIVATE
            : ROOM_TYPES.PUBLIC;


    const room =
        createRoom(
            type,
            playerId
        );


    const player =
        room.addPlayer(
            playerId,
            name
        );


    player.socket =
        ws;


    session.room =
        room;

    session.player =
        player;


    send(
        ws,
        "ROOM_CREATED",
        {

            roomId:
                room.id,

            roomCode:
                room.code,

            playerId:
                player.id,

            seat:
                player.seat,

            roomType:
                room.type

        }
    );


    room.broadcastState();

}


/* =========================================================
   JOIN PUBLIC
========================================================= */

function handleJoinPublic(
    ws,
    message
) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (
        session.room
    ) {

        return;

    }


    let room =
        findAvailablePublicRoom();


    if (!room) {

        room =
            createRoom(
                ROOM_TYPES.PUBLIC,
                null
            );

    }


    const playerId =
        typeof message.playerId ===
        "string"
            ? message.playerId
            : id("player_");


    const player =
        room.addPlayer(
            playerId,
            message.name
        );


    if (!player) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Public room is full."
            }
        );

        return;

    }


    player.socket =
        ws;


    player.connected =
        true;


    session.room =
        room;

    session.player =
        player;


    send(
        ws,
        "ROOM_JOINED",
        {

            roomId:
                room.id,

            roomCode:
                room.code,

            playerId:
                player.id,

            seat:
                player.seat,

            roomType:
                room.type

        }
    );


    room.broadcastState();


    /*
       Automatically start once
       six players are present.
    */

    if (
        room.players.filter(
            Boolean
        ).length === MAX_PLAYERS
    ) {

        setTimeout(
            () => {

                room.startGame();

            },
            1000
        );

    }

}


/* =========================================================
   JOIN PRIVATE
========================================================= */

function handleJoinPrivate(
    ws,
    message
) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (
        session.room
    ) {

        return;

    }


    const code =
        String(
            message.code || ""
        )
        .trim()
        .toUpperCase();


    let room = null;


    for (
        const candidate
        of rooms.values()
    ) {

        if (
            candidate.type ===
            ROOM_TYPES.PRIVATE &&
            candidate.code ===
            code
        ) {

            room =
                candidate;

            break;

        }

    }


    if (!room) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Private room not found."
            }
        );

        return;

    }


    if (
        room.players.filter(
            Boolean
        ).length >=
        MAX_PLAYERS
    ) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Room is full."
            }
        );

        return;

    }


    const playerId =
        typeof message.playerId ===
        "string"
            ? message.playerId
            : id("player_");


    const player =
        room.addPlayer(
            playerId,
            message.name
        );


    if (!player) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Could not join room."
            }
        );

        return;

    }


    player.socket =
        ws;

    player.connected =
        true;


    session.room =
        room;

    session.player =
        player;


    send(
        ws,
        "ROOM_JOINED",
        {

            roomId:
                room.id,

            roomCode:
                room.code,

            playerId:
                player.id,

            seat:
                player.seat,

            roomType:
                room.type

        }
    );


    room.broadcastState();

}


/* =========================================================
   START GAME
========================================================= */

function handleStartGame(ws) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (
        !session ||
        !session.room ||
        !session.player
    ) {

        return;

    }


    const room =
        session.room;


    if (
        room.ownerId !==
        session.player.id
    ) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Only room owner can start."
            }
        );

        return;

    }


    room.startGame();

}


/* =========================================================
   BID
========================================================= */

function handleBid(
    ws,
    message
) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (
        !session ||
        !session.room ||
        !session.player
    ) {

        return;

    }


    session.room.submitBid(
        session.player.id,
        message.value
    );

}


/* =========================================================
   PLAY CARD
========================================================= */

function handlePlayCard(
    ws,
    message
) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (
        !session ||
        !session.room ||
        !session.player
    ) {

        return;

    }


    session.room.playCard(
        session.player.id,
        message.cardId
    );

}


/* =========================================================
   RECONNECT
========================================================= */

function handleReconnect(
    ws,
    message
) {

    const playerId =
        typeof message.playerId ===
        "string"
            ? message.playerId
            : null;


    if (!playerId) {

        send(
            ws,
            "ERROR",
            {
                message:
                    "Player ID required."
            }
        );

        return;

    }


    for (
        const room
        of rooms.values()
    ) {

        const player =
            room.getPlayer(
                playerId
            );


        if (!player) {
            continue;
        }


        /*
           Reconnect grace period.
        */

        if (
            player.reconnectUntil <
            now() &&
            player.connected === false
        ) {

            continue;

        }


        player.socket =
            ws;

        player.connected =
            true;

        player.isAI =
            false;

        player.reconnectUntil =
            0;


        const session =
            sessions.get(
                ws.connectionId
            );


        session.room =
            room;

        session.player =
            player;


        send(
            ws,
            "RECONNECTED",
            {

                roomId:
                    room.id,

                playerId:
                    player.id,

                seat:
                    player.seat

            }
        );


        send(
            ws,
            "YOUR_HAND",
            {
                cards:
                    player.hand
            }
        );


        room.broadcastState();


        if (
            room.turnSeat ===
            player.seat &&
            room.phase ===
            GAME_PHASES.PLAYING
        ) {

            room.startTurnTimer();

        }


        return;

    }


    send(
        ws,
        "ERROR",
        {
            message:
                "Reconnect session expired."
        }
    );

}


/* =========================================================
   DISCONNECT
========================================================= */

function handleDisconnect(ws) {

    const session =
        sessions.get(
            ws.connectionId
        );


    if (!session) {
        return;
    }


    if (
        session.room &&
        session.player
    ) {

        session.room.disconnectPlayer(
            session.player
        );

    }


    sessions.delete(
        ws.connectionId
    );

}


/* =========================================================
   START SERVER
========================================================= */

httpServer.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "COURT PIECES SPADES SERVER"
        );

        console.log(
            "ONLINE"
        );

        console.log(
            `PORT: ${PORT}`
        );

        console.log(
            `MAX PLAYERS: ${MAX_PLAYERS}`
        );

        console.log(
            `ROUNDS: ${TOTAL_ROUNDS}`
        );

        console.log(
            `CARDS PER PLAYER: ${CARDS_PER_PLAYER}`
        );

        console.log(
            `TURN TIME: ${TURN_TIME}ms`
        );

        console.log(
            "WebSocket: READY"
        );

        console.log(
            "========================================"
        );

    }
);


/* =========================================================
   PROCESS SAFETY
========================================================= */

process.on(
    "SIGTERM",
    () => {

        console.log(
            "SIGTERM received."
        );


        for (
            const room
            of rooms.values()
        ) {

            room.cancelTurnTimer();

        }


        wss.close(
            () => {

                httpServer.close(
                    () => {

                        process.exit(0);

                    }
                );

            }
        );

    }
);


process.on(
    "uncaughtException",
    error => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );

    }
);
