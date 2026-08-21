/*
=========================================================
SPADES ONLINE SERVER
=========================================================

Architecture:

index.html
    ↓
game.js
    ↓
Socket.IO
    ↓
server.js

GAME TYPES:

suit    = 6 players
classic = 4 players
two     = 2 players

ROOM TYPES:

random  = RANDOM MATCH
private = PRIVATE ROOM

=========================================================
*/

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


/* ========================================================
   CONFIGURATION
======================================================== */

const PORT = process.env.PORT || 3000;

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


/* ========================================================
   ROOMS
========================================================

rooms = {

  roomId: {

    id,
    game,
    type,
    capacity,
    players: [],
    started,
    createdAt

  }

}

======================================================== */

const rooms = new Map();


/* ========================================================
   PLAYER SOCKET INDEX
========================================================

socketToRoom:

socket.id → roomId

This allows quick room lookup when
a player disconnects.

======================================================== */

const socketToRoom = new Map();


/* ========================================================
   EXPRESS
======================================================== */

app.use(
  express.json()
);

app.use(
  express.static(
    path.join(__dirname)
  )
);


/* ========================================================
   BASIC ROUTES
======================================================== */

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


app.get(
  "/game",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "game.html"
      )
    );

  }
);


app.get(
  "/health",
  (req, res) => {

    res.json({
      ok: true,
      server: "SPADES",
      rooms: rooms.size,
      players: socketToRoom.size,
      time: new Date().toISOString()
    });

  }
);


/* ========================================================
   UTILITY
======================================================== */


/*
Generate random room code.

Example:

A7K92P

*/

function generateRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }

  return code;

}


/*
Generate unique private room code.
*/

function generateUniqueRoomCode() {

  let code;

  do {

    code =
      generateRoomCode();

  } while (
    rooms.has(code)
  );

  return code;

}


/*
Create random room ID.
*/

function generateRandomRoomId(game) {

  let id;

  do {

    id =
      `${game}-random-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}`;

  } while (
    rooms.has(id)
  );

  return id;

}


/*
Validate game type.
*/

function isValidGame(game) {

  return Object.prototype.hasOwnProperty.call(
    GAME_CONFIG,
    game
  );

}


/*
Return room player count.
*/

function playerCount(room) {

  return room.players.length;

}


/*
Check whether room is full.
*/

function isRoomFull(room) {

  return (
    playerCount(room) >=
    room.capacity
  );

}


/* ========================================================
   ROOM CREATION
======================================================== */

function createRoom(
  game,
  type
) {

  if (
    !isValidGame(game)
  ) {

    throw new Error(
      "Invalid game type."
    );

  }


  const capacity =
    GAME_CONFIG[game].capacity;


  let roomId;


  if (
    type === "private"
  ) {

    roomId =
      generateUniqueRoomCode();

  } else {

    roomId =
      generateRandomRoomId(
        game
      );

  }


  const room = {

    id: roomId,

    game,

    type,

    capacity,

    players: [],

    started: false,

    createdAt: Date.now(),

    gameState: null

  };


  rooms.set(
    roomId,
    room
  );


  return room;

}


/* ========================================================
   FIND RANDOM ROOM
========================================================

Only returns rooms that:

1. Match the game
2. Are RANDOM
3. Are not started
4. Have free space

======================================================== */

function findRandomRoom(game) {

  for (
    const room of rooms.values()
  ) {

    if (
      room.game === game &&
      room.type === "random" &&
      !room.started &&
      !isRoomFull(room)
    ) {

      return room;

    }

  }


  return null;

}


/* ========================================================
   GET OR CREATE RANDOM ROOM
======================================================== */

function getRandomRoom(game) {

  let room =
    findRandomRoom(
      game
    );


  if (!room) {

    room =
      createRoom(
        game,
        "random"
      );

  }


  return room;

}


/* ========================================================
   ADD PLAYER
======================================================== */

