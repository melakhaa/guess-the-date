import { randomInt } from "node:crypto";
import { events } from "../content/events.js";
import { acceptGuess, ownRound, resolveRound, startRound } from "../rooms/round.js";
import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import { z, ZodError } from "zod";
import { ROOM_CAPACITY, ROUND_COUNTDOWN_MS, type ClientToServerEvents, type DuelError, type PlayerReadyAck, type ServerToClientEvents } from "@guess-the-date/shared";
import { RoomError, type Room, type RoomManager } from "../rooms/RoomManager.js";

interface SocketData {
  session?: { code: string; playerId: string };
}

type LobbySocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const attachSchema = z.strictObject({
  code: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  playerToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

const requestIdEnvelope = z.object({ requestId: z.string().min(1).max(128) });
const syncSchema = requestIdEnvelope.strict();
const readySchema = syncSchema.extend({ ready: z.boolean() });
const guessSchema = syncSchema.extend({ round: z.number().int().min(1).max(5), date: z.string().max(10) });
const MAX_READY_ACKS = 64;

function attachedPlayer(socket: LobbySocket, rooms: RoomManager) {
  const session = socket.data.session;
  if (!session) throw new RoomError("PLAYER_NOT_ATTACHED", 401, "Attach to a room first.");
  const room = rooms.get(session.code);
  const player = room.players.find((candidate) => candidate.playerId === session.playerId);
  if (!player || player.socketId !== socket.id) throw new RoomError("UNAUTHORIZED", 401, "Socket is no longer authorized.");
  return { room, player };
}

function fail(socket: LobbySocket, ack: unknown, error: unknown, requestId?: string): void {
  let safeError: DuelError;
  if (error instanceof RoomError) safeError = { code: error.code, message: error.message };
  else if (error instanceof ZodError) safeError = { code: "INVALID_REQUEST", message: "Invalid request." };
  else safeError = { code: "INTERNAL_ERROR", message: "An unexpected error occurred." };
  if (typeof ack === "function") ack({ ok: false, ...(requestId ? { requestId } : {}), error: safeError });
  else socket.emit("room:error", { ...safeError, ...(requestId ? { requestId } : {}) });
}

export function registerLobby(app: FastifyInstance, rooms: RoomManager): void {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(app.server, {
    maxHttpBufferSize: 1024,
    serveClient: false,
  });

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearTimer(room: Room): void {
    clearTimeout(timers.get(room.code));
    timers.delete(room.code);
  }

  function schedule(room: Room): void {
    clearTimer(room);
    const deadline = room.phase === "countdown" ? room.countdownStartsAt : room.phase === "playing" ? room.round?.endsAt : null;
    if (deadline == null) return;
    timers.set(room.code, setTimeout(() => {
      timers.delete(room.code);
      try {
        if (rooms.get(room.code) !== room) return;
        advance(room);
        schedule(room);
      } catch (error) {
        if (!(error instanceof RoomError)) app.log.error("Unable to advance round.");
      }
    }, Math.max(0, deadline - Date.now())));
  }

  function advance(room: Room): void {
    const now = Date.now();
    if (room.phase === "countdown" && room.countdownStartsAt !== null && now >= room.countdownStartsAt) {
      const started = startRound(room, events[randomInt(events.length)]);
      io.to(room.code).emit("round:start", { ...started, serverNow: now });
      io.to(room.code).emit("room:state", rooms.snapshot(room));
      schedule(room);
    }
    const result = resolveRound(room, now);
    if (result) {
      clearTimer(room);
      io.to(room.code).emit("round:result", result);
      io.to(room.code).emit("room:state", rooms.snapshot(room));
    }
  }

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {
      if (!socket.data.session) return;
      try {
        const { room, player } = attachedPlayer(socket, rooms);
        advance(room);
        player.socketId = null;
        player.ready = false;
        if (room.phase === "waiting" || room.phase === "countdown") {
          room.phase = "waiting";
          room.countdownStartsAt = null;
          clearTimer(room);
        }
        socket.to(room.code).emit("opponent:status", { connected: false, finished: room.round?.players.get(player.playerId)?.finished ?? false });
        io.to(room.code).emit("room:state", rooms.snapshot(room));
      } catch (error) {
        // Expired rooms and replaced sockets no longer own presence state.
        if (!(error instanceof RoomError)) app.log.error("Unable to update socket presence.");
      }
    });

    socket.on("player:ready", (payload, ack) => {
      const requestId = requestIdEnvelope.safeParse(payload).data?.requestId;
      try {
        if (typeof ack !== "function") throw new RoomError("INVALID_REQUEST", 400, "Acknowledgment required.");
        const request = readySchema.parse(payload);
        const { room, player } = attachedPlayer(socket, rooms);
        advance(room);
        if (room.phase !== "waiting" && room.phase !== "countdown") throw new RoomError("ROOM_STATE_CONFLICT", 409, "Readiness is lobby-only.");
        const cached = player.readyAcks.get(request.requestId);
        if (cached) return ack(cached);
        player.ready = request.ready;
        rooms.touch(room);
        if (!player.ready && room.phase === "countdown") {
          room.phase = "waiting";
          room.countdownStartsAt = null;
          clearTimer(room);
        }
        let countdown = null;
        if (room.phase === "waiting" && room.players.length === ROOM_CAPACITY && room.players.every((candidate) => candidate.ready && candidate.socketId !== null)) {
          const serverNow = Date.now();
          room.phase = "countdown";
          room.countdownStartsAt = serverNow + ROUND_COUNTDOWN_MS;
          countdown = { startsAt: room.countdownStartsAt, serverNow };
          schedule(room);
        }
        const response: PlayerReadyAck = { ok: true, requestId: request.requestId, ready: player.ready };
        player.readyAcks.set(request.requestId, response);
        if (player.readyAcks.size > MAX_READY_ACKS) player.readyAcks.delete(player.readyAcks.keys().next().value!);
        ack(response);
        io.to(room.code).emit("room:state", rooms.snapshot(room));
        if (countdown) io.to(room.code).emit("match:countdown", countdown);
      } catch (error) {
        fail(socket, ack, error, requestId);
      }
    });

    socket.on("guess:submit", (payload, ack) => {
      const requestId = requestIdEnvelope.safeParse(payload).data?.requestId;
      try {
        if (typeof ack !== "function") throw new RoomError("INVALID_REQUEST", 400, "Acknowledgment required.");
        const request = guessSchema.parse(payload);
        const { room, player } = attachedPlayer(socket, rooms);
        advance(room);
        const wasFinished = room.round?.players.get(player.playerId)?.finished;
        const response = acceptGuess(room, player.playerId, request, Date.now());
        ack(response);
        if (!wasFinished && room.round?.players.get(player.playerId)?.finished) {
          socket.to(room.code).emit("opponent:status", { connected: true, finished: true });
        }
        advance(room);
      } catch (error) {
        fail(socket, ack, error, requestId);
      }
    });

    socket.on("room:sync", (payload, ack) => {
      const requestId = requestIdEnvelope.safeParse(payload).data?.requestId;
      try {
        if (typeof ack !== "function") throw new RoomError("INVALID_REQUEST", 400, "Acknowledgment required.");
        const request = syncSchema.parse(payload);
        const { room, player } = attachedPlayer(socket, rooms);
        advance(room);
        ack({ ok: true, requestId: request.requestId, state: rooms.snapshot(room), ownRound: ownRound(room, player.playerId), roundResult: room.round?.result ?? null, serverNow: Date.now() });
      } catch (error) {
        fail(socket, ack, error, requestId);
      }
    });

    socket.on("room:attach", (payload, ack) => {
      try {
        if (typeof ack !== "function") throw new RoomError("INVALID_REQUEST", 400, "Acknowledgment required.");
        const { code, playerToken } = attachSchema.parse(payload);
        const { room, player } = rooms.authenticate(code, playerToken);
        const session = socket.data.session;
        if (session && (session.code !== code || session.playerId !== player.playerId)) {
          throw new RoomError("ROOM_STATE_CONFLICT", 409, "Reconnect before attaching a different player.");
        }
        advance(room);
        const previousSocketId = player.socketId;
        player.socketId = socket.id;
        rooms.touch(room);
        socket.data.session = { code, playerId: player.playerId };
        // The default in-memory adapter joins synchronously; this app is single-process.
        void socket.join(code);
        if (previousSocketId && previousSocketId !== socket.id) {
          io.sockets.sockets.get(previousSocketId)?.disconnect(true);
        }
        const state = rooms.snapshot(room);
        ack({ ok: true, playerId: player.playerId, state, serverNow: Date.now() });
        io.to(code).emit("room:state", state);
        socket.to(code).emit("opponent:status", { connected: true, finished: room.round?.players.get(player.playerId)?.finished ?? false });
      } catch (error) {
        fail(socket, ack, error);
      }
    });
  });

  app.addHook("preClose", async () => {
    io.disconnectSockets(true);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
  app.addHook("onClose", async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
}
