/* =========================================================
   SPADES GAME CLIENT
========================================================= */

"use strict";


/* =========================================================
   TELEGRAM
========================================================= */

const tg =
    window.Telegram &&
    window.Telegram.WebApp
        ? window.Telegram.WebApp
        : null;

if(tg){

    tg.ready();
    tg.expand();

}


/* =========================================================
   URL PARAMETERS
========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const players =
    Number(params.get("players")) || 6;

const mode =
    params.get("mode") || "random";

const requestedRoom =
    params.get("room") || "";


/* =========================================================
   VALIDATION
========================================================= */

if(![2,4,6].includes(players)){

    window.location.replace("index.html");

}


/* =========================================================
   PLAYER ID
========================================================= */

let playerId =
    localStorage.getItem(
        "spades_player_id"
    );

if(!playerId){

    playerId =
        "p_" +
        Math.random()
        .toString(36)
        .substring(2,10) +
        "_" +
        Date.now()
        .toString(36);

    localStorage.setItem(
        "spades_player_id",
        playerId
    );

}


/* =========================================================
   PLAYER NAME
========================================================= */

let playerName = "PLAYER";

if(tg && tg.initDataUnsafe){

    const user =
        tg.initDataUnsafe.user;

    if(user){

        playerName =
            user.first_name ||
            user.username ||
            "PLAYER";

    }

}

playerName =
    localStorage.getItem(
        "spades_player_name"
    ) ||
    playerName;

localStorage.setItem(
    "spades_player_name",
    playerName
);


/* =========================================================
   DOM
========================================================= */

const gameType =
    document.getElementById(
        "gameType"
    );

const roomText =
    document.getElementById(
        "roomText"
    );

const status =
    document.getElementById(
        "status"
    );

const centerMessage =
    document.getElementById(
        "centerMessage"
    );

const connection =
    document.getElementById(
        "connection"
    );

const loading =
    document.getElementById(
        "loading"
    );

const loadingText =
    document.getElementById(
        "loadingText"
    );

const errorModal =
    document.getElementById(
        "errorModal"
    );

const errorText =
    document.getElementById(
        "errorText"
    );


/* =========================================================
   UI INITIAL
========================================================= */

gameType.textContent =
    `${players} PLAYERS`;

if(mode === "private"){

    roomText.textContent =
        `PRIVATE ROOM • ${requestedRoom || "NEW"}`;

}else{

    roomText.textContent =
        "RANDOM MATCH";

}


/* =========================================================
   SOCKET
========================================================= */

let socket = null;

let currentRoom =
    requestedRoom || null;

let connected = false;


/* =========================================================
   SOCKET URL
========================================================= */

/*
   اگر game.html از server.js باز شده باشد:
   window.location.origin

   اگر بعداً frontend روی GitHub Pages باشد،
   می‌توان با:
   ?server=https://YOUR-SERVER
   سرور جدا را مشخص کرد.
*/

const serverParam =
    params.get("server");

const socketURL =
    serverParam
        ? serverParam.replace(/\/$/,"")
        : window.location.origin;


/* =========================================================
   CONNECT
========================================================= */

