/*
=========================================================
 SPADES MULTIPLAYER SERVER
=========================================================

 Supports:

 1. RANDOM MATCH - 6 PLAYERS
 2. RANDOM MATCH - 4 PLAYERS
 3. RANDOM MATCH - 2 PLAYERS
 4. PRIVATE ROOM - 6 PLAYERS
 5. PRIVATE ROOM - 4 PLAYERS
 6. PRIVATE ROOM - 2 PLAYERS

 Each room is independent.

 Random rooms:
 - Server automatically creates rooms.
 - Players are placed into the correct room.
 - When capacity is reached, the room starts.

 Private rooms:
 - One player creates a room.
 - Server generates a room code.
 - Friends enter the code.
 - When capacity is reached, the game starts.

=========================================================
*/

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");


/* ======================================================
   APP
====================================================== */

const app = express();

const server = http.createServer(app);

const io = new Server(server, {

  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }

});


/* ======================================================
   CONFIG
====================================================== */

const PORT =
  process.env.PORT || 3000;


/*
  Supported game types
*/

const GAME_CONFIG = {

  suit: {
    name: "Spade Trump",
    capacity: 6
  },

  classic: {
    name: "Classic Spades",
    capacity: 4
  },

  two: {
    name: "Two Player",
    capacity: 2
  }

};


/*
  Room types
*/

const ROOM_TYPES = {

  RANDOM: "random",

  PRIVATE: "private"

};


/*
  Game states
*/

const GAME_STATES = {

  WAITING: "waiting",

  PLAYING: "playing",

  FINISHED: "finished"

};


/* ======================================================
   MEMORY DATABASE
====================================================== */

/*
  rooms:

  Map<roomId, room>

  Example:

  room = {
    id,
    code,
    game,
    roomType,
    capacity,
    state,
    players: [],
    createdAt,
    startedAt
  }
*/

const rooms =
  new Map();


/*
  socketRooms:

  socket.id -> roomId
*/

const socketRooms =
  new Map();


/*
  Player information
*/

const players =
  new Map();


/* ======================================================
   STATIC FILES
====================================================== */

app.use(
  express.static(
    path.join(
      __dirname
    )
  )
);


/* ======================================================
   HOME
====================================================== */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );

  }
);


/* ======================================================
   HEALTH CHECK
====================================================== */

app.get(
  "/health",
  (req, res) => {

    res.json({

      ok: true,

      server: "SPADES",

      rooms:
        rooms.size,

      players:
        players.size,

      time:
        new Date().toISOString()

    });

  }
);


/* ======================================================
   HELPERS
====================================================== */


/*
  Get game configuration
*/

function getGameConfig(game) {

  return GAME_CONFIG[game] || null;

}


/*
  Generate random room ID
*/

function generateRoomId() {

  return (

    "room_" +

    Date.now().toString(36) +

    "_" +

    Math.random()
      .toString(36)
      .substring(2, 8)

  );

}


/*
  Generate 6-character room code
*/

function generateRoomCode() {

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      characters[
        Math.floor(
          Math.random() *
          characters.length
        )
      ];

  }

  return code;

}


/*
  Make sure code is unique
*/

function createUniqueCode() {

  let code;

  do {

    code =
      generateRoomCode();

  } while (
    [...rooms.values()]
      .some(
        room =>
          room.code === code
      )
  );

  return code;

}


/*
  Create player
*/

function createPlayer(
  socket,
  data = {}
) {

  const user =
    data.user || {};

  const player = {

    id: socket.id,

    telegramId:
      user.id ||
      null,

    username:
      user.username ||
      "",

    firstName:
      user.first_name ||
      "Player",

    avatar:
      user.photo_url ||
      "",

    joinedAt:
      Date.now()

  };


  players.set(
    socket.id,
    player
  );


  return player;

}


/*
  Get room player count
*/

function roomPlayerCount(room) {

  return room.players.length;

}


/*
  Send room information
*/

function roomInfo(room) {

  return {

    id:
      room.id,

    code:
      room.code || null,

    game:
      room.game,

    gameName:
      room.gameName,

    roomType:
      room.roomType,

    capacity:
      room.capacity,

    players:
      room.players.map(
        player => ({

          id:
            player.id,

          telegramId:
            player.telegramId,

          username:
            player.username,

          firstName:
            player.firstName,

          avatar:
            player.avatar

        })
      ),

    playerCount:
      room.players.length,

    state:
      room.state

  };

}


/*
  Broadcast room update
*/

function broadcastRoom(room) {

  io.to(
    room.id
  ).emit(
    "room:update",
    roomInfo(room)
  );

}


/* ======================================================
   ROOM CREATION
====================================================== */

