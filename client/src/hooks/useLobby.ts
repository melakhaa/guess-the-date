import type {
  ClientToServerEvents, DuelError, DuelErrorCode, GuessSubmitAck, GuessSubmitRequest, OwnRoundState,
  PlayerSession, RoomStateEvent, RoundResultEvent, ServerToClientEvents,
} from "@guess-the-date/shared";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const ACK_TIMEOUT = 5000;
const CLOCK_SYNC_MS = 15_000;
const guessErrors: Partial<Record<DuelErrorCode, string>> = {
  INVALID_DATE: "That date isn’t in the supported range.",
  DUPLICATE_GUESS: "You’ve already tried that date.",
  ALREADY_FINISHED: "You’ve already finished this round.",
  GUESS_LIMIT_REACHED: "You’re out of guesses for this round.",
};

function roomUnavailable({ code }: DuelError): boolean {
  return code === "ROOM_EXPIRED" || code === "ROOM_NOT_FOUND" || code === "UNAUTHORIZED";
}

export function useLobby({ code, playerId, playerToken }: PlayerSession) {
  const socketRef = useRef<LobbySocket | null>(null);
  const nextId = useRef(0);
  const retryGuess = useRef<GuessSubmitRequest | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "disconnected" | "unavailable">("connecting");
  const [room, setRoom] = useState<RoomStateEvent | null>(null);
  const [ownRound, setOwnRound] = useState<OwnRoundState | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultEvent | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [readyPending, setReadyPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const socket: LobbySocket = io({ autoConnect: false });
    socketRef.current = socket;
    let clockSync: ReturnType<typeof setInterval> | undefined;
    const current = (connectionId: string) => socketRef.current === socket && socket.id === connectionId;

    function stop(message: string, unavailable = false) {
      socket.disconnect();
      setConnection(unavailable ? "unavailable" : "disconnected");
      setError(message);
    }

    function syncRoom(connectionId: string, initial = false) {
      const sentAt = performance.now();
      // Apply snapshots in packet order, before newer broadcasts in the same polling response.
      socket.timeout(ACK_TIMEOUT).emit("room:sync", { requestId: `${connectionId}:sync` }, (error, sync) => {
        if (!current(connectionId)) return;
        if (error) {
          if (initial) stop("Could not connect to the room. Try reconnecting.");
          return;
        }
        if (!sync.ok) return stop(sync.error.message, roomUnavailable(sync.error));

        setClockOffset(sync.serverNow - (sentAt + performance.now()) / 2);
        setRoom(sync.state);
        setOwnRound(sync.ownRound);
        setRoundResult(sync.roundResult);
        if (initial) {
          setError("");
          setConnection("connected");
          clockSync = setInterval(() => {
            if (current(connectionId)) syncRoom(connectionId);
          }, CLOCK_SYNC_MS);
        }
      });
    }

    socket.on("room:state", setRoom);
    socket.on("round:start", ({ round, clue, roundStartedAt, roundEndsAt }) => {
      setRoundResult(null);
      setOwnRound({ round, clues: [clue], guesses: [], finished: false, roundStartedAt, roundEndsAt });
    });
    socket.on("round:result", setRoundResult);
    socket.on("opponent:status", (status) => {
      setRoom((room) => room && ({
        ...room,
        players: room.players.map((player) => player.playerId === playerId ? player : { ...player, ...status }),
      }));
    });
    socket.on("room:error", ({ message }) => setError(message));
    socket.on("connect_error", () => setConnection("reconnecting"));
    socket.on("disconnect", () => {
      clearInterval(clockSync);
      setConnection(socket.active ? "reconnecting" : "disconnected");
      setReadyPending(false);
    });

    socket.on("connect", async () => {
      const connectionId = socket.id!;
      try {
        const attach = await socket.timeout(ACK_TIMEOUT).emitWithAck("room:attach", { code, playerToken });
        if (!current(connectionId)) return;
        if (!attach.ok) return stop(attach.error.message, roomUnavailable(attach.error));
        syncRoom(connectionId, true);
      } catch {
        if (current(connectionId)) stop("Could not connect to the room. Try reconnecting.");
      }
    });

    socket.connect();
    return () => {
      clearInterval(clockSync);
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [attempt, code, playerId, playerToken]);

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

  async function submitGuess(date: string): Promise<string | null> {
    const socket = socketRef.current;
    if (!socket?.connected || connection !== "connected") return "Reconnect before guessing.";
    if (!ownRound || room?.phase !== "playing" || ownRound.round !== room.round || ownRound.finished) {
      return "This round has ended.";
    }

    const connectionId = socket.id;
    const previous = retryGuess.current?.round === ownRound.round ? retryGuess.current : null;
    if (previous && previous.date !== date && !ownRound.guesses.some((guess) => guess.date === previous.date)) {
      return `Retry the unconfirmed date (${previous.date}) before entering a new one.`;
    }
    const request = previous?.date === date
      ? previous
      : { round: ownRound.round, date, requestId: `${connectionId}:${++nextId.current}` };
    retryGuess.current = request;

    try {
      const ack: GuessSubmitAck = await socket.timeout(ACK_TIMEOUT).emitWithAck("guess:submit", request);
      if (socketRef.current !== socket || socket.id !== connectionId) return "Connection changed. Check your guess history.";
      retryGuess.current = null;
      if (!ack.ok) {
        if (roomUnavailable(ack.error)) {
          socket.disconnect();
          setConnection("unavailable");
        }
        return guessErrors[ack.error.code] ?? ack.error.message;
      }
      const { temperature, direction, finished, newClue } = ack;
      setOwnRound((round) => {
        if (round?.round !== request.round || round.guesses.some((guess) => guess.date === date)) return round;
        return {
          ...round, finished,
          guesses: [...round.guesses, { date, temperature, direction }],
          clues: newClue === undefined ? round.clues : [...round.clues, newClue],
        };
      });
      return null;
    } catch {
      return "Could not confirm your guess. Retry the same date or check your history.";
    }
  }

  function reconnect() {
    setError("");
    setConnection("connecting");
    setAttempt((value) => value + 1);
  }

  return { room, ownRound, roundResult, clockOffset, connection, readyPending, error, setReady, submitGuess, reconnect };
}
