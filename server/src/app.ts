import Fastify from "fastify";
import { ZodError } from "zod";
import "./content/events.js";
import { RoomError, RoomManager } from "./rooms/RoomManager.js";
import { registerRoomRoutes } from "./routes/rooms.js";

export function buildApp({ logger = false } = {}) {
  const app = Fastify({ bodyLimit: 1024, logger });
  const rooms = new RoomManager();
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RoomError) {
      return reply.code(error.statusCode).send({ ok: false, error: { code: error.code, message: error.message } });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({ ok: false, error: { code: "INVALID_REQUEST", message: "Invalid request." } });
    }
    if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ ok: false, error: { code: "INVALID_REQUEST", message: "Invalid request." } });
    }
    _request.log.error({ name: error instanceof Error ? error.name : "UnknownError" }, "Unhandled request error");
    return reply.code(500).send({ ok: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ ok: false, error: { code: "INVALID_REQUEST", message: "Endpoint not found." } }),
  );
  app.get("/health", async () => ({ status: "ok" }));
  registerRoomRoutes(app, rooms);
  return app;
}
