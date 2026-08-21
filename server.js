/* =========================================================
   SPADES 6 PLAYER SERVER
   SERVER.JS
   Multiplayer + 5 Second Timeout + AI Replacement
========================================================= */

"use strict";


/* =========================================================
   DEPENDENCIES
========================================================= */

const http =
    require("http");

const crypto =
    require("crypto");

const WebSocket =
    require("ws");


/* =========================================================
   CONFIG
========================================================= */

const PORT =
    process.env.PORT ||
    3000;


const CONFIG = {

    PLAYERS: 6,

    CARDS_PER_PLAYER: 9,

    ROUNDS: 6,

    TURN_TIME: 5000,

    TRUMP: "S"

};


/* =========================================================
   PLAYERS
========================================================= */

const PLAYER_IDS =
    [1,2,3,4,5,6];


function teamOf(
    playerId
) {

    playerId =
        Number(playerId);


    return (
        playerId === 1 ||
        playerId === 3 ||
        playerId === 5
    )
        ? "blue"
        : "red";

}


/* =========================================================
   HTTP SERVER
========================================================= */

const server =
    http.createServer(
        function (
            request,
            response
        ) {

            response.writeHead(
                200,
                {
                    "Content-Type":
                        "text/plain; charset=utf-8"
                }
            );

            response.end(
                "SPADES 6 PLAYER SERVER ONLINE"
            );

        }
    );


/* =========================================================
   WEBSOCKET SERVER
========================================================= */

const wss =
    new WebSocket.Server({
        server
    });


/* =========================================================
   ROOMS
========================================================= */

const rooms =
    new Map();


/* =========================================================
   CREATE ROOM
========================================================= */

function createRoom(
    roomId
) {

    const room = {

        id:
            roomId,

        clients:
            new Map(),

        aiPlayers:
            new Set(),

        players:
            {},

        phase:
            "waiting",

        round:
            0,

        starter:
            1,

        currentPlayer:
            1,

        trickNumber:
            0,

        trickLeader:
            1,

        deck:
            [],

        hands:
            {},

        trickCards:
            [],

        cardHistory:
            [],

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

        turnTimer:
            null,

        startedAt:
            0

    };


    PLAYER_IDS.forEach(
        playerId => {

            room.players[
                playerId
            ] = {

                id:
                    playerId,

                connected:
                    false,

                ai:
                    true

            };

            room.hands[
                playerId
            ] = [];

            room.aiPlayers.add(
                playerId
            );

        }
    );


    rooms.set(
        roomId,
        room
    );


    return room;

}


/* =========================================================
   GET ROOM
========================================================= */

function getRoom(
    roomId
) {

    if (
        !rooms.has(roomId)
    ) {

        return createRoom(
            roomId
        );

    }


    return rooms.get(
        roomId
    );

}


/* =========================================================
   CARD DECK
========================================================= */

const SUITS =
    ["S","H","D","C"];


