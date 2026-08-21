/* =========================================================
   SPADES 6 PLAYER
   GAME.JS
   Version: Multiplayer + 5 Second AI + Offline Fallback
========================================================= */

"use strict";

/* =========================================================
   CONFIG
========================================================= */

const GAME_CONFIG = {

    PLAYERS: 6,

    CARDS_PER_PLAYER: 9,

    ROUNDS: 6,

    TURN_TIME: 5000,

    AI_DELAY_MIN: 450,

    AI_DELAY_MAX: 1100,

    TRUMP: "S",

    WS_URL:
        window.SPADES_SERVER_URL ||
        (
            location.protocol === "https:"
                ? "wss://" + location.host
                : "ws://" + location.host
        )

};


/* =========================================================
   PLAYER SEATS
========================================================= */

const PLAYERS = {

    1: { id: 1, team: "blue", name: "Player 1" },

    2: { id: 2, team: "red", name: "Player 2" },

    3: { id: 3, team: "blue", name: "Player 3" },

    4: { id: 4, team: "red", name: "Player 4" },

    5: { id: 5, team: "blue", name: "Player 5" },

    6: { id: 6, team: "red", name: "Player 6" }

};


/* =========================================================
   CARD DEFINITIONS
========================================================= */

const SUITS = ["S", "H", "D", "C"];

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
   GAME STATE
========================================================= */

const state = {

    connected: false,

    onlineMode: false,

    roomId: null,

    myPlayerId: null,

    phase: "waiting",

    round: 0,

    starter: 1,

    currentPlayer: 1,

    trickNumber: 0,

    trickLeader: 1,

    trickCards: [],

    hands: {},

    players: {},

    bids: {

        blue: 0,
        red: 0

    },

    tricks: {

        blue: 0,
        red: 0

    },

    scores: {

        blue: 0,
        red: 0

    },

    cardHistory: [],

    usedCards: [],

    timerStartedAt: 0,

    timerEndsAt: 0,

    aiPlayers: new Set(),

    gameOver: false

};


/* =========================================================
   LOCAL STORAGE
========================================================= */

const STORAGE_KEY =
    "spades_6_player_state_v4";


function saveLocalState() {

    try {

        const copy = {

            roomId: state.roomId,

            myPlayerId: state.myPlayerId,

            round: state.round,

            starter: state.starter,

            currentPlayer: state.currentPlayer,

            trickNumber: state.trickNumber,

            bids: state.bids,

            tricks: state.tricks,

            scores: state.scores,

            aiPlayers:
                Array.from(state.aiPlayers)

        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(copy)
        );

    } catch (error) {

        console.warn(
            "Could not save game state",
            error
        );

    }

}


/* =========================================================
   LOAD LOCAL STATE
========================================================= */

function loadLocalState() {

    try {

        const raw =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!raw) return;

        const data =
            JSON.parse(raw);

        if (data.round) {

            state.round =
                data.round;

        }

        if (data.starter) {

            state.starter =
                data.starter;

        }

        if (data.trickNumber) {

            state.trickNumber =
                data.trickNumber;

        }

        if (data.bids) {

            state.bids =
                data.bids;

        }

        if (data.tricks) {

            state.tricks =
                data.tricks;

        }

        if (data.scores) {

            state.scores =
                data.scores;

        }

    } catch (error) {

        console.warn(
            "Local state invalid",
            error
        );

    }

}


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {

    return document.getElementById(id);

}


function setText(id, value) {

    const element = $(id);

    if (element) {

        element.textContent =
            value;

    }

}


/* =========================================================
   WEBSOCKET
========================================================= */

let socket = null;

let reconnectTimer = null;


