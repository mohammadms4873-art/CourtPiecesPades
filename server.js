"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CLIENT_ORIGIN || "*";
const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 10000
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const ROUND_COUNT = 6;
const TURN_TIME = 10000;
const VALID_MODES = new Set(["spade6", "spade4", "spade2"]);
const rooms = new Map();
const socketRequests = new Map();
const RATE_WINDOW = 10000;
const RATE_LIMIT = 30;

app.disable("x-powered-by");
app.use(express.static(path.join(__dirname), { dotfiles: "deny", index: false }));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/health", (_req, res) => res.json({ ok: true, service: "SPADES", rooms: rooms.size }));

function makeId(prefix = "ROOM") {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
function normalizeMode(mode) {
  const m = String(mode || "spade6").toLowerCase();
  if (VALID_MODES.has(m)) return m;
  if (m.includes("classic") || m.includes("4")) return "spade4";
  if (m.includes("duel") || m.includes("2")) return "spade2";
  return "spade6";
}
function capacityForMode(mode) { return normalizeMode(mode) === "spade4" ? 4 : normalizeMode(mode) === "spade2" ? 2 : 6; }
function teamForSeat(seat) { return Number(seat) % 2 === 1 ? "A" : "B"; }
function safeString(value, fallback, max = 24) {
  const s = typeof value === "string" ? value.trim() : "";
  return (s || fallback).slice(0, max);
}
function publicPlayer(p) { return { id: p.id, name: p.name, username: p.username, avatar: p.avatar, seat: p.seat, team: p.team, bid: p.bid, tricks: p.tricks }; }
function roomState(room) { return { roomId: room.id, mode: room.mode, capacity: room.capacity, private: room.private, started: room.started, players: room.players.map(publicPlayer) }; }
function emitRoom(room) { room.players.forEach(p => io.to(p.socketId).emit("ROOM_UPDATE", { ...roomState(room), seat: p.seat, mySeat: p.seat, playerId: p.id })); }
function getRoom(id) { return id ? rooms.get(String(id).trim()) || null : null; }
function getFreeSeat(room) { for (let seat = 1; seat <= room.capacity; seat++) if (!room.players.some(p => p.seat === seat)) return seat; return null; }
function error(socket, message) { socket.emit("ROOM_ERROR", { message }); }
function checkRate(socket) {
  const now = Date.now();
  const r = socketRequests.get(socket.id) || { at: now, count: 0 };
  if (now - r.at >= RATE_WINDOW) { r.at = now; r.count = 0; }
  r.count++;
  socketRequests.set(socket.id, r);
  return r.count <= RATE_LIMIT;
}
function createRoom({ mode, capacity, privateRoom, roomId }) {
  const normalized = normalizeMode(mode);
  const room = { id: roomId || makeId(privateRoom ? "PRV" : "ROOM"), mode: normalized, capacity: capacity || capacityForMode(normalized), private: !!privateRoom, started: false, players: [], game: null };
  rooms.set(room.id, room); return room;
}
function findPublicRoom(mode) {
  const normalized = normalizeMode(mode), capacity = capacityForMode(normalized);
  for (const room of rooms.values()) if (!room.private && room.mode === normalized && !room.started && room.players.length < capacity) return room;
  return createRoom({ mode: normalized, capacity, privateRoom: false });
}
function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"], ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"], deck = [];
  for (const suit of suits) for (const rank of ranks) deck.push({ rank, suit });
  return deck;
}
function secureShuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const bytes = crypto.randomBytes(4).readUInt32BE(0);
    const j = bytes % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function createGame() { return { round: 1, scoreA: 0, scoreB: 0, turn: 1, trick: [], played: [], bids: {}, bidding: false, leadSeat: 1, tricksA: 0, tricksB: 0, trickNumber: 0, turnTimer: null }; }
