/*
=========================================================
 SPADES ONLINE SERVER
 RANDOM MATCH + PRIVATE ROOM
 Supports:
   - 2 Players
   - 4 Players
   - 6 Players

 Node.js + Express + Socket.IO
=========================================================
*/

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;


/* =========================================================
   SOCKET.IO
========================================================= */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },

  transports: ["websocket", "polling"]
});


/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json());

/*
  اگر index.html کنار server.js باشد
  خود سرور آن را سرو می‌کند.
*/

app.use(express.static(path.join(__dirname)));


/* =========================================================
   BASIC ROUTES
========================================================= */

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});


app.get("/health", (req, res) => {

  res.json({
    ok: true,
    service: "SPADES SERVER",
    time: new Date().toISOString()
  });

});


/* =========================================================
   GAME CONFIGURATION
========================================================= */

const GAME_CONFIG = {

  suit: {
    name: "Spade Trump",
    players: 6
  },

  classic: {
    name: "Classic Spades",
    players: 4
  },

  two: {
    name: "Two Player",
    players: 2

  }

};


/* =========================================================
   ROOMS
========================================================= */

/*
 rooms:

 Map<roomId, room>

 room = {

   id,
   code,
   game,
   gameName,
   maxPlayers,
   type,
   status,
   players: Map,
   hostId,
   createdAt,
   startedAt

 }

*/

const rooms = new Map();


/*
 RANDOM MATCH QUEUES

 هر بازی صف مستقل خودش را دارد.

 suit    => 6 نفر
 classic => 4 نفر
 two     => 2 نفر
*/

const randomQueues = {

  suit: [],
  classic: [],
  two: []

};


/* =========================================================
   HELPERS
========================================================= */

function isValidGame(game) {

  return Object.prototype.hasOwnProperty.call(
    GAME_CONFIG,
    game
  );

}


function generateRoomId() {

  return crypto
    .randomBytes(8)
    .toString("hex");

}


/*
 کد خصوصی کوتاه و قابل خواندن
 مثال:

 SP82KF

*/

function generateRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {

    code +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];

  }

  return code;

}


function generateUniqueRoomCode() {

  let code;

  do {

    code =
      generateRoomCode();

  } while (
    [...rooms.values()]
      .some(room => room.code === code)
  );

  return code;

}


function getPlayerName(socket) {

  const user =
    socket.telegramUser ||
    {};

  if (user.username) {

    return "@" + user.username;

  }

  if (user.first_name) {

    return user.first_name;

  }

  return "Player";

}


function createPlayer(socket) {

  return {

    socketId: socket.id,

    name: getPlayerName(socket),

    telegramId:
      socket.telegramUser?.id ||
      null,

    joinedAt:
      Date.now(),

    ready: true

  };

}


/* =========================================================
   ROOM SNAPSHOT
========================================================= */

function roomSnapshot(room) {

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

    status:
      room.status,

    maxPlayers:
      room.maxPlayers,

    playerCount:
      room.players.size,

    players:
      [...room.players.values()]
        .map(player => ({

          socketId:
            player.socketId,

          name:
            player.name,

          telegramId:
            player.telegramId,

          ready:
            player.ready

        })),

    hostId:
      room.hostId,

    createdAt:
      room.createdAt,

    startedAt:
      room.startedAt || null

  };

}


/* =========================================================
   ROOM FULL?
========================================================= */

function isRoomFull(room) {

  return (
    room.players.size >=
    room.maxPlayers
  );

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

  const room = {

    id:
      generateRoomId(),

    code:
      generateUniqueRoomCode(),

    game:
      game,

    gameName:
      config.name,

    maxPlayers:
      config.players,

    type:
      type,

    status:
      "WAITING",

    players:
      new Map(),

    hostId:
      null,

    createdAt:
      Date.now(),

    startedAt:
      null

  };


  rooms.set(
    room.id,
    room
  );


  return room;

}


/* =========================================================
   JOIN ROOM
========================================================= */

