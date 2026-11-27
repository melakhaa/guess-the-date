import type { ClientToServerEvents, DuelError, PlayerSession, RoomStateEvent, ServerToClientEvents } from "@guess-the-date/shared";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const ACK_TIMEOUT = 5000;

function roomUnavailable({ code }: DuelError): boolean {
  return code === "ROOM_EXPIRED" || code === "ROOM_NOT_FOUND" || code === "UNAUTHORIZED";
}

export function useLobby({ code, playerToken }: PlayerSession) {
  const socketRef = useRef<LobbySocket | null>(null);
  const nextId = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "disconnected" | "unavailable">("connecting");
  const [room, setRoom] = useState<RoomStateEvent | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [readyPending, setReadyPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const socket: LobbySocket = io({ autoConnect: false });
    socketRef.current = socket;

    function stop(message: string, unavailable = false) {
      socket.disconnect();
      setConnection(unavailable ? "unavailable" : "disconnected");
      setError(message);
    }

    socket.on("room:state", setRoom);
    socket.on("room:error", ({ message }) => setError(message));
    socket.on("connect_error", () => setConnection("reconnecting"));
    socket.on("disconnect", () => {
      setConnection(socket.active ? "reconnecting" : "disconnected");
      setReadyPending(false);
    });

    socket.on("connect", async () => {
      const connectionId = socket.id;
      const current = () => socketRef.current === socket && socket.id === connectionId;
      try {
        const attach = await socket.timeout(ACK_TIMEOUT).emitWithAck("room:attach", { code, playerToken });
        if (!current()) return;
        if (!attach.ok) return stop(attach.error.message, roomUnavailable(attach.error));
        const sentAt = performance.now();
        const sync = await socket.timeout(ACK_TIMEOUT).emitWithAck("room:sync", { requestId: `${connectionId}:sync` });
        if (!current()) return;
        if (!sync.ok) return stop(sync.error.message, roomUnavailable(sync.error));

        const receivedAt = performance.now();
        // Keep the sync estimate; a delayed countdown broadcast must not reset the clock.
        setClockOffset(sync.serverNow - (sentAt + receivedAt) / 2);
        setRoom(sync.state);
        setError("");
        setConnection("connected");
      } catch {
        if (current()) stop("Could not connect to the room. Try reconnecting.");
      }
    });

    socket.connect();
    return () => {
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [attempt, code, playerToken]);

  async function setReady(ready: boolean) {
    const socket = socketRef.current;
    if (!socket?.connected || connection !== "connected" || readyPending) return;
    const connectionId = socket.id;
    const current = () => socketRef.current === socket && socket.id === connectionId;
    setReadyPending(true);
    setError("");
    try {
      const ack = await socket.timeout(ACK_TIMEOUT).emitWithAck("player:ready", { ready, requestId: `${connectionId}:${++nextId.current}` });
      if (!current() || ack.ok) return;
      if (roomUnavailable(ack.error)) {
        socket.disconnect();
        setConnection("unavailable");
      }
      setError(ack.error.message);
    } catch {
      if (current()) setError("Could not confirm readiness. Check your status and try again.");
    } finally {
      if (current()) setReadyPending(false);
    }
  }

  function reconnect() {
    setError("");
    setConnection("connecting");
    setAttempt((value) => value + 1);
  }

  return { room, clockOffset, connection, readyPending, error, setReady, reconnect };
}
