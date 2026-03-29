/**
 * Problocks Multiplayer Server
 *
 * WebSocket server for real-time collaborative simulations.
 * Players join rooms (one room per simulation instance),
 * and state updates are broadcast to all participants.
 *
 * Protocol:
 *   Client → Server:
 *     { type: "join", room: "sim-slug", player: { id, name } }
 *     { type: "state", data: { entityId, position, rotation, ... } }
 *     { type: "action", action: "applyForce", args: { ... } }
 *     { type: "chat", message: "hello" }
 *     { type: "leave" }
 *
 *   Server → Client:
 *     { type: "joined", room, players, playerId }
 *     { type: "player_joined", player }
 *     { type: "player_left", playerId }
 *     { type: "state", playerId, data }
 *     { type: "action", playerId, action, args }
 *     { type: "chat", playerId, playerName, message }
 *     { type: "error", message }
 */

import { WebSocketServer, type WebSocket } from 'ws';
import { nanoid } from 'nanoid';

interface Player {
  id: string;
  name: string;
  ws: WebSocket;
  room: string | null;
}

interface Room {
  id: string;
  slug: string;
  players: Map<string, Player>;
  createdAt: number;
}

const PORT = parseInt(process.env.WS_PORT ?? '5002', 10);
const rooms = new Map<string, Room>();
const players = new Map<WebSocket, Player>();

const wss = new WebSocketServer({ port: PORT });

console.log(`Problocks Multiplayer Server running on ws://localhost:${PORT}`);

wss.on('connection', (ws: WebSocket) => {
  const player: Player = {
    id: nanoid(8),
    name: 'Anonymous',
    ws,
    room: null,
  };
  players.set(ws, player);

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(player, msg);
    } catch {
      send(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    if (player.room) leaveRoom(player);
    players.delete(ws);
  });
});

function send(ws: WebSocket, data: object): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room: Room, data: object, excludeId?: string): void {
  for (const [, p] of room.players) {
    if (p.id !== excludeId) send(p.ws, data);
  }
}

function handleMessage(player: Player, msg: any): void {
  switch (msg.type) {
    case 'join': {
      const slug = msg.room;
      const name = msg.player?.name ?? 'Anonymous';
      player.name = name;

      // Leave current room if in one
      if (player.room) leaveRoom(player);

      // Find or create room
      let room = rooms.get(slug);
      if (!room) {
        room = { id: nanoid(), slug, players: new Map(), createdAt: Date.now() };
        rooms.set(slug, room);
      }

      // Join room
      room.players.set(player.id, player);
      player.room = slug;

      // Send join confirmation
      const playerList = Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name }));
      send(player.ws, { type: 'joined', room: slug, players: playerList, playerId: player.id });

      // Notify others
      broadcast(room, { type: 'player_joined', player: { id: player.id, name: player.name } }, player.id);

      console.log(`[${slug}] ${name} joined (${room.players.size} players)`);
      break;
    }

    case 'state': {
      if (!player.room) return;
      const room = rooms.get(player.room);
      if (!room) return;
      broadcast(room, { type: 'state', playerId: player.id, data: msg.data }, player.id);
      break;
    }

    case 'action': {
      if (!player.room) return;
      const room = rooms.get(player.room);
      if (!room) return;
      broadcast(room, { type: 'action', playerId: player.id, action: msg.action, args: msg.args }, player.id);
      break;
    }

    case 'chat': {
      if (!player.room) return;
      const room = rooms.get(player.room);
      if (!room) return;
      broadcast(room, { type: 'chat', playerId: player.id, playerName: player.name, message: msg.message });
      break;
    }

    case 'leave': {
      if (player.room) leaveRoom(player);
      break;
    }

    default:
      send(player.ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
  }
}

function leaveRoom(player: Player): void {
  if (!player.room) return;
  const room = rooms.get(player.room);
  if (room) {
    room.players.delete(player.id);
    broadcast(room, { type: 'player_left', playerId: player.id });
    console.log(`[${player.room}] ${player.name} left (${room.players.size} players)`);

    // Clean up empty rooms
    if (room.players.size === 0) {
      rooms.delete(player.room);
      console.log(`[${player.room}] Room closed (empty)`);
    }
  }
  player.room = null;
}

// Periodic stats
setInterval(() => {
  if (rooms.size > 0) {
    console.log(`[stats] ${rooms.size} rooms, ${players.size} connected`);
  }
}, 30000);
