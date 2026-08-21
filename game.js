/* =========================================================
   SPADES - 6 PLAYER ONLINE GAME
   game.js
   =========================================================

   Players:
   1 - 3 - 5 = BLUE TEAM
   2 - 4 - 6 = RED TEAM

   Capacity:
   6 HUMAN PLAYERS

   Socket.IO:
   Used for realtime multiplayer communication.

   IMPORTANT:
   This file contains GAME LOGIC.
   Room creation / matchmaking is handled by server.js.
========================================================= */


/* =========================================================
   SOCKET.IO
========================================================= */

const socket = io();


/* =========================================================
   GAME STATE
========================================================= */

const GAME_STATE = {

    roomId: null,

    playerId: null,

    playerNumber: null,

    playerName: "Player",

    gameType: "suit",

    players: [],

    started: false,

    phase: "waiting",

    currentTurn: 1,

    round: 1,

    trick: 1,

    myCards: [],

    tableCards: [],

    selectedCard: null,

    blueScore: 0,

    redScore: 0,

    blueBid: 0,

    redBid: 0,

    trumpSuit: "spades",

    timeLeft: 10

};


/* =========================================================
   CARD DATA
========================================================= */

const SUITS = [

    "spades",
    "hearts",
    "diamonds",
    "clubs"

];


const SUIT_SYMBOLS = {

    spades: "♠",

    hearts: "♥",

    diamonds: "♦",

    clubs: "♣"

};