function addPlayerToRoom(
  room,
  socket
) {

  if (isRoomFull(room)) {

    return {
      success: false,
      reason: "ROOM_FULL"
    };

  }


  /*
    جلوگیری از ورود یک Socket
    چند بار به یک اتاق
  */

  if (
    room.players.has(
      socket.id
    )
  ) {

    return {
      success: true,
      room
    };

  }


  const player =
    createPlayer(socket);


  room.players.set(
    socket.id,
    player
  );


  /*
    اولین بازیکن = Host
  */

  if (!room.hostId) {

    room.hostId =
      socket.id;

  }


  socket.join(
    room.id
  );


  /*
    وقتی اتاق کامل شد
  */

  if (
    room.players.size ===
    room.maxPlayers
  ) {

    startRoom(room);

  }


  return {
    success: true,
    room
  };

}


/* =========================================================
   START ROOM
========================================================= */

function startRoom(room) {

  if (
    room.status ===
    "STARTED"
  ) {

    return;

  }


  if (!isRoomFull(room)) {

    return;

  }


  room.status =
    "STARTED";

  room.startedAt =
    Date.now();


  io.to(room.id).emit(
    "room_started",
    roomSnapshot(room)
  );


  /*
    پیام جداگانه برای Front-End
  */

  io.to(room.id).emit(
    "game_ready",
    {

      roomId:
        room.id,

      roomCode:
        room.code,

      game:
        room.game,

      gameName:
        room.gameName,

      players:
        [...room.players.values()]
          .map(player => ({

            name:
              player.name,

            socketId:
              player.socketId

          }))

    }
  );

}


/* =========================================================
   REMOVE PLAYER FROM ROOM
========================================================= */

function removePlayerFromRoom(
  socket
) {

  const roomId =
    socket.currentRoomId;

  if (!roomId) {

    return null;

  }


  const room =
    rooms.get(roomId);

  if (!room) {

    socket.currentRoomId =
      null;

    return null;

  }


  room.players.delete(
    socket.id
  );


  socket.leave(
    room.id
  );


  /*
    اگر Host خارج شد
    Host جدید تعیین می‌شود.
  */

  if (
    room.hostId ===
    socket.id
  ) {

    const nextPlayer =
      room.players.values().next().value;

    room.hostId =
      nextPlayer
        ? nextPlayer.socketId
        : null;

  }


  /*
    اگر بازی شروع شده بود
    و بازیکن خارج شد،
    فعلاً بازی متوقف می‌شود
    تا سیستم Bot در مرحله بعد اضافه شود.
  */

  if (
    room.status ===
    "STARTED"
  ) {

    room.status =
      "WAITING_REPLACEMENT";

  }


  /*
    اگر اتاق خالی شد
    آن را حذف کن.
  */

  if (
    room.players.size ===
    0
  ) {

    rooms.delete(
      room.id
    );

  } else {

    io.to(room.id).emit(
      "room_update",
      roomSnapshot(room)
    );

  }


  socket.currentRoomId =
    null;


  return room;

}


/* =========================================================
   RANDOM QUEUE
========================================================= */

function removeFromRandomQueue(
  socketId
) {

  for (
    const game of
    Object.keys(randomQueues)
  ) {

    randomQueues[game] =
      randomQueues[game]
        .filter(
          id => id !== socketId
        );

  }

}


function getSocketById(
  socketId
) {

  return io.sockets.sockets.get(
    socketId
  );

}


/* =========================================================
   FIND RANDOM ROOM
========================================================= */

function findWaitingRandomRoom(
  game
) {

  for (
    const room of
    rooms.values()
  ) {

    if (
      room.game === game &&
      room.type === "random" &&
      room.status === "WAITING" &&
      !isRoomFull(room)
    ) {

      return room;

    }

  }


  return null;

}


/* =========================================================
   RANDOM MATCH
========================================================= */