function connectToServer() {

    if (
        !window.WebSocket
    ) {

        console.warn(
            "WebSocket unavailable. Offline mode."
        );

        startOfflineMode();

        return;

    }


    try {

        socket =
            new WebSocket(
                GAME_CONFIG.WS_URL
            );


        socket.onopen =
            function () {

                state.connected = true;

                state.onlineMode = true;

                updateConnectionUI(
                    true
                );


                sendServer({

                    type: "join",

                    playerId:
                        getLocalPlayerId(),

                    roomId:
                        getRoomId()

                });

            };


        socket.onmessage =
            function (event) {

                try {

                    const message =
                        JSON.parse(
                            event.data
                        );

                    handleServerMessage(
                        message
                    );

                } catch (error) {

                    console.error(
                        "Bad server message",
                        error
                    );

                }

            };


        socket.onclose =
            function () {

                state.connected = false;

                updateConnectionUI(
                    false
                );


                /*
                   Offline AI fallback.
                   We don't immediately destroy
                   the local game.
                */

                if (
                    !state.gameOver
                ) {

                    startOfflineMode();

                }


                scheduleReconnect();

            };


        socket.onerror =
            function (error) {

                console.warn(
                    "WebSocket error",
                    error
                );

            };

    } catch (error) {

        console.warn(
            "Server unavailable",
            error
        );

        startOfflineMode();

    }

}


/* =========================================================
   RECONNECT
========================================================= */

function scheduleReconnect() {

    if (reconnectTimer) {

        return;

    }


    reconnectTimer =
        setTimeout(
            function () {

                reconnectTimer =
                    null;

                connectToServer();

            },
            3000
        );

}


/* =========================================================
   SEND SERVER
========================================================= */

function sendServer(data) {

    if (
        !socket ||
        socket.readyState !==
        WebSocket.OPEN
    ) {

        return false;

    }


    socket.send(
        JSON.stringify(data)
    );


    return true;

}


/* =========================================================
   SERVER MESSAGES
========================================================= */

function handleServerMessage(message) {

    if (!message) return;


    switch (
        message.type
    ) {

        case "joined":

            handleJoined(
                message
            );

            break;


        case "state":

            applyServerState(
                message.state
            );

            break;


        case "yourSeat":

            state.myPlayerId =
                message.playerId;

            break;


        case "playerJoined":

            updatePlayerConnection(
                message.playerId,
                true
            );

            break;


        case "playerLeft":

            handlePlayerLeft(
                message.playerId
            );

            break;


        case "turn":

            handleServerTurn(
                message
            );

            break;


        case "aiMove":

            handleServerAIMove(
                message
            );

            break;


        case "cardPlayed":

            handleServerCardPlayed(
                message
            );

            break;


        case "trickFinished":

            handleTrickFinished(
                message
            );

            break;


        case "roundFinished":

            handleRoundFinished(
                message
            );

            break;


        case "gameFinished":

            handleGameFinished(
                message
            );

            break;


        case "error":

            showGameMessage(
                message.message ||
                "Server error."
            );

            break;

    }

}


/* =========================================================
   JOINED
========================================================= */

function handleJoined(message) {

    state.roomId =
        message.roomId ||
        state.roomId;


    state.myPlayerId =
        message.playerId ||
        state.myPlayerId;


    if (
        message.state
    ) {

        applyServerState(
            message.state
        );

    }


    updateConnectionUI(
        true
    );

}


/* =========================================================
   APPLY SERVER STATE
========================================================= */

function applyServerState(serverState) {

    if (!serverState) return;


    Object.keys(
        serverState
    ).forEach(key => {

        if (
            key === "aiPlayers"
        ) {

            state.aiPlayers =
                new Set(
                    serverState.aiPlayers ||
                    []
                );

            return;

        }


        if (
            key in state
        ) {

            state[key] =
                serverState[key];

        }

    });


    renderGameState();

    saveLocalState();

}


/* =========================================================
   PLAYER ID
========================================================= */

function getLocalPlayerId() {

    const key =
        "spades_player_id";


    let id =
        localStorage.getItem(
            key
        );


    if (!id) {

        id =
            String(
                Math.floor(
                    Math.random() * 6
                ) + 1
            );

        localStorage.setItem(
            key,
            id
        );

    }


    return Number(id);

}


/* =========================================================
   ROOM ID
========================================================= */

function getRoomId() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    return (
        params.get("room") ||
        "public"
    );

}


/* =========================================================
   CONNECTION UI
========================================================= */

function updateConnectionUI(
    online
) {

    const status =
        $("connectionStatus");


    if (!status) return;


    if (online) {

        status.textContent =
            "ONLINE";

        status.className =
            "online";

    } else {

        status.textContent =
            "OFFLINE";

        status.className =
            "offline";

    }

}


/* =========================================================
   PLAYER CONNECTION
========================================================= */

