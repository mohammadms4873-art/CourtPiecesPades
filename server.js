/* =========================================================
   SPADES ONLINE SERVER
   Socket.IO + Express

   Supported:
   6 PLAYER GAME
   4 PLAYER GAME
   2 PLAYER GAME

   MATCH TYPES:
   RANDOM MATCH
   PRIVATE ROOM

   IMPORTANT:
   Token deduction is done on SERVER.
========================================================= */

const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");


/* =========================================================
   APP
========================================================= */

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
   PORT
========================================================= */

const PORT =
  process.env.PORT || 3000;


/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.static(
    __dirname
  )
);


/* =========================================================
   MAIN PAGE
========================================================= */

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


/* =========================================================
   GAME PAGE
========================================================= */

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


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/health",
  (req, res) => {

    res.json({

      status: "ok",

      server: "SPADES",

      time:
        new Date().toISOString(),

      rooms:
        rooms.size,

      players:
        players.size

    });

  }
);


/* =========================================================
   GAME CONFIGURATION
========================================================= */

const GAME_CONFIG = {

  suit: {

    id: "suit",

    name: "Spade Trump",

    players: 6,

    entryFee: 50

  },

  classic: {

    id: "classic",

    name: "Classic Spades",

    players: 4,

    entryFee: 50

  },

  two: {

    id: "two",

    name: "Two Player",

    players: 2,

    entryFee: 50

  }

};


/* =========================================================
   ROOM TYPES
========================================================= */

const ROOM_TYPES = {

  RANDOM: "random",

  PRIVATE: "private"

};


/* =========================================================
   ROOM STATUS
========================================================= */

const ROOM_STATUS = {

  WAITING: "waiting",

  STARTING: "starting",

  PLAYING: "playing",

  FINISHED: "finished"

};


/* =========================================================
   MEMORY DATABASE
========================================================= */

/*
   This is an in-memory server database.

   Later, when the game is ready for production,
   replace this with Redis / PostgreSQL / MongoDB
   or another persistent database.
*/

const players = new Map();

const rooms = new Map();

const randomQueues = {

  suit: [],

  classic: [],

  two: []

};


/* =========================================================
   PLAYER DATA
========================================================= */

function createPlayer(socket) {

  return {

    socketId:
      socket.id,

    telegramId:
      null,

    username:
      null,

    firstName:
      null,

    tokens:
      100,

    game:
      null,

    roomId:
      null,

    seat:
      null,

    connected:
      true

  };

}


/* =========================================================
   ROOM ID
========================================================= */

function generateRoomId() {

  let id;

  do {

    id =
      crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

  } while (
    rooms.has(id)
  );

  return id;

}


/* =========================================================
   PRIVATE ROOM CODE
========================================================= */

function generatePrivateCode() {

  let code;

  do {

    code =
      crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

  } while (
    rooms.has(code)
  );

  return code;

}


/* =========================================================
   CREATE ROOM
========================================================= */

function createRoom(
  game,
  type
) {

  const config =
    GAME_CONFIG[game];

  if (!config) {

    throw new Error(
      "Invalid game."
    );

  }


  const roomId =
    generateRoomId();


  const roomCode =
    type === ROOM_TYPES.PRIVATE
      ? generatePrivateCode()
      : null;


  const room = {

    id:
      roomId,

    code:
      roomCode,

    game:
      game,

    gameName:
      config.name,

    type:
      type,

    capacity:
      config.players,

    entryFee:
      config.entryFee,

    status:
      ROOM_STATUS.WAITING,

    players:
      [],

    createdAt:
      Date.now(),

    startedAt:
      null,

    gameState:
      null

  };


  rooms.set(
    roomId,
    room
  );


  return room;

}


/* =========================================================
   GET PLAYER
========================================================= */

function getPlayer(
  socketId
) {

  return players.get(
    socketId
  );

}


/* =========================================================
   GET ROOM
========================================================= */

function getRoom(
  roomId
) {

  if (!roomId) {

    return null;

  }

  return rooms.get(
    roomId
  ) || null;

}


/* =========================================================
   REMOVE PLAYER FROM RANDOM QUEUE
========================================================= */