function joinRandomMatch(
  socket,
  game
) {

  if (!isValidGame(game)) {

    socket.emit(
      "match_error",
      {
        message:
          "Invalid game."
      }
    );

    return;

  }


  /*
    اگر قبلاً داخل اتاق است
  */

  if (socket.currentRoomId) {

    socket.emit(
      "match_error",
      {
        message:
          "You are already inside a room."
      }
    );

    return;

  }


  removeFromRandomQueue(
    socket.id
  );


  /*
    اول تلاش برای پیدا کردن
    اتاق نیمه‌پر
  */

  let room =
    findWaitingRandomRoom(
      game
    );


  /*
    اگر اتاق وجود نداشت
    اتاق جدید بساز.
  */

  if (!room) {

    room =
      createRoom(
        game,
        "random"
      );

  }


  const result =
    addPlayerToRoom(
      room,
      socket
    );


  if (!result.success) {

    socket.emit(
      "match_error",
      {
        message:
          "Unable to join room."
      }
    );

    return;

  }


  socket.currentRoomId =
    room.id;


  /*
    از صف خارج شود
  */

  removeFromRandomQueue(
    socket.id
  );


  /*
    اطلاعات اتاق
  */

  socket.emit(
    "room_joined",
    roomSnapshot(room)
  );


  /*
    به همه بازیکنان
    اطلاعات جدید بده
  */

  io.to(room.id).emit(
    "room_update",
    roomSnapshot(room)
  );

}


/* =========================================================
   PRIVATE ROOM
========================================================= */

function createPrivateRoom(
  socket,
  game
) {

  if (!isValidGame(game)) {

    socket.emit(
      "room_error",
      {
        message:
          "Invalid game."
      }
    );

    return;

  }


  if (socket.currentRoomId) {

    socket.emit(
      "room_error",
      {
        message:
          "You are already inside a room."
      }
    );

    return;

  }


  const room =
    createRoom(
      game,
      "private"
    );


  const result =
    addPlayerToRoom(
      room,
      socket
    );


  if (!result.success) {

    socket.emit(
      "room_error",
      {
        message:
          "Unable to create room."
      }
    );

    rooms.delete(
      room.id
    );

    return;

  }


  socket.currentRoomId =
    room.id;


  /*
    اطلاعات مهم:

    کد اتاق فقط به Host
    برگردانده می‌شود.

    Host این کد را به دوستان
    می‌دهد.
  */

  socket.emit(
    "private_room_created",
    {

      roomId:
        room.id,

      roomCode:
        room.code,

      game:
        room.game,

      gameName:
        room.gameName,

      maxPlayers:
        room.maxPlayers,

      playerCount:
        room.players.size

    }
  );


  io.to(room.id).emit(
    "room_update",
    roomSnapshot(room)
  );

}


/* =========================================================
   JOIN PRIVATE ROOM BY CODE
========================================================= */