function updatePlayerConnection(
    playerId,
    connected
) {

    if (
        !state.players[playerId]
    ) {

        state.players[playerId] = {

            id: playerId,

            connected,

            ai: !connected

        };

    } else {

        state.players[playerId]
            .connected =
            connected;

        state.players[playerId]
            .ai =
            !connected;

    }


    if (connected) {

        state.aiPlayers.delete(
            Number(playerId)
        );

    } else {

        state.aiPlayers.add(
            Number(playerId)
        );

    }


    renderPlayers();

}


/* =========================================================
   PLAYER LEFT
========================================================= */

function handlePlayerLeft(
    playerId
) {

    state.aiPlayers.add(
        Number(playerId)
    );


    if (
        state.players[playerId]
    ) {

        state.players[playerId]
            .connected =
            false;

        state.players[playerId]
            .ai =
            true;

    }


    renderPlayers();


    /*
       If the disconnected player is currently
       supposed to act, AI takes the seat.
    */

    if (
        Number(playerId) ===
        Number(state.currentPlayer)
    ) {

        scheduleLocalAI(
            Number(playerId)
        );

    }

}


/* =========================================================
   SERVER TURN
========================================================= */

function handleServerTurn(
    message
) {

    state.currentPlayer =
        Number(
            message.playerId
        );


    state.timerStartedAt =
        Number(
            message.startedAt ||
            Date.now()
        );


    state.timerEndsAt =
        state.timerStartedAt +
        GAME_CONFIG.TURN_TIME;


    renderTurn();


    if (
        state.currentPlayer ===
        state.myPlayerId &&
        !state.aiPlayers.has(
            state.myPlayerId
        )
    ) {

        startTurnTimer();

    }

}


/* =========================================================
   SERVER AI MOVE
========================================================= */

function handleServerAIMove(
    message
) {

    const playerId =
        Number(
            message.playerId
        );


    state.aiPlayers.add(
        playerId
    );


    renderPlayers();

}


/* =========================================================
   SERVER CARD PLAYED
========================================================= */

function handleServerCardPlayed(
    message
) {

    if (
        message.card
    ) {

        addPlayedCard(
            Number(
                message.playerId
            ),
            message.card
        );

    }


    if (
        message.state
    ) {

        applyServerState(
            message.state
        );

    }

}


/* =========================================================
   SERVER TRICK FINISHED
========================================================= */

function handleTrickFinished(
    message
) {

    if (
        message.winner
    ) {

        const winner =
            Number(
                message.winner
            );


        const team =
            getTeam(
                winner
            );


        if (team) {

            state.tricks[team]++;

        }

    }


    renderScores();

}


/* =========================================================
   ROUND FINISHED
========================================================= */

function handleRoundFinished(
    message
) {

    if (
        message.state
    ) {

        applyServerState(
            message.state
        );

    }


    showRoundResult();

}


/* =========================================================
   GAME FINISHED
========================================================= */

function handleGameFinished(
    message
) {

    state.gameOver =
        true;


    if (
        message.state
    ) {

        applyServerState(
            message.state
        );

    }


    showFinalResult();

}


/* =========================================================
   START TURN TIMER
========================================================= */

let turnTimer =
    null;

let turnInterval =
    null;


function startTurnTimer() {

    clearTurnTimer();


    const started =
        state.timerStartedAt ||
        Date.now();


    const end =
        state.timerEndsAt ||
        (
            started +
            GAME_CONFIG.TURN_TIME
        );


    state.timerStartedAt =
        started;

    state.timerEndsAt =
        end;


    updateTimerDisplay(
        end
    );


    turnInterval =
        setInterval(
            function () {

                updateTimerDisplay(
                    end
                );

            },
            100
        );


    turnTimer =
        setTimeout(
            function () {

                clearTurnTimer();

                timeoutCurrentPlayer();

            },
            Math.max(
                0,
                end - Date.now()
            )
        );

}


/* =========================================================
   CLEAR TURN TIMER
========================================================= */

function clearTurnTimer() {

    if (turnTimer) {

        clearTimeout(
            turnTimer
        );

        turnTimer = null;

    }


    if (turnInterval) {

        clearInterval(
            turnInterval
        );

        turnInterval = null;

    }

}


/* =========================================================
   TIMER DISPLAY
========================================================= */

