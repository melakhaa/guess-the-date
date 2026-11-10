import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.useRealTimers();
});

function appForTest() {
  const app = buildApp();
  apps.push(app);
  return app;
}

describe("room HTTP API", () => {
  it("does not reveal internal exception details", async () => {
    const app = appForTest();
    app.get("/test-error", () => { throw new Error("private-token-material"); });
    const response = await app.inject("/test-error");
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ ok: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
    expect(response.body).not.toContain("private-token-material");
  });

  it("rejects extra join fields without consuming the guest slot", async () => {
    const app = appForTest();
    const host = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Host" } })).json();
    const response = await app.inject({
      method: "POST", url: `/api/rooms/${host.code}/join`, payload: { nickname: "Guest", playerToken: "forged" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_REQUEST");
    expect((await app.inject(`/api/rooms/${host.code}`)).json().room.playerCount).toBe(1);
  });

  it("returns structured errors for unsupported content types and unknown routes", async () => {
    const app = appForTest();
    const unsupported = await app.inject({ method: "POST", url: "/api/rooms", headers: { "content-type": "application/xml" }, payload: "<name>Ada</name>" });
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.json().error.code).toBe("INVALID_REQUEST");
    const missing = await app.inject("/missing");
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("INVALID_REQUEST");
  });

  it("reports health without exposing application state", async () => {
    const response = await appForTest().inject("/health");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it.each(["GET", "POST"] as const)("rejects missing rooms via %s", async (method) => {
    const response = await appForTest().inject({
      method, url: `/api/rooms/abcdefghijklmnop${method === "POST" ? "/join" : ""}`,
      ...(method === "POST" ? { payload: { nickname: "Guest" } } : {}),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("ROOM_NOT_FOUND");
  });

  it.each(["GET", "POST"] as const)("expires an idle lobby at 30 minutes via %s", async (method) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const app = appForTest();
    const host = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Host" } })).json();
    vi.setSystemTime(new Date("2026-01-01T00:29:59.999Z"));
    expect((await app.inject(`/api/rooms/${host.code}`)).statusCode).toBe(200);
    vi.setSystemTime(new Date("2026-01-01T00:30:00Z"));
    const expired = await app.inject({
      method, url: `/api/rooms/${host.code}${method === "POST" ? "/join" : ""}`,
      ...(method === "POST" ? { payload: { nickname: "Guest" } } : {}),
    });
    expect(expired.statusCode).toBe(410);
    expect(expired.json().error.code).toBe("ROOM_EXPIRED");
    expect((await app.inject(`/api/rooms/${host.code}`)).statusCode).toBe(404);
  });

  it("accepts only one of two simultaneous guest joins", async () => {
    const app = appForTest();
    const host = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Host" } })).json();
    const replies = await Promise.all(["Guest A", "Guest B"].map((nickname) =>
      app.inject({ method: "POST", url: `/api/rooms/${host.code}/join`, payload: { nickname } }),
    ));
    expect(replies.map((reply) => reply.statusCode).sort()).toEqual([201, 409]);
  });

  it.each([null, {}, { nickname: 42 }, { nickname: "Ada", score: 5000 }])(
    "rejects malformed request bodies: %j", async (payload) => {
      const app = appForTest();
      const response = await app.inject({
        method: "POST", url: "/api/rooms", headers: { "content-type": "application/json" },
        payload: JSON.stringify(payload),
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INVALID_REQUEST");
    },
  );

  it.each(["", "   ", "a".repeat(25), "<script>alert(1)</script>", "A\u0000B", "A\u202eB"])(
    "rejects invalid nicknames: %j", async (nickname) => {
      const app = appForTest();
      const response = await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname } });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INVALID_NICKNAME");
    },
  );

  it("returns structured errors for malformed JSON, oversized bodies, and invalid codes", async () => {
    const app = appForTest();
    for (const [payload, status] of [["{", 400], [JSON.stringify({ nickname: "a".repeat(2000) }), 413]] as const) {
      const response = await app.inject({ method: "POST", url: "/api/rooms", headers: { "content-type": "application/json" }, payload });
      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({ ok: false, error: { code: "INVALID_REQUEST", message: expect.any(String) } });
    }
    const invalid = await app.inject("/api/rooms/bad-code");
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("INVALID_REQUEST");
  });

  it("allows one guest and rejects a third player without leaking credentials", async () => {
    const app = appForTest();
    const host = (await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Host" } })).json();
    const url = `/api/rooms/${host.code}/join`;
    const joined = await app.inject({ method: "POST", url, payload: { nickname: "Guest" } });
    expect(joined.statusCode).toBe(201);
    const guest = joined.json();
    expect(guest.code).toBe(host.code);
    expect(guest.playerId).not.toBe(host.playerId);
    expect(guest.playerToken).not.toBe(host.playerToken);
    expect(Object.keys(guest).sort()).toEqual(["code", "playerId", "playerToken"]);
    const full = await app.inject({ method: "POST", url, payload: { nickname: "Third" } });
    expect(full.statusCode).toBe(409);
    expect(full.json()).toEqual({ ok: false, error: { code: "ROOM_FULL", message: expect.any(String) } });
    const lobby = await app.inject(`/api/rooms/${host.code}`);
    expect(lobby.json().room.playerCount).toBe(2);
    for (const response of [joined, full, lobby]) {
      expect(response.body).not.toContain(host.playerToken);
      expect(response.body).not.toContain("tokenHash");
    }
  });

  it("creates a private room and exposes only safe lobby metadata", async () => {
    const app = appForTest();
    const created = await app.inject({ method: "POST", url: "/api/rooms", payload: { nickname: "Ada" } });
    expect(created.statusCode).toBe(201);
    const session = created.json();
    expect(session).toEqual({
      code: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
      playerId: expect.any(String),
      playerToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    const lobby = await app.inject({ method: "GET", url: `/api/rooms/${session.code}` });
    expect(lobby.statusCode).toBe(200);
    expect(lobby.json()).toEqual({
      room: { code: session.code, phase: "waiting", playerCount: 1, capacity: 2 },
    });
    expect(created.headers["cache-control"]).toBe("no-store");
    expect(lobby.headers["cache-control"]).toBe("no-store");
  });
});
