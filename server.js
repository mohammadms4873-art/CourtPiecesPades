"use strict";


/* =========================================================
   IMPORTS
========================================================= */

const express =
    require("express");

const http =
    require("http");

const path =
    require("path");

const {
    Server
} =
    require("socket.io");


/* =========================================================
   APP
========================================================= */

const app =
    express();

const server =
    http.createServer(app);

const io =
    new Server(server,{

        cors:{
            origin:"*",
            methods:["GET","POST"]
        }

    });


/* =========================================================
   CONFIG
========================================================= */

const PORT =
    process.env.PORT || 3000;

const VALID_PLAYERS =
    [2,4,6];


/* =========================================================
   STATIC
========================================================= */

app.use(
    express.static(
        path.join(__dirname)
    )
);


/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    (req,res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


/* =========================================================
   ROOM STORAGE
========================================================= */

const rooms =
    new Map();


/*
room structure:

{
    code,
    mode,
    capacity,
    players: [
        {
            id,
            name,
            socketId
        }
    ],
    started
}
*/


/* =========================================================
   ROOM ID
========================================================= */

let roomCounter = 0;


function createRandomRoomCode(players){

    roomCounter++;

    return (
        `ROOM-${players}-` +
        String(roomCounter)
            .padStart(4,"0")
    );

}


function createPrivateRoomCode(){

    let code;

    do{

        code =
            Math.random()
            .toString(36)
            .substring(2,8)
            .toUpperCase();

    }while(rooms.has(code));

    return code;

}


/* =========================================================
   FIND RANDOM ROOM
========================================================= */

function findRandomRoom(players){

    for(const room of rooms.values()){

        if(
            room.mode === "random" &&
            room.capacity === players &&
            !room.started &&
            room.players.length < room.capacity
        ){

            return room;

        }

    }

    return null;

}


/* =========================================================
   CREATE ROOM
========================================================= */

function createRoom(
    mode,
    capacity,
    code = null
){

    const roomCode =
        code ||
        (
            mode === "private"
            ? createPrivateRoomCode()
            : createRandomRoomCode(capacity)
        );

    const room = {

        code:roomCode,

        mode,

        capacity,

        players:[],

        started:false

    };

    rooms.set(
        roomCode,
        room
    );

    return room;

}


/* =========================================================
   GET ROOM
========================================================= */

function getOrCreateRoom({
    mode,
    capacity,
    roomCode
}){

    if(mode === "private"){

        if(roomCode){

            let room =
                rooms.get(roomCode);

            if(!room){

                room =
                    createRoom(
                        "private",
                        capacity,
                        roomCode
                    );

            }

            return room;

        }

        return createRoom(
            "private",
            capacity
        );

    }


    let room =
        findRandomRoom(
            capacity
        );

    if(!room){

        room =
            createRoom(
                "random",
                capacity
            );

    }

    return room;

}


/* =========================================================
   ROOM UPDATE
========================================================= */

function sendRoomUpdate(room){

    if(!room) return;

    io.to(room.code)
        .emit(
            "ROOM_UPDATE",
            {
                roomCode:room.code,

                mode:room.mode,

                capacity:room.capacity,

                players:
                    room.players.map(
                        p => ({
                            id:p.id,
                            name:p.name,
                            ready:true
                        })
                    )
            }
        );

}


/* =========================================================
   START GAME
========================================================= */

function startRoom(room){

    if(!room) return;

    if(room.started) return;

    if(
        room.players.length !==
        room.capacity
    ){

        return;

    }

    room.started = true;

    io.to(room.code)
        .emit(
            "GAME_START",
            {

                roomCode:room.code,

                mode:room.mode,

                capacity:room.capacity,

                players:
                    room.players.map(
                        p => ({
                            id:p.id,
                            name:p.name,
                            ready:true
                        })
                    )

            }
        );

}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            "CONNECTED:",
            socket.id
        );


        /* =================================================
           JOIN ROOM
        ================================================= */

        socket.on(
            "JOIN_ROOM",
            data => {

                try{

                    if(!data){

                        socket.emit(
                            "ROOM_ERROR",
                            {
                                message:
                                "Invalid room request."
                            }
                        );

                        return;

                    }


                    const capacity =
                        Number(
                            data.players
                        );

                    if(
                        !VALID_PLAYERS
                            .includes(
                                capacity
                            )
                    ){

                        socket.emit(
                            "ROOM_ERROR",
                            {
                                message:
                                "Invalid player count."
                            }
                        );

                        return;

                    }


                    const mode =
                        data.mode ===
                        "private"
                        ? "private"
                        : "random";


                    let room =
                        getOrCreateRoom({

                            mode,

                            capacity,

                            roomCode:
                                data.roomCode
                                ? String(
                                    data.roomCode
                                ).toUpperCase()
                                : null

                        });


                    /* =========================
                       ROOM FULL
                    ========================= */

                    if(
                        room.players.length >=
                        room.capacity
                    ){

                        socket.emit(
                            "ROOM_ERROR",
                            {
                                message:
                                "Room is full."
                            }
                        );

                        return;

                    }


                    /* =========================
                       DUPLICATE PLAYER
                    ========================= */

                    const existing =
                        room.players.find(
                            p =>
                                p.id ===
                                data.playerId
                        );

                    if(existing){

                        existing.socketId =
                            socket.id;

                    }else{

                        room.players.push({

                            id:
                                String(
                                    data.playerId ||
                                    socket.id
                                ),

                            name:
                                String(
                                    data.playerName ||
                                    "PLAYER"
                                ).substring(
                                    0,
                                    24
                                ),

                            socketId:
                                socket.id

                        });

                    }


                    socket.join(
                        room.code
                    );


                    socket.data.roomCode =
                        room.code;

                    socket.data.playerId =
                        String(
                            data.playerId ||
                            socket.id
                        );


                    console.log(
                        `PLAYER JOINED: ${socket.data.playerId} -> ${room.code}`
                    );


                    sendRoomUpdate(
                        room
                    );


                    if(
                        room.players.length ===
                        room.capacity
                    ){

                        startRoom(
                            room
                        );

                    }

                }catch(error){

                    console.error(
                        "JOIN ERROR:",
                        error
                    );

                    socket.emit(
                        "ROOM_ERROR",
                        {
                            message:
                            "Could not join room."
                        }
                    );

                }

            }
        );


        /* =================================================
           LEAVE ROOM
        ================================================= */

        socket.on(
            "LEAVE_ROOM",
            () => {

                removePlayer(
                    socket
                );

            }
        );


        /* =================================================
           BID
        ================================================= */

        socket.on(
            "BID",
            data => {

                const room =
                    getSocketRoom(
                        socket
                    );

                if(!room) return;

                io.to(room.code)
                    .emit(
                        "BID",
                        {

                            playerId:
                                socket.data.playerId,

                            playerName:
                                findPlayerName(
                                    room,
                                    socket
                                ),

                            value:
                                data &&
                                data.value

                        }
                    );

            }
        );


        /* =================================================
           PLAY CARD
        ================================================= */

        socket.on(
            "PLAY_CARD",
            data => {

                const room =
                    getSocketRoom(
                        socket
                    );

                if(!room) return;

                io.to(room.code)
                    .emit(
                        "PLAY_CARD",
                        {

                            playerId:
                                socket.data.playerId,

                            playerName:
                                findPlayerName(
                                    room,
                                    socket
                                ),

                            card:
                                data &&
                                data.card

                        }
                    );

            }
        );


        /* =================================================
           DISCONNECT
        ================================================= */

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "DISCONNECTED:",
                    socket.id
                );

                removePlayer(
                    socket
                );

            }
        );

    }
);