function removeFromRandomQueue(
  socketId
) {

  for (
    const game of Object.keys(
      randomQueues
    )
  ) {

    randomQueues[game] =
      randomQueues[game].filter(
        id =>
          id !== socketId
      );

  }

}


/* =========================================================
   ADD TO RANDOM QUEUE
========================================================= */

function addToRandomQueue(
  socketId,
  game
) {

  if (
    !randomQueues[game]
  ) {

    return false;

  }


  removeFromRandomQueue(
    socketId
  );


  randomQueues[game].push(
    socketId
  );


  return true;

}


/* =========================================================
   FIND RANDOM PLAYER
========================================================= */

function getNextQueuedPlayer(
  game
) {

  const queue =
    randomQueues[game];

  if (!queue) {

    return null;

  }


  while (
    queue.length > 0
  ) {

    const socketId =
      queue.shift();


    const player =
      players.get(
        socketId
      );


    if (
      player &&
      player.connected &&
      !player.roomId
    ) {

      return player;

    }

  }


  return null;

}


/* =========================================================
   CREATE RANDOM ROOM
========================================================= */

function createRandomRoom(
  game
) {

  return createRoom(
    game,
    ROOM_TYPES.RANDOM
  );

}


/* =========================================================
   CREATE PRIVATE ROOM
========================================================= */

function createPrivateRoom(
  game
) {

  return createRoom(
    game,
    ROOM_TYPES.PRIVATE
  );

}


/* =========================================================
   ROOM PLAYER COUNT
========================================================= */

function roomPlayerCount(
  room
) {

  if (!room) {

    return 0;

  }

  return room.players.length;

}


/* =========================================================
   ROOM FULL
========================================================= */

function isRoomFull(
  room
) {

  return (
    roomPlayerCount(room) >=
    room.capacity
  );

}


/* =========================================================
   ROOM AVAILABLE
========================================================= */

function canJoinRoom(
  room
) {

  if (!room) {

    return false;

  }


  if (
    room.status !==
    ROOM_STATUS.WAITING
  ) {

    return false;

  }


  return !isRoomFull(
    room
  );

}


/* =========================================================
   FIND RANDOM ROOM
========================================================= */

function findAvailableRandomRoom(
  game
) {

  for (
    const room of rooms.values()
  ) {

    if (
      room.game === game &&
      room.type ===
        ROOM_TYPES.RANDOM &&
      canJoinRoom(room)
    ) {

      return room;

    }

  }


  return createRandomRoom(
    game
  );

}


/* =========================================================
   JOIN ROOM
========================================================= */

function joinRoom(
  player,
  room
) {

  if (!player) {

    return {
      ok: false,
      error: "PLAYER_NOT_FOUND"
    };

  }


  if (!room) {

    return {
      ok: false,
      error: "ROOM_NOT_FOUND"
    };

  }


  if (
    !canJoinRoom(room)
  ) {

    return {
      ok: false,
      error: "ROOM_NOT_AVAILABLE"
    };

  }


  if (
    player.roomId
  ) {

    leaveRoom(
      player
    );

  }


  /*
    Server-side token check.
  */

  if (
    Number(player.tokens) <
    room.entryFee
  ) {

    return {

      ok: false,

      error:
        "INSUFFICIENT_TOKENS",

      required:
        room.entryFee,

      tokens:
        player.tokens

    };

  }


  /*
    Deduct entry fee exactly once
    when player enters the room.
  */

  player.tokens -=
    room.entryFee;


  /*
    Seat assignment.
  */

  const seat =
    room.players.length;


  player.roomId =
    room.id;

  player.game =
    room.game;

  player.seat =
    seat;


  room.players.push(
    player.socketId
  );


  const socket =
    io.sockets.sockets.get(
      player.socketId
    );


  if (socket) {

    socket.join(
      room.id
    );

  }


  return {

    ok: true,

    room,

    player

  };

}


/* =========================================================
   LEAVE ROOM
========================================================= */