function createRoom(
  game,
  roomType,
  creator
) {

  const config =
    getGameConfig(
      game
    );


  if(!config) {

    return null;

  }


  const room = {

    id:
      generateRoomId(),

    code:
      roomType === ROOM_TYPES.PRIVATE
        ? createUniqueCode()
        : null,

    game,

    gameName:
      config.name,

    roomType,

    capacity:
      config.capacity,

    state:
      GAME_STATES.WAITING,

    players: [],

    createdAt:
      Date.now(),

    startedAt:
      null

  };


  room.players.push(
    creator
  );


  rooms.set(
    room.id,
    room
  );


  socketRooms.set(
    creator.id,
    room.id
  );


  return room;

}


/* ======================================================
   FIND RANDOM ROOM
====================================================== */

function findRandomRoom(
  game
) {

  const config =
    getGameConfig(
      game
    );


  if(!config) {

    return null;

  }


  for(
    const room of rooms.values()
  ) {

    if(

      room.roomType ===
      ROOM_TYPES.RANDOM &&

      room.game ===
      game &&

      room.state ===
      GAME_STATES.WAITING &&

      room.players.length <
      room.capacity

    ) {

      return room;

    }

  }


  return null;

}


/* ======================================================
   JOIN ROOM
====================================================== */

function addPlayerToRoom(
  room,
  player
) {

  if(!room) {

    return {
      ok: false,
      error: "ROOM_NOT_FOUND"
    };

  }


  if(
    room.state !==
    GAME_STATES.WAITING
  ) {

    return {
      ok: false,
      error: "GAME_ALREADY_STARTED"
    };

  }


  if(
    room.players.length >=
    room.capacity
  ) {

    return {
      ok: false,
      error: "ROOM_FULL"
    };

  }


  /*
    Prevent duplicate player
  */

  const alreadyInside =
    room.players.some(
      p =>
        p.id ===
        player.id
    );


  if(alreadyInside) {

    return {
      ok: true,
      room
    };

  }


  /*
    Remove player from old room
  */

  leaveCurrentRoom(
    player.id
  );


  room.players.push(
    player
  );


  socketRooms.set(
    player.id,
    room.id
  );


  return {

    ok: true,

    room

  };

}


/* ======================================================
   JOIN SOCKET ROOM
====================================================== */

function joinSocketRoom(
  socket,
  room
) {

  socket.join(
    room.id
  );

}


/* ======================================================
   START GAME
====================================================== */

function startGame(
  room
) {

  if(!room) {

    return;

  }


  if(
    room.state !==
    GAME_STATES.WAITING
  ) {

    return;

  }


  if(
    room.players.length !==
    room.capacity
  ) {

    return;

  }


  room.state =
    GAME_STATES.PLAYING;


  room.startedAt =
    Date.now();


  /*
    Notify everyone
  */

  io.to(
    room.id
  ).emit(
    "game:start",
    {

      room:
        roomInfo(room),

      players:
        room.players.map(
          (player, index) => ({

            ...player,

            seat:
              index + 1

          })
        )

    }
  );


  broadcastRoom(
    room
  );


  console.log(
    `[GAME START] ${room.game} / ${room.roomType} / ${room.id}`
  );

}


/* ======================================================
   RANDOM MATCH
====================================================== */

function randomMatch(
  socket,
  game,
  user
) {

  const config =
    getGameConfig(
      game
    );


  if(!config) {

    socket.emit(
      "room:error",
      {
        error:
          "INVALID_GAME"
      }
    );

    return;

  }


  /*
    Player object
  */

  let player =
    players.get(
      socket.id
    );


  if(!player) {

    player =
      createPlayer(
        socket,
        {
          user
        }
      );

  }


  /*
    If player already has room
  */

  const currentRoomId =
    socketRooms.get(
      socket.id
    );


  if(currentRoomId) {

    const currentRoom =
      rooms.get(
        currentRoomId
      );


    if(currentRoom) {

      socket.emit(
        "room:joined",
        roomInfo(
          currentRoom
        )
      );

      return;

    }

  }


  /*
    Find existing room
  */

  let room =
    findRandomRoom(
      game
    );


  /*
    If no room exists,
    create one
  */

  if(!room) {

    room =
      createRoom(
        game,
        ROOM_TYPES.RANDOM,
        player
      );

  }else{

    const result =
      addPlayerToRoom(
        room,
        player
      );


    if(!result.ok) {

      socket.emit(
        "room:error",
        {
          error:
            result.error
        }
      );

      return;

    }

  }


  joinSocketRoom(
    socket,
    room
  );


  socket.emit(
    "room:joined",
    roomInfo(room)
  );


  broadcastRoom(
    room
  );


  /*
    Automatically start
    exactly at capacity
  */

  if(
    room.players.length ===
    room.capacity
  ) {

    startGame(
      room
    );

  }

}