function updateTimerDisplay(
    end
) {

    const remaining =
        Math.max(
            0,
            end - Date.now()
        );


    const seconds =
        Math.ceil(
            remaining / 1000
        );


    setText(
        "turnTimer",
        seconds
    );


    const timer =
        $("turnTimer");


    if (!timer) return;


    timer.classList.toggle(
        "danger",
        seconds <= 2
    );

}


/* =========================================================
   TIMEOUT
========================================================= */

function timeoutCurrentPlayer() {

    const playerId =
        Number(
            state.currentPlayer
        );


    if (!playerId) return;


    /*
       Server authoritative:
       ask server to force AI.
    */

    if (
        state.onlineMode &&
        state.connected
    ) {

        sendServer({

            type:
                "turnTimeout",

            playerId,

            roomId:
                state.roomId

        });


        return;

    }


    /*
       Offline fallback.
    */

    state.aiPlayers.add(
        playerId
    );


    scheduleLocalAI(
        playerId
    );

}


/* =========================================================
   LOCAL AI
========================================================= */

function scheduleLocalAI(
    playerId
) {

    const delay =
        random(
            GAME_CONFIG.AI_DELAY_MIN,
            GAME_CONFIG.AI_DELAY_MAX
        );


    setTimeout(
        function () {

            if (
                state.currentPlayer !==
                playerId
            ) {

                return;

            }


            const card =
                chooseAICard(
                    playerId
                );


            if (!card) {

                return;

            }


            playCard(
                card,
                true
            );

        },
        delay
    );

}


/* =========================================================
   AI CARD SELECTION
========================================================= */

function chooseAICard(
    playerId
) {

    const hand =
        state.hands[playerId] ||
        [];


    if (!hand.length) {

        return null;

    }


    const legalCards =
        getLegalCards(
            playerId
        );


    if (!legalCards.length) {

        return hand[0];

    }


    /*
       Natural balanced AI.
    */

    if (
        state.trickCards.length === 0
    ) {

        return chooseLeadCard(
            legalCards,
            playerId
        );

    }


    return chooseFollowCard(
        legalCards,
        playerId
    );

}


/* =========================================================
   LEAD AI
========================================================= */

function chooseLeadCard(
    cards,
    playerId
) {

    const team =
        getTeam(
            playerId
        );


    const sorted =
        [...cards].sort(
            cardStrengthAscending
        );


    /*
       Avoid wasting strongest trump cards
       unless necessary.
    */

    const nonTrump =
        sorted.filter(
            card =>
                card.suit !==
                GAME_CONFIG.TRUMP
        );


    if (
        nonTrump.length
    ) {

        return nonTrump[
            Math.floor(
                nonTrump.length *
                0.35
            )
        ];

    }


    return sorted[0];

}


/* =========================================================
   FOLLOW AI
========================================================= */

function chooseFollowCard(
    cards,
    playerId
) {

    const currentWinner =
        getCurrentWinningCard();


    const leadSuit =
        state.trickCards[0]
            ?.card?.suit;


    const following =
        cards.filter(
            card =>
                card.suit ===
                leadSuit
        );


    /*
       If player can follow suit,
       prefer smallest card that wins.
    */

    if (
        following.length
    ) {

        const winners =
            following.filter(
                card =>
                    compareCards(
                        card,
                        currentWinner.card
                    ) > 0
            );


        if (
            winners.length
        ) {

            return winners.sort(
                cardStrengthAscending
            )[0];

        }


        return following.sort(
            cardStrengthAscending
        )[0];

    }


    /*
       Can't follow suit.
       Try smallest trump if useful.
    */

    const trumps =
        cards.filter(
            card =>
                card.suit ===
                GAME_CONFIG.TRUMP
        );


    if (
        trumps.length
    ) {

        const winningTrumps =
            trumps.filter(
                card =>
                    compareCards(
                        card,
                        currentWinner.card
                    ) > 0
            );


        if (
            winningTrumps.length
        ) {

            return winningTrumps.sort(
                cardStrengthAscending
            )[0];

        }


        /*
           Do not waste trump if
           it cannot win.
        */

        return trumps.sort(
            cardStrengthAscending
        )[0];

    }


    /*
       Lowest safe card.
    */

    return cards.sort(
        cardStrengthAscending
    )[0];

}


/* =========================================================
   LEGAL CARDS
========================================================= */

