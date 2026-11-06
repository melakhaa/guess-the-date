# Guess the Date Duel — Product Requirements Document

**Version:** 2.0 (MVP)  
**Status:** Ready for implementation  
**Architecture:** React + Vite + TypeScript / Node.js + Fastify + Socket.IO  
**Game mode:** Real-time 1v1, accuracy-based  
**Last updated:** 2026-11-05

## 1. Product summary

Guess the Date Duel is a mobile-friendly browser game in which two players simultaneously guess the exact calendar date of a mystery historical event. Both receive the same event, but independently unlock progressively clearer clues. Each round lasts 60 seconds. Players receive hot/cold and earlier/later feedback after each guess. Accuracy is the primary determinant of score.

### Goals
- Start a private 1v1 match using a shareable invite link, without registration.
- Deliver a fair, synchronized five-round match with server-authoritative scoring.
- Make the entire game playable on desktop and mobile.
- Keep the MVP deployable on a single small Node.js instance without a database.

### Non-goals for MVP
Public matchmaking, ranked ladders, ELO, global leaderboard, accounts, chat, spectators, AI-generated clues, payments, and more than two players per room.

## 2. Audience and primary user stories

- As a host, I can create a private room and invite a friend.
- As a guest, I can join a room and select a nickname.
- As either player, I can indicate readiness and start at the same synchronized time.
- As a player, I can submit valid dates and receive private temperature/direction feedback.
- As a player, I can reconnect after briefly losing connectivity without resetting the timer.
- As either player, I can see round results and a final winner based on verified scores.

## 3. Match rules

| Setting | MVP value |
|---|---|
| Match size | Exactly 2 players |
| Lobby | Private invite code/link |
| Rounds | 5 |
| Round duration | 60 seconds, server-controlled |
| Guesses | Up to 6 valid, distinct dates per round |
| Initial clue | Clue 1 visible at round start |
| Additional clues | One new clue per incorrect guess, maximum 5 total |
| Round start | 3-second synchronized countdown |
| Inter-round results | 8 seconds |
| Win condition | Highest cumulative score after round 5 |
| Opponent information during play | Connection/finished status only; no dates or private clues |

### 3.1 Match sequence
1. Host creates a room; server generates a non-guessable invite code and host session token.
2. Guest joins; server assigns a second session token. Each chooses a sanitized nickname.
3. Both mark ready. Server schedules a three-second countdown.
4. Server starts round 1 and broadcasts `roundStartedAt` and `roundEndsAt`.
5. Each player sees clue 1 and may submit up to six dates.
6. For each accepted guess, server privately returns temperature, direction, attempt number, and any newly unlocked clue.
7. An exact guess marks that player finished. Using all six guesses also marks them finished. A player may otherwise continue until the deadline.
8. When both finish or the deadline passes, server computes scores and reveals the event, correct date, best guess, and per-player points.
9. After eight seconds, server starts the next round. After round 5, show match results.

### 3.2 Date input and validation
- Accept ISO Gregorian dates in `YYYY-MM-DD` format (UI may use separate day/month/year fields).
- MVP event years are 1600–2099 inclusive. Accept guesses in the same range.
- Validate real dates, including leap years; do not rely on permissive `Date.parse`.
- Calculate absolute calendar-day differences using UTC day indices, never local timezone arithmetic.
- Reject invalid dates, duplicate guesses, expired rounds, and attempts over the limit. Rejections do not consume guesses.
- Dates must be submitted before the server deadline; client clocks cannot extend a round.

### 3.3 Temperature and direction

| Absolute difference | Feedback |
|---|---|
| 0 days | Correct |
| 1–7 days | Burning |
| 8–30 days | Hot |
| 31–365 days | Warm |
| 366–1,825 days | Cool |
| 1,826+ days | Freezing |

Direction is **Later** when the correct event date is after the guess, **Earlier** when before, and **Exact** on a match. Never reveal the exact distance during an active round.

### 3.4 Clue behavior
Each event has five ordered clues. Clue 1 is public at the beginning of the round. After the first through fourth incorrect guesses, reveal clues 2 through 5 to that player only. Subsequent guesses do not reveal additional clues. Correct guesses end the player's round immediately.

## 4. Scoring

For each player and round, let `d` be the smallest absolute calendar-day error among accepted guesses. If the player made no accepted guesses, award zero.

**Accuracy points:** `round(4500 × exp(-d / 365))`.

**Exact-solve bonus:** Only if `d = 0`, award `round(500 × (6 - g) / 5)`, where `g` is the index (1–6) of the exact guess.