function addPlayerToRoom(
  room,
  socket,
  playerInfo = {}
) {

  if (
    !room ||
    !socket
  ) {

    return {
      ok: false,
      error: "Invalid room or socket."
    };

  }


  if (
    room.started
  ) {

    return {
      ok: false,
      error: "This game has already started."
    };

  }


  if (
    isRoomFull(room)
  ) {

    return {
      ok: false,
      error: "This room is full."
    };

  }


  /*
  Prevent duplicate socket.
  */

  const alreadyInside =
    room.players.find(
      player =>
        player.socketId ===
        socket.id
    );


  if (alreadyInside) {

    return {
      ok: true,
      player: alreadyInside
    };

  }


  const player = {

    socketId:
      socket.id,

    userId:
      playerInfo.userId ||
      null,

    username:
      playerInfo.username ||
      "Player",

    firstName:
      playerInfo.firstName ||
      "",

    avatar:
      playerInfo.avatar ||
      "",

    seat:
      room.players.length,

    joinedAt:
      Date.now()

  };


  room.players.push(
    player
  );


  socketToRoom.set(
    socket.id,
    room.id
  );


  return {
    ok: true,
    player
  };

}


/* ========================================================
   REMOVE PLAYER
======================================================== */

function removePlayerFromRoom(
  socketId
) {

  const roomId =
    socketToRoom.get(
      socketId
    );


  if (!roomId) {

    return null;

  }


  const room =
    rooms.get(
      roomId
    );


  socketToRoom.delete(
    socketId
  );


  if (!room) {

    return null;

  }


  const index =
    room.players.findIndex(
      player =>
        player.socketId ===
        socketId
    );


  if (
    index !== -1
  ) {

    room.players.splice(
      index,
      1
    );

  }


  /*
  Re-number seats.

  This only matters before
  the game starts.

  */

  if (
    !room.started
  ) {

    room.players.forEach(
      (player, i) => {

        player.seat = i;

      }
    );

  }


  /*
  Delete empty rooms.
  */

  if (
    room.players.length === 0
  ) {

    rooms.delete(
      room.id
    );

  }


  return room;

}


/* ========================================================
   PUBLIC ROOM STATE
======================================================== */

function getRoomState(room) {

  if (!room) {

    return null;

  }


  return {

    roomId:
      room.id,

    game:
      room.game,

    gameName:
      GAME_CONFIG[
        room.game
      ]
        ? GAME_CONFIG[
            room.game
          ].name
        : room.game,

    type:
      room.type,

    capacity:
      room.capacity,

    started:
      room.started,

    playerCount:
      room.players.length,

    players:
      room.players.map(
        player => ({

          socketId:
            player.socketId,

          userId:
            player.userId,

          username:
            player.username,

          firstName:
            player.firstName,

          avatar:
            player.avatar,

          seat:
            player.seat

        })
      )

  };

}


/* ========================================================
   BROADCAST ROOM STATE
======================================================== */

function broadcastRoomState(
  room
) {

  if (!room) {

    return;

  }


  const state =
    getRoomState(
      room
    );


  io.to(
    room.id
  ).emit(
    "room_update",
    state
  );

}


/* ========================================================
   START ROOM
======================================================== */

function startRoom(
  room
) {

  if (!room) {

    return false;

  }


  if (
    room.started
  ) {

    return false;

  }


  /*
  IMPORTANT:

  A game starts ONLY when
  all required HUMAN players
  have joined.

  */

  if (
    room.players.length !==
    room.capacity
  ) {

    return false;

  }


  room.started =
    true;


  /*
  Create initial server game state.

  The detailed card rules remain
  inside game.js / future game engine.

  */

  room.gameState = {

    phase:
      "starting",

    startedAt:
      Date.now(),

    currentPlayer:
      0,

    round:
      1,

    trick:
      1

  };


  /*
  Tell every player that
  the room is ready.

  */

  io.to(
    room.id
  ).emit(
    "game_start",
    {

      roomId:
        room.id,

      game:
        room.game,

      type:
        room.type,

      capacity:
        room.capacity,

      players:
        room.players.map(
          player => ({

            socketId:
              player.socketId,

            userId:
              player.userId,

            username:
              player.username,

            firstName:
              player.firstName,

            avatar:
              player.avatar,

            seat:
              player.seat

          })
        ),

      gameState:
        room.gameState

    }
  );


  /*
  Also send updated room state.
  */

  broadcastRoomState(
    room
  );


  return true;

}


/* ========================================================
   JOIN SOCKET ROOM
======================================================== */

function joinSocketRoom(
  socket,
  room
) {

  socket.join(
    room.id
  );

}


/* ========================================================
   SOCKET.IO
======================================================== */