function leaveRoom(
  player
) {

  if (
    !player ||
    !player.roomId
  ) {

    return;

  }


  const room =
    rooms.get(
      player.roomId
    );


  if (room) {

    room.players =
      room.players.filter(
        socketId =>
          socketId !==
          player.socketId
      );


    /*
      If game has not started,
      reassign seats.
    */

    room.players.forEach(
      (
        socketId,
        index
      ) => {

        const p =
          players.get(
            socketId
          );

        if (p) {

          p.seat =
            index;

        }

      }
    );


    /*
      Destroy empty waiting rooms.
    */

    if (
      room.players.length === 0 &&
      room.status ===
        ROOM_STATUS.WAITING
    ) {

      rooms.delete(
        room.id
      );

    }

  }


  const socket =
    io.sockets.sockets.get(
      player.socketId
    );


  if (socket) {

    socket.leave(
      player.roomId
    );

  }


  player.roomId =
    null;

  player.game =
    null;

  player.seat =
    null;

}


/* =========================================================
   ROOM PUBLIC DATA
========================================================= */

function publicRoomData(
  room
) {

  return {

    roomId:
      room.id,

    roomCode:
      room.code,

    game:
      room.game,

    gameName:
      room.gameName,

    type:
      room.type,

    capacity:
      room.capacity,

    players:
      room.players.length,

    status:
      room.status,

    entryFee:
      room.entryFee

  };

}


/* =========================================================
   PUBLIC PLAYER DATA
========================================================= */

function publicPlayerData(
  player
) {

  return {

    socketId:
      player.socketId,

    telegramId:
      player.telegramId,

    username:
      player.username,

    firstName:
      player.firstName,

    seat:
      player.seat,

    connected:
      player.connected

  };

}


/* =========================================================
   ROOM PLAYERS DATA
========================================================= */

function roomPlayersData(
  room
) {

  return room.players
    .map(
      socketId =>
        players.get(
          socketId
        )
    )
    .filter(Boolean)
    .map(
      publicPlayerData
    );

}


/* =========================================================
   SEND ROOM UPDATE
========================================================= */

function sendRoomUpdate(
  room
) {

  if (!room) {

    return;

  }


  io.to(
    room.id
  ).emit(
    "ROOM_UPDATE",
    {

      room:
        publicRoomData(room),

      players:
        roomPlayersData(room)

    }
  );

}


/* =========================================================
   START GAME
========================================================= */

function startGame(
  room
) {

  if (!room) {

    return false;

  }


  if (
    room.status !==
    ROOM_STATUS.WAITING
  ) {

    return false;

  }


  if (
    !isRoomFull(room)
  ) {

    return false;

  }


  room.status =
    ROOM_STATUS.STARTING;

  room.startedAt =
    Date.now();


  /*
    Create initial game state.
  */

  room.gameState = {

    phase:
      "waiting_for_game",

    round:
      0,

    trick:
      0,

    currentPlayer:
      0,

    players:
      room.players.map(
        (
          socketId,
          index
        ) => {

          const player =
            players.get(
              socketId
            );

          return {

            socketId:
              socketId,

            seat:
              index,

            username:
              player
                ? player.username
                : null

          };

        }
      )

  };


  /*
    Short delay allows all clients
    to receive the final room state.
  */

  setTimeout(
    () => {

      const currentRoom =
        rooms.get(
          room.id
        );


      if (!currentRoom) {

        return;

      }


      currentRoom.status =
        ROOM_STATUS.PLAYING;


      currentRoom.gameState.phase =
        "playing";


      io.to(
        currentRoom.id
      ).emit(
        "GAME_START",
        {

          room:
            publicRoomData(
              currentRoom
            ),

          players:
            roomPlayersData(
              currentRoom
            ),

          gameState:
            currentRoom.gameState

        }
      );


      sendRoomUpdate(
        currentRoom
      );


    },
    800
  );


  return true;

}


/* =========================================================
   MATCH RANDOM PLAYER
========================================================= */

function matchRandomPlayer(
  player,
  game
) {

  const config =
    GAME_CONFIG[game];


  if (!config) {

    return {

      ok: false,

      error:
        "INVALID_GAME"

    };

  }


  /*
    Search for an existing waiting room
    with free seats.
  */

  let room =
    findAvailableRandomRoom(
      game
    );


  /*
    If a suitable room was found,
    join it.
  */

  const result =
    joinRoom(
      player,
      room
    );


  if (!result.ok) {

    return result;

  }


  /*
    Notify everyone.
  */

  sendRoomUpdate(
    room
  );


  /*
    If the room is now full,
    start immediately.
  */

  if (
    isRoomFull(room)
  ) {

    startGame(
      room
    );

  }


  return {

    ok: true,

    room:
      publicRoomData(
        room
      ),

    players:
      roomPlayersData(
        room
      ),

    tokenBalance:
      player.tokens

  };

}