function connectServer(){

    if(typeof io !== "function"){

        showError(
            "Socket.IO could not be loaded."
        );

        return;

    }

    socket =
        io(socketURL,{
            transports:["websocket","polling"],
            reconnection:true,
            reconnectionAttempts:10,
            timeout:10000
        });


    socket.on(
        "connect",
        () => {

            connected = true;

            connection.textContent = "🟢";

            hideLoading();

            status.textContent =
                "Connected. Joining room...";

            socket.emit(
                "JOIN_ROOM",
                {
                    playerId,
                    playerName,
                    players,
                    mode,
                    roomCode:currentRoom
                }
            );

        }
    );


    socket.on(
        "disconnect",
        () => {

            connected = false;

            connection.textContent = "🔴";

            status.textContent =
                "Disconnected. Reconnecting...";

        }
    );


    socket.on(
        "connect_error",
        () => {

            connected = false;

            connection.textContent = "🔴";

            showLoading(
                "Connecting to game server..."
            );

        }
    );


    /* =========================
       ROOM UPDATE
    ========================= */

    socket.on(
        "ROOM_UPDATE",
        data => {

            if(!data) return;

            if(data.roomCode){

                currentRoom =
                    data.roomCode;

                roomText.textContent =
                    mode === "private"
                    ? `PRIVATE ROOM • ${currentRoom}`
                    : `RANDOM MATCH • ${currentRoom}`;

            }

            updatePlayers(
                data.players || []
            );

            const count =
                (data.players || []).length;

            const capacity =
                data.capacity || players;

            status.textContent =
                `${count}/${capacity} players`;

            centerMessage.textContent =
                count >= capacity
                ? "Starting game..."
                : `Waiting for players... ${count}/${capacity}`;

        }
    );


    /* =========================
       GAME START
    ========================= */

    socket.on(
        "GAME_START",
        data => {

            hideLoading();

            centerMessage.textContent =
                "GAME STARTED";

            status.textContent =
                "All players connected.";

            updatePlayers(
                data.players || []
            );

        }
    );


    /* =========================
       ERROR
    ========================= */

    socket.on(
        "GAME_ERROR",
        data => {

            showError(
                data &&
                data.message
                    ? data.message
                    : "Game error."
            );

        }
    );


    socket.on(
        "ROOM_ERROR",
        data => {

            showError(
                data &&
                data.message
                    ? data.message
                    : "Unable to join room."
            );

        }
    );


    /* =========================
       GAME EVENTS
    ========================= */

    socket.on(
        "BID",
        data => {

            if(!data) return;

            status.textContent =
                `${data.playerName || "Player"} selected ${data.value}`;

        }
    );


    socket.on(
        "PLAY_CARD",
        data => {

            if(!data) return;

            status.textContent =
                `${data.playerName || "Player"} played a card`;

        }
    );

}


/* =========================================================
   PLAYERS UI
========================================================= */

function updatePlayers(list){

    const capacity = players;

    for(let i=0;i<6;i++){

        const name =
            document.getElementById(
                `name${i}`
            );

        const playerStatus =
            document.getElementById(
                `status${i}`
            );

        const avatar =
            document.getElementById(
                `player${i}`
            );

        if(!name ||
           !playerStatus ||
           !avatar){

            continue;

        }


        if(i >= capacity){

            name.textContent =
                "—";

            playerStatus.textContent =
                "—";

            avatar.textContent =
                "✕";

            continue;

        }


        const p = list[i];

        if(p){

            name.textContent =
                p.name ||
                "PLAYER";

            playerStatus.textContent =
                p.ready
                ? "READY"
                : "CONNECTED";

            avatar.textContent =
                p.id === playerId
                ? "♠"
                : "👤";

        }else{

            name.textContent =
                "WAITING";

            playerStatus.textContent =
                "—";

            avatar.textContent =
                "👤";

        }

    }

}


/* =========================================================
   LOADING
========================================================= */

function showLoading(text){

    loading.classList.remove("hidden");

    loadingText.textContent =
        text || "Connecting...";

}


function hideLoading(){

    loading.classList.add("hidden");

}


/* =========================================================
   ERROR
========================================================= */

function showError(message){

    hideLoading();

    errorText.textContent =
        message;

    errorModal.classList.add("show");

}


/* =========================================================
   LEAVE
========================================================= */

function leaveGame(){

    if(socket){

        socket.emit(
            "LEAVE_ROOM",
            {
                roomCode:currentRoom,
                playerId
            }
        );

        socket.disconnect();

    }

    window.location.replace(
        "index.html"
    );

}


/* =========================================================
   BROWSER BACK
========================================================= */

window.addEventListener(
    "popstate",
    () => {

        leaveGame();

    }
);


/* =========================================================
   START
========================================================= */

connectServer();
