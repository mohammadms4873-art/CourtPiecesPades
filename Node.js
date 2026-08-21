"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");

const {
  Server
} = require("socket.io");


/* =========================================================
   SERVER
========================================================= */

const app =
  express();

const server =
  http.createServer(app);

const io =
  new Server(
    server,
    {
      cors:{
        origin:"*",
        methods:["GET","POST"]
      },
      transports:[
        "websocket",
        "polling"
      ]
    }
  );


/* =========================================================
   CONFIG
========================================================= */

const PORT =
  process.env.PORT || 3000;

const HOST =
  "0.0.0.0";

const MAX_PLAYERS = 6;

const ROUND_COUNT = 6;

const TURN_TIME =
  10000;


/* =========================================================
   STATIC
========================================================= */

app.use(
  express.static(
    path.join(__dirname)
  )
);

app.get(
  "/health",
  (req,res)=>{
    res.json({
      ok:true,
      service:"SPADES",
      rooms:rooms.size
    });
  }
);


/* =========================================================
   ROOMS
========================================================= */

const rooms =
  new Map();


/*
room = {

 id,
 mode,
 capacity,
 private,
 started,
 players:[],
 game:null

}
*/


/* =========================================================
   HELPERS
========================================================= */

function makeId(prefix="ROOM"){

  return (
    prefix +
    "-" +
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()
  );

}


function normalizeMode(mode){

  const m =
    String(mode || "spade6")
      .toLowerCase();

  if(
    m.includes("4") ||
    m === "classic"
  )
    return "spade4";

  if(
    m.includes("2") ||
    m === "two"
  )
    return "spade2";

  return "spade6";

}


function capacityForMode(mode){

  const m =
    normalizeMode(mode);

  if(m === "spade4")
    return 4;

  if(m === "spade2")
    return 2;

  return 6;

}


function teamForSeat(seat){

  return (
    Number(seat) % 2 === 1
    ? "A"
    : "B"
  );

}


function publicPlayer(p){

  return {
    id:p.id,
    name:p.name,
    username:p.username,
    avatar:p.avatar,
    seat:p.seat,
    team:p.team,
    bid:p.bid,
    tricks:p.tricks
  };

}


function roomState(room){

  return {
    roomId:room.id,
    mode:room.mode,
    capacity:room.capacity,
    private:room.private,
    started:room.started,
    players:
      room.players.map(
        publicPlayer
      )
  };

}


function emitRoom(room){

  room.players.forEach(
    player=>{

      io.to(player.socketId)
        .emit(
          "ROOM_UPDATE",
          {
            ...roomState(room),
            seat:player.seat,
            mySeat:player.seat,
            playerId:player.id
          }
        );

    }
  );

}


function getRoom(id){

  if(!id)
    return null;

  return rooms.get(
    String(id).trim()
  ) || null;

}


function getFreeSeat(room){

  for(
    let seat=1;
    seat<=room.capacity;
    seat++
  ){

    if(
      !room.players.some(
        p => p.seat === seat
      )
    )
      return seat;

  }

  return null;

}


/* =========================================================
   ROOM CREATION
========================================================= */

function createRoom({
  mode,
  capacity,
  privateRoom,
  roomId
}){

  const room = {

    id:
      roomId ||
      makeId(
        privateRoom
        ? "PRV"
        : "ROOM"
      ),

    mode:
      normalizeMode(mode),

    capacity:
      capacity ||
      capacityForMode(mode),

    private:
      !!privateRoom,

    started:false,

    players:[],

    game:null

  };

  rooms.set(
    room.id,
    room
  );

  return room;

}


/* =========================================================
   PUBLIC MATCHMAKING
========================================================= */

function findPublicRoom(mode){

  const normalized =
    normalizeMode(mode);

  const capacity =
    capacityForMode(normalized);

  for(
    const room of rooms.values()
  ){

    if(
      room.private
    )
      continue;

    if(
      room.mode !== normalized
    )
      continue;

    if(
      room.started
    )
      continue;

    if(
      room.players.length >=
      capacity
    )
      continue;

    return room;

  }

  return createRoom({
    mode:normalized,
    capacity,
    privateRoom:false
  });

}


/* =========================================================
   CARD DECK
========================================================= */

