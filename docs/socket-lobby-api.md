# Socket lobby and round API (Stages 4–5)

Socket.IO is attached to the same HTTP server, at its default `/socket.io` path. Local default: `http://127.0.0.1:3001`. Both WebSocket and polling transports are enabled; automated integration tests currently exercise WebSocket transport.

The shared contract is `shared/src/protocol.ts`: `ClientToServerEvents` and `ServerToClientEvents` include payload and acknowledgment signatures usable by both Socket.IO client and server. The runtime implements lobby actions and one authoritative round. Five-round progression and rematch remain Stage 6 work.

## Connection and authentication

1. Create or join a room through the [HTTP API](room-http-api.md).
2. Connect a Socket.IO client. A transport connection alone grants no room access.
3. Emit `room:attach` with `{ code, playerToken }` and an acknowledgment callback.
4. After every reconnect, attach again, then call `room:sync`.

Tokens belong in the attach payload, never in URLs, query strings, or share text. A socket may attach to only one player. To switch players, disconnect and create a new socket. Reattaching the same player on the same socket is allowed. A new socket using that player's valid credential replaces/disconnects the old controller without resetting readiness or a pending countdown.

## Client actions

| Event | Payload | Success acknowledgment |
| --- | --- | --- |
| `room:attach` | `{ code, playerToken }` | `{ ok: true, playerId, state, serverNow }` |
| `player:ready` | `{ ready: boolean, requestId }` | `{ ok: true, requestId, ready }` |
| `room:sync` | `{ requestId }` | `{ ok: true, requestId, state, ownRound, roundResult, serverNow }` |
| `guess:submit` | `{ round, date, requestId }` | `{ ok: true, requestId, temperature, direction, guessesUsed, solved, finished, newClue? }` |

Every action requires an acknowledgment callback. Without one, the server emits `room:error` and does not mutate state. Payloads are strict: unknown fields, invalid types, missing IDs, and IDs outside 1–128 characters are rejected. Socket.IO inbound packets are limited to 1 KiB; packets over the transport limit can disconnect the client rather than receive an action acknowledgment.

For ready/sync errors the response is `{ ok: false, requestId?, error: { code, message } }`. A valid request ID is echoed; malformed requests may have no usable ID. Attach errors omit the request ID. Relevant codes include `INVALID_REQUEST`, `UNAUTHORIZED`, `PLAYER_NOT_ATTACHED`, `ROOM_STATE_CONFLICT`, `ROOM_NOT_FOUND`, and `ROOM_EXPIRED`. Internal exception details are not sent.

Readiness is lobby-only; once playing or showing results, even an old ready request returns `ROOM_STATE_CONFLICT`. In the lobby, readiness retries are deduplicated by player and request ID. The last 64 accepted readiness acknowledgments are retained across socket replacement/reconnect. Retrying a retained ID returns the original acknowledgment without changing current state, even if a newer action changed readiness. Use a new ID for every new choice; a cached acknowledgment is not a fresh snapshot. Older evicted IDs are treated as new actions. Read-only sync requests always return fresh state.

## State and broadcasts

Only authenticated sockets in that room receive its broadcasts. State is projected explicitly and never includes token hashes, socket IDs, private storage, or catalog data.

- `room:state`: public player IDs/nicknames, connected/ready flags, phase, round, total rounds, and `countdownStartsAt` (absolute Unix milliseconds or `null`). Lobby scores are zero, finished flags are false, and round is null.
- `match:countdown`: `{ startsAt, serverNow }`. Emitted once when both players are connected and ready; `startsAt` is exactly 3,000 ms after the scheduling server time.
- `round:start`: round 1, total rounds, clue 1, `roundStartedAt`, `roundEndsAt`, and `serverNow`. No event identity or answer.
- `opponent:status`: connected/finished only, emitted on presence or completion changes, not on each guess.
- `round:result`: revealed event and per-player best guesses, errors, points, totals, and solved flags. Emitted once when both finish or time expires.
- `room:error`: structured failure for an action without an acknowledgment callback.

Further ready-true actions do not extend or duplicate a pending countdown. Becoming unready or disconnecting cancels it, resets `countdownStartsAt` to null, and broadcasts the waiting state. A disconnected player's ready flag is cleared. After returning, that player must make a new ready action. Replacement by a new socket with the same credential is not treated as a disconnect for presence/readiness purposes.

Successful attachment and new readiness actions refresh the 30-minute idle timeout. Starting a round reserves at least 30 minutes beyond its deadline, so idle cleanup cannot remove an active round. Sync, metadata reads, cached retries, and invalid actions do not extend expiry.

## Authoritative round

The server randomly selects an event from its private validated catalog when the countdown completes. The scheduled countdown deadline becomes `roundStartedAt`; `roundEndsAt` is exactly 60,000 ms later, even if a timer callback runs late. Server timers start and resolve the round without requiring client traffic. Cancellation and shutdown clear timers.

Submit an integer round number (1–5), a strict ISO date in 1600–2099, and a fresh request ID. The current implementation plays only round 1. Up to six distinct valid dates are accepted per player. Wrong guesses privately unlock clues 2–5; exact guesses and the sixth guess mark the player finished. Feedback is acknowledgment-only: `guess:result` is reserved but not emitted. Exact error distances and the opponent's dates/clues are never returned during play.

Errors include `ROUND_NOT_ACTIVE`, `ROUND_MISMATCH`, `ROUND_EXPIRED`, `INVALID_DATE`, `DUPLICATE_GUESS`, `ALREADY_FINISHED`, and `GUESS_LIMIT_REACHED`. Rejected guesses consume no attempts. A new guess received at or after the deadline is rejected even if the timer callback has not run.

Guess retries are scoped to player + round + request ID. All accepted acknowledgments (at most six) survive through results. Domain rejections also replay their original acknowledgment, even if a retry changes the date. The cache holds at most 64 entries; oldest rejections are evicted first and may then be evaluated anew. Payload/authentication/phase/deadline errors are not cached. Use a fresh ID for each new action.

`room:sync` returns only that player's clues, accepted date/temperature/direction history, finished flag, and original deadlines in `ownRound` (null before play). `roundResult` is null until reveal, then contains the stored result for reconnect recovery without rebroadcasting it. Public snapshots include current round, finished flags, and awarded totals. HTTP metadata can now report `playing` and `roundResults`.

Disconnects do not pause, cancel, or extend an active round. Reattach with the same credential, then sync; controller replacement preserves progress. Disconnect forfeits are not yet implemented.

## Stage boundary and remaining work

Stage 5 stops at `roundResults` with `nextRoundStartsAt: null`. Stage 6 must select five distinct events per match, add eight-second result intervals, cumulative results, final winner/draw, and rematch. The browser remains a disconnected placeholder.

Stage 9 still owns disconnect forfeiture, periodic cleanup, connection/per-IP/guess rate limits, and production origin allowlisting. Neither the HTTP server nor these sockets are ready for public deployment yet. Tests use real local WebSocket clients, including one real 60-second timeout test; polling, browser flows, and deployed proxies remain unverified.