function getLegalCards(
    playerId
) {

    const hand =
        state.hands[playerId] ||
        [];


    if (
        !state.trickCards.length
    ) {

        /*
           Joker cannot lead.
        */

        const nonJokers =
            hand.filter(
                card =>
                    !card.joker
            );


        return (
            nonJokers.length
                ? nonJokers
                : hand
        );

    }


    const leadSuit =
        state.trickCards[0]
            ?.card?.suit;


    const sameSuit =
        hand.filter(
            card =>
                card.suit ===
                leadSuit
        );


    if (
        sameSuit.length
    ) {

        return sameSuit;

    }


    return hand;

}


/* =========================================================
   CARD PLAY
========================================================= */

function playCard(
    card,
    byAI = false
) {

    if (!card) return false;


    const playerId =
        Number(
            state.currentPlayer
        );


    if (!playerId) {

        return false;

    }


    const legal =
        getLegalCards(
            playerId
        );


    if (
        !containsCard(
            legal,
            card
        )
    ) {

        if (
            !byAI
        ) {

            showGameMessage(
                "این کارت در این لحظه قابل بازی نیست."
            );

        }

        return false;

    }


    /*
       Online:
       Server decides whether this move is valid.
    */

    if (
        state.onlineMode &&
        state.connected &&
        !byAI
    ) {

        sendServer({

            type:
                "playCard",

            roomId:
                state.roomId,

            playerId,

            card

        });


        clearTurnTimer();

        return true;

    }


    /*
       Offline or local AI.
    */

    removeCardFromHand(
        playerId,
        card
    );


    addPlayedCard(
        playerId,
        card
    );


    if (
        byAI
    ) {

        state.aiPlayers.add(
            playerId
        );

    }


    saveLocalState();


    return true;

}


/* =========================================================
   CARD VALIDATION
========================================================= */

function containsCard(
    cards,
    target
) {

    return cards.some(
        card =>
            card.id ===
            target.id
    );

}


/* =========================================================
   REMOVE CARD
========================================================= */

function removeCardFromHand(
    playerId,
    card
) {

    const hand =
        state.hands[playerId] ||
        [];


    const index =
        hand.findIndex(
            c =>
                c.id ===
                card.id
        );


    if (
        index >= 0
    ) {

        hand.splice(
            index,
            1
        );

    }


    renderMyHand();

}


/* =========================================================
   ADD PLAYED CARD
========================================================= */

function addPlayedCard(
    playerId,
    card
) {

    state.trickCards.push({

        playerId,

        card

    });


    state.cardHistory.push({

        round:
            state.round,

        trick:
            state.trickNumber,

        playerId,

        card

    });


    renderPlayedCards();


    if (
        state.trickCards.length >=
        GAME_CONFIG.PLAYERS
    ) {

        finishLocalTrick();

        return;

    }


    state.currentPlayer =
        getNextPlayer(
            playerId
        );


    renderTurn();


    if (
        state.aiPlayers.has(
            state.currentPlayer
        )
    ) {

        scheduleLocalAI(
            state.currentPlayer
        );

    } else if (
        state.currentPlayer ===
        state.myPlayerId
    ) {

        startTurnTimer();

    }

}


/* =========================================================
   FINISH LOCAL TRICK
========================================================= */

function finishLocalTrick() {

    clearTurnTimer();


    const winner =
        getTrickWinner();


    const team =
        getTeam(
            winner
        );


    if (team) {

        state.tricks[team]++;

    }


    renderScores();


    setTimeout(
        function () {

            state.trickCards = [];

            state.trickNumber++;

            renderPlayedCards();


            /*
               Continue until the 9 cards
               have been played by each player.
            */

            const cardsPlayed =
                state.cardHistory.filter(
                    item =>
                        item.round ===
                        state.round
                ).length;


            const required =
                GAME_CONFIG.PLAYERS *
                GAME_CONFIG.CARDS_PER_PLAYER;


            if (
                cardsPlayed >=
                required
            ) {

                finishLocalRound();

                return;

            }


            state.currentPlayer =
                winner;

            state.trickLeader =
                winner;


            renderTurn();


            if (
                state.aiPlayers.has(
                    winner
                )
            ) {

                scheduleLocalAI(
                    winner
                );

            } else if (
                winner ===
                state.myPlayerId
            ) {

                startTurnTimer();

            }

        },
        700
    );

}


