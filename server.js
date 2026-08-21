/* =========================================================
   SPADES ONLINE SERVER
   RANDOM MATCH + PRIVATE ROOM

   GAME MODES:
   suit    = 6 players
   classic = 4 players
   two     = 2 players

   Node.js + Express + Socket.IO
========================================================= */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },

  transports: ["websocket", "polling"]
});


/* =========================================================
   SERVER CONFIG
========================================================= */

const PORT =
  process.env.PORT || 3000;


/* =========================================================
   GAME CONFIG
========================================================= */

const GAME_CONFIG = {

  suit: {
    name: "Spade Trump",
    maxPlayers: 6
  },

  classic: {
    name: "Classic Spades",
    maxPlayers: 4
  },

  two: {
    name: "Two Player",
    maxPlayers: 2
  }

};


/* =========================================================
   DATA
========================================================= */

/*
   rooms:

   roomId -> {
      id,
      code,
      game,
      type,
      maxPlayers,
      players,
      started,
      createdAt
   }
*/

const rooms = new Map();


/*
   randomQueues:

   game -> Set(socketId)
*/

const randomQueues = {

  suit: new Set(),

  classic: new Set(),

  two: new Set()

};


/*
   playerRooms:

   socketId -> roomId
*/

const playerRooms = new Map();


/* =========================================================
   BASIC EXPRESS
========================================================= */

app.use(express.json());

app.get("/", (req, res) => {

  res.json({

    success: true,

    server: "SPADES ONLINE SERVER",

    status: "online",

    games: GAME_CONFIG,

    rooms: rooms.size

  });

});


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {

  res.json({

    status: "ok",

    uptime: process.uptime(),

    rooms: rooms.size,

    players: playerRooms.size

  });

});


/* =========================================================
   UTILS
========================================================= */

function generateRoomId() {

  return crypto
    .randomBytes(8)
    .toString("hex");

}


function generateRoomCode() {

  /*
     Example:

     SP8K4M
     A72Q91
  */

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for(let i = 0; i < 6; i++){

    code +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];

  }

  return code;

}


function createUniqueRoomCode() {

  let code;

  do {

    code =
      generateRoomCode();

  } while(
    findRoomByCode(code)
  );

  return code;

}


function findRoomByCode(code) {

  if(!code) {
    return null;
  }

  const normalized =
    String(code)
      .trim()
      .toUpperCase();

  for(const room of rooms.values()){

    if(
      room.code === normalized
    ){

      return room;

    }

  }

  return null;

}


function validGame(game) {

  return Boolean(
    GAME_CONFIG[game]
  );

}


function removeFromAllQueues(socketId) {

  Object.keys(randomQueues)
    .forEach(game => {

      randomQueues[game]
        .delete(socketId);

    });

}


/* =========================================================
   CREATE ROOM
========================================================= */

function createRoom(
  game,
  type
){

  if(!validGame(game)){

    throw new Error(
      "Invalid game."
    );

  }

  const config =
    GAME_CONFIG[game];


  const room = {

    id:
      generateRoomId(),

    code:
      type === "private"
        ? createUniqueRoomCode()
        : null,

    game,

    type,

    maxPlayers:
      config.maxPlayers,

    players: [],

    started: false,

    createdAt:
      Date.now()

  };


  rooms.set(
    room.id,
    room
  );


  return room;

}


/* =========================================================
   PLAYER OBJECT
========================================================= */

function createPlayer(
  socket,
  data
){

  const telegramUser =
    data &&
    data.telegramUser
      ? data.telegramUser
      : null;


  return {

    socketId:
      socket.id,

    id:
      telegramUser &&
      telegramUser.id
        ? String(telegramUser.id)
        : socket.id,

    name:
      telegramUser &&
      (
        telegramUser.first_name ||
        telegramUser.username
      )
        ? (
            telegramUser.first_name ||
            telegramUser.username
          )
        : "Player",

    username:
      telegramUser &&
      telegramUser.username
        ? telegramUser.username
        : null,

    joinedAt:
      Date.now()

  };

}


/* =========================================================
   JOIN ROOM
========================================================= */