io.on(
  "connection",
  socket => {

    console.log(
      `Socket connected: ${socket.id}`
    );


    /* ====================================================
       PLAYER JOIN RANDOM MATCH
    ==================================================== */

    socket.on(
      "join_random",
      data => {

        try {

          const game =
            data &&
            data.game
              ? String(
                  data.game
                )
              : "";


          if (
            !isValidGame(game)
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  "Invalid game type."
              }
            );

            return;

          }


          /*
          If player is already
          inside another room,
          leave it first.
          */

          leaveCurrentRoom(
            socket
          );


          const room =
            getRandomRoom(
              game
            );


          const result =
            addPlayerToRoom(
              room,
              socket,
              data.player || {}
            );


          if (
            !result.ok
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  result.error
              }
            );

            return;

          }


          joinSocketRoom(
            socket,
            room
          );


          /*
          Tell this player exactly
          which room they joined.
          */

          socket.emit(
            "room_joined",
            {

              roomId:
                room.id,

              game:
                room.game,

              type:
                room.type,

              capacity:
                room.capacity,

              seat:
                result.player.seat,

              player:
                result.player,

              roomState:
                getRoomState(
                  room
                )

            }
          );


          /*
          Update everyone.
          */

          broadcastRoomState(
            room
          );


          /*
          Start ONLY if full.
          */

          if (
            room.players.length ===
            room.capacity
          ) {

            startRoom(
              room
            );

          }

        } catch(error) {

          console.error(
            "join_random error:",
            error
          );


          socket.emit(
            "join_error",
            {
              message:
                "Could not join random match."
            }
          );

        }

      }
    );


    /* ====================================================
       CREATE PRIVATE ROOM
    ==================================================== */

    socket.on(
      "create_private",
      data => {

        try {

          const game =
            data &&
            data.game
              ? String(
                  data.game
                )
              : "";


          if (
            !isValidGame(game)
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  "Invalid game type."
              }
            );

            return;

          }


          /*
          Leave old room.
          */

          leaveCurrentRoom(
            socket
          );


          /*
          Create private room.
          */

          const room =
            createRoom(
              game,
              "private"
            );


          const result =
            addPlayerToRoom(
              room,
              socket,
              data.player || {}
            );


          if (
            !result.ok
          ) {

            rooms.delete(
              room.id
            );

            socket.emit(
              "join_error",
              {
                message:
                  result.error
              }
            );

            return;

          }


          joinSocketRoom(
            socket,
            room
          );


          /*
          Send private code
          to room creator.

          */

          socket.emit(
            "private_room_created",
            {

              roomId:
                room.id,

              roomCode:
                room.id,

              game:
                room.game,

              capacity:
                room.capacity,

              seat:
                result.player.seat,

              roomState:
                getRoomState(
                  room
                )

            }
          );


          broadcastRoomState(
            room
          );


        } catch(error) {

          console.error(
            "create_private error:",
            error
          );


          socket.emit(
            "join_error",
            {
              message:
                "Could not create private room."
            }
          );

        }

      }
    );


    /* ====================================================
       JOIN PRIVATE ROOM
    ==================================================== */

    socket.on(
      "join_private",
      data => {

        try {

          const roomCode =
            data &&
            data.roomCode
              ? String(
                  data.roomCode
                )
                .trim()
                .toUpperCase()
              : "";


          if (!roomCode) {

            socket.emit(
              "join_error",
              {
                message:
                  "Please enter a room code."
              }
            );

            return;

          }


          const room =
            rooms.get(
              roomCode
            );


          if (!room) {

            socket.emit(
              "join_error",
              {
                message:
                  "Private room not found."
              }
            );

            return;

          }


          if (
            room.type !==
            "private"
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  "This is not a private room."
              }
            );

            return;

          }


          if (
            room.started
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  "This game has already started."
              }
            );

            return;

          }


          if (
            isRoomFull(room)
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  "This private room is full."
              }
            );

            return;

          }


          /*
          Game mismatch protection.

          If game.js sends the game,
          make sure it matches.

          */

          if (
            data.game &&
            String(data.game) !==
              room.game
          ) {

            socket.emit(
              "join_error",
              {
                message:
                  "This room belongs to another game."
              }
            );

            return;

          }


          /*
          Leave current room first.
          */

          leaveCurrentRoom(
            socket
          );


          const result =
            addPlayerToRoom(
              room,
              socket,
              data.player || {}
            );


          if (
            !result.ok
          ) {

            socket.emit(
              "join_error",
              {
                message:
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
            "room_joined",
            {

              roomId:
                room.id,

              roomCode:
                room.id,

              game:
                room.game,

              type:
                room.type,

              capacity:
                room.capacity,

              seat:
                result.player.seat,

              player:
                result.player,

              roomState:
                getRoomState(
                  room
                )

            }
          );


          broadcastRoomState(
            room
          );


          /*
          Start when full.
          */

          if (
            room.players.length ===
            room.capacity
          ) {

            startRoom(
              room
            );

          }

        } catch(error) {

          console.error(
            "join_private error:",
            error
          );


          socket.emit(
            "join_error",
            {
              message:
                "Could not join private room."
            }
          );

        }

      }
    );


    /* ====================================================
       REQUEST ROOM STATE
    ==================================================== */

    socket.on(
      "get_room_state",
      () => {

        const roomId =
          socketToRoom.get(
            socket.id
          );


        if (!roomId) {

          socket.emit(
            "room_error",
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


        if (!room) {

          socket.emit(
            "room_error",
            {
              message:
                "Room no longer exists."
            }
          );

          return;

        }


        socket.emit(
          "room_update",
          getRoomState(
            room
          )
        );

      }
    );


    /* ====================================================
       LEAVE ROOM
    ==================================================== */

    socket.on(
      "leave_room",
      () => {

        leaveCurrentRoom(
          socket
        );

      }
    );


    /* ====================================================
       GAME ACTION
    ====================================================

       This is the online transport layer.

       game.js can send actions such as:

       {
         type: "play_card",
         card: {...}
       }

       or:

       {
         type: "bid",
         value: 3
       }

       The actual rule validation should remain
       in the game engine.

    ==================================================== */

    socket.on(
      "game_action",
      action => {

        try {

          const roomId =
            socketToRoom.get(
              socket.id
            );


          if (!roomId) {

            socket.emit(
              "game_error",
              {
                message:
                  "You are not inside a game room."
              }
            );

            return;

          }


          const room =
            rooms.get(
              roomId
            );


          if (!room) {

            socket.emit(
              "game_error",
              {
                message:
                  "Game room not found."
              }
            );

            return;

          }


          if (
            !room.started
          ) {

            socket.emit(
              "game_error",
              {
                message:
                  "The game has not started yet."
              }
            );

            return;

          }


          /*
          Find player.
          */

          const player =
            room.players.find(
              p =>
                p.socketId ===
                socket.id
            );


          if (!player) {

            socket.emit(
              "game_error",
              {
                message:
                  "Player not found."
              }
            );

            return;

          }


          /*
          Forward the action
          to all players in room.

          game.js receives:

          game_action

          */

          io.to(
            room.id
          ).emit(
            "game_action",
            {

              playerId:
                socket.id,

              seat:
                player.seat,

              action:
                action,

              timestamp:
                Date.now()

            }
          );


        } catch(error) {

          console.error(
            "game_action error:",
            error
          );


          socket.emit(
            "game_error",
            {
              message:
                "Game action failed."
            }
          );

        }

      }
    );


    /* ====================================================
       CHAT
    ==================================================== */

    socket.on(
      "chat_message",
      message => {

        const roomId =
          socketToRoom.get(
            socket.id
          );


        if (!roomId) {

          return;

        }


        const room =
          rooms.get(
            roomId
          );


        if (!room) {

          return;

        }


        const player =
          room.players.find(
            p =>
              p.socketId ===
              socket.id
          );


        if (!player) {

          return;

        }


        const cleanMessage =
          String(
            message || ""
          )
          .trim()
          .slice(
            0,
            300
          );


        if (!cleanMessage) {

          return;

        }


        io.to(
          room.id
        ).emit(
          "chat_message",
          {

            player:
              player.username,

            seat:
              player.seat,

            message:
              cleanMessage,

            timestamp:
              Date.now()

          }
        );

      }
    );


    /* ====================================================
       DISCONNECT
    ==================================================== */

    socket.on(
      "disconnect",
      reason => {

        console.log(
          `Socket disconnected: ${socket.id} (${reason})`
        );


        const roomId =
          socketToRoom.get(
            socket.id
          );


        if (!roomId) {

          return;

        }


        const room =
          rooms.get(
            roomId
          );


        if (!room) {

          socketToRoom.delete(
            socket.id
          );

          return;

        }


        /*
        If game already started,
        notify players.

        We do NOT automatically
        add another human.

        game.js can later replace
        disconnected players with bots.
        */

        if (
          room.started
        ) {

          const player =
            room.players.find(
              p =>
                p.socketId ===
                socket.id
            );


          if (player) {

            io.to(
              room.id
            ).emit(
              "player_disconnected",
              {

                socketId:
                  socket.id,

                seat:
                  player.seat,

                username:
                  player.username,

                message:
                  `${player.username} disconnected.`

              }
            );

          }


          /*
          Keep the seat occupied
          during an active game.

          This prevents the room from
          changing size while the game
          is running.

          */

          socketToRoom.delete(
            socket.id
          );

          return;

        }


        /*
        Before game start,
        remove player normally.
        */

        removePlayerFromRoom(
          socket.id
        );


        const updatedRoom =
          rooms.get(
            roomId
          );


        if (updatedRoom) {

          broadcastRoomState(
            updatedRoom
          );

        }

      }

    );

  }
);