/* ======================================================
   PRIVATE ROOM CREATE
====================================================== */

function createPrivateRoom(
  socket,
  game,
  user
) {

  const config =
    getGameConfig(
      game
    );


  if(!config) {

    socket.emit(
      "room:error",
      {
        error:
          "INVALID_GAME"
      }
    );

    return;

  }


  let player =
    players.get(
      socket.id
    );


  if(!player) {

    player =
      createPlayer(
        socket,
        {
          user
        }
      );

  }


  /*
    Remove from previous room
  */

  leaveCurrentRoom(
    socket.id
  );


  const room =
    createRoom(
      game,
      ROOM_TYPES.PRIVATE,
      player
    );


  if(!room) {

    socket.emit(
      "room:error",
      {
        error:
          "ROOM_CREATE_FAILED"
      }
    );

    return;

  }


  joinSocketRoom(
    socket,
    room
  );


  socket.emit(
    "private:created",
    {

      room:
        roomInfo(room),

      code:
        room.code

    }
  );


  broadcastRoom(
    room
  );


  console.log(
    `[PRIVATE ROOM] ${room.code} created for ${game}`
  );

}


/* ======================================================
   JOIN PRIVATE ROOM
====================================================== */

function joinPrivateRoom(
  socket,
  game,
  code,
  user
) {

  const config =
    getGameConfig(
      game
    );


  if(!config) {

    socket.emit(
      "room:error",
      {
        error:
          "INVALID_GAME"
      }
    );

    return;

  }


  if(
    !code ||
    typeof code !==
    "string"
  ) {

    socket.emit(
      "room:error",
      {
        error:
          "INVALID_ROOM_CODE"
      }
    );

    return;

  }


  const normalizedCode =
    code
      .trim()
      .toUpperCase();


  /*
    Find private room
  */

  let room = null;


  for(
    const candidate
    of rooms.values()
  ) {

    if(

      candidate.roomType ===
      ROOM_TYPES.PRIVATE &&

      candidate.code ===
      normalizedCode

    ) {

      room =
        candidate;

      break;

    }

  }


  if(!room) {

    socket.emit(
      "room:error",
      {
        error:
          "ROOM_NOT_FOUND"
      }
    );

    return;

  }


  /*
    Check game type
  */

  if(
    room.game !==
    game
  ) {

    socket.emit(
      "room:error",
      {
        error:
          "WRONG_GAME"
      }
    );

    return;

  }


  /*
    Check capacity
  */

  if(
    room.players.length >=
    room.capacity
  ) {

    socket.emit(
      "room:error",
      {
        error:
          "ROOM_FULL"
      }
    );

    return;

  }


  let player =
    players.get(
      socket.id
    );


  if(!player) {

    player =
      createPlayer(
        socket,
        {
          user
        }
      );

  }


  const result =
    addPlayerToRoom(
      room,
      player
    );


  if(!result.ok) {

    socket.emit(
      "room:error",
      {
        error:
          result.error
      }
    );

    return;

  }


  joinSocketRoom(
    socket,
    room
  );


  socket.emit(
    "private:joined",
    roomInfo(room)
  );


  broadcastRoom(
    room
  );


  /*
    Start automatically
    when room is full
  */

  if(
    room.players.length ===
    room.capacity
  ) {

    startGame(
      room
    );

  }

}


/* ======================================================
   LEAVE CURRENT ROOM
====================================================== */

function leaveCurrentRoom(
  socketId
) {

  const roomId =
    socketRooms.get(
      socketId
    );


  if(!roomId) {

    return;

  }


  const room =
    rooms.get(
      roomId
    );


  socketRooms.delete(
    socketId
  );


  if(!room) {

    return;

  }


  /*
    Remove player
  */

  room.players =
    room.players.filter(
      player =>
        player.id !==
        socketId
    );


  /*
    If game is waiting,
    notify remaining players
  */

  if(
    room.state ===
    GAME_STATES.WAITING
  ) {

    broadcastRoom(
      room
    );

  }


  /*
    Empty room gets deleted
  */

  if(
    room.players.length ===
    0
  ) {

    rooms.delete(
      room.id
    );

    console.log(
      `[ROOM REMOVED] ${room.id}`
    );

  }

}


/* ======================================================
   SOCKET.IO
====================================================== */