function joinRoom(
  socket,
  room,
  player
){

  if(!room){

    throw new Error(
      "Room not found."
    );

  }


  if(room.started){

    throw new Error(
      "Game already started."
    );

  }


  if(
    room.players.length >=
    room.maxPlayers
  ){

    throw new Error(
      "Room is full."
    );

  }


  /*
     Make sure player isn't already
     inside another room.
  */

  leaveCurrentRoom(
    socket,
    false
  );


  room.players.push(
    player
  );


  playerRooms.set(
    socket.id,
    room.id
  );


  socket.join(
    room.id
  );


  sendRoomState(
    room
  );


  /*
     If room is now full,
     start game automatically.
  */

  if(
    room.players.length ===
    room.maxPlayers
  ){

    startGame(
      room
    );

  }

}


/* =========================================================
   ROOM STATE
========================================================= */

function getRoomState(room) {

  return {

    roomId:
      room.id,

    roomCode:
      room.code,

    game:
      room.game,

    gameName:
      GAME_CONFIG[
        room.game
      ].name,

    type:
      room.type,

    maxPlayers:
      room.maxPlayers,

    playerCount:
      room.players.length,

    started:
      room.started,

    players:
      room.players.map(
        (player, index) => {

          return {

            position:
              index + 1,

            id:
              player.id,

            name:
              player.name,

            username:
              player.username

          };

        }
      )

  };

}


/* =========================================================
   SEND ROOM STATE
========================================================= */

function sendRoomState(room) {

  io.to(room.id).emit(
    "ROOM_STATE",
    getRoomState(room)
  );

}


/* =========================================================
   START GAME
========================================================= */

function startGame(room) {

  if(room.started){

    return;

  }


  if(
    room.players.length !==
    room.maxPlayers
  ){

    return;

  }


  room.started =
    true;


  /*
     Assign fixed player positions.

     suit:

     1 - 3 - 5 = Blue
     2 - 4 - 6 = Red

     classic / two:

     position only
  */

  const players =
    room.players.map(
      (player, index) => {

        const position =
          index + 1;


        let team = null;


        if(room.game === "suit"){

          team =
            position % 2 === 1
              ? "BLUE"
              : "RED";

        }


        return {

          position,

          id:
            player.id,

          name:
            player.name,

          username:
            player.username,

          team

        };

      }
    );


  /*
     Notify everyone.

     The actual card game logic
     can be attached after this.
  */

  io.to(room.id).emit(
    "GAME_START",
    {

      roomId:
        room.id,

      roomCode:
        room.code,

      game:
        room.game,

      gameName:
        GAME_CONFIG[
          room.game
        ].name,

      maxPlayers:
        room.maxPlayers,

      players

    }
  );


  console.log(
    `[GAME START] ${room.game} | ${room.id} | ${players.length} players`
  );

}


/* =========================================================
   LEAVE ROOM
========================================================= */

function leaveCurrentRoom(
  socket,
  notify = true
){

  const roomId =
    playerRooms.get(
      socket.id
    );


  if(!roomId){

    removeFromAllQueues(
      socket.id
    );

    return;

  }


  const room =
    rooms.get(
      roomId
    );


  playerRooms.delete(
    socket.id
  );


  socket.leave(
    roomId
  );


  if(!room){

    removeFromAllQueues(
      socket.id
    );

    return;

  }


  room.players =
    room.players.filter(
      player =>
        player.socketId !==
        socket.id
    );


  /*
     If the game hasn't started,
     room remains open.
  */

  if(!room.started){

    if(notify){

      sendRoomState(
        room
      );

    }

  }


  /*
     If game already started,
     notify remaining players.
  */

  else {

    io.to(room.id).emit(
      "PLAYER_LEFT",
      {

        socketId:
          socket.id,

        playerCount:
          room.players.length,

        message:
          "A player left the game."

      }
    );

  }


  /*
     Delete empty room.
  */

  if(
    room.players.length === 0
  ){

    rooms.delete(
      room.id
    );

  }

}


/* =========================================================
   RANDOM MATCH
========================================================= */