/* ========================================================
   LEAVE CURRENT ROOM
======================================================== */

function leaveCurrentRoom(
  socket
) {

  const roomId =
    socketToRoom.get(
      socket.id
    );


  if (!roomId) {

    return;

  }


  const room =
    rooms.get(
      roomId
    );


  /*
  Remove socket from
  Socket.IO room.
  */

  try {

    socket.leave(
      roomId
    );

  } catch(error) {}


  /*
  If active game:
  do not change room seats.

  */

  if (
    room &&
    room.started
  ) {

    socketToRoom.delete(
      socket.id
    );

    return;

  }


  const updatedRoom =
    removePlayerFromRoom(
      socket.id
    );


  if (updatedRoom) {

    broadcastRoomState(
      updatedRoom
    );

  }

}


/* ========================================================
   CLEAN EMPTY ROOMS
========================================================

Every 5 minutes remove abandoned
rooms that have been empty.

======================================================== */

setInterval(
  () => {

    const now =
      Date.now();


    for (
      const [
        roomId,
        room
      ] of rooms
    ) {

      if (
        room.players.length === 0
      ) {

        rooms.delete(
          roomId
        );

        continue;

      }


      /*
      Only clean rooms that
      have not started.

      */

      if (
        !room.started &&
        now -
          room.createdAt >
          30 * 60 * 1000
      ) {

        /*
        Notify remaining players.
        */

        io.to(
          room.id
        ).emit(
          "room_closed",
          {
            message:
              "This room expired."
          }
        );


        rooms.delete(
          roomId
        );

      }

    }

  },

  5 * 60 * 1000

);