function createDeck(){

  const suits = [
    "♠",
    "♥",
    "♦",
    "♣"
  ];

  const ranks = [
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

  const deck=[];

  for(
    const suit of suits
  ){

    for(
      const rank of ranks
    ){

      deck.push({
        rank,
        suit
      });

    }

  }

  return deck;

}


function shuffle(deck){

  for(
    let i=deck.length-1;
    i>0;
    i--
  ){

    const j =
      Math.floor(
        Math.random() *
        (i+1)
      );

    [
      deck[i],
      deck[j]
    ] =
    [
      deck[j],
      deck[i]
    ];

  }

  return deck;

}


/* =========================================================
   GAME
========================================================= */

function createGame(room){

  return {

    round:1,

    scoreA:0,

    scoreB:0,

    turn:1,

    trick:[],

    played:[],

    bids:{},

    bidDone:false,

    bidding:false,

    leadSeat:1,

    tricksA:0,

    tricksB:0,

    trickNumber:0,

    turnTimer:null,

    roundCards:[]

  };

}


/* =========================================================
   DEAL
========================================================= */

function dealCards(room){

  const deck =
    shuffle(
      createDeck()
    );

  /*
    For 6-player:
    52 cards cannot give 9 to all 6.
    Therefore the game uses 9 cards per
    player from the 54-card deck
    including two jokers.
  */

  if(room.capacity === 6){

    deck.push({
      rank:"Joker",
      suit:"red"
    });

    deck.push({
      rank:"Joker",
      suit:"black"
    });

  }

  shuffle(deck);

  room.players.forEach(
    p => {

      p.hand =
        deck.splice(
          0,
          room.capacity === 6
          ? 9
          : Math.floor(
              deck.length /
              room.capacity
            )
        );

      p.tricks = 0;

    }
  );

}


/* =========================================================
   GAME START
========================================================= */

function startGame(room){

  if(room.started)
    return;

  if(
    room.players.length !==
    room.capacity
  )
    return;

  room.started = true;

  room.game =
    createGame(room);

  room.players.forEach(
    p=>{
      p.bid = null;
      p.tricks = 0;
    }
  );

  dealCards(room);

  sendGameStart(room);

  startBidding(room);

}


function privateGameState(room,player){

  const game =
    room.game;

  return {

    roomId:room.id,

    mode:room.mode,

    capacity:room.capacity,

    started:room.started,

    players:
      room.players.map(
        publicPlayer
      ),

    playerId:
      player.id,

    mySeat:
      player.seat,

    hand:
      player.hand || [],

    played:
      game.played,

    round:
      game.round,

    scoreA:
      game.scoreA,

    scoreB:
      game.scoreB,

    turn:
      game.turn

  };

}


function sendGameStart(room){

  room.players.forEach(
    player=>{

      io.to(player.socketId)
        .emit(
          "GAME_START",
          privateGameState(
            room,
            player
          )
        );

    }
  );

}


/* =========================================================
   BIDDING
========================================================= */

function startBidding(room){

  const game =
    room.game;

  game.bidding = true;

  game.bidDone = false;

  game.bids = {};

  room.players.forEach(
    p=>{
      p.bid = null;
    }
  );

  emitRoom(room);

  room.players.forEach(
    player=>{

      io.to(player.socketId)
        .emit(
          "BID_REQUEST",
          {
            round:game.round
          }
        );

    }
  );

}


function allBidsDone(room){

  return room.players.every(
    p => p.bid !== null
  );

}


function submitBid(
  socket,
  data
){

  const room =
    getRoom(data?.roomId);

  if(!room)
    return error(
      socket,
      "Room not found."
    );

  if(!room.started)
    return error(
      socket,
      "Game has not started."
    );

  const player =
    room.players.find(
      p =>
        p.socketId ===
        socket.id
    );

  if(!player)
    return error(
      socket,
      "Player not found."
    );

  let bid =
    Number(data.bid);

  if(
    !Number.isInteger(bid) ||
    bid < 0 ||
    bid > 7
  ){

    return error(
      socket,
      "Bid must be between 0 and 7."
    );

  }

  player.bid = bid;

  room.game.bids[
    player.seat
  ] = bid;

  io.to(room.id)
    .emit(
      "BID_UPDATE",
      {
        players:
          room.players.map(
            publicPlayer
          )
      }
    );

  if(
    allBidsDone(room)
  ){

    room.game.bidding = false;

    beginTricks(room);

  }

}


/* =========================================================
   TRICKS
========================================================= */

function beginTricks(room){

  const game =
    room.game;

  game.turn =
    game.leadSeat;

  game.trick = [];

  game.played = [];

  game.trickNumber = 0;

  sendGameState(room);

  startTurnTimer(room);

}


function sendGameState(room){

  room.players.forEach(
    player=>{

      io.to(player.socketId)
        .emit(
          "GAME_STATE",
          privateGameState(
            room,
            player
          )
        );

    }
  );

}


/* =========================================================
   TURN TIMER
========================================================= */

function clearTurnTimer(room){

  if(
    room.game &&
    room.game.turnTimer
  ){

    clearTimeout(
      room.game.turnTimer
    );

    room.game.turnTimer = null;

  }

}


function startTurnTimer(room){

  clearTurnTimer(room);

  const expectedSeat =
    room.game.turn;

  room.game.turnTimer =
    setTimeout(
      ()=>{

        const player =
          room.players.find(
            p =>
              p.seat ===
              expectedSeat
          );

        if(!player)
          return;

        autoPlay(
          room,
          player
        );

      },
      TURN_TIME
    );

}


/* =========================================================
   VALID CARD
========================================================= */

function sameCard(a,b){

  return (
    a &&
    b &&
    a.rank === b.rank &&
    a.suit === b.suit
  );

}


function cardAllowed(
  room,
  player,
  card
){

  if(!card)
    return false;

  const hand =
    player.hand || [];

  const index =
    hand.findIndex(
      c =>
        sameCard(c,card)
    );

  if(index < 0)
    return false;

  /*
    First card can be anything
    except joker as lead.
  */

  if(
    room.game.trick.length === 0
  ){

    if(
      card.rank === "Joker"
    )
      return false;

    return true;

  }

  /*
    Simplified legal-follow rule.
    Player must follow suit when possible.
  */

  const lead =
    room.game.trick[0];

  const suit =
    lead.card.suit;

  const hasSuit =
    hand.some(
      c =>
        c.suit === suit
    );

  if(
    hasSuit &&
    card.suit !== suit
  )
    return false;

  return true;

}


/* =========================================================
   PLAY CARD
========================================================= */

function playCard(
  socket,
  data
){

  const room =
    getRoom(data?.roomId);

  if(!room)
    return error(
      socket,
      "Room not found."
    );

  if(!room.started)
    return error(
      socket,
      "Game has not started."
    );

  const player =
    room.players.find(
      p =>
        p.socketId ===
        socket.id
    );

  if(!player)
    return error(
      socket,
      "Player not found."
    );

  if(
    room.game.turn !==
    player.seat
  ){

    return error(
      socket,
      "It is not your turn."
    );

  }

  const card =
    data.card;

  if(
    !cardAllowed(
      room,
      player,
      card
    )
  ){

    return error(
      socket,
      "This card cannot be played."
    );

  }

  playCardInternal(
    room,
    player,
    card
  );

}


function playCardInternal(
  room,
  player,
  card
){

  clearTurnTimer(room);

  const index =
    player.hand.findIndex(
      c =>
        sameCard(c,card)
    );

  if(index < 0)
    return;

  player.hand.splice(
    index,
    1
  );

  room.game.trick.push({
    seat:player.seat,
    card
  });

  room.game.played =
    room.game.trick.map(
      x=>({
        seat:x.seat,
        rank:x.card.rank,
        suit:x.card.suit
      })
    );

  io.to(room.id)
    .emit(
      "TRICK_UPDATE",
      {
        played:
          room.game.played
      }
    );

  if(
    room.game.trick.length >=
    room.capacity
  ){

    finishTrick(room);

    return;

  }

  room.game.turn =
    nextSeat(
      room,
      player.seat
    );

  sendGameState(room);

  startTurnTimer(room);

}


/* =========================================================
   NEXT SEAT
========================================================= */

function nextSeat(
  room,
  seat
){

  let next =
    Number(seat) + 1;

  if(next > room.capacity)
    next = 1;

  return next;

}


/* =========================================================
   TRICK WINNER
========================================================= */

function cardPower(card){

  if(card.rank === "Joker"){

    if(card.suit === "red")
      return 1000;

    return 950;

  }

  const values = {
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

  let power =
    values[card.rank] || 0;

  /*
    Spades are permanent trump.
  */

  if(card.suit === "♠")
    power += 100;

  return power;

}


function winnerOfTrick(room){

  const trick =
    room.game.trick;

  const leadSuit =
    trick[0].card.suit;

  let winner =
    trick[0];

  for(
    let i=1;
    i<trick.length;
    i++
  ){

    const current =
      trick[i];

    const a =
      winner.card;

    const b =
      current.card;

    let bPower =
      cardPower(b);

    let aPower =
      cardPower(a);

    /*
      Non-trump off-suit cards
      cannot beat lead/trump.
    */

    const aTrump =
      a.suit === "♠" ||
      a.rank === "Joker";

    const bTrump =
      b.suit === "♠" ||
      b.rank === "Joker";

    if(
      bTrump &&
      !aTrump
    ){

      winner =
        current;

      continue;

    }

    if(
      !bTrump &&
      aTrump
    )
      continue;

    if(
      !aTrump &&
      !bTrump
    ){

      if(
        a.suit !== leadSuit
      )
        aPower = -1;

      if(
        b.suit !== leadSuit
      )
        bPower = -1;

    }

    if(
      bPower >
      aPower
    )
      winner =
        current;

  }

  return winner.seat;

}


/* =========================================================
   FINISH TRICK
========================================================= */

function finishTrick(room){

  const game =
    room.game;

  clearTurnTimer(room);

  const winnerSeat =
    winnerOfTrick(room);

  const winner =
    room.players.find(
      p =>
        p.seat ===
        winnerSeat
    );

  if(!winner)
    return;

  winner.tricks =
    Number(winner.tricks || 0) +
    1;

  if(
    teamForSeat(winnerSeat) === "A"
  )
    game.tricksA++;
  else
    game.tricksB++;

  game.trick = [];

  game.trickNumber++;

  game.leadSeat =
    winnerSeat;

  game.turn =
    winnerSeat;

  game.played = [];

  io.to(room.id)
    .emit(
      "TRICK_UPDATE",
      {
        played:[],
        winner:winnerSeat
      }
    );

  if(
    game.trickNumber >= 9 ||
    room.players.some(
      p =>
        (p.hand || []).length === 0
    )
  ){

    finishRound(room);

    return;

  }

  sendGameState(room);

  startTurnTimer(room);

}


/* =========================================================
   ROUND SCORE
========================================================= */

function teamBid(room,team){

  return room.players
    .filter(
      p =>
        teamForSeat(p.seat) === team
    )
    .reduce(
      (sum,p)=>
        sum +
        Number(p.bid || 0),
      0
    );

}


function scoreTeam(
  bid,
  tricks
){

  /*
    Exact basic contract:
    successful bid = bid * 10
    failed bid = -bid * 10

    Special 7:
    +140 / -140
  */

  if(bid === 7)
    return tricks >= 7
      ? 140
      : -140;

  if(
    tricks >= bid
  )
    return bid * 10;

  return -(bid * 10);

}


function finishRound(room){

  const game =
    room.game;

  clearTurnTimer(room);

  const bidA =
    teamBid(room,"A");

  const bidB =
    teamBid(room,"B");

  const pointsA =
    scoreTeam(
      bidA,
      game.tricksA
    );

  const pointsB =
    scoreTeam(
      bidB,
      game.tricksB
    );

  game.scoreA +=
    pointsA;

  game.scoreB +=
    pointsB;

  const round =
    game.round;

  if(
    round >= ROUND_COUNT
  ){

    game.round =
      ROUND_COUNT;

    sendRoundUpdate(room);

    finishGame(room);

    return;

  }

  sendRoundUpdate(room);

  game.round++;

  game.tricksA = 0;

  game.tricksB = 0;

  game.trickNumber = 0;

  game.leadSeat =
    nextSeat(
      room,
      game.leadSeat
    );

  game.turn =
    game.leadSeat;

  room.players.forEach(
    p=>{
      p.bid = null;
      p.tricks = 0;
    }
  );

  setTimeout(
    ()=>{

      dealCards(room);

      sendRoundUpdate(room);

      startBidding(room);

    },
    1200
  );

}


function sendRoundUpdate(room){

  room.players.forEach(
    player=>{

      io.to(player.socketId)
        .emit(
          "ROUND_UPDATE",
          {
            round:
              room.game.round,

            scoreA:
              room.game.scoreA,

            scoreB:
              room.game.scoreB,

            hand:
              player.hand || []
          }
        );

    }
  );

}


/* =========================================================
   GAME OVER
========================================================= */

function finishGame(room){

  const winner =
    room.game.scoreA ===
    room.game.scoreB
    ? "DRAW"
    : (
      room.game.scoreA >
      room.game.scoreB
      ? "A"
      : "B"
    );

  room.players.forEach(
    player=>{

      io.to(player.socketId)
        .emit(
          "GAME_OVER",
          {
            roomId:room.id,
            round:ROUND_COUNT,
            scoreA:
              room.game.scoreA,
            scoreB:
              room.game.scoreB,
            winner,
            players:
              room.players.map(
                publicPlayer
              )
          }
        );

    }
  );

  room.started = false;

  /*
    Keep the room object temporarily so
    clients can receive the final state.
    New public games will use another room.
  */

  setTimeout(
    ()=>{
      if(
        rooms.get(room.id) === room
      ){

        rooms.delete(
          room.id
        );

      }
    },
    30000
  );

}


/* =========================================================
   BOT
========================================================= */

function autoPlay(
  room,
  player
){

  if(
    !room.started ||
    room.game.turn !== player.seat
  )
    return;

  const hand =
    player.hand || [];

  if(!hand.length)
    return;

  /*
    Simple intelligent bot:
    1. Follow lead suit if possible.
    2. Prefer winning card.
    3. Otherwise play lowest legal card.
  */

  let legal =
    hand.filter(
      c =>
        cardAllowed(
          room,
          player,
          c
        )
    );

  if(!legal.length)
    legal = hand.slice();

  let chosen =
    legal[0];

  if(
    room.game.trick.length
  ){

    const lead =
      room.game.trick[0].card;

    const currentWinner =
      winnerOfTrick(room);

    const winningCards =
      legal.filter(
        c =>
          cardPower(c) >
          cardPower(
            room.game.trick.find(
              x =>
                x.seat ===
                currentWinner
            )?.card || lead
          )
      );

    if(winningCards.length){

      chosen =
        winningCards.sort(
          (a,b)=>
            cardPower(a) -
            cardPower(b)
        )[0];

    }else{

      chosen =
        legal.sort(
          (a,b)=>
            cardPower(a) -
            cardPower(b)
        )[0];

    }

  }else{

    chosen =
      legal.sort(
        (a,b)=>
          cardPower(a) -
          cardPower(b)
      )[0];

  }

  playCardInternal(
    room,
    player,
    chosen
  );

}


/* =========================================================
   ERROR
========================================================= */

function error(
  socket,
  message
){

  socket.emit(
    "SERVER_ERROR",
    {
      message
    }
  );

}


/* =========================================================
   JOIN
========================================================= */

function joinRoom(
  socket,
  data
){

  const mode =
    normalizeMode(
      data?.mode
    );

  const requestedPrivate =
    !!(
      data?.private ||
      data?.type === "private"
    );

  let room;

  /*
    Private room:
    room code must be supplied.
  */

  if(requestedPrivate){

    const requestedId =
      String(
        data?.roomId ||
        ""
      ).trim();

    if(!requestedId){

      return error(
        socket,
        "Private room code is required."
      );

    }

    room =
      getRoom(
        requestedId
      );

    if(!room){

      room =
        createRoom({
          mode,
          capacity:
            capacityForMode(mode),
          privateRoom:true,
          roomId:requestedId
        });

    }else{

      if(!room.private)
        return error(
          socket,
          "This is not a private room."
        );

    }

  }else{

    /*
      Public matchmaking.
      Every game type has its own queue.
    */

    room =
      findPublicRoom(
        mode
      );

  }


  if(!room)
    return error(
      socket,
      "Unable to find a room."
    );


  if(room.started)
    return error(
      socket,
      "This room has already started."
    );


  if(
    room.players.length >=
    room.capacity
  )
    return error(
      socket,
      "Room is full."
    );


  /*
    Prevent duplicate socket
  */

  const existing =
    room.players.find(
      p =>
        p.socketId ===
        socket.id
    );

  if(existing){

    socket.emit(
      "ROOM_UPDATE",
      {
        ...roomState(room),
        seat:existing.seat,
        mySeat:existing.seat,
        playerId:existing.id
      }
    );

    return;

  }


  const seat =
    getFreeSeat(room);

  if(!seat)
    return error(
      socket,
      "No free seat."
    );


  const tgUser =
    data?.telegramUser || {};


  const player = {

    id:
      String(
        tgUser.id ||
        data?.playerId ||
        makeId("P")
      ),

    socketId:
      socket.id,

    name:
      String(
        tgUser.first_name ||
        data?.name ||
        `Player ${seat}`
      ),

    username:
      String(
        tgUser.username ||
        data?.username ||
        ""
      ),

    avatar:
      String(seat),

    seat,

    team:
      teamForSeat(seat),

    bid:null,

    tricks:0,

    hand:[]

  };


  room.players.push(
    player
  );


  socket.join(
    room.id
  );


  socket.data.roomId =
    room.id;

  socket.data.playerId =
    player.id;


  emitRoom(room);


  if(
    room.players.length ===
    room.capacity
  ){

    startGame(room);

  }

}


/* =========================================================
   SOCKET EVENTS
========================================================= */

io.on(
  "connection",
  socket=>{

    console.log(
      "CONNECTED:",
      socket.id
    );


    socket.on(
      "JOIN_ROOM",
      data=>{
        joinRoom(
          socket,
          data || {}
        );
      }
    );


    /*
      Backward compatibility
      with old game.html.
    */

    socket.on(
      "ROOM_JOIN",
      data=>{

        if(
          !socket.data.roomId
        ){

          joinRoom(
            socket,
            data || {}
          );

        }

      }
    );


    socket.on(
      "BID",
      data=>{
        submitBid(
          socket,
          data || {}
        );
      }
    );


    socket.on(
      "DECLARE_BID",
      data=>{

        submitBid(
          socket,
          data || {}
        );

      }
    );


    socket.on(
      "PLAY_CARD",
      data=>{
        playCard(
          socket,
          data || {}
        );
      }
    );


    socket.on(
      "LEAVE_ROOM",
      data=>{
        leaveRoom(
          socket,
          data || {}
        );
      }
    );


    socket.on(
      "ROOM_LEAVE",
      data=>{
        leaveRoom(
          socket,
          data || {}
        );
      }
    );


    socket.on(
      "disconnect",
      ()=>{
        leaveRoom(
          socket,
          {
            roomId:
              socket.data.roomId
          },
          true
        );

        console.log(
          "DISCONNECTED:",
          socket.id
        );

      }
    );

  }
);


/* =========================================================
   LEAVE ROOM
========================================================= */

function leaveRoom(
  socket,
  data,
  disconnected=false
){

  const room =
    getRoom(
      data?.roomId ||
      socket.data.roomId
    );

  if(!room)
    return;


  const index =
    room.players.findIndex(
      p =>
        p.socketId ===
        socket.id
    );

  if(index < 0)
    return;


  const player =
    room.players[index];


  clearTurnTimer(room);


  room.players.splice(
    index,
    1
  );


  socket.leave(
    room.id
  );


  socket.data.roomId =
    null;


  if(room.started){

    /*
      For now the room ends when a
      player leaves. This prevents
      corrupt game states.
    */

    room.started = false;

    room.players.forEach(
      p=>{

        io.to(p.socketId)
          .emit(
            "SERVER_ERROR",
            {
              message:
                `${player.name} left the game.`
            }
          );

      }
    );

  }


  if(
    room.players.length === 0
  ){

    rooms.delete(
      room.id
    );

  }else{

    emitRoom(room);

  }

}


/* =========================================================
   START
========================================================= */

server.listen(
  PORT,
  HOST,
  ()=>{
    console.log(
      `SPADES SERVER running on port ${PORT}`
    );
  }
);