function addToRandomQueue(
  socket,
  game,
  data
){

  if(!validGame(game)){

    socket.emit(
      "ERROR",
      {
        message:
          "Invalid game."
      }
    );

    return;

  }


  /*
     Remove player from
     any previous queue.
  */

  removeFromAllQueues(
    socket.id
  );


  /*
     Remove from existing room.
  */

  leaveCurrentRoom(
    socket,
    false
  );


  randomQueues[
    game
  ].add(
    socket.id
  );


  socket.emit(
    "QUEUE_JOINED",
    {

      game,

      gameName:
        GAME_CONFIG[
          game
        ].name,

      position:
        randomQueues[
          game
        ].size,

      needed:
        GAME_CONFIG[
          game
        ].maxPlayers

    }
  );


  matchQueue(
    game
  );

}


/* =========================================================
   MATCH QUEUE
========================================================= */

function matchQueue(game) {

  const queue =
    randomQueues[
      game
    ];

  const needed =
    GAME_CONFIG[
      game
    ].maxPlayers;


  /*
     Remove disconnected sockets.
  */

  for(
    const socketId of queue
  ){

    if(
      !io.sockets.sockets.has(
        socketId
      )
    ){

      queue.delete(
        socketId
      );

    }

  }


  /*
     Keep creating rooms while
     enough players exist.

     Example:

     12 players
     =>
     2 rooms of 6

     18 players
     =>
     3 rooms of 6
  */

  while(
    queue.size >= needed
  ){

    const selected =
      Array.from(
        queue
      ).slice(
        0,
        needed
      );


    const room =
      createRoom(
        game,
        "random"
      );


    selected.forEach(
      socketId => {

        queue.delete(
          socketId
        );


        const socket =
          io.sockets.sockets.get(
            socketId
          );


        if(!socket){

          return;

        }


        const player =
          createPlayer(
            socket,
            {}
          );


        joinRoom(
          socket,
          room,
          player
        );

      }
    );

  }

}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
  "connection",
  socket => {

    console.log(
      `[CONNECT] ${socket.id}`
    );


    /* =====================================================
       IDENTIFY PLAYER
    ===================================================== */

    socket.on(
      "IDENTIFY",
      data => {

        socket.playerData =
          data || {};

      }
    );


    /* =====================================================
       RANDOM MATCH
    ===================================================== */

    socket.on(
      "RANDOM_MATCH",
      data => {

        try{

          const game =
            data &&
            data.game;


          if(
            !validGame(game)
          ){

            socket.emit(
              "ERROR",
              {
                message:
                  "Invalid game."
              }
            );

            return;

          }


          socket.playerData =
            data || {};


          addToRandomQueue(
            socket,
            game,
            data
          );

        }catch(error){

          console.error(
            error
          );

          socket.emit(
            "ERROR",
            {
              message:
                error.message
            }
          );

        }

      }
    );


    /* =====================================================
       CANCEL RANDOM MATCH
    ===================================================== */

    socket.on(
      "CANCEL_RANDOM_MATCH",
      () => {

        removeFromAllQueues(
          socket.id
        );


        socket.emit(
          "QUEUE_CANCELLED"
        );

      }
    );


    /* =====================================================
       CREATE PRIVATE ROOM
    ===================================================== */

    socket.on(
      "CREATE_PRIVATE_ROOM",
      data => {

        try{

          const game =
            data &&
            data.game;


          if(
            !validGame(game)
          ){

            socket.emit(
              "ERROR",
              {
                message:
                  "Invalid game."
              }
            );

            return;

          }


          /*
             Remove player from
             previous room/queue.
          */

          removeFromAllQueues(
            socket.id
          );

          leaveCurrentRoom(
            socket,
            false
          );


          const room =
            createRoom(
              game,
              "private"
            );


          socket.playerData =
            data || {};


          const player =
            createPlayer(
              socket,
              data
            );


          joinRoom(
            socket,
            room,
            player
          );


          /*
             IMPORTANT:

             Creator receives
             the private room code.

             This is the code that
             must be shared with friends.
          */

          socket.emit(
            "PRIVATE_ROOM_CREATED",
            {

              roomId:
                room.id,

              roomCode:
                room.code,

              game:
                room.game,

              gameName:
                GAME_CONFIG[
                  room.game
                ].name,

              maxPlayers:
                room.maxPlayers,

              playerCount:
                room.players.length

            }
          );


          console.log(
            `[PRIVATE ROOM] ${room.code} | ${room.game}`
          );

        }catch(error){

          console.error(
            error
          );

          socket.emit(
            "ERROR",
            {
              message:
                error.message
            }
          );

        }

      }
    );


    /* =====================================================
       JOIN PRIVATE ROOM
    ===================================================== */

    socket.on(
      "JOIN_PRIVATE_ROOM",
      data => {

        try{

          const code =
            data &&
            data.code
              ? String(
                  data.code
                )
                  .trim()
                  .toUpperCase()
              : "";


          if(!code){

            socket.emit(
              "ERROR",
              {
                message:
                  "Please enter the room code."
              }
            );

            return;

          }


          const room =
            findRoomByCode(
              code
            );


          if(!room){

            socket.emit(
              "ERROR",
              {
                message:
                  "Room not found."
              }
            );

            return;

          }


          if(room.started){

            socket.emit(
              "ERROR",
              {
                message:
                  "This game has already started."
              }
            );

            return;

          }


          if(
            room.players.length >=
            room.maxPlayers
          ){

            socket.emit(
              "ERROR",
              {
                message:
                  "This room is full."
              }
            );

            return;

          }


          /*
             If joining player selected
             another game, room's game
             remains authoritative.

             The code determines
             the exact game.
          */

          socket.playerData =
            data || {};


          const player =
            createPlayer(
              socket,
              data
            );


          joinRoom(
            socket,
            room,
            player
          );


          socket.emit(
            "PRIVATE_ROOM_JOINED",
            {

              roomId:
                room.id,

              roomCode:
                room.code,

              game:
                room.game,

              gameName:
                GAME_CONFIG[
                  room.game
                ].name,

              maxPlayers:
                room.maxPlayers,

              playerCount:
                room.players.length

            }
          );


          console.log(
            `[PRIVATE JOIN] ${code} | ${room.players.length}/${room.maxPlayers}`
          );

        }catch(error){

          console.error(
            error
          );

          socket.emit(
            "ERROR",
            {
              message:
                error.message
            }
          );

        }

      }
    );


    /* =====================================================
       GET ROOM STATE
    ===================================================== */

    socket.on(
      "GET_ROOM_STATE",
      () => {

        const roomId =
          playerRooms.get(
            socket.id
          );


        if(!roomId){

          socket.emit(
            "ERROR",
            {
              message:
                "You are not inside a room."
            }
          );

          return;

        }


        const room =
          rooms.get(
            roomId
          );


        if(room){

          socket.emit(
            "ROOM_STATE",
            getRoomState(
              room
            )
          );

        }

      }
    );


    /* =====================================================
       LEAVE ROOM
    ===================================================== */

    socket.on(
      "LEAVE_ROOM",
      () => {

        removeFromAllQueues(
          socket.id
        );

        leaveCurrentRoom(
          socket,
          true
        );

      }
    );


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",
      () => {

        console.log(
          `[DISCONNECT] ${socket.id}`
        );


        removeFromAllQueues(
          socket.id
        );


        leaveCurrentRoom(
          socket,
          true
        );

      }
    );

  }
);


