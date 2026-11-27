import type { ApiErrorResponse, CreateRoomRequest, JoinRoomRequest, PlayerSession } from "@guess-the-date/shared";

const ROOM_CODE = /^[A-Za-z0-9_-]{16}$/;
const SESSION_KEY = "duel.session.v1";
const REQUEST_FAILED = "Could not confirm the room request. Check your connection before trying again.";

function isSession(value: unknown): value is PlayerSession {
  return typeof value === "object" && value !== null
    && "code" in value && typeof value.code === "string" && ROOM_CODE.test(value.code)
    && "playerId" in value && typeof value.playerId === "string" && value.playerId.length > 0
    && "playerToken" in value && typeof value.playerToken === "string" && /^[A-Za-z0-9_-]{43}$/.test(value.playerToken);
}

export function readSession(inviteCode: string | null): PlayerSession | null {
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (isSession(stored) && (inviteCode === null || stored.code === inviteCode)) return stored;
  } catch {
    // Storage can be blocked or unreadable; joining still works in memory.
  }
  return null;
}

export function saveSession(session: PlayerSession | null): void {
  try {
    if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage is optional for the live connection.
  }
}

export function inviteUrl(origin: string, code: string): string {
  const url = new URL("/", origin);
  url.searchParams.set("code", code);
  return url.href;
}

export async function enterRoom(nickname: string, code?: string): Promise<PlayerSession> {
  if (code !== undefined && !ROOM_CODE.test(code)) {
    throw new Error("Enter the 16-character room code from your invitation.");
  }
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(code === undefined ? "/api/rooms" : `/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname } satisfies CreateRoomRequest | JoinRoomRequest),
      signal: AbortSignal.timeout(10_000),
    });
    body = await response.json();
  } catch {
    throw new Error(REQUEST_FAILED);
  }
  if (response.ok && isSession(body) && (code === undefined || body.code === code)) return body;
  if (!response.ok) {
    const failure = body as Partial<ApiErrorResponse> | null;
    if (failure?.ok === false && typeof failure.error?.message === "string") {
      throw new Error(failure.error.code === "ROOM_NOT_FOUND"
        ? "That room was not found or has expired. Ask your friend for a new invite."
        : failure.error.message);
    }
  }
  throw new Error(REQUEST_FAILED);
}
