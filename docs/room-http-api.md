# Room HTTP API (Stage 3)

The source of truth for DTO shapes is `shared/src/protocol.ts`; errors are defined in `shared/src/errors.ts`. Route behavior is covered by `server/src/routes/rooms.test.ts` using Fastify injection. The [Socket.IO lobby API](socket-lobby-api.md) provides authenticated attachment, readiness, and countdown broadcasts on the same server.

## Run locally

```sh
npm ci
npm run dev --workspace @guess-the-date/server
```

Default address: `http://127.0.0.1:3001`. `PORT` accepts an integer from 1 to 65535; `HOST` overrides the bind address. `npm run start --workspace @guess-the-date/server` runs without watch mode. These commands use `tsx`, so install dev dependencies too. The frontend still runs separately via `npm run dev` and is not connected yet.

This is a development server, not a production-ready deployment. Cross-origin frontend access, per-IP rate limits, disconnect forfeiture, and deployment hardening remain pending. Do not expose it publicly yet.

## Endpoints

All responses use `Cache-Control: no-store`. JSON request bodies are limited to 1 KiB. Create/join accept exactly `{ "nickname": "Ada" }`; unknown fields are rejected.

| Method | Path | Success | Response |
| --- | --- | --- | --- |
| GET | `/health` | 200 | `{ "status": "ok" }` |
| POST | `/api/rooms` | 201 | `PlayerSession` |
| POST | `/api/rooms/:code/join` | 201 | `PlayerSession` |
| GET | `/api/rooms/:code` | 200 | `GetRoomResponse` |

Example session shape (placeholder values, not usable credentials):

```json
{ "code": "abcdefghijklmnop", "playerId": "player-id", "playerToken": "private-session-token" }
```

Codes are case-sensitive, 16-character base64url invitation identifiers generated from 12 random bytes. They are not authentication credentials. Player IDs are UUIDs; tokens are generated from 32 random bytes and returned only to the corresponding create/join caller. Player authentication records keep SHA-256 token hashes. The socket rematch retry cache also retains one private credential response per original player; see the socket API for its lifetime and retry behavior. Do not place tokens in URLs, share text, or logs.

Public metadata deliberately excludes nicknames, player IDs, credentials, guesses, and events:

```json
{ "room": { "code": "abcdefghijklmnop", "phase": "waiting", "playerCount": 1, "capacity": 2 } }
```

Nicknames are Unicode NFKC-normalized, trimmed, and have whitespace runs collapsed. Normalized names must contain 1–24 Unicode code points. Markup delimiters (`<`, `>`), control characters, and format characters are rejected. Client UIs must still render names as text, not HTML.

Create and join are **not idempotent**: a successful join consumes the second player slot. Do not automatically retry these POST requests after an ambiguous network failure; HTTP request-ID retry semantics are not implemented. Socket action retry handling is documented in the socket API.

## Errors

```json
{ "ok": false, "error": { "code": "ROOM_FULL", "message": "This room already has two players." } }
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Invalid JSON, body shape, or room-code format |
| 400 | `INVALID_NICKNAME` | Nickname violates the rules above |
| 404 | `ROOM_NOT_FOUND` | No room exists for that code (including already-cleaned expired rooms) |
| 404 | `INVALID_REQUEST` | Unknown endpoint |
| 409 | `ROOM_FULL` | Two players have already joined |
| 410 | `ROOM_EXPIRED` | This request discovered an expired lobby; it has now been removed |
| 413 | `INVALID_REQUEST` | Request body exceeds 1 KiB |
| 415 | `INVALID_REQUEST` | Unsupported content type |
| 429 | `RATE_LIMITED` | The process has reached its 1,000-room capacity; retry later |
| 500 | `INTERNAL_ERROR` | Unexpected failure; internal exception details are not returned |

## Lifecycle and limitations

- A lobby expires 30 minutes after creation or its latest successful join, socket attachment, or new readiness action. Metadata/sync reads, cached retries, and rejected actions do not extend expiry.
- Metadata reports the current room phase, including `playing`, `roundResults`, and `matchResults`. Round start reserves expiry through at least 30 minutes after the round deadline; active play is never removed by the old lobby timeout.
- Expired rooms are removed on access and swept before room creation. A periodic sweep will be added with match/timer cleanup in Stage 9.
- Room state is process-local. Restarting the server loses every room and session.
- Two concurrent guest joins cannot both claim the last slot: lookup, capacity check, and insertion are synchronous with no intervening await.
- No answers or catalog routes exist. The catalog validates at application module load before the server listens.
