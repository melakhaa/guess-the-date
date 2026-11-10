import { z } from "zod";
import { buildApp } from "./app.js";

const port = z.coerce.number().int().min(1).max(65535).parse(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
const app = buildApp({ logger: true });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

await app.listen({ port, host });
