export const DUEL_ERROR_CODES = [
  "INVALID_REQUEST",
  "INVALID_NICKNAME",
  "ROOM_NOT_FOUND",
  "ROOM_FULL",
  "ROOM_EXPIRED",
  "UNAUTHORIZED",
  "ROOM_STATE_CONFLICT",
  "PLAYER_NOT_ATTACHED",
  "ROUND_NOT_ACTIVE",
  "ROUND_MISMATCH",
  "ROUND_EXPIRED",
  "INVALID_DATE",
  "DUPLICATE_GUESS",
  "GUESS_LIMIT_REACHED",
  "ALREADY_FINISHED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type DuelErrorCode = (typeof DUEL_ERROR_CODES)[number];

export interface DuelError {
  code: DuelErrorCode;
  message: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: DuelError;
}

export type ActionAck<T extends object = Record<string, never>> =
  | ({ ok: true; requestId: string } & T)
  // Malformed requests may not contain a valid requestId to echo.
  | { ok: false; requestId?: string; error: DuelError };
