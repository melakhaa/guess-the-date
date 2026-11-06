import type { ActionAck, DuelError } from "./errors.js";

export type Temperature =
  | "correct"
  | "burning"
  | "hot"
  | "warm"
  | "cool"
  | "freezing";

export type GuessDirection = "earlier" | "later" | "exact";
export type RoomPhase =
  | "waiting"
  | "countdown"
  | "playing"
  | "roundResults"
  | "matchResults"
  | "cancelled";

export interface SourceLink {
  label: string;
  url: string;
}

export interface PlayerSession {
  code: string;
  playerId: string;
  playerToken: string;
}

export interface CreateRoomRequest {
  nickname: string;
}

export type CreateRoomResponse = PlayerSession;

export interface JoinRoomRequest {
  nickname: string;
}

export type JoinRoomResponse = PlayerSession;

export interface LobbyMetadata {
  code: string;
  phase: "waiting" | "countdown";
  playerCount: number;
  capacity: number;
}

export interface GetRoomResponse {
  room: LobbyMetadata;
}

export interface PublicPlayerState {
  playerId: string;
  nickname: string;
  connected: boolean;
  ready: boolean;
  finished: boolean;
  totalPoints: number;
}

export interface RoomStateEvent {
  code: string;
  phase: RoomPhase;
  players: PublicPlayerState[];
  round: number | null;
  roundsTotal: number;
}

export interface RoomAttachRequest {
  code: string;
  playerToken: string;
}

export type RoomAttachAck =
  | {
      ok: true;
      playerId: string;
      state: RoomStateEvent;
      serverNow: number;
    }
  | { ok: false; error: DuelError };

export interface PlayerReadyRequest {
  ready: boolean;
  requestId: string;
}

export type PlayerReadyAck = ActionAck<{ ready: boolean }>;

export interface GuessSubmitRequest {
  round: number;
  date: string;
  requestId: string;
}

export interface GuessSubmitSuccess {
  temperature: Temperature;
  direction: GuessDirection;
  guessesUsed: number;
  solved: boolean;
  finished: boolean;
  newClue?: string;
}

export type GuessSubmitAck = ActionAck<GuessSubmitSuccess>;

export interface RoomSyncRequest {
  requestId: string;
}

export interface OwnGuessFeedback {
  date: string;
  temperature: Temperature;
  direction: GuessDirection;
}

export interface OwnRoundState {
  round: number;
  clues: string[];
  guesses: OwnGuessFeedback[];
  finished: boolean;
  roundStartedAt: number;
  roundEndsAt: number;
}

export type RoomSyncAck = ActionAck<{
  state: RoomStateEvent;
  ownRound: OwnRoundState | null;
  serverNow: number;
}>;

export interface PlayerRematchRequest {
  requestId: string;
}

export type PlayerRematchAck = ActionAck<PlayerSession>;

export interface MatchCountdownEvent {
  startsAt: number;
  serverNow: number;
}

export interface RoundStartEvent {
  round: number;
  roundsTotal: number;
  clue: string;
  roundStartedAt: number;
  roundEndsAt: number;
  serverNow: number;
}

export interface OpponentStatusEvent {
  connected: boolean;
  finished: boolean;
}

export interface RevealedEvent {
  id: string;
  title: string;
  date: string;
  explanation: string;
  sources: SourceLink[];
}

export interface RoundPlayerResult {
  playerId: string;
  nickname: string;
  bestGuess: string | null;
  errorDays: number | null;
  points: number;
  totalPoints: number;
  solved: boolean;
}

export interface RoundResultEvent {
  round: number;
  event: RevealedEvent;
  players: RoundPlayerResult[];
  nextRoundStartsAt: number | null;
}

export interface MatchRoundSummary {
  round: number;
  points: number;
  errorDays: number | null;
  solved: boolean;
}

export interface MatchPlayerResult {
  playerId: string;
  nickname: string;
  totalPoints: number;
  exactSolves: number;
  totalErrorDays: number;
  rounds: MatchRoundSummary[];
}

export interface MatchResultEvent {
  winnerPlayerId: string | null;
  players: MatchPlayerResult[];
  shareText: string;
}

export interface RoomErrorEvent extends DuelError {
  requestId?: string;
}

export interface ClientToServerPayloads {
  "room:attach": RoomAttachRequest;
  "player:ready": PlayerReadyRequest;
  "guess:submit": GuessSubmitRequest;
  "room:sync": RoomSyncRequest;
  "player:rematch": PlayerRematchRequest;
}

export interface ServerToClientPayloads {
  "room:state": RoomStateEvent;
  "match:countdown": MatchCountdownEvent;
  "round:start": RoundStartEvent;
  "guess:result": GuessSubmitSuccess;
  "opponent:status": OpponentStatusEvent;
  "round:result": RoundResultEvent;
  "match:result": MatchResultEvent;
  "room:error": RoomErrorEvent;
}