const RANKS =
    [
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
   CREATE DECK
========================================================= */

function createDeck() {

    const deck = [];


    for (
        const suit of SUITS
    ) {

        for (
            const rank of RANKS
        ) {

            deck.push({

                id:
                    rank + suit,

                rank,

                suit,

                joker:
                    false

            });

        }

    }


    /*
       Red Joker
    */

    deck.push({

        id:
            "JR",

        rank:
            "JOKER",

        suit:
            null,

        joker:
            true,

        color:
            "red"

    });


    /*
       Black Joker
    */

    deck.push({

        id:
            "JB",

        rank:
            "JOKER",

        suit:
            null,

        joker:
            true,

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

function dealCards(
    room
) {

    room.deck =
        createDeck();


    PLAYER_IDS.forEach(
        playerId => {

            room.hands[
                playerId
            ] = [];

        }
    );


    for (
        let i = 0;
        i < room.deck.length;
        i++
    ) {

        const playerId =
            (
                i %
                CONFIG.PLAYERS
            ) + 1;


        room.hands[
            playerId
        ].push(
            room.deck[i]
        );

    }

}


/* =========================================================
   SEND
========================================================= */

function send(
    ws,
    data
) {

    if (
        !ws ||
        ws.readyState !==
        WebSocket.OPEN
    ) {

        return;

    }


    ws.send(
        JSON.stringify(
            data
        )
    );

}


/* =========================================================
   BROADCAST
========================================================= */

function broadcast(
    room,
    data
) {

    room.clients.forEach(
        ws => {

            send(
                ws,
                data
            );

        }
    );

}


/* =========================================================
   PUBLIC STATE
========================================================= */

function publicState(
    room,
    playerId
) {

    const hands = {};


    /*
       A player sees only their own
       cards.
    */

    hands[playerId] =
        room.hands[playerId] ||
        [];


    return {

        phase:
            room.phase,

        round:
            room.round,

        starter:
            room.starter,

        currentPlayer:
            room.currentPlayer,

        trickNumber:
            room.trickNumber,

        trickLeader:
            room.trickLeader,

        trickCards:
            room.trickCards,

        bids:
            room.bids,

        tricks:
            room.tricks,

        scores:
            room.scores,

        hands,

        aiPlayers:
            Array.from(
                room.aiPlayers
            ),

        players:
            room.players

    };

}


/* =========================================================
   BROADCAST STATE
========================================================= */

function broadcastState(
    room
) {

    room.clients.forEach(
        (
            ws,
            playerId
        ) => {

            send(
                ws,
                {

                    type:
                        "state",

                    state:
                        publicState(
                            room,
                            Number(
                                playerId
                            )
                        )

                }
            );

        }
    );

}


/* =========================================================
   JOIN
========================================================= */

function joinRoom(
    ws,
    roomId,
    playerId
) {

    const room =
        getRoom(
            roomId
        );


    playerId =
        Number(
            playerId
        );


    if (
        !PLAYER_IDS.includes(
            playerId
        )
    ) {

        send(
            ws,
            {

                type:
                    "error",

                message:
                    "Invalid player seat."

            }
        );

        return;

    }


    /*
       Replace old connection.
    */

    if (
        room.clients.has(
            playerId
        )
    ) {

        const old =
            room.clients.get(
                playerId
            );


        try {

            old.close();

        } catch (error) {}

    }


    room.clients.set(
        playerId,
        ws
    );


    room.players[playerId]
        .connected =
        true;


    room.players[playerId]
        .ai =
        false;


    room.aiPlayers.delete(
        playerId
    );


    ws.roomId =
        roomId;


    ws.playerId =
        playerId;


    send(
        ws,
        {

            type:
                "joined",

            roomId,

            playerId,

            state:
                publicState(
                    room,
                    playerId
                )

        }
    );


    broadcast(
        room,
        {

            type:
                "playerJoined",

            playerId

        }
    );


    /*
       Start game automatically
       when all six human players
       have connected.
    */

    if (
        room.phase ===
            "waiting" &&
        room.clients.size ===
            CONFIG.PLAYERS
    ) {

        startGame(
            room
        );

    }


    /*
       If game is already running,
       update state.
    */

    broadcastState(
        room
    );

}


/* =========================================================
   START GAME
========================================================= */

function startGame(
    room
) {

    room.phase =
        "playing";


    room.round =
        1;


    room.starter =
        1;


    room.currentPlayer =
        1;


    room.trickNumber =
        1;


    room.trickLeader =
        1;


    room.trickCards =
        [];


    room.cardHistory =
        [];


    room.bids = {

        blue: 0,

        red: 0

    };


    room.tricks = {

        blue: 0,

        red: 0

    };


    room.scores = {

        blue: 0,

        red: 0

    };


    dealCards(
        room
    );


    broadcastState(
        room
    );


    startTurn(
        room
    );

}


/* =========================================================
   START TURN
========================================================= */

function startTurn(
    room
) {

    clearTurnTimer(
        room
    );


    room.startedAt =
        Date.now();


    const playerId =
        room.currentPlayer;


    broadcast(
        room,
        {

            type:
                "turn",

            playerId,

            startedAt:
                room.startedAt,

            timeout:
                CONFIG.TURN_TIME

        }
    );


    /*
       If this seat is AI,
       let AI make the move.
    */

    if (
        room.aiPlayers.has(
            playerId
        )
    ) {

        scheduleAI(
            room,
            playerId
        );

        return;

    }


    /*
       Server-side authoritative
       5-second timer.
    */

    room.turnTimer =
        setTimeout(
            function () {

                forceAITakeover(
                    room,
                    playerId
                );

            },
            CONFIG.TURN_TIME
        );

}


/* =========================================================
   CLEAR TIMER
========================================================= */

function clearTurnTimer(
    room
) {

    if (
        room.turnTimer
    ) {

        clearTimeout(
            room.turnTimer
        );

        room.turnTimer =
            null;

    }

}


/* =========================================================
   TIMEOUT
========================================================= */

function forceAITakeover(
    room,
    playerId
) {

    if (
        room.currentPlayer !==
        playerId
    ) {

        return;

    }


    room.aiPlayers.add(
        playerId
    );


    room.players[playerId]
        .ai =
        true;


    broadcast(
        room,
        {

            type:
                "aiMove",

            playerId,

            reason:
                "timeout"

        }
    );


    scheduleAI(
        room,
        playerId
    );

}


/* =========================================================
   DISCONNECT
========================================================= */

function disconnectPlayer(
    ws
) {

    const room =
        rooms.get(
            ws.roomId
        );


    if (!room) return;


    const playerId =
        Number(
            ws.playerId
        );


    /*
       Don't remove a newer connection
       belonging to the same seat.
    */

    if (
        room.clients.get(
            playerId
        ) !== ws
    ) {

        return;

    }


    room.clients.delete(
        playerId
    );


    room.players[playerId]
        .connected =
        false;


    room.players[playerId]
        .ai =
        true;


    room.aiPlayers.add(
        playerId
    );


    broadcast(
        room,
        {

            type:
                "playerLeft",

            playerId

        }
    );


    /*
       If it was currently their turn,
       AI acts immediately.
    */

    if (
        room.currentPlayer ===
        playerId &&
        room.phase ===
            "playing"
    ) {

        clearTurnTimer(
            room
        );


        scheduleAI(
            room,
            playerId
        );

    }


    broadcastState(
        room
    );

}


/* =========================================================
   RECEIVE CARD
========================================================= */

function playCard(
    room,
    playerId,
    cardId
) {

    playerId =
        Number(
            playerId
        );


    if (
        room.phase !==
        "playing"
    ) {

        return;

    }


    if (
        room.currentPlayer !==
        playerId
    ) {

        return;

    }


    const hand =
        room.hands[playerId] ||
        [];


    const cardIndex =
        hand.findIndex(
            card =>
                card.id ===
                cardId
        );


    if (
        cardIndex ===
        -1
    ) {

        return;

    }


    const card =
        hand[cardIndex];


    const legal =
        getLegalCards(
            room,
            playerId
        );


    if (
        !legal.some(
            item =>
                item.id ===
                card.id
        )
    ) {

        return;

    }


    clearTurnTimer(
        room
    );


    hand.splice(
        cardIndex,
        1
    );


    room.trickCards.push({

        playerId,

        card

    });


    room.cardHistory.push({

        round:
            room.round,

        trick:
            room.trickNumber,

        playerId,

        card

    });


    broadcast(
        room,
        {

            type:
                "cardPlayed",

            playerId,

            card

        }
    );


    broadcastState(
        room
    );


    /*
       Six cards played:
       determine winner.
    */

    if (
        room.trickCards.length ===
        CONFIG.PLAYERS
    ) {

        finishTrick(
            room
        );

        return;

    }


    room.currentPlayer =
        nextPlayer(
            playerId
        );


    startTurn(
        room
    );

}


/* =========================================================
   LEGAL CARDS
========================================================= */

function getLegalCards(
    room,
    playerId
) {

    const hand =
        room.hands[playerId] ||
        [];


    if (
        room.trickCards.length === 0
    ) {

        /*
           Joker cannot start.
        */

        const normal =
            hand.filter(
                card =>
                    !card.joker
            );


        return normal.length
            ? normal
            : hand;

    }


    const leadSuit =
        room.trickCards[0]
            .card
            .suit;


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
   AI
========================================================= */

function scheduleAI(
    room,
    playerId
) {

    const delay =
        450 +
        Math.floor(
            Math.random() *
            650
        );


    setTimeout(
        function () {

            if (
                room.currentPlayer !==
                playerId
            ) {

                return;

            }


            const card =
                chooseAI(
                    room,
                    playerId
                );


            if (card) {

                playCard(
                    room,
                    playerId,
                    card.id
                );

            }

        },
        delay
    );

}


/* =========================================================
   AI DECISION
========================================================= */

function chooseAI(
    room,
    playerId
) {

    const legal =
        getLegalCards(
            room,
            playerId
        );


    if (
        !legal.length
    ) {

        return null;

    }


    /*
       Lead:
       don't waste Joker or strongest trump.
    */

    if (
        room.trickCards.length === 0
    ) {

        const nonTrump =
            legal.filter(
                card =>
                    card.suit !==
                    CONFIG.TRUMP &&
                    !card.joker
            );


        if (
            nonTrump.length
        ) {

            return lowestCard(
                nonTrump
            );

        }


        return lowestCard(
            legal
        );

    }


    /*
       Follow suit.
    */

    const leadSuit =
        room.trickCards[0]
            .card
            .suit;


    const sameSuit =
        legal.filter(
            card =>
                card.suit ===
                leadSuit
        );


    if (
        sameSuit.length
    ) {

        const winner =
            currentWinner(
                room
            );


        const winning =
            sameSuit.filter(
                card =>
                    compareCards(
                        card,
                        winner.card,
                        leadSuit
                    ) > 0
            );


        if (
            winning.length
        ) {

            return lowestCard(
                winning
            );

        }


        return lowestCard(
            sameSuit
        );

    }


    /*
       Can't follow:
       use smallest useful trump.
    */

    const trumps =
        legal.filter(
            card =>
                card.suit ===
                CONFIG.TRUMP
        );


    if (
        trumps.length
    ) {

        const winner =
            currentWinner(
                room
            );


        const winningTrumps =
            trumps.filter(
                card =>
                    compareCards(
                        card,
                        winner.card,
                        leadSuit
                    ) > 0
            );


        if (
            winningTrumps.length
        ) {

            return lowestCard(
                winningTrumps
            );

        }


        return lowestCard(
            trumps
        );

    }


    return lowestCard(
        legal
    );

}


/* =========================================================
   LOWEST CARD
========================================================= */

function lowestCard(
    cards
) {

    return [
        ...cards
    ].sort(
        (
            a,
            b
        ) =>
            cardPower(
                a,
                "S"
            ) -
            cardPower(
                b,
                "S"
            )
    )[0];

}


/* =========================================================
   CARD POWER
========================================================= */

function cardPower(
    card,
    leadSuit
) {

    if (
        card.joker &&
        card.color ===
        "red"
    ) {

        return 1000;

    }


    if (
        card.id ===
        "AS"
    ) {

        return 950;

    }


    if (
        card.joker &&
        card.color ===
        "black"
    ) {

        return 940;

    }


    if (
        card.id ===
        "KS"
    ) {

        return 930;

    }


    if (
        card.suit ===
        CONFIG.TRUMP
    ) {

        return 700 +
            RANK_VALUE[
                card.rank
            ];

    }


    if (
        card.suit ===
        leadSuit
    ) {

        return 400 +
            RANK_VALUE[
                card.rank
            ];

    }


    return (
        RANK_VALUE[
            card.rank
        ] || 0
    );

}


/* =========================================================
   COMPARE
========================================================= */

function compareCards(
    a,
    b,
    leadSuit
) {

    return (
        cardPower(
            a,
            leadSuit
        ) -
        cardPower(
            b,
            leadSuit
        )
    );

}


/* =========================================================
   CURRENT WINNER
========================================================= */

function currentWinner(
    room
) {

    let winner =
        room.trickCards[0];


    const leadSuit =
        room.trickCards[0]
            .card
            .suit;


    for (
        let i = 1;
        i < room.trickCards.length;
        i++
    ) {

        const candidate =
            room.trickCards[i];


        if (
            compareCards(
                candidate.card,
                winner.card,
                leadSuit
            ) > 0
        ) {

            winner =
                candidate;

        }

    }


    return winner;

}


/* =========================================================
   FINISH TRICK
========================================================= */

function finishTrick(
    room
) {

    clearTurnTimer(
        room
    );


    const winner =
        currentWinner(
            room
        );


    const winnerPlayer =
        winner.playerId;


    const team =
        teamOf(
            winnerPlayer
        );


    room.tricks[team]++;


    broadcast(
        room,
        {

            type:
                "trickFinished",

            winner:
                winnerPlayer,

            team,

            tricks:
                room.tricks

        }
    );


    setTimeout(
        function () {

            room.trickCards =
                [];


            room.trickNumber++;


            /*
               9 cards per player
               = 9 tricks.
            */

            const played =
                room.cardHistory
                    .filter(
                        item =>
                            item.round ===
                            room.round
                    )
                    .length;


            const required =
                CONFIG.PLAYERS *
                CONFIG.CARDS_PER_PLAYER;


            if (
                played >=
                required
            ) {

                finishRound(
                    room
                );

                return;

            }


            room.trickLeader =
                winnerPlayer;


            room.currentPlayer =
                winnerPlayer;


            broadcastState(
                room
            );


            startTurn(
                room
            );

        },
        700
    );

}


/* =========================================================
   FINISH ROUND
========================================================= */

function finishRound(
    room
) {

    const blue =
        calculateScore(
            room.bids.blue,
            room.tricks.blue
        );


    const red =
        calculateScore(
            room.bids.red,
            room.tricks.red
        );


    room.scores.blue +=
        blue;


    room.scores.red +=
        red;


    broadcast(
        room,
        {

            type:
                "roundFinished",

            round:
                room.round,

            blueRoundScore:
                blue,

            redRoundScore:
                red,

            state:
                publicState(
                    room,
                    1
                )

        }
    );


    /*
       Each of six rounds has a
       different starter.
    */

    if (
        room.starter >=
        CONFIG.PLAYERS
    ) {

        finishGame(
            room
        );

        return;

    }


    room.starter++;


    room.round++;


    room.trickNumber =
        1;


    room.trickLeader =
        room.starter;


    room.currentPlayer =
        room.starter;


    room.trickCards =
        [];


    room.tricks = {

        blue: 0,

        red: 0

    };


    room.bids = {

        blue: 0,

        red: 0

    };


    dealCards(
        room
    );


    setTimeout(
        function () {

            broadcastState(
                room
            );


            startTurn(
                room
            );

        },
        1200
    );

}


/* =========================================================
   SCORE
========================================================= */

function calculateScore(
    bid,
    tricks
) {

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
   FINISH GAME
========================================================= */

function finishGame(
    room
) {

    room.phase =
        "finished";


    clearTurnTimer(
        room
    );


    let winner =
        "draw";


    if (
        room.scores.blue >
        room.scores.red
    ) {

        winner =
            "blue";

    }


    if (
        room.scores.red >
        room.scores.blue
    ) {

        winner =
            "red";

    }


    broadcast(
        room,
        {

            type:
                "gameFinished",

            winner,

            state:
                publicState(
                    room,
                    1
                )

        }
    );

}


/* =========================================================
   NEXT PLAYER
========================================================= */

function nextPlayer(
    playerId
) {

    return (
        Number(playerId) %
        CONFIG.PLAYERS
    ) + 1;

}


/* =========================================================
   MESSAGE HANDLER
========================================================= */

function handleMessage(
    ws,
    message
) {

    if (!message) return;


    switch (
        message.type
    ) {

        case "join":

            joinRoom(
                ws,

                message.roomId ||
                "public",

                message.playerId
            );

            break;


        case "playCard":

            if (
                !ws.roomId ||
                !ws.playerId
            ) {

                return;

            }


            {

                const room =
                    rooms.get(
                        ws.roomId
                    );


                if (!room) return;


                /*
                   Player must play
                   their own seat.
                */

                if (
                    Number(
                        ws.playerId
                    ) !==
                    Number(
                        message.playerId
                    )
                ) {

                    return;

                }


                playCard(
                    room,

                    ws.playerId,

                    message.card?.id ||
                    message.cardId
                );

            }

            break;


        case "turnTimeout":

            {

                const room =
                    rooms.get(
                        ws.roomId
                    );


                if (!room) return;


                const playerId =
                    Number(
                        message.playerId
                    );


                if (
                    room.currentPlayer !==
                    playerId
                ) {

                    return;

                }


                /*
                   Only accept timeout
                   after 5 seconds.
                */

                if (
                    Date.now() -
                    room.startedAt <
                    CONFIG.TURN_TIME
                ) {

                    return;

                }


                forceAITakeover(
                    room,
                    playerId
                );

            }

            break;

    }

}


/* =========================================================
   CONNECTION
========================================================= */

wss.on(
    "connection",
    function (ws) {

        ws.roomId =
            null;

        ws.playerId =
            null;


        ws.on(
            "message",
            function (raw) {

                try {

                    const message =
                        JSON.parse(
                            raw.toString()
                        );


                    handleMessage(
                        ws,
                        message
                    );

                } catch (error) {

                    console.error(
                        "Invalid message",
                        error
                    );

                }

            }
        );


        ws.on(
            "close",
            function () {

                disconnectPlayer(
                    ws
                );

            }
        );


        ws.on(
            "error",
            function () {

                disconnectPlayer(
                    ws
                );

            }
        );

    }
);


/* =========================================================
   START
========================================================= */

server.listen(
    PORT,
    function () {

        console.log(
            "======================================"
        );

        console.log(
            " SPADES 6 PLAYER SERVER"
        );

        console.log(
            " PORT:",
            PORT
        );

        console.log(
            " PLAYERS:",
            CONFIG.PLAYERS
        );

        console.log(
            " CARDS:",
            CONFIG.CARDS_PER_PLAYER
        );

        console.log(
            " ROUNDS:",
            CONFIG.ROUNDS
        );

        console.log(
            " TURN:",
            CONFIG.TURN_TIME,
            "ms"
        );

        console.log(
            "======================================"
        );

    }
);