**Round points:** Accuracy points + exact-solve bonus, capped at 5,000. An exact solve on guess 1 scores 5,000; on guess 6 scores 4,500. An unsolved player gets no bonus, even if close.

**Match points:** Sum of five round scores (maximum 25,000).

**Tiebreakers:** (1) more exact solves, (2) smaller sum of best absolute day errors, using a fixed penalty of 182,621 days (the maximum error between 1600-01-01 and 2099-12-31) for rounds with no valid guess, (3) draw. Time is not a tiebreaker.

> Product balancing note: These thresholds and formulas are initial values, to be tuned after playtesting. Keep scoring in a shared, versioned server module, but never trust scores submitted by clients.

## 5. Screens and UX

### Home
- Logo, concise how-to-play, nickname entry, **Create room**, and **Join room**.
- Mobile-first design, keyboard-accessible controls, readable contrast.

### Lobby
- Room code, copyable invite URL, two player slots, ready indicators.
- Host may start only when both players are connected and ready; countdown begins automatically when both ready.
- Clear states for waiting, disconnected, expired room, and full room.

### In-round
- Round number, 60-second countdown, mystery clues, date input, submit button.
- Guess history with temperature and earlier/later feedback.
- Opponent connected/finished status; no live opponent guess values.
- Countdown derives from server timestamps and periodically corrected server time offset.
- After exact solve or sixth guess, show a waiting state until round results.

### Round results
- Event title, verified date, brief explanation/source, both best guesses, day errors, points, and match totals.
- Eight-second next-round countdown.

### Final results
- Winner/draw, cumulative scores, five-round breakdown, rematch button (creates a new room), and shareable spoiler-free result text.

## 6. Recommended technology stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Small SPA and fast iteration |
| Styling | Tailwind CSS | Responsive UI |
| Backend runtime | Node.js LTS + TypeScript | Portable, familiar server runtime |
| HTTP framework | Fastify | Lightweight REST and health endpoints |
| Real-time transport | Socket.IO | Rooms, acknowledgments, reconnection support |
| Validation | Zod | Runtime validation of HTTP and socket payloads |
| Room state | In-memory `Map` | No database required for first release |
| Content | Server-side versioned JSON | Prevent accidental answer exposure |
| Testing | Vitest + Socket.IO integration tests | Game rules and protocol correctness |
| Hosting | Static frontend host + persistent Node.js host | WebSocket-capable deployment |

Use a **single Node.js process** for the MVP. Do not add Redis, Postgres, Docker orchestration, or microservices until operational requirements justify them. Hosting a continuously available Node.js WebSocket server may incur costs; free hosts may sleep or restrict long-lived connections.

## 7. Architecture

```text
Player A (React) ── Socket.IO ──┐
                                ├── Node.js + Fastify + Socket.IO
Player B (React) ── Socket.IO ──┘         │
                                          ├── RoomManager: Map<roomId, MatchRoom>
                                          ├── Game engine / scoring / validation
                                          ├── Server-only events.json
                                          └── Timer scheduler / cleanup

React SPA ── HTTP ──> GET /health, POST /rooms, POST /rooms/:code/join
```

The server is authoritative for event selection, answers, guess acceptance, clue progression, timers, and scoring. Socket.IO rooms are a transport/broadcast mechanism; they are **not** the sole source of game state.

### 7.1 State machine
`WAITING → COUNTDOWN → PLAYING → ROUND_RESULTS → (PLAYING next round | MATCH_RESULTS)`.

An optional `CANCELLED` state handles lobby expiry and abandoned matches. All transitions are server-owned and guarded by the current match state. Schedule transitions using absolute server deadlines; on timer callback, recompute current state from timestamps to handle event-loop delays.

### 7.2 Storage and limitations
- Active rooms, guest sessions, guesses, and scores live in a process-local `Map`.
- Restarting the server **loses active matches**. Document this clearly in the UI/operations notes.
- Expire idle lobbies after 30 minutes; completed rooms after 15 minutes; clear all scheduled timers and references on expiry.
- Limit rooms and connections per IP/session; periodically sweep stale state.
- Future upgrade path: Redis for multi-instance coordination and session state; SQLite/Postgres for persistent profiles and match history. Socket.IO Redis adapter alone does not persist game state.

## 8. HTTP API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Liveness/readiness status |
| POST | `/api/rooms` | Create private room; return room code and host credential |
| POST | `/api/rooms/:code/join` | Join room; return guest credential |
| GET | `/api/rooms/:code` | Public safe lobby metadata only |