function joinPrivateRoomByCode(
  socket,
  game,
  code
) {

  if (!isValidGame(game)) {

    socket.emit(
      "room_error",
      {
        message:
          "Invalid game."
      }
    );

    return;

  }


  if (socket.currentRoomId) {

    socket.emit(
      "room_error",
      {
        message:
          "You are already inside a room."
      }
    );

    return;

  }


  const normalizedCode =
    String(code || "")
      .trim()
      .toUpperCase();


  if (
    normalizedCode.length <
    4
  ) {

    socket.emit(
      "room_error",
      {
        message:
          "Invalid room code."
      }
    );

    return;

  }


  let room = null;


  for (
    const candidate of
    rooms.values()
  ) {

    if (
      candidate.code ===
      normalizedCode
    ) {

      room =
        candidate;

      break;

    }

  }


  if (!room) {

    socket.emit(
      "room_error",
      {
        message:
          "Private room not found."
      }
    );

    return;

  }


  /*
    کد باید متعلق به همان بازی باشد.
  */

  if (
    room.game !== game
  ) {

    socket.emit(
      "room_error",
      {
        message:
          "This room belongs to another game."
      }
    );

    return;

  }


  if (
    room.type !==
    "private"
  ) {

    socket.emit(
      "room_error",
      {
        message:
          "This is not a private room."
      }
    );

    return;

  }


  if (
    room.status !==
    "WAITING"
  ) {

    socket.emit(
      "room_error",
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
      "room_error",
      {
        message:
          "This room is full."
      }
    );

    return;

  }


  const result =
    addPlayerToRoom(
      room,
      socket
    );


  if (!result.success) {

    socket.emit(
      "room_error",
      {
        message:
          "Unable to join room."
      }
    );

    return;

  }


  socket.currentRoomId =
    room.id;


  socket.emit(
    "private_room_joined",
    roomSnapshot(room)
  );


  io.to(room.id).emit(
    "room_update",
    roomSnapshot(room)
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


    socket.currentRoomId =
      null;

    socket.telegramUser =
      null;


    /* =====================================================
       TELEGRAM USER
    ===================================================== */

    socket.on(
      "set_user",
      user => {

        if (
          !user ||
          typeof user !==
          "object"
        ) {

          return;

        }


        socket.telegramUser = {

          id:
            user.id ||
            null,

          username:
            user.username ||
            null,

          first_name:
            user.first_name ||
            "Player"

        };

      }
    );


    /* =====================================================
       RANDOM MATCH
    ===================================================== */

    socket.on(
      "random_match",
      data => {

        const game =
          data?.game;


        joinRandomMatch(
          socket,
          game
        );

      }
    );


    /* =====================================================
       CREATE PRIVATE ROOM
    ===================================================== */

    socket.on(
      "create_private_room",
      data => {

        const game =
          data?.game;


        createPrivateRoom(
          socket,
          game
        );

      }
    );


    /* =====================================================
       JOIN PRIVATE ROOM
    ===================================================== */

    socket.on(
      "join_private_room",
      data => {

        const game =
          data?.game;

        const code =
          data?.code;


        joinPrivateRoomByCode(
          socket,
          game,
          code
        );

      }
    );


    /* =====================================================
       LEAVE ROOM
    ===================================================== */

    socket.on(
      "leave_room",
      () => {

        const room =
          removePlayerFromRoom(
            socket
          );


        if (room) {

          io.to(room.id).emit(
            "room_update",
            roomSnapshot(room)
          );

        }


        socket.emit(
          "left_room"
        );

      }
    );


    /* =====================================================
       GET CURRENT ROOM
    ===================================================== */

    socket.on(
      "get_room",
      () => {

        if (
          !socket.currentRoomId
        ) {

          socket.emit(
            "room_update",
            null
          );

          return;

        }


        const room =
          rooms.get(
            socket.currentRoomId
          );


        if (!room) {

          socket.currentRoomId =
            null;

          socket.emit(
            "room_update",
            null
          );

          return;

        }


        socket.emit(
          "room_update",
          roomSnapshot(room)
        );

      }
    );


    /* =====================================================
       DISCONNECT
    ===================================================== */

    socket.on(
      "disconnect",
      reason => {

        console.log(
          "DISCONNECTED:",
          socket.id,
          reason
        );


        removeFromRandomQueue(
          socket.id
        );


        removePlayerFromRoom(
          socket
        );

      }
    );

  }
);


/* =========================================================
   CLEANUP EMPTY / OLD ROOMS
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
        اتاق‌های خالی
      */

      if (
        room.players.size ===
        0
      ) {

        rooms.delete(
          roomId
        );

        continue;

      }


      /*
        اتاق WAITING که بیشتر
        از 30 دقیقه بدون تکمیل
        مانده باشد.
      */

      if (
        room.status ===
        "WAITING" &&
        now -
        room.createdAt >
        30 * 60 * 1000
      ) {

        io.to(room.id).emit(
          "room_expired",
          {
            message:
              "Room expired."
          }
        );


        for (
          const player
          of room.players.values()
        ) {

          const playerSocket =
            getSocketById(
              player.socketId
            );


          if (playerSocket) {

            playerSocket.leave(
              room.id
            );

            playerSocket.currentRoomId =
              null;

          }

        }


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
      "========================================"
    );

    console.log(
      " SPADES SERVER STARTED"
    );

    console.log(
      " PORT:",
      PORT
    );

    console.log(
      "========================================"
    );

  }
);
