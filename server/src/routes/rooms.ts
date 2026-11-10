import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CreateRoomResponse, GetRoomResponse, JoinRoomResponse } from "@guess-the-date/shared";
import type { RoomManager } from "../rooms/RoomManager.js";

const nicknameBody = z.strictObject({ nickname: z.string() });
const roomParams = z.strictObject({ code: z.string().regex(/^[A-Za-z0-9_-]{16}$/) });

export function registerRoomRoutes(app: FastifyInstance, rooms: RoomManager): void {
  app.post<{ Reply: CreateRoomResponse }>("/api/rooms", async (request, reply) => {
    const { nickname } = nicknameBody.parse(request.body);
    return reply.code(201).send(rooms.create(nickname));
  });

  app.post<{ Reply: JoinRoomResponse }>("/api/rooms/:code/join", async (request, reply) => {
    const { code } = roomParams.parse(request.params);
    const { nickname } = nicknameBody.parse(request.body);
    return reply.code(201).send(rooms.join(code, nickname));
  });

  app.get<{ Reply: GetRoomResponse }>("/api/rooms/:code", async (request) => {
    const { code } = roomParams.parse(request.params);
    return { room: rooms.metadata(code) };
  });
}