/* =========================================================
   CREATE PRIVATE ROOM
========================================================= */

function handleCreatePrivateRoom(
  player,
  game
) {

  const config =
    GAME_CONFIG[game];


  if (!config) {

    return {

      ok: false,

      error:
        "INVALID_GAME"

    };

  }


  if (
    Number(player.tokens) <
    config.entryFee
  ) {

    return {

      ok: false,

      error:
        "INSUFFICIENT_TOKENS",

      required:
        config.entryFee,

      tokens:
        player.tokens

    };

  }


  const room =
    createPrivateRoom(
      game
    );


  const result =
    joinRoom(
      player,
      room
    );


  if (!result.ok) {

    rooms.delete(
      room.id
    );

    return result;

  }


  sendRoomUpdate(
    room
  );


  return {

    ok: true,

    room:
      publicRoomData(
        room
      ),

    roomCode:
      room.code,

    tokenBalance:
      player.tokens

  };

}


/* =========================================================
   JOIN PRIVATE ROOM BY CODE
========================================================= */

function handleJoinPrivateRoom(
  player,
  code
) {

  const cleanCode =
    String(
      code || ""
    )
      .trim()
      .toUpperCase();


  if (!cleanCode) {

    return {

      ok: false,

      error:
        "ROOM_CODE_REQUIRED"

    };

  }


  let room =
    null;


  for (
    const item of rooms.values()
  ) {

    if (
      item.type ===
        ROOM_TYPES.PRIVATE &&
      item.code ===
        cleanCode
    ) {

      room =
        item;

      break;

    }

  }


  if (!room) {

    return {

      ok: false,

      error:
        "PRIVATE_ROOM_NOT_FOUND"

    };

  }


  const result =
    joinRoom(
      player,
      room
    );


  if (!result.ok) {

    return result;

  }


  sendRoomUpdate(
    room
  );


  if (
    isRoomFull(room)
  ) {

    startGame(
      room
    );

  }


  return {

    ok: true,

    room:
      publicRoomData(
        room
      ),

    players:
      roomPlayersData(
        room
      ),

    tokenBalance:
      player.tokens

  };

}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
  "connection",
  socket => {

    console.log(
      "PLAYER CONNECTED:",
      socket.id
    );


    /*
      Create player.
    */

    const player =
      createPlayer(
        socket
      );


    players.set(
      socket.id,
      player
    );


    /*
      Send initial connection data.
    */

    socket.emit(
      "CONNECTED",
      {

        socketId:
          socket.id,

        tokens:
          player.tokens

      }
    );


    /* =====================================================
       PLAYER IDENTIFICATION
    ===================================================== */

    socket.on(
      "IDENTIFY",
      data => {

        try {

          data =
            data || {};


          player.telegramId =
            data.telegramId ||
            null;

          player.username =
            data.username ||
            null;

          player.firstName =
            data.firstName ||
            null;


          socket.emit(
            "PLAYER_IDENTIFIED",
            {

              ok: true,

              player:
                publicPlayerData(
                  player
                ),

              tokens:
                player.tokens

            }
          );

        } catch(error) {

          socket.emit(
            "SERVER_ERROR",
            {

              message:
                "Identification failed."

            }
          );

        }

      }
    );


    /* =====================================================
       RANDOM MATCH
    ===================================================== */

    socket.on(
      "RANDOM_MATCH",
      data => {

        try {

          const game =
            data &&
            data.game
              ? data.game
              : "suit";


          /*
            Don't allow a player already
            inside a room to join again.
          */

          if (
            player.roomId
          ) {

            socket.emit(
              "MATCH_ERROR",
              {

                error:
                  "ALREADY_IN_ROOM"

              }
            );

            return;

          }


          /*
            Token check BEFORE queue.
          */

          const config =
            GAME_CONFIG[game];


          if (!config) {

            socket.emit(
              "MATCH_ERROR",
              {

                error:
                  "INVALID_GAME"

              }
            );

            return;

          }


          if (
            Number(player.tokens) <
            config.entryFee
          ) {

            socket.emit(
              "MATCH_ERROR",
              {

                error:
                  "INSUFFICIENT_TOKENS",

                required:
                  config.entryFee,

                tokens:
                  player.tokens

              }
            );

            return;

          }


          /*
            Match directly to a room.
          */

          const result =
            matchRandomPlayer(
              player,
              game
            );


          if (!result.ok) {

            socket.emit(
              "MATCH_ERROR",
              result
            );

            return;

          }


          socket.emit(
            "MATCH_FOUND",
            result
          );


        } catch(error) {

          console.error(
            "RANDOM_MATCH ERROR:",
            error
          );


          socket.emit(
            "MATCH_ERROR",
            {

              error:
                "SERVER_ERROR"

            }
          );

        }

      }
    );


    /* =====================================================
       CREATE PRIVATE ROOM
    ===================================================== */

    socket.on(
      "CREATE_PRIVATE_ROOM",
      data => {

        try {

          const game =
            data &&
            data.game
              ? data.game
              : "suit";


          if (
            player.roomId
          ) {

            socket.emit(
              "PRIVATE_ROOM_ERROR",
              {

                error:
                  "ALREADY_IN_ROOM"

              }
            );

            return;

          }


          const result =
            handleCreatePrivateRoom(
              player,
              game
            );


          if (!result.ok) {

            socket.emit(
              "PRIVATE_ROOM_ERROR",
              result
            );

            return;

          }


          socket.emit(
            "PRIVATE_ROOM_CREATED",
            result
          );


        } catch(error) {

          console.error(
            "CREATE_PRIVATE_ROOM ERROR:",
            error
          );


          socket.emit(
            "PRIVATE_ROOM_ERROR",
            {

              error:
                "SERVER_ERROR"

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

        try {

          const code =
            data &&
            data.code
              ? data.code
              : "";


          if (
            player.roomId
          ) {

            socket.emit(
              "PRIVATE_ROOM_ERROR",
              {

                error:
                  "ALREADY_IN_ROOM"

              }
            );

            return;

          }


          const result =
            handleJoinPrivateRoom(
              player,
              code
            );


          if (!result.ok) {

            socket.emit(
              "PRIVATE_ROOM_ERROR",
              result
            );

            return;

          }


          socket.emit(
            "PRIVATE_ROOM_JOINED",
            result
          );


        } catch(error) {

          console.error(
            "JOIN_PRIVATE_ROOM ERROR:",
            error
          );


          socket.emit(
            "PRIVATE_ROOM_ERROR",
            {

              error:
                "SERVER_ERROR"

            }
          );

        }

      }
    );


    /* =====================================================
       GET ROOM INFO
    ===================================================== */

    socket.on(
      "GET_ROOM",
      () => {

        const room =
          getRoom(
            player.roomId
          );


        if (!room) {

          socket.emit(
            "ROOM_INFO",
            {

              ok: false

            }
          );

          return;

        }


        socket.emit(
          "ROOM_INFO",
          {

            ok: true,

            room:
              publicRoomData(
                room
              ),

            players:
              roomPlayersData(
                room
              )

          }
        );

      }
    );


    /* =====================================================
       LEAVE ROOM
    ===================================================== */

    socket.on(
      "LEAVE_ROOM",
      () => {

        const room =
          getRoom(
            player.roomId
          );


        if (room) {

          const oldRoomId =
            room.id;


          leaveRoom(
            player
          );


          io.to(
            oldRoomId
          ).emit(
            "PLAYER_LEFT",
            {

              socketId:
                player.socketId

            }
          );


          sendRoomUpdate(
            room
          );

        }

      }
    );


    /* =====================================================
       GAME ACTION
    ===================================================== */

    socket.on(
      "GAME_ACTION",
      data => {

        try {

          const room =
            getRoom(
              player.roomId
            );


          if (!room) {

            socket.emit(
              "GAME_ERROR",
              {

                error:
                  "NOT_IN_GAME"

              }
            );

            return;

          }


          if (
            room.status !==
            ROOM_STATUS.PLAYING
          ) {

            socket.emit(
              "GAME_ERROR",
              {

                error:
                  "GAME_NOT_STARTED"

              }
            );

            return;

          }


          /*
            At this stage we simply
            relay the action to the
            game engine.

            game.js will later contain
            the complete card rules.
          */

          io.to(
            room.id
          ).emit(
            "GAME_ACTION",
            {

              player:
                publicPlayerData(
                  player
                ),

              action:
                data || {}

            }
          );


        } catch(error) {

          console.error(
            "GAME_ACTION ERROR:",
            error
          );


          socket.emit(
            "GAME_ERROR",
            {

              error:
                "SERVER_ERROR"

            }
          );

        }

      }
    );


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",
      reason => {

        console.log(
          "PLAYER DISCONNECTED:",
          socket.id,
          reason
        );


        player.connected =
          false;


        const room =
          getRoom(
            player.roomId
          );


        if (room) {

          /*
            If the game has not started,
            remove player immediately.
          */

          if (
            room.status ===
            ROOM_STATUS.WAITING
          ) {

            const oldRoomId =
              room.id;


            leaveRoom(
              player
            );


            io.to(
              oldRoomId
            ).emit(
              "PLAYER_DISCONNECTED",
              {

                socketId:
                  socket.id

              }
            );


            sendRoomUpdate(
              room
            );

          }

          /*
            If game is already running,
            keep player record for reconnect/
            bot replacement later.
          */

          else {

            io.to(
              room.id
            ).emit(
              "PLAYER_DISCONNECTED",
              {

                socketId:
                  socket.id,

                seat:
                  player.seat,

                message:
                  "Player disconnected."

              }
            );

          }

        }


        removeFromRandomQueue(
          socket.id
        );


        /*
          Do not immediately delete the player
          if he is inside a running game.
        */

        if (
          !player.roomId
        ) {

          players.delete(
            socket.id
          );

        }

      }
    );

  }
);


/* =========================================================
   CLEAN EMPTY ROOMS
========================================================= */

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

      /*
        Delete empty rooms.
      */

      if (
        room.players.length === 0
      ) {

        rooms.delete(
          roomId
        );

        continue;

      }


      /*
        Delete old waiting rooms
        after 30 minutes.
      */

      if (
        room.status ===
          ROOM_STATUS.WAITING &&
        now -
          room.createdAt >
          30 * 60 * 1000
      ) {

        /*
          Reset players.
        */

        room.players.forEach(
          socketId => {

            const player =
              players.get(
                socketId
              );

            if (player) {

              player.roomId =
                null;

              player.game =
                null;

              player.seat =
                null;

            }

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
   DEBUG API
========================================================= */

app.get(
  "/api/status",
  (req, res) => {

    const roomList =
      Array.from(
        rooms.values()
      ).map(
        publicRoomData
      );


    res.json({

      server:
        "SPADES",

      players:
        players.size,

      rooms:
        rooms.size,

      randomQueues: {

        suit:
          randomQueues.suit.length,

        classic:
          randomQueues.classic.length,

        two:
          randomQueues.two.length

      },

      roomList

    });

  }
);


/* =========================================================
   START SERVER
========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      "======================================"
    );

    console.log(
      "        SPADES SERVER ONLINE"
    );

    console.log(
      "======================================"
    );

    console.log(
      "PORT:",
      PORT
    );

    console.log(
      "6 PLAYER:",
      GAME_CONFIG.suit.players
    );

    console.log(
      "4 PLAYER:",
      GAME_CONFIG.classic.players
    );

    console.log(
      "2 PLAYER:",
      GAME_CONFIG.two.players
    );

    console.log(
      "ENTRY FEE:",
      "50 TOKENS"
    );

    console.log(
      "======================================"
    );

  }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(
  signal
) {

  console.log(
    `${signal} received.`
  );


  io.close(
    () => {

      server.close(
        () => {

          process.exit(
            0
          );

        }
      );

    }
  );

}


process.on(
  "SIGTERM",
  () => {

    shutdown(
      "SIGTERM"
    );

  }
);


process.on(
  "SIGINT",
  () => {

    shutdown(
      "SIGINT"
    );

  }
);