/* ========================================================
   SERVER STATUS
======================================================== */

function getServerStats() {

  let players = 0;

  let randomRooms = 0;

  let privateRooms = 0;

  let startedRooms = 0;


  for (
    const room of rooms.values()
  ) {

    players +=
      room.players.length;


    if (
      room.type ===
      "random"
    ) {

      randomRooms++;

    }


    if (
      room.type ===
      "private"
    ) {

      privateRooms++;

    }


    if (
      room.started
    ) {

      startedRooms++;

    }

  }


  return {

    rooms:
      rooms.size,

    players,

    randomRooms,

    privateRooms,

    startedRooms

  };

}


/* ========================================================
   ADMIN / DEBUG STATUS
======================================================== */

app.get(
  "/status",
  (req, res) => {

    res.json({
      ok: true,

      gameConfig:
        GAME_CONFIG,

      stats:
        getServerStats(),

      rooms:
        Array.from(
          rooms.values()
        ).map(
          room =>
            getRoomState(
              room
            )
        )

    });

  }
);


/* ========================================================
   START SERVER
======================================================== */

server.listen(
  PORT,
  () => {

    console.log(
      "=========================================="
    );

    console.log(
      "        SPADES ONLINE SERVER"
    );

    console.log(
      "=========================================="
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      "Games:"
    );

    console.log(
      "Spade Trump  : 6 players"
    );

    console.log(
      "Classic Spades: 4 players"
    );

    console.log(
      "Two Player   : 2 players"
    );

    console.log(
      "Room types:"
    );

    console.log(
      "RANDOM MATCH"
    );

    console.log(
      "PRIVATE ROOM"
    );

    console.log(
      "=========================================="
    );

  }
);


/* ========================================================
   ERROR HANDLING
======================================================== */

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