Use HTTPS in production. Room codes are invitation identifiers, **not** authorization credentials. Return a cryptographically random, unguessable per-player session token through a secure transport; never put it in the shareable URL. Store only a token hash server-side when practical. Avoid logging tokens.

## 9. Socket.IO protocol

All client messages include a `requestId` when an acknowledgment or retry is expected. Validate every payload and return structured error codes. Prefer acknowledgment callbacks for client actions and server events for broadcasts.

### Client → server

| Event | Payload | Behavior |
|---|---|---|
| `room:attach` | `{code, playerToken}` | Authenticate socket and attach player to room |
| `player:ready` | `{ready, requestId}` | Set readiness in lobby |
| `guess:submit` | `{round, date, requestId}` | Validate and score a guess privately |
| `room:sync` | `{requestId}` | Return sanitized snapshot after reconnect |
| `player:rematch` | `{requestId}` | Request a new room/match after completion |

### Server → client

| Event | Description |
|---|---|
| `room:state` | Sanitized lobby and player presence |
| `match:countdown` | Countdown start and scheduled round start |
| `round:start` | Round number, clue 1, server timestamps |
| `guess:result` | Private temperature, direction, attempts, next clue |
| `opponent:status` | Opponent connected / finished |
| `round:result` | Revealed answer, points, both round summaries |
| `match:result` | Final scores, winner/draw |
| `room:error` | Structured error code and safe message |

**Example guess request:**

```json
{"round":2,"date":"1989-11-09","requestId":"guess-003"}
```

**Example private acknowledgment:**

```json
{"ok":true,"requestId":"guess-003","temperature":"correct","direction":"exact","guessesUsed":3,"solved":true}
```

For duplicate `requestId` retries, return the original acknowledgment without consuming another guess. Scope deduplication to player + round + requestId and bound its memory use. Do not broadcast private guess results to the opponent.

### 9.1 Reconnection
- Socket.IO automatic transport reconnection is enabled.
- After reconnection, reattach using the player token, then request a sanitized snapshot containing current state, own guesses/clues, scores, and server deadlines.
- The match timer continues while a player is disconnected; no reset or pause.
- Allow a 30-second disconnect grace period for **presence/forfeit handling**, but never extend a round past its deadline.
- For MVP, if a player remains disconnected for 30 seconds during an active match, mark them forfeited and award the win to the remaining player; if both disconnect, expire the room after its cleanup window. Define this behavior clearly in the UI.
- Prevent simultaneous active control by two sockets with the same player token; replace the previous connection on successful reattach.

## 10. Server-side event content

```json
{
  "id": "fall-of-berlin-wall",
  "title": "Fall of the Berlin Wall",
  "date": "1989-11-09",
  "category": "world-history",
  "difficulty": "medium",
  "clues": [
    "This event transformed European politics.",
    "It happened near the end of the Cold War.",
    "It involved a city divided for decades.",
    "Large crowds gathered at a barrier in Berlin.",
    "The Berlin Wall was opened."
  ],
  "sourceUrl": "https://www.britannica.com/topic/Berlin-Wall"
}
```

Content requirements:
- At least 50 manually reviewed, verifiably dated events before public launch.
- Five clues per event, from vague to specific, without leaking the exact date.
- Prefer a range of categories, regions, and decades; avoid ambiguous event dates.
- Choose five distinct events per match using server-side random selection, optionally balanced by difficulty.
- Never serve the full event JSON or correct dates before round reveal.

## 11. Security and fairness

- Use TLS (`https://` and `wss://`) in production and allowlist frontend origins in CORS/Socket.IO configuration.
- Validate every event payload with strict schemas and size limits.
- Authenticate each socket to a player session; authorize room and round membership before actions.
- Apply rate limits for room creation, joining, and guess submissions; cap simultaneous rooms and sockets.
- Never accept client-supplied scores, temperature values, event IDs, or deadline timestamps.
- Keep server-side event answers private until results; minimize response fields to avoid leakage.
- Use unpredictable invite codes and secure tokens; handle brute-force join attempts.
- Sanitize nicknames and display as text, not HTML; avoid storing unnecessary personal data.
- Keep server logs free of tokens and private answers while matches are active.
- Acknowledge that determined players can use outside sources to look up historical dates; perfect anti-cheat is outside MVP scope.

## 12. Testing and acceptance criteria