/* =========================================================
   ROOM CLEANUP
========================================================= */

/*
   Remove empty / abandoned rooms.

   This is useful when thousands
   of players use the server.
*/

setInterval(
  () => {

    const now =
      Date.now();


    for(
      const [roomId, room]
      of rooms
    ){

      /*
         Delete completely empty rooms.
      */

      if(
        room.players.length === 0
      ){

        rooms.delete(
          roomId
        );

        continue;

      }


      /*
         Delete very old waiting rooms.

         30 minutes.
      */

      if(
        !room.started &&
        now - room.createdAt >
        30 * 60 * 1000
      ){

        io.to(room.id).emit(
          "ROOM_EXPIRED",
          {
            message:
              "This room has expired."
          }
        );


        room.players.forEach(
          player => {

            playerRooms.delete(
              player.socketId
            );

          }
        );


        rooms.delete(
          roomId
        );

      }

    }

  },

  60 * 1000
);


/* =========================================================
   SERVER START
========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      "======================================"
    );

    console.log(
      "        SPADES ONLINE SERVER"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      "Random Match:"
    );

    console.log(
      "  Spade Trump  = 6 players"
    );

    console.log(
      "  Classic      = 4 players"
    );

    console.log(
      "  Two Player   = 2 players"
    );

    console.log(
      "Private Rooms:"
    );

    console.log(
      "  Room Code enabled"
    );

    console.log(
      "======================================"

    );

  }
);