const CARD_VALUES = [

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
   PLAYER HELPERS
========================================================= */

function getTeam(playerNumber) {

    playerNumber =
        Number(playerNumber);


    if (
        playerNumber === 1 ||
        playerNumber === 3 ||
        playerNumber === 5
    ) {

        return "blue";

    }


    if (
        playerNumber === 2 ||
        playerNumber === 4 ||
        playerNumber === 6
    ) {

        return "red";

    }


    return null;

}


function getPlayerByNumber(number) {

    return GAME_STATE.players.find(
        player =>
            Number(player.number) ===
            Number(number)
    );

}


function getCurrentPlayer() {

    return getPlayerByNumber(
        GAME_STATE.currentTurn
    );

}


function isMyTurn() {

    return (
        Number(
            GAME_STATE.playerNumber
        ) ===
        Number(
            GAME_STATE.currentTurn
        )
    );

}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

socket.on(
    "connect",
    () => {

        console.log(
            "Connected to server:",
            socket.id
        );


        GAME_STATE.playerId =
            socket.id;


        updateConnectionStatus(
            true
        );


        /*
         * If the page was opened with:
         *
         * ?room=XXXX
         *
         * automatically join that room.
         */

        const params =
            new URLSearchParams(
                window.location.search
            );


        const roomId =
            params.get(
                "room"
            );


        if (roomId) {

            joinRoom(
                roomId
            );

        }

    }
);


socket.on(
    "disconnect",
    () => {

        console.log(
            "Disconnected from server"
        );


        updateConnectionStatus(
            false
        );

    }
);


/* =========================================================
   CONNECTION STATUS
========================================================= */

function updateConnectionStatus(
    connected
) {

    const element =
        document.getElementById(
            "connectionStatus"
        );


    if (!element) {

        return;

    }


    if (connected) {

        element.textContent =
            "● Connected";

        element.style.color =
            "#5ee39b";

    } else {

        element.textContent =
            "● Disconnected";

        element.style.color =
            "#e56b6f";

    }

}


/* =========================================================
   JOIN ROOM
========================================================= */

function joinRoom(
    roomId
) {

    if (!roomId) {

        console.error(
            "Room ID missing"
        );

        return;

    }


    GAME_STATE.roomId =
        String(roomId);


    const playerName =
        getPlayerName();


    GAME_STATE.playerName =
        playerName;


    socket.emit(
        "joinRoom",
        {

            roomId:
                GAME_STATE.roomId,

            name:
                playerName

        }
    );

}


/* =========================================================
   GET PLAYER NAME
========================================================= */

function getPlayerName() {

    try {

        if (
            window.Telegram &&
            Telegram.WebApp &&
            Telegram.WebApp
                .initDataUnsafe &&
            Telegram.WebApp
                .initDataUnsafe.user
        ) {

            const user =
                Telegram.WebApp
                    .initDataUnsafe
                    .user;


            if (user.first_name) {

                return (
                    user.first_name +
                    (
                        user.last_name
                            ? " " +
                              user.last_name
                            : ""
                    )
                );

            }

        }

    } catch (error) {

        console.log(
            error
        );

    }


    return (
        "Player " +
        Math.floor(
            Math.random() *
            9999
        )
    );

}


/* =========================================================
   ROOM JOINED
========================================================= */

socket.on(
    "roomJoined",
    data => {

        console.log(
            "Room joined:",
            data
        );


        if (!data) {

            return;

        }


        GAME_STATE.roomId =
            data.roomId ||
            GAME_STATE.roomId;


        GAME_STATE.playerNumber =
            Number(
                data.playerNumber ||
                data.position ||
                0
            );


        GAME_STATE.players =
            data.players ||
            [];


        GAME_STATE.gameType =
            data.gameType ||
            "suit";


        renderPlayers();

        updateRoomInfo();


        /*
         * If server says game already started,
         * load current game state.
         */

        if (
            data.started
        ) {

            GAME_STATE.started =
                true;

            GAME_STATE.phase =
                data.phase ||
                "playing";

            renderGame();

        }

    }
);


/* =========================================================
   PLAYER LIST UPDATE
========================================================= */

socket.on(
    "playersUpdate",
    data => {

        if (!data) {

            return;

        }


        GAME_STATE.players =
            data.players ||
            [];


        renderPlayers();

        updateRoomInfo();

    }
);


/* =========================================================
   ROOM STATE
========================================================= */

socket.on(
    "roomState",
    data => {

        if (!data) {

            return;

        }


        applyServerState(
            data
        );

    }
);


/* =========================================================
   GAME STARTED
========================================================= */

socket.on(
    "gameStarted",
    data => {

        console.log(
            "GAME STARTED",
            data
        );


        GAME_STATE.started =
            true;


        GAME_STATE.phase =
            "bidding";


        if (data) {

            applyServerState(
                data
            );

        }


        showGameScreen();

        renderGame();

    }
);


/* =========================================================
   GAME STATE UPDATE
========================================================= */

socket.on(
    "gameState",
    data => {

        if (!data) {

            return;

        }


        applyServerState(
            data
        );


        renderGame();

    }
);


/* =========================================================
   TURN UPDATE
========================================================= */

socket.on(
    "turnChanged",
    data => {

        if (!data) {

            return;

        }


        GAME_STATE.currentTurn =
            Number(
                data.playerNumber ||
                data.turn
            );


        GAME_STATE.timeLeft =
            Number(
                data.timeLeft ||
                10
            );


        updateTurnUI();

        startTurnTimer();

    }
);


/* =========================================================
   NEW TRICK
========================================================= */

socket.on(
    "newTrick",
    data => {

        GAME_STATE.tableCards =
            data &&
            data.cards
                ? data.cards
                : [];


        GAME_STATE.trick =
            data &&
            data.trick
                ? Number(
                    data.trick
                  )
                : GAME_STATE.trick;


        renderTable();

    }
);


/* =========================================================
   CARD PLAYED
========================================================= */

socket.on(
    "cardPlayed",
    data => {

        if (!data) {

            return;

        }


        GAME_STATE.tableCards =
            data.tableCards ||
            data.cards ||
            GAME_STATE.tableCards;


        GAME_STATE.currentTurn =
            Number(
                data.nextTurn ||
                GAME_STATE.currentTurn
            );


        renderTable();

        updateTurnUI();

        startTurnTimer();

    }
);


/* =========================================================
   TRICK COMPLETED
========================================================= */

socket.on(
    "trickCompleted",
    data => {

        if (!data) {

            return;

        }


        GAME_STATE.blueScore =
            Number(
                data.blueScore ||
                GAME_STATE.blueScore
            );


        GAME_STATE.redScore =
            Number(
                data.redScore ||
                GAME_STATE.redScore
            );


        GAME_STATE.trick++;


        updateScoreUI();

    }
);


/* =========================================================
   ROUND COMPLETED
========================================================= */

socket.on(
    "roundCompleted",
    data => {

        if (!data) {

            return;

        }


        GAME_STATE.round =
            Number(
                data.round ||
                GAME_STATE.round + 1
            );


        GAME_STATE.blueScore =
            Number(
                data.blueScore ||
                GAME_STATE.blueScore
            );


        GAME_STATE.redScore =
            Number(
                data.redScore ||
                GAME_STATE.redScore
            );


        GAME_STATE.tableCards =
            [];


        renderTable();

        updateScoreUI();

    }
);


/* =========================================================
   GAME FINISHED
========================================================= */

socket.on(
    "gameFinished",
    data => {

        GAME_STATE.phase =
            "finished";


        GAME_STATE.started =
            false;


        showGameResult(
            data
        );

    }
);


/* =========================================================
   PLAYER DISCONNECTED
========================================================= */

socket.on(
    "playerDisconnected",
    data => {

        console.log(
            "Player disconnected:",
            data
        );


        if (
            data &&
            data.players
        ) {

            GAME_STATE.players =
                data.players;

        }


        renderPlayers();

        updateRoomInfo();

    }
);


/* =========================================================
   SERVER ERROR
========================================================= */

socket.on(
    "gameError",
    data => {

        const message =
            data &&
            data.message
                ? data.message
                : "Game error.";


        showGameMessage(
            message
        );

    }
);


/* =========================================================
   APPLY SERVER STATE
========================================================= */

function applyServerState(
    data
) {

    if (!data) {

        return;

    }


    if (
        data.roomId
    ) {

        GAME_STATE.roomId =
            data.roomId;

    }


    if (
        data.players
    ) {

        GAME_STATE.players =
            data.players;

    }


    if (
        data.playerNumber
    ) {

        GAME_STATE.playerNumber =
            Number(
                data.playerNumber
            );

    }


    if (
        data.currentTurn ||
        data.turn
    ) {

        GAME_STATE.currentTurn =
            Number(
                data.currentTurn ||
                data.turn
            );

    }


    if (
        data.round
    ) {

        GAME_STATE.round =
            Number(
                data.round
            );

    }


    if (
        data.trick
    ) {

        GAME_STATE.trick =
            Number(
                data.trick
            );

    }


    if (
        data.phase
    ) {

        GAME_STATE.phase =
            data.phase;

    }


    if (
        data.tableCards
    ) {

        GAME_STATE.tableCards =
            data.tableCards;

    }


    if (
        data.cards
    ) {

        GAME_STATE.myCards =
            data.cards;

    }


    if (
        data.myCards
    ) {

        GAME_STATE.myCards =
            data.myCards;

    }


    if (
        typeof data.blueScore !==
        "undefined"
    ) {

        GAME_STATE.blueScore =
            Number(
                data.blueScore
            );

    }


    if (
        typeof data.redScore !==
        "undefined"
    ) {

        GAME_STATE.redScore =
            Number(
                data.redScore
            );

    }


    if (
        typeof data.blueBid !==
        "undefined"
    ) {

        GAME_STATE.blueBid =
            Number(
                data.blueBid
            );

    }


    if (
        typeof data.redBid !==
        "undefined"
    ) {

        GAME_STATE.redBid =
            Number(
                data.redBid
            );

    }


    renderPlayers();

    updateRoomInfo();

    updateTurnUI();

    updateScoreUI();

}


/* =========================================================
   RENDER PLAYERS
========================================================= */

function renderPlayers() {

    const container =
        document.getElementById(
            "gamePlayers"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "";


    for (
        let i = 1;
        i <= 6;
        i++
    ) {

        const player =
            getPlayerByNumber(
                i
            );


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "game-player";


        if (
            GAME_STATE.playerNumber ===
            i
        ) {

            div.classList.add(
                "me"
            );

        }


        if (
            getTeam(i) ===
            "blue"
        ) {

            div.classList.add(
                "blue-player"
            );

        } else {

            div.classList.add(
                "red-player"
            );

        }


        if (player) {

            div.innerHTML = `

                <div class="game-player-avatar">
                    ${getPlayerAvatar(i)}
                </div>

                <div class="game-player-info">

                    <div class="game-player-name">
                        ${escapeHTML(
                            player.name ||
                            "Player " + i
                        )}
                    </div>

                    <div class="game-player-team">
                        ${getTeam(i) === "blue"
                            ? "BLUE TEAM"
                            : "RED TEAM"}
                    </div>

                </div>

                ${
                    player.ready
                        ? `<div class="player-ready">
                             ✓
                           </div>`
                        : ""
                }

            `;

        } else {

            div.innerHTML = `

                <div class="game-player-avatar">
                    ⏳
                </div>

                <div class="game-player-info">

                    <div class="game-player-name">
                        Waiting
                    </div>

                    <div class="game-player-team">
                        Player ${i}
                    </div>

                </div>

            `;

        }


        container.appendChild(
            div
        );

    }

}


/* =========================================================
   PLAYER AVATAR
========================================================= */

function getPlayerAvatar(
    number
) {

    const avatars = {

        1: "👤",
        2: "👤",
        3: "👤",
        4: "👤",
        5: "👤",
        6: "👤"

    };


    return (
        avatars[number] ||
        "👤"
    );

}


/* =========================================================
   ROOM INFO
========================================================= */

function updateRoomInfo() {

    const roomElement =
        document.getElementById(
            "gameRoomCode"
        );


    if (
        roomElement
    ) {

        roomElement.textContent =
            GAME_STATE.roomId ||
            "------";

    }


    const countElement =
        document.getElementById(
            "gamePlayerCount"
        );


    if (
        countElement
    ) {

        countElement.textContent =
            GAME_STATE.players.length +
            " / 6";

    }

}


/* =========================================================
   SHOW GAME SCREEN
========================================================= */

function showGameScreen() {

    /*
     * If index.html already has a game screen,
     * use it.
     */

    if (
        typeof navigate ===
        "function"
    ) {

        if (
            document.getElementById(
                "gameScreen"
            )
        ) {

            navigate(
                "gameScreen"
            );

        }

    }


    /*
     * If game.html is used instead,
     * nothing else is required.
     */

}


/* =========================================================
   RENDER GAME
========================================================= */

function renderGame() {

    renderPlayers();

    renderMyCards();

    renderTable();

    updateTurnUI();

    updateScoreUI();

    updatePhaseUI();

}


/* =========================================================
   RENDER MY CARDS
========================================================= */

function renderMyCards() {

    const container =
        document.getElementById(
            "myCards"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "";


    GAME_STATE.myCards
        .forEach(
            (
                card,
                index
            ) => {

                const element =
                    document.createElement(
                        "button"
                    );


                element.type =
                    "button";


                element.className =
                    "playing-card";


                if (
                    GAME_STATE.selectedCard ===
                    index
                ) {

                    element.classList.add(
                        "selected"
                    );

                }


                element.innerHTML =
                    createCardHTML(
                        card
                    );


                element.addEventListener(
                    "click",
                    () => {

                        selectCard(
                            index
                        );

                    }
                );


                container.appendChild(
                    element
                );

            }
        );

}


/* =========================================================
   CARD HTML
========================================================= */

function createCardHTML(
    card
) {

    if (!card) {

        return "";

    }


    const value =
        card.value ||
        card.rank ||
        "";


    const suit =
        card.suit ||
        "";


    const symbol =
        SUIT_SYMBOLS[
            suit
        ] ||
        suit;


    const red =
        suit === "hearts" ||
        suit === "diamonds";


    return `

        <div class="card-top ${
            red ? "red-card" : ""
        }">

            ${escapeHTML(
                value
            )}

            ${symbol}

        </div>

        <div class="card-center ${
            red ? "red-card" : ""
        }">

            ${symbol}

        </div>

        <div class="card-bottom ${
            red ? "red-card" : ""
        }">

            ${escapeHTML(
                value
            )}

            ${symbol}

        </div>

    `;

}


/* =========================================================
   SELECT CARD
========================================================= */

function selectCard(
    index
) {

    if (
        !GAME_STATE.started
    ) {

        return;

    }


    if (
        GAME_STATE.phase !==
        "playing"
    ) {

        return;

    }


    if (
        !isMyTurn()
    ) {

        showGameMessage(
            "It is not your turn."
        );

        return;

    }


    if (
        !GAME_STATE.myCards[
            index
        ]
    ) {

        return;

    }


    const card =
        GAME_STATE.myCards[
            index
        ];


    /*
     * Validate locally before
     * sending to server.
     */

    if (
        !isValidCardPlay(
            card
        )
    ) {

        showGameMessage(
            "You must follow the suit."
        );

        return;

    }


    GAME_STATE.selectedCard =
        index;


    renderMyCards();


    /*
     * Send card to server.
     */

    socket.emit(
        "playCard",
        {

            roomId:
                GAME_STATE.roomId,

            card:
                card,

            cardIndex:
                index

        }
    );

}


/* =========================================================
   VALID CARD PLAY
========================================================= */

function isValidCardPlay(
    card
) {

    /*
     * First card of trick:
     * any card except prohibited joker.
     */

    if (
        GAME_STATE.tableCards.length ===
        0
    ) {

        return !isJoker(card);

    }


    const leadCard =
        GAME_STATE.tableCards[0];


    const leadSuit =
        leadCard.suit;


    /*
     * If player has lead suit,
     * they must follow it.
     */

    const hasLeadSuit =
        GAME_STATE.myCards.some(
            c =>
                c &&
                c.suit ===
                leadSuit
        );


    if (
        hasLeadSuit &&
        card.suit !==
        leadSuit
    ) {

        /*
         * Joker may be allowed according
         * to server rules.
         */

        if (
            isJoker(card)
        ) {

            return true;

        }


        return false;

    }


    return true;

}


/* =========================================================
   JOKER
========================================================= */

function isJoker(
    card
) {

    if (!card) {

        return false;

    }


    return (
        card.type ===
        "joker" ||
        card.value ===
        "RJ" ||
        card.value ===
        "BJ" ||
        card.rank ===
        "RJ" ||
        card.rank ===
        "BJ"
    );

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable() {

    const container =
        document.getElementById(
            "tableCards"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "";


    GAME_STATE.tableCards
        .forEach(
            play => {

                const element =
                    document.createElement(
                        "div"
                    );


                element.className =
                    "table-card-play";


                if (
                    play.card
                ) {

                    element.innerHTML =
                        createCardHTML(
                            play.card
                        );

                } else {

                    element.innerHTML =
                        createCardHTML(
                            play
                        );

                }


                if (
                    play.playerNumber
                ) {

                    const label =
                        document.createElement(
                            "div"
                        );


                    label.className =
                        "table-card-player";


                    label.textContent =
                        "P" +
                        play.playerNumber;


                    element.appendChild(
                        label
                    );

                }


                container.appendChild(
                    element
                );

            }
        );

}


/* =========================================================
   TURN UI
========================================================= */

function updateTurnUI() {

    const turnElement =
        document.getElementById(
            "currentTurn"
        );


    if (turnElement) {

        if (
            isMyTurn()
        ) {

            turnElement.textContent =
                "YOUR TURN";

        } else {

            turnElement.textContent =
                "PLAYER " +
                GAME_STATE.currentTurn +
                " TURN";

        }

    }


    const timerElement =
        document.getElementById(
            "gameTimer"
        );


    if (timerElement) {

        timerElement.textContent =
            GAME_STATE.timeLeft;

    }

}


/* =========================================================
   TURN TIMER
========================================================= */

let turnTimer =
    null;


function startTurnTimer() {

    if (turnTimer) {

        clearInterval(
            turnTimer
        );

    }


    GAME_STATE.timeLeft =
        10;


    updateTurnUI();


    turnTimer =
        setInterval(
            () => {

                GAME_STATE.timeLeft--;

                updateTurnUI();


                if (
                    GAME_STATE.timeLeft <=
                    0
                ) {

                    clearInterval(
                        turnTimer
                    );


                    if (
                        isMyTurn()
                    ) {

                        autoPlayCard();

                    }

                }

            },
            1000
        );

}


/* =========================================================
   AUTO PLAY
========================================================= */

function autoPlayCard() {

    if (
        !GAME_STATE.myCards.length
    ) {

        return;

    }


    if (
        !isMyTurn()
    ) {

        return;

    }


    let index =
        GAME_STATE.myCards.findIndex(
            card =>
                isValidCardPlay(
                    card
                )
        );


    if (
        index < 0
    ) {

        index = 0;

    }


    const card =
        GAME_STATE.myCards[
            index
        ];


    socket.emit(
        "playCard",
        {

            roomId:
                GAME_STATE.roomId,

            card:
                card,

            cardIndex:
                index,

            automatic:
                true

        }
    );

}


/* =========================================================
   SCORE UI
========================================================= */

function updateScoreUI() {

    const blue =
        document.getElementById(
            "blueScore"
        );


    const red =
        document.getElementById(
            "redScore"
        );


    if (blue) {

        blue.textContent =
            GAME_STATE.blueScore;

    }


    if (red) {

        red.textContent =
            GAME_STATE.redScore;

    }


    const blueBid =
        document.getElementById(
            "blueBid"
        );


    const redBid =
        document.getElementById(
            "redBid"
        );


    if (blueBid) {

        blueBid.textContent =
            GAME_STATE.blueBid;

    }


    if (redBid) {

        redBid.textContent =
            GAME_STATE.redBid;

    }

}


/* =========================================================
   PHASE UI
========================================================= */

function updatePhaseUI() {

    const phase =
        document.getElementById(
            "gamePhase"
        );


    if (!phase) {

        return;

    }


    const names = {

        waiting:
            "WAITING FOR PLAYERS",

        bidding:
            "BIDDING",

        playing:
            "PLAYING",

        roundEnd:
            "ROUND COMPLETE",

        finished:
            "GAME FINISHED"

    };


    phase.textContent =
        names[
            GAME_STATE.phase
        ] ||
        GAME_STATE.phase
            .toUpperCase();

}


/* =========================================================
   BIDDING
========================================================= */

function submitBid(
    amount
) {

    amount =
        Number(
            amount
        );


    if (
        !Number.isFinite(
            amount
        )
    ) {

        return;

    }


    /*
     * Allowed individual declaration:
     * 0 - 7
     */

    if (
        amount < 0 ||
        amount > 7
    ) {

        showGameMessage(
            "Bid must be between 0 and 7."
        );

        return;

    }


    socket.emit(
        "submitBid",
        {

            roomId:
                GAME_STATE.roomId,

            amount:
                amount

        }
    );

}


/* =========================================================
   READY
========================================================= */

function setReady() {

    socket.emit(
        "playerReady",
        {

            roomId:
                GAME_STATE.roomId

        }
    );

}


/* =========================================================
   LEAVE ROOM
========================================================= */

function leaveGame() {

    if (
        GAME_STATE.roomId
    ) {

        socket.emit(
            "leaveRoom",
            {

                roomId:
                    GAME_STATE.roomId

            }
        );

    }


    GAME_STATE.roomId =
        null;

    GAME_STATE.players =
        [];

    GAME_STATE.started =
        false;

    GAME_STATE.phase =
        "waiting";


    if (
        typeof navigate ===
        "function"
    ) {

        navigate(
            "tableScreen"
        );

    }

}


/* =========================================================
   GAME RESULT
========================================================= */

function showGameResult(
    data
) {

    let title =
        "GAME OVER";


    let message =
        "";


    if (
        data &&
        data.winner
    ) {

        title =
            data.winner ===
            "blue"
                ? "BLUE TEAM WINS"
                : "RED TEAM WINS";

    }


    if (
        data &&
        data.message
    ) {

        message =
            data.message;

    } else {

        const myTeam =
            getTeam(
                GAME_STATE.playerNumber
            );


        if (
            data &&
            data.winner ===
            myTeam
        ) {

            message =
                "Congratulations! Your team won.";

        } else {

            message =
                "The game has ended.";

        }

    }


    const result =
        document.getElementById(
            "gameResult"
        );


    if (result) {

        result.textContent =
            title +
            " - " +
            message;

    }


    showGameMessage(
        title +
        "\n\n" +
        message
    );

}


/* =========================================================
   GAME MESSAGE
========================================================= */

function showGameMessage(
    message
) {

    try {

        if (
            window.Telegram &&
            Telegram.WebApp &&
            typeof Telegram.WebApp.showAlert ===
            "function"
        ) {

            Telegram.WebApp.showAlert(
                String(message)
            );

            return;

        }

    } catch (error) {

        console.log(
            error
        );

    }


    window.alert(
        String(message)
    );

}


/* =========================================================
   COPY ROOM CODE
========================================================= */

function copyRoomCode() {

    const code =
        GAME_STATE.roomId;


    if (!code) {

        showGameMessage(
            "Room code is not available."
        );

        return;

    }


    if (
        navigator.clipboard &&
        navigator.clipboard.writeText
    ) {

        navigator.clipboard
            .writeText(
                code
            )
            .then(
                () => {

                    showGameMessage(
                        "Room code copied."
                    );

                }
            )
            .catch(
                () => {

                    showGameMessage(
                        code
                    );

                }
            );

    } else {

        showGameMessage(
            code
        );

    }

}


/* =========================================================
   SHARE ROOM
========================================================= */

function shareRoom() {

    if (
        !GAME_STATE.roomId
    ) {

        return;

    }


    const link =
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(
            GAME_STATE.roomId
        );


    const text =
        "Join my private SPADES game.";


    try {

        if (
            window.Telegram &&
            Telegram.WebApp &&
            typeof Telegram.WebApp.openTelegramLink ===
            "function"
        ) {

            Telegram.WebApp.openTelegramLink(
                "https://t.me/share/url?url=" +
                encodeURIComponent(
                    link
                ) +
                "&text=" +
                encodeURIComponent(
                    text
                )
            );

            return;

        }

    } catch (error) {

        console.log(
            error
        );

    }


    if (
        navigator.share
    ) {

        navigator.share({

            title:
                "SPADES",

            text:
                text,

            url:
                link

        }).catch(
            () => {}
        );

    } else {

        copyRoomCode();

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );

}


/* =========================================================
   PAGE LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "SPADES game.js loaded"
        );


        /*
         * If URL contains room code,
         * wait for socket connection.
         */

        const params =
            new URLSearchParams(
                window.location.search
            );


        const room =
            params.get(
                "room"
            );


        if (room) {

            GAME_STATE.roomId =
                room;

        }

    }
);


/* =========================================================
   GLOBAL ACCESS
========================================================= */

window.SpadesGame = {

    state:
        GAME_STATE,

    joinRoom,

    leaveGame,

    selectCard,

    submitBid,

    setReady,

    copyRoomCode,

    shareRoom,

    startTurnTimer

};