/* =========================================================
   FINISH LOCAL ROUND
========================================================= */

function finishLocalRound() {

    clearTurnTimer();


    calculateRoundScore();


    showRoundResult();


    /*
       Next starter:
       1 → 2 → 3 → 4 → 5 → 6
    */

    if (
        state.starter <
        GAME_CONFIG.PLAYERS
    ) {

        state.starter++;

    } else {

        /*
           Six starts completed.
           Game finished.
        */

        finishLocalGame();

        return;

    }


    setTimeout(
        function () {

            state.round++;

            state.trickNumber = 0;

            state.trickCards = [];

            state.tricks.blue = 0;

            state.tricks.red = 0;

            state.bids.blue = 0;

            state.bids.red = 0;


            dealNewRound();


        },
        1200
    );

}


/* =========================================================
   ROUND SCORE
========================================================= */

function calculateRoundScore() {

    const blue =
        calculateTeamScore(
            state.bids.blue,
            state.tricks.blue
        );


    const red =
        calculateTeamScore(
            state.bids.red,
            state.tricks.red
        );


    state.scores.blue +=
        blue;


    state.scores.red +=
        red;


    renderScores();

}


/* =========================================================
   SCORE
========================================================= */

function calculateTeamScore(
    bid,
    tricks
) {

    /*
       Special declaration 7.
    */

    if (
        bid === 7
    ) {

        return tricks >= 7
            ? 140
            : -140;

    }


    if (
        tricks < bid
    ) {

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
   TRICK WINNER
========================================================= */

function getTrickWinner() {

    if (
        !state.trickCards.length
    ) {

        return null;

    }


    let winner =
        state.trickCards[0];


    for (
        let i = 1;
        i < state.trickCards.length;
        i++
    ) {

        const candidate =
            state.trickCards[i];


        if (
            compareCards(
                candidate.card,
                winner.card,
                state.trickCards[0]
                    .card
                    .suit
            ) > 0
        ) {

            winner =
                candidate;

        }

    }


    return winner.playerId;

}


/* =========================================================
   CURRENT WINNING CARD
========================================================= */

function getCurrentWinningCard() {

    let winner =
        state.trickCards[0];


    for (
        let i = 1;
        i < state.trickCards.length;
        i++
    ) {

        const candidate =
            state.trickCards[i];


        if (
            compareCards(
                candidate.card,
                winner.card,
                state.trickCards[0]
                    .card
                    .suit
            ) > 0
        ) {

            winner =
                candidate;

        }

    }


    return winner;

}


/* =========================================================
   COMPARE CARDS
========================================================= */

function compareCards(
    a,
    b,
    leadSuit
) {

    const aPower =
        cardPower(
            a,
            leadSuit
        );


    const bPower =
        cardPower(
            b,
            leadSuit
        );


    return (
        aPower -
        bPower
    );

}


/* =========================================================
   CARD POWER
========================================================= */

function cardPower(
    card,
    leadSuit
) {

    /*
       Red Joker:
       highest.
    */

    if (
        card.joker &&
        card.color ===
        "red"
    ) {

        return 1000;

    }


    /*
       Ace of Spades.
    */

    if (
        card.id ===
        "AS"
    ) {

        return 950;

    }


    /*
       Black Joker.
    */

    if (
        card.joker &&
        card.color ===
        "black"
    ) {

        return 940;

    }


    /*
       King of Spades.
    */

    if (
        card.id ===
        "KS"
    ) {

        return 930;

    }


    /*
       Trump.
    */

    if (
        card.suit ===
        GAME_CONFIG.TRUMP
    ) {

        return 700 +
            RANK_VALUE[
                card.rank
            ];

    }


    /*
       Lead suit.
    */

    if (
        card.suit ===
        leadSuit
    ) {

        return 400 +
            RANK_VALUE[
                card.rank
            ];

    }


    return RANK_VALUE[
        card.rank
    ] || 0;

}


/* =========================================================
   SORT
========================================================= */

function cardStrengthAscending(
    a,
    b
) {

    return (
        cardPower(a, "S") -
        cardPower(b, "S")
    );

}


/* =========================================================
   TEAM
========================================================= */

function getTeam(
    playerId
) {

    playerId =
        Number(
            playerId
        );


    if (
        playerId === 1 ||
        playerId === 3 ||
        playerId === 5
    ) {

        return "blue";

    }


    if (
        playerId === 2 ||
        playerId === 4 ||
        playerId === 6
    ) {

        return "red";

    }


    return null;

}


/* =========================================================
   NEXT PLAYER
========================================================= */

function getNextPlayer(
    playerId
) {

    return (
        Number(playerId) %
        GAME_CONFIG.PLAYERS
    ) + 1;

}


/* =========================================================
   RANDOM
========================================================= */

function random(
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
   DECK
========================================================= */

function createDeck() {

    const deck = [];


    SUITS.forEach(
        suit => {

            RANKS.forEach(
                rank => {

                    deck.push({

                        id:
                            rank + suit,

                        rank,

                        suit,

                        joker:false

                    });

                }
            );

        }
    );


    deck.push({

        id:
            "JR",

        rank:
            "JOKER",

        suit:
            null,

        joker:true,

        color:
            "red"

    });


    deck.push({

        id:
            "JB",

        rank:
            "JOKER",

        suit:
            null,

        joker:true,

        color:
            "black"

    });


    return shuffle(
        deck
    );

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(
    array
) {

    const result =
        [...array];


    for (
        let i =
            result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
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
   DEAL
========================================================= */

function dealNewRound() {

    const deck =
        createDeck();


    state.hands = {};


    for (
        let player = 1;
        player <= 6;
        player++
    ) {

        state.hands[player] =
            [];

    }


    for (
        let i = 0;
        i < deck.length;
        i++
    ) {

        const player =
            (
                i %
                GAME_CONFIG.PLAYERS
            ) + 1;


        state.hands[player]
            .push(
                deck[i]
            );

    }


    state.usedCards =
        [];


    renderMyHand();


    state.currentPlayer =
        state.starter;


    state.trickLeader =
        state.starter;


    renderTurn();


    if (
        state.aiPlayers.has(
            state.currentPlayer
        )
    ) {

        scheduleLocalAI(
            state.currentPlayer
        );

    } else if (
        state.currentPlayer ===
        state.myPlayerId
    ) {

        startTurnTimer();

    }

}


/* =========================================================
   RENDER MY HAND
========================================================= */

function renderMyHand() {

    const hand =
        state.hands[
            state.myPlayerId
        ] || [];


    /*
       Works with current game.html.
    */

    const container =
        $("myHand");


    if (!container) {

        return;

    }


    container.innerHTML = "";


    hand.forEach(
        card => {

            const element =
                document.createElement(
                    "button"
                );


            element.className =
                "real-card";


            element.dataset.cardId =
                card.id;


            element.innerHTML =
                cardHTML(
                    card
                );


            element.onclick =
                function () {

                    if (
                        state.currentPlayer !==
                        state.myPlayerId
                    ) {

                        return;

                    }


                    playCard(
                        card,
                        false
                    );

                };


            container.appendChild(
                element
            );

        }
    );

}


/* =========================================================
   CARD HTML
========================================================= */

function cardHTML(
    card
) {

    if (
        card.joker
    ) {

        return `
            <span class="joker">
                ${card.color === "red"
                    ? "🃏"
                    : "🃏"}
            </span>
        `;

    }


    const symbols = {

        S: "♠",

        H: "♥",

        D: "♦",

        C: "♣"

    };


    return `
        <span class="card-rank">
            ${card.rank}
        </span>
        <span class="card-suit ${(
            card.suit === "H" ||
            card.suit === "D"
        ) ? "red" : ""}">
            ${symbols[card.suit]}
        </span>
    `;

}


/* =========================================================
   RENDER PLAYED CARDS
========================================================= */

function renderPlayedCards() {

    const container =
        $("playedCards");


    if (!container) {

        return;

    }


    container.innerHTML = "";


    state.trickCards.forEach(
        (item, index) => {

            const element =
                document.createElement(
                    "div"
                );


            element.className =
                "played-card show";


            element.innerHTML =
                cardHTML(
                    item.card
                );


            element.dataset.player =
                item.playerId;


            container.appendChild(
                element
            );

        }
    );

}


/* =========================================================
   RENDER TURN
========================================================= */

function renderTurn() {

    document
        .querySelectorAll(
            ".player"
        )
        .forEach(
            element =>
                element.classList
                    .remove(
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


    setText(
        "centerText",
        "PLAYER " +
        state.currentPlayer +
        " TURN"
    );


    setText(
        "roundNumber",
        "ROUND " +
        state.round +
        " / 6"
    );

}


/* =========================================================
   RENDER PLAYERS
========================================================= */

function renderPlayers() {

    for (
        let id = 1;
        id <= 6;
        id++
    ) {

        const player =
            state.players[id];


        const element =
            document.querySelector(
                ".p" + id
            );


        if (!element) continue;


        const card =
            element.querySelector(
                ".player-card"
            );


        if (
            state.aiPlayers.has(id)
        ) {

            element.classList.add(
                "ai"
            );

            if (card) {

                const name =
                    card.querySelector(
                        ".player-name"
                    );

                if (name) {

                    name.textContent =
                        "AI";

                }

            }

        } else {

            element.classList.remove(
                "ai"
            );

        }

    }

}


/* =========================================================
   RENDER SCORES
========================================================= */

function renderScores() {

    setText(
        "blueScore",
        state.scores.blue
    );


    setText(
        "redScore",
        state.scores.red
    );

}


/* =========================================================
   RENDER GAME
========================================================= */

function renderGameState() {

    renderPlayers();

    renderTurn();

    renderScores();

    renderMyHand();

    renderPlayedCards();

}


/* =========================================================
   ROUND RESULT
========================================================= */

function showRoundResult() {

    const overlay =
        $("scoreOverlay");


    if (!overlay) return;


    setText(
        "scoreBlueBid",
        state.bids.blue
    );


    setText(
        "scoreRedBid",
        state.bids.red
    );


    setText(
        "scoreBlueTricks",
        state.tricks.blue
    );


    setText(
        "scoreRedTricks",
        state.tricks.red
    );


    setText(
        "scoreBlueTotal",
        state.scores.blue
    );


    setText(
        "scoreRedTotal",
        state.scores.red
    );


    overlay.classList.add(
        "show"
    );

}


/* =========================================================
   FINAL RESULT
========================================================= */

function showFinalResult() {

    const blue =
        state.scores.blue;

    const red =
        state.scores.red;


    setText(
        "finalBlueScore",
        blue
    );


    setText(
        "finalRedScore",
        red
    );


    let winner =
        "DRAW";


    if (
        blue > red
    ) {

        winner =
            "🔵 BLUE TEAM";

    }


    if (
        red > blue
    ) {

        winner =
            "🔴 RED TEAM";

    }


    setText(
        "winnerName",
        winner
    );


    const overlay =
        $("resultOverlay");


    if (overlay) {

        overlay.classList.add(
            "show"
        );

    }

}


/* =========================================================
   OFFLINE MODE
========================================================= */

function startOfflineMode() {

    if (
        state.onlineMode &&
        state.connected
    ) {

        return;

    }


    state.onlineMode =
        false;


    /*
       Offline test table:
       six seats exist.
       disconnected seats become AI.
    */

    for (
        let id = 1;
        id <= 6;
        id++
    ) {

        if (
            id !== state.myPlayerId
        ) {

            state.aiPlayers.add(
                id
            );

        }

    }


    if (
        !state.round
    ) {

        state.round = 1;

        state.starter = 1;

        state.trickNumber = 1;

        dealNewRound();

    }


    renderGameState();

}


/* =========================================================
   GAME MESSAGE
========================================================= */

function showGameMessage(
    message
) {

    if (
        window.Telegram &&
        Telegram.WebApp &&
        typeof Telegram.WebApp.showAlert ===
        "function"
    ) {

        Telegram.WebApp.showAlert(
            message
        );

        return;

    }


    alert(
        message
    );

}


/* =========================================================
   START GAME
========================================================= */

function startGameEngine() {

    state.myPlayerId =
        getLocalPlayerId();


    state.roomId =
        getRoomId();


    loadLocalState();


    /*
       Try multiplayer first.
       If server unavailable,
       offline AI mode starts.
    */

    connectToServer();

}


/* =========================================================
   GLOBAL API
========================================================= */

window.SpadesGame = {

    state,

    playCard,

    startGame:
        startGameEngine,

    chooseAICard,

    createDeck,

    dealNewRound,

    connectToServer

};


/* =========================================================
   INIT
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        startGameEngine();

    }
);