### Unit tests
- Date parsing, leap years, UTC day differences, date range boundaries.
- Temperature thresholds at 0, 1, 7, 8, 30, 31, 365, 366, 1825, 1826 days.
- Earlier/later/exact direction.
- Accuracy score, exact-solve bonus, best-guess selection, zero-guess score, and tiebreakers.
- Clue unlocking and six-guess enforcement.

### Integration tests
- Two clients can join one room; a third is rejected.
- Ready state produces one countdown and one round start.
- Both players receive identical event clue 1 and synchronized deadlines.
- Each player sees only their own private guesses and clues.
- Duplicate request IDs cannot consume extra attempts.
- Guesses at/after deadline are rejected.
- Results are computed once and match advances exactly five rounds.
- Disconnect/reconnect restores own state and does not reset timer.
- Abandoned room cleanup releases resources.
- A server restart during an active match results in a clear session-expired experience, not a stuck UI.

### MVP launch checklist
- [ ] Create and join private room via link
- [ ] Two-player readiness and synchronized countdown
- [ ] Five 60-second rounds
- [ ] Six valid guesses per round with temperature/direction
- [ ] Five progressive clues per event
- [ ] Server-authoritative scoring and results
- [ ] Mobile-friendly UI and keyboard-accessible input
- [ ] Reconnection and forfeiture handling
- [ ] 50 curated events with sources
- [ ] Rate limiting, safe session tokens, and cleanup
- [ ] Production WebSocket deployment verified

## 13. Development plan

**Phase 1 — Game engine (1–2 days):** Event schema, date validation, feedback, clue unlocking, scoring, unit tests.

**Phase 2 — Lobby and sockets (2–3 days):** Fastify, Socket.IO, room manager, create/join, guest sessions, readiness, countdown.

**Phase 3 — Match lifecycle (2–4 days):** Timers, guesses, private acknowledgments, scoreboards, round transitions, final results.

**Phase 4 — Reliability (2–3 days):** Reconnection, idempotency, forfeits, cleanup, rate limiting, integration tests.

**Phase 5 — UI/content/deployment (2–4 days):** Responsive polish, 50 events, production configuration, two-device tests.

These are rough estimates for a developer already familiar with React/TypeScript. Real-time edge cases may increase the timeline.

## 14. Repository layout

```text
guess-the-date/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/useSocket.ts
│   │   └── App.tsx
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/rooms.ts
│   │   ├── socket/handlers.ts
│   │   ├── game/RoomManager.ts
│   │   ├── game/MatchRoom.ts
│   │   ├── game/scoring.ts
│   │   ├── game/dates.ts
│   │   └── content/events.json
│   └── tsconfig.json
├── shared/
│   └── src/protocol.ts
├── package.json
└── README.md
```

Use npm workspaces or pnpm workspaces for shared types; choose one package manager and keep configuration minimal.

## 15. Deployment and operational notes

- Deploy the React build to a static host; deploy Node.js to a host supporting always-on HTTP and WebSocket connections.
- Configure `CLIENT_ORIGIN`, `PORT`, and any trusted proxy settings through environment variables.
- Use one backend instance initially because room state is process-local. Multi-instance deployments require shared state and a compatible Socket.IO adapter.
- Provide a `/health` endpoint, graceful shutdown behavior, and basic structured logs.
- Configure reverse proxy WebSocket upgrade and sensible idle timeouts; Socket.IO may fall back to HTTP long polling if enabled.
- A free-tier host is not guaranteed to support uninterrupted live matches; check sleep policies and resource limits before choosing it.
- Set operational expectations: matches are ephemeral and may be lost on process restart. Persistence is a post-MVP enhancement.

## 16. Success metrics

- At least 90% of created rooms with two joined players successfully begin a match.
- At least 95% of started rounds complete with valid server-side results under normal connectivity.
- Median end-to-end guess acknowledgment under 300 ms for players near the server region (target, not guarantee).
- At least 70% of started matches reach final results during closed beta.
- No duplicate scoring or answer leakage observed in automated tests.

## 17. Future roadmap

1. Daily asynchronous challenge using the same curated events.
2. Persistent match history and player accounts (SQLite/Postgres).
3. Public matchmaking, ratings, and friend lists.
4. Redis-backed multi-instance room state and Socket.IO scaling.
5. Seasonal leaderboards, tournaments, spectator mode, localization.

---

**MVP decision summary:** One Node.js server, Fastify, Socket.IO, in-memory rooms, server-only historical event JSON, and a React/Vite frontend. The game uses synchronized 60-second rounds and server-verified accuracy scoring. No external database is required to ship the first private-duel version.