io.on(
  "connection",
  socket => {

    console.log(
      `[CONNECTED] ${socket.id}`
    );


    /* ==================================================
       REGISTER PLAYER
    ================================================== */

    socket.on(
      "player:register",
      data => {

        try{

          createPlayer(
            socket,
            data || {}
          );


          socket.emit(
            "player:registered",
            {
              ok:true
            }
          );

        }catch(error){

          console.error(
            "Register error:",
            error
          );

          socket.emit(
            "room:error",
            {
              error:
                "REGISTER_FAILED"
            }
          );

        }

      }
    );


    /* ==================================================
       RANDOM MATCH
    ================================================== */

    socket.on(
      "random:join",
      data => {

        try{

          data =
            data || {};


          randomMatch(
            socket,

            data.game,

            data.user
          );

        }catch(error){

          console.error(
            "Random match error:",
            error
          );

          socket.emit(
            "room:error",
            {
              error:
                "RANDOM_MATCH_FAILED"
            }
          );

        }

      }
    );


    /* ==================================================
       PRIVATE CREATE
    ================================================== */

    socket.on(
      "private:create",
      data => {

        try{

          data =
            data || {};


          createPrivateRoom(
            socket,

            data.game,

            data.user
          );

        }catch(error){

          console.error(
            "Private create error:",
            error
          );

          socket.emit(
            "room:error",
            {
              error:
                "PRIVATE_CREATE_FAILED"
            }
          );

        }

      }
    );


    /* ==================================================
       PRIVATE JOIN
    ================================================== */

    socket.on(
      "private:join",
      data => {

        try{

          data =
            data || {};


          joinPrivateRoom(
            socket,

            data.game,

            data.code,

            data.user
          );

        }catch(error){

          console.error(
            "Private join error:",
            error
          );

          socket.emit(
            "room:error",
            {
              error:
                "PRIVATE_JOIN_FAILED"
            }
          );

        }

      }
    );


    /* ==================================================
       LEAVE ROOM
    ================================================== */

    socket.on(
      "room:leave",
      () => {

        try{

          const roomId =
            socketRooms.get(
              socket.id
            );


          const room =
            roomId
              ? rooms.get(roomId)
              : null;


          leaveCurrentRoom(
            socket.id
          );


          if(room){

            socket.leave(
              room.id
            );

          }


          socket.emit(
            "room:left",
            {
              ok:true
            }
          );

        }catch(error){

          console.error(
            "Leave error:",
            error
          );

        }

      }
    );


    /* ==================================================
       GET CURRENT ROOM
    ================================================== */

    socket.on(
      "room:get",
      () => {

        const roomId =
          socketRooms.get(
            socket.id
          );


        if(!roomId){

          socket.emit(
            "room:none"
          );

          return;

        }


        const room =
          rooms.get(
            roomId
          );


        if(!room){

          socket.emit(
            "room:none"
          );

          return;

        }


        socket.emit(
          "room:update",
          roomInfo(room)
        );

      }
    );


    /* ==================================================
       DISCONNECT
    ================================================== */

    socket.on(
      "disconnect",
      reason => {

        console.log(
          `[DISCONNECTED] ${socket.id} - ${reason}`
        );


        const roomId =
          socketRooms.get(
            socket.id
          );


        const room =
          roomId
            ? rooms.get(roomId)
            : null;


        leaveCurrentRoom(
          socket.id
        );


        players.delete(
          socket.id
        );


        /*
          Notify remaining players
        */

        if(room){

          if(
            room.state ===
            GAME_STATES.WAITING
          ){

            broadcastRoom(
              room
            );

          }

        }

      }
    );

  }
);


/* ======================================================
   PERIODIC CLEANUP
====================================================== */

setInterval(
  () => {

    const now =
      Date.now();


    for(
      const [
        roomId,
        room
      ]
      of rooms.entries()
    ) {

      /*
        Delete empty rooms
      */

      if(
        room.players.length ===
        0
      ) {

        rooms.delete(
          roomId
        );

        continue;

      }


      /*
        Delete abandoned waiting
        rooms after 30 minutes
      */

      if(

        room.state ===
        GAME_STATES.WAITING &&

        now -
        room.createdAt >
        30 * 60 * 1000

      ) {

        io.to(
          room.id
        ).emit(
          "room:expired"
        );


        rooms.delete(
          roomId
        );

      }

    }

  },

  60 * 1000

);


/* ======================================================
   SERVER START
====================================================== */

server.listen(
  PORT,
  () => {

    console.log(
      "=========================================="
    );

    console.log(
      "        SPADES SERVER STARTED"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `PORT: ${PORT}`
    );

    console.log(
      "Games:"
    );

    console.log(
      " - Spade Trump : 6 players"
    );

    console.log(
      " - Classic Spades : 4 players"
    );

    console.log(
      " - Two Player : 2 players"
    );

    console.log(
      "Room Types:"
    );

    console.log(
      " - RANDOM MATCH"
    );

    console.log(
      " - PRIVATE ROOM"
    );

    console.log(
      "=========================================="

    );

  }
);
