import Fastify from "fastify";
import pg from "pg";

const app = Fastify({ logger: true });
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://planet:planet@localhost:5432/planet_world",
});

app.get("/health", async () => ({ ok: true, worker: "notification" }));

app.post("/v1/dispatch-pending", async () => {
  const { rows } = await pool.query(
    `SELECT id, user_id, title, body FROM notifications WHERE read = false ORDER BY created_at DESC LIMIT 50`,
  );
  return { pending: rows.length, items: rows };
});

const port = Number(process.env.PORT ?? 4104);
if (process.env.NODE_ENV !== "test") {
  setInterval(async () => {
    try {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM notifications WHERE read = false LIMIT 1`,
      );
      if (rowCount) app.log.info({ pending: rowCount }, "notification backlog");
    } catch (err) {
      app.log.error(err);
    }
  }, 30000);
  app.listen({ port, host: "0.0.0.0" });
}
