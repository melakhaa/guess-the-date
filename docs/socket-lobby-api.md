# Socket lobby API (Stage 4)

Socket.IO is attached to the same HTTP server, at its default `/socket.io` path. Local default: `http://127.0.0.1:3001`. Both WebSocket and polling transports are enabled; automated integration tests currently exercise WebSocket transport.

The shared contract is `shared/src/protocol.ts`: `ClientToServerEvents` and `ServerToClientEvents` include payload and acknowledgment signatures usable by both Socket.IO client and server. The runtime implements the three lobby actions below; guess submission and rematch remain future stages.

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
| `room:sync` | `{ requestId }` | `{ ok: true, requestId, state, ownRound: null, serverNow }` |

Every action requires an acknowledgment callback. Without one, the server emits `room:error` and does not mutate state. Payloads are strict: unknown fields, invalid types, missing IDs, and IDs outside 1–128 characters are rejected. Socket.IO inbound packets are limited to 1 KiB; packets over the transport limit can disconnect the client rather than receive an action acknowledgment.

For ready/sync errors the response is `{ ok: false, requestId?, error: { code, message } }`. A valid request ID is echoed; malformed requests may have no usable ID. Attach errors omit the request ID. Relevant codes include `INVALID_REQUEST`, `UNAUTHORIZED`, `PLAYER_NOT_ATTACHED`, `ROOM_STATE_CONFLICT`, `ROOM_NOT_FOUND`, and `ROOM_EXPIRED`. Internal exception details are not sent.

Readiness retries are deduplicated by player and request ID. The last 64 accepted readiness acknowledgments are retained across socket replacement/reconnect. Retrying a retained ID returns the original acknowledgment without changing current state, even if a newer action changed readiness. Use a new ID for every new choice; a cached acknowledgment is not a fresh snapshot. Older evicted IDs are treated as new actions. Read-only sync requests always return fresh state.

## State and broadcasts

Only authenticated sockets in that room receive its broadcasts. State is projected explicitly and never includes token hashes, socket IDs, private storage, or catalog data.

- `room:state`: public player IDs/nicknames, connected/ready flags, phase, round, total rounds, and `countdownStartsAt` (absolute Unix milliseconds or `null`). Lobby scores are zero, finished flags are false, and round is null.
- `match:countdown`: `{ startsAt, serverNow }`. Emitted once when both players are connected and ready; `startsAt` is exactly 3,000 ms after the scheduling server time.
- `room:error`: structured failure for an action without an acknowledgment callback.

Further ready-true actions do not extend or duplicate a pending countdown. Becoming unready or disconnecting cancels it, resets `countdownStartsAt` to null, and broadcasts the waiting state. A disconnected player's ready flag is cleared. After returning, that player must make a new ready action. Replacement by a new socket with the same credential is not treated as a disconnect for presence/readiness purposes.

Successful attachment and new readiness actions refresh the 30-minute lobby idle timeout. Sync, metadata reads, cached retries, and invalid actions do not.

## Stage boundary and remaining work

**Stage 4 publishes and stores the countdown deadline; it does not yet execute a round when that deadline arrives.** Until Stage 5, the room stays in countdown and `ownRound` remains null. Do not present this as a playable game.

Stage 5 must consume the deadline, introduce active-round state, guard readiness by phase, and change disconnect handling so it never resets or extends an active round. Stage 9 still owns disconnect forfeiture, periodic cleanup, connection/per-IP caps, and production origin allowlisting. Neither the HTTP server nor these sockets are ready for public deployment yet.