/* =========================================================
   HELPERS
========================================================= */

function getSocketRoom(socket){

    const roomCode =
        socket.data.roomCode;

    if(!roomCode){

        return null;

    }

    return rooms.get(
        roomCode
    ) || null;

}


function findPlayerName(
    room,
    socket
){

    const player =
        room.players.find(
            p =>
                p.socketId ===
                socket.id
        );

    return player
        ? player.name
        : "PLAYER";

}


function removePlayer(socket){

    const room =
        getSocketRoom(
            socket
        );

    if(!room){

        return;

    }


    const index =
        room.players.findIndex(
            p =>
                p.socketId ===
                socket.id
        );


    if(index !== -1){

        room.players.splice(
            index,
            1
        );

    }


    socket.leave(
        room.code
    );


    /*
      اگر بازی هنوز شروع نشده،
      اتاق همچنان برای بازیکنان
      بعدی قابل استفاده است.
    */

    if(room.started){

        /*
          بعداً منطق reconnect/bot
          اینجا اضافه می‌شود.
        */

        room.started = false;

    }


    if(room.players.length === 0){

        rooms.delete(
            room.code
        );

    }else{

        sendRoomUpdate(
            room
        );

    }

}


/* =========================================================
   SERVER
========================================================= */

server.listen(
    PORT,
    () => {

        console.log(
            "================================"
        );

        console.log(
            "SPADES SERVER RUNNING"
        );

        console.log(
            `PORT: ${PORT}`
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log(
            "================================"
        );

    }
);