function dealCards(room) {
  const deck = secureShuffle(createDeck());
  if (room.capacity === 6) { deck.push({ rank: "Joker", suit: "red" }, { rank: "Joker", suit: "black" }); secureShuffle(deck); }
  const cardsPerPlayer = room.capacity === 6 ? 9 : Math.floor(deck.length / room.capacity);
  room.players.forEach(p => { p.hand = deck.splice(0, cardsPerPlayer); p.tricks = 0; });
}
function startGame(room) {
  if (room.started || room.players.length !== room.capacity) return;
  room.started = true; room.game = createGame();
  room.players.forEach(p => { p.bid = null; p.tricks = 0; });
  dealCards(room); sendGameStart(room); startBidding(room);
}
function privateGameState(room, player) {
  const game = room.game;
  return { roomId: room.id, mode: room.mode, capacity: room.capacity, started: room.started, players: room.players.map(publicPlayer), playerId: player.id, mySeat: player.seat, hand: player.hand || [], played: game ? game.played : [], round: game ? game.round : 1, scoreA: game ? game.scoreA : 0, scoreB: game ? game.scoreB : 0, turn: game ? game.turn : 1 };
}
function sendGameStart(room) { room.players.forEach(p => io.to(p.socketId).emit("GAME_START", privateGameState(room, p))); }
function startBidding(room) {
  const game = room.game; game.bidding = true; game.bids = {};
  room.players.forEach(p => p.bid = null); emitRoom(room);
  room.players.forEach(p => io.to(p.socketId).emit("BID_REQUEST", { round: game.round }));
  clearTurnTimer(room);
  game.turnTimer = setTimeout(() => { room.players.forEach(p => { if (p.bid === null) { p.bid = 1; game.bids[p.seat] = 1; } }); game.bidding = false; beginTricks(room); }, TURN_TIME * 1.5);
}
function allBidsDone(room) { return room.players.every(p => p.bid !== null); }
function submitBid(socket, data) {
  if (!checkRate(socket)) return error(socket, "Too many requests.");
  if (!data || typeof data !== "object") return error(socket, "Invalid bid request.");
  const room = getRoom(data.roomId); if (!room) return error(socket, "Room not found.");
  if (!room.started || !room.game?.bidding) return error(socket, "Bidding phase is over.");
  const player = room.players.find(p => p.socketId === socket.id); if (!player) return error(socket, "Player not found.");
  const bid = Number(data.bid); if (!Number.isInteger(bid) || bid < 0 || bid > 7) return error(socket, "Invalid bid.");
  player.bid = bid; room.game.bids[player.seat] = bid;
  io.to(room.id).emit("BID_UPDATE", { players: room.players.map(publicPlayer) });
  if (allBidsDone(room)) { clearTurnTimer(room); room.game.bidding = false; beginTricks(room); }
}
function beginTricks(room) { room.game.turn = room.game.leadSeat; room.game.trick = []; room.game.played = []; room.game.trickNumber = 0; sendGameState(room); startTurnTimer(room); }
function sendGameState(room) { room.players.forEach(p => io.to(p.socketId).emit("GAME_STATE", privateGameState(room, p))); }
function clearTurnTimer(room) { if (room.game?.turnTimer) { clearTimeout(room.game.turnTimer); room.game.turnTimer = null; } }
function startTurnTimer(room) { clearTurnTimer(room); const expectedSeat = room.game.turn; room.game.turnTimer = setTimeout(() => { const p = room.players.find(x => x.seat === expectedSeat); if (p) autoPlay(room, p); }, TURN_TIME); }
function sameCard(a,b) { return a && b && a.rank === b.rank && a.suit === b.suit; }
function cardAllowed(room, player, card) {
  if (!card || typeof card !== "object") return false;
  const hand = player.hand || [], index = hand.findIndex(c => sameCard(c, card)); if (index < 0) return false;
  if (room.game.trick.length === 0) return card.rank !== "Joker";
  const lead = room.game.trick[0].card.suit;
  const hasSuit = hand.some(c => c.suit === lead);
  return !(hasSuit && card.suit !== lead);
}
function playCard(socket, data) {
  if (!checkRate(socket)) return error(socket, "Too many requests.");
  if (!data || typeof data !== "object" || !data.card || typeof data.card !== "object") return error(socket, "Invalid card.");
  const room = getRoom(data.roomId); if (!room || !room.started) return error(socket, "Game not active.");
  if (room.game.bidding) return error(socket, "Still in bidding phase.");
  const player = room.players.find(p => p.socketId === socket.id); if (!player) return error(socket, "Player not found.");
  if (room.game.turn !== player.seat) return error(socket, "It is not your turn.");
  const card = { rank: safeString(data.card.rank, "", 10), suit: safeString(data.card.suit, "", 10) };
  if (!cardAllowed(room, player, card)) return error(socket, "This card cannot be played.");
  playCardInternal(room, player, card);
}
function playCardInternal(room, player, card) {
  clearTurnTimer(room); const index = player.hand.findIndex(c => sameCard(c, card)); if (index < 0) return;
  player.hand.splice(index, 1); room.game.trick.push({ seat: player.seat, card }); room.game.played = room.game.trick.map(x => ({ seat:x.seat, rank:x.card.rank, suit:x.card.suit }));
  io.to(room.id).emit("TRICK_UPDATE", { played: room.game.played });
  if (room.game.trick.length >= room.capacity) return finishTrick(room);
  room.game.turn = nextSeat(room, player.seat); sendGameState(room); startTurnTimer(room);
}
function nextSeat(room, seat) { const next = Number(seat) + 1; return next > room.capacity ? 1 : next; }
function cardPower(card) {
  if (card.rank === "Joker") return card.suit === "red" ? 1000 : 950;
  const values = {"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:11,Q:12,K:13,A:14};
  let power = values[card.rank] || 0; if (card.suit === "♠") power += 100; return power;
}
function winnerOfTrick(room) {
  const trick = room.game.trick, leadSuit = trick[0].card.suit; let winner = trick[0];
  for (let i=1;i<trick.length;i++) { const current=trick[i], a=winner.card, b=current.card; let ap=cardPower(a), bp=cardPower(b); const at=a.suit==="♠"||a.rank==="Joker", bt=b.suit==="♠"||b.rank==="Joker"; if(bt&&!at){winner=current;continue;} if(!bt&&at)continue; if(!at&&!bt){if(a.suit!==leadSuit)ap=-1;if(b.suit!==leadSuit)bp=-1;} if(bp>ap)winner=current; }
  return winner.seat;
}
function finishTrick(room) {
  const game=room.game; clearTurnTimer(room); const winnerSeat=winnerOfTrick(room), winner=room.players.find(p=>p.seat===winnerSeat); if(!winner)return;
  winner.tricks++; if(teamForSeat(winnerSeat)==="A")game.tricksA++;else game.tricksB++; game.trick=[];game.trickNumber++;game.leadSeat=winnerSeat;
  if(game.trickNumber>=9){finishRound(room);return;} sendGameState(room); startTurnTimer(room);
}
function finishRound(room) { const g=room.game; clearTurnTimer(room); g.scoreA+=g.tricksA;g.scoreB+=g.tricksB; if(g.round>=ROUND_COUNT){io.to(room.id).emit("GAME_OVER",{scoreA:g.scoreA,scoreB:g.scoreB}); room.started=false;return;} g.round++;g.tricksA=0;g.tricksB=0;g.trickNumber=0;dealCards(room);startBidding(room); }
function autoPlay(room, player) { const card=(player.hand||[]).find(c=>cardAllowed(room,player,c)); if(card) playCardInternal(room,player,card); else removePlayer(player.socketId ? {data:{roomCode:room.id},id:player.socketId,leave:()=>{}} : null); }
function removePlayer(socket) {
  if(!socket)return; const room=getRoom(socket.data?.roomCode); if(!room)return; const idx=room.players.findIndex(p=>p.socketId===socket.id); if(idx!==-1)room.players.splice(idx,1); clearTurnTimer(room);
  if(room.started){room.started=false;io.to(room.id).emit("PLAYER_LEFT",{message:"A player disconnected. Game cancelled.",playerId:socket.data.playerId});}
  if(room.players.length===0)rooms.delete(room.id);else emitRoom(room);
}

io.on("connection", socket => {
  socket.on("JOIN_ROOM", data => {
    if(!checkRate(socket)||!data||typeof data!=="object")return error(socket,"Invalid room request.");
    const mode=normalizeMode(data.mode), capacity=capacityForMode(mode); const playerId=safeString(data.playerId, crypto.randomUUID(), 64);
    const playerName=safeString(data.playerName,"PLAYER",24); const reqCode=data.roomCode?safeString(data.roomCode,"",32).toUpperCase():null;
    let room;
    if(data.private){ room=reqCode?getRoom(reqCode):null; if(!room)room=createRoom({mode,capacity,privateRoom:true,roomId:reqCode}); if(room.mode!==mode||room.capacity!==capacity)return error(socket,"Room configuration mismatch."); }
    else room=findPublicRoom(mode);
    if(room.started||room.players.length>=room.capacity)return error(socket,"Room is full.");
    if(room.players.some(p=>p.id===playerId))return error(socket,"Player is already in this room.");
    const seat=getFreeSeat(room); if(!seat)return error(socket,"No seat available.");
    const player={id:playerId,name:playerName,username:safeString(data.username,"",32),avatar:safeString(data.avatar,"",256),socketId:socket.id,seat,team:teamForSeat(seat),bid:null,tricks:0,hand:[]};
    room.players.push(player);socket.join(room.id);socket.data.roomCode=room.id;socket.data.playerId=player.id;emitRoom(room);if(room.players.length===room.capacity)startGame(room);
  });
  socket.on("BID", data=>submitBid(socket,data));
  socket.on("PLAY_CARD", data=>playCard(socket,data));
  socket.on("LEAVE_ROOM",()=>removePlayer(socket));
  socket.on("disconnect",()=>{socketRequests.delete(socket.id);removePlayer(socket);});
});

setInterval(()=>{ for(const [id,room] of rooms){if(room.players.length===0){clearTurnTimer(room);rooms.delete(id);}} },60000).unref();

server.listen(PORT,HOST,()=>console.log(`SPADES SERVER RUNNING on ${HOST}:${PORT}`));
