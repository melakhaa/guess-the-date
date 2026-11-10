import type { FastifyInstance } from "fastify";
import { Server, type Socket } from "socket.io";
import { z, ZodError } from "zod";
import { ROOM_CAPACITY, ROUND_COUNTDOWN_MS, type ClientToServerEvents, type DuelError, type PlayerReadyAck, type ServerToClientEvents } from "@guess-the-date/shared";
import { RoomError, type RoomManager } from "../rooms/RoomManager.js";

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

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {
      if (!socket.data.session) return;
      try {
        const { room, player } = attachedPlayer(socket, rooms);
        player.socketId = null;
        player.ready = false;
        room.phase = "waiting";
        room.countdownStartsAt = null;
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
        const cached = player.readyAcks.get(request.requestId);
        if (cached) return ack(cached);
        player.ready = request.ready;
        rooms.touch(room);
        if (!player.ready && room.phase === "countdown") {
          room.phase = "waiting";
          room.countdownStartsAt = null;
        }
        let countdown = null;
        if (room.phase === "waiting" && room.players.length === ROOM_CAPACITY && room.players.every((candidate) => candidate.ready && candidate.socketId !== null)) {
          const serverNow = Date.now();
          room.phase = "countdown";
          room.countdownStartsAt = serverNow + ROUND_COUNTDOWN_MS;
          // shortcut: this stage schedules only; Stage 5 must start the round at this deadline.
          countdown = { startsAt: room.countdownStartsAt, serverNow };
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

    socket.on("room:sync", (payload, ack) => {
      const requestId = requestIdEnvelope.safeParse(payload).data?.requestId;
      try {
        if (typeof ack !== "function") throw new RoomError("INVALID_REQUEST", 400, "Acknowledgment required.");
        const request = syncSchema.parse(payload);
        const { room } = attachedPlayer(socket, rooms);
        ack({ ok: true, requestId: request.requestId, state: rooms.snapshot(room), ownRound: null, serverNow: Date.now() });
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
      } catch (error) {
        fail(socket, ack, error);
      }
    });
  });

  app.addHook("preClose", async () => { io.disconnectSockets(true); });
  app.addHook("onClose", async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });
}
