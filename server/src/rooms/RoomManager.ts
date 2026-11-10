import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { MATCH_ROUNDS, ROOM_CAPACITY, type DuelErrorCode, type LobbyMetadata, type PlayerSession, type PlayerReadyAck, type RoomStateEvent } from "@guess-the-date/shared";

import type { ActiveRound } from "./round.js";

const LOBBY_IDLE_MS = 30 * 60_000;
const MAX_ROOMS = 1000;

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  tokenHash: string;
  socketId: string | null;
  ready: boolean;
  readyAcks: Map<string, PlayerReadyAck>;
}

export interface Room {
  code: string;
  phase: "waiting" | "countdown" | "playing" | "roundResults";
  round?: ActiveRound;
  countdownStartsAt: number | null;
  expiresAt: number;
  players: RoomPlayer[];
}

export class RoomError extends Error {
  constructor(readonly code: DuelErrorCode, readonly statusCode: number, message: string) {
    super(message);
  }
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  create(nickname: string): PlayerSession {
    // shortcut: reclaim on access/create only; add periodic cleanup with match timers in Stage 9.
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now >= room.expiresAt) this.rooms.delete(code);
    }
    if (this.rooms.size >= MAX_ROOMS) {
      throw new RoomError("RATE_LIMITED", 429, "Server room capacity reached. Try again later.");
    }
    let code: string;
    do {
      code = randomBytes(12).toString("base64url");
    } while (this.rooms.has(code));
    const room: Room = { code, phase: "waiting", countdownStartsAt: null, expiresAt: Date.now() + LOBBY_IDLE_MS, players: [] };
    const session = this.addPlayer(room, nickname);
    this.rooms.set(code, room);
    return session;
  }

  join(code: string, nickname: string): PlayerSession {
    const room = this.get(code);
    if (room.players.length >= ROOM_CAPACITY) {
      throw new RoomError("ROOM_FULL", 409, "This room already has two players.");
    }
    return this.addPlayer(room, nickname);
  }

  private addPlayer(room: Room, nickname: string): PlayerSession {
    nickname = nickname.normalize("NFKC");
    if (/[<>\p{Cc}\p{Cf}]/u.test(nickname)) {
      throw new RoomError("INVALID_NICKNAME", 400, "Nickname cannot contain markup or control characters.");
    }
    nickname = nickname.trim().replace(/\s+/gu, " ");
    if ([...nickname].length < 1 || [...nickname].length > 24) {
      throw new RoomError("INVALID_NICKNAME", 400, "Nickname must contain 1–24 characters.");
    }
    const playerToken = randomBytes(32).toString("base64url");
    const playerId = randomUUID();
    room.players.push({
      playerId, nickname, tokenHash: createHash("sha256").update(playerToken).digest("hex"),
      socketId: null, ready: false, readyAcks: new Map(),
    });
    this.touch(room);
    return { code: room.code, playerId, playerToken };
  }

  get(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError("ROOM_NOT_FOUND", 404, "Room not found.");
    if (Date.now() >= room.expiresAt) {
      this.rooms.delete(code);
      throw new RoomError("ROOM_EXPIRED", 410, "This room has expired.");
    }
    return room;
  }

  touch(room: Room): void {
    room.expiresAt = Date.now() + LOBBY_IDLE_MS;
  }

  authenticate(code: string, playerToken: string): { room: Room; player: RoomPlayer } {
    const room = this.get(code);
    const tokenHash = createHash("sha256").update(playerToken).digest();
    const player = room.players.find((candidate) =>
      timingSafeEqual(Buffer.from(candidate.tokenHash, "hex"), tokenHash),
    );
    if (!player) throw new RoomError("UNAUTHORIZED", 401, "Invalid player credential.");
    return { room, player };
  }

  snapshot(room: Room): RoomStateEvent {
    return {
      code: room.code, phase: room.phase, round: room.round?.number ?? null, roundsTotal: MATCH_ROUNDS,
      countdownStartsAt: room.countdownStartsAt,
      players: room.players.map((player) => ({
        playerId: player.playerId, nickname: player.nickname,
        connected: player.socketId !== null, ready: player.ready,
        finished: room.round?.players.get(player.playerId)?.finished ?? false,
        totalPoints: room.round?.result?.players.find((result) => result.playerId === player.playerId)?.totalPoints ?? 0,
      })),
    };
  }

  metadata(code: string): LobbyMetadata {
    const room = this.get(code);
    return { code: room.code, phase: room.phase, playerCount: room.players.length, capacity: ROOM_CAPACITY };
  }
}
