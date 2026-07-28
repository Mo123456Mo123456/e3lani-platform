import "./load-env.js";
import mysql from "mysql2/promise";

const desired = {
  imageMaxBytes: 5 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoMimeTypes: ["video/mp4"],
  requirePrimaryImage: true,
};

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is unavailable");

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();
  const [rows] = await connection.execute(
    "SELECT value FROM app_settings WHERE settingKey = ? FOR UPDATE",
    ["media.policy"],
  );
  const row = rows[0];
  const previous = row?.value && typeof row.value === "object"
    ? row.value
    : row?.value
      ? JSON.parse(row.value)
      : {};
  const next = { ...previous, ...desired };

  if (row) {
    await connection.execute(
      "UPDATE app_settings SET value = ?, isPublic = 1, updatedAt = CURRENT_TIMESTAMP(3) WHERE settingKey = ?",
      [JSON.stringify(next), "media.policy"],
    );
  } else {
    await connection.execute(
      "INSERT INTO app_settings (settingKey, value, isPublic) VALUES (?, ?, 1)",
      ["media.policy", JSON.stringify(next)],
    );
  }
  await connection.commit();
  console.log(JSON.stringify({ ok: true, settingKey: "media.policy", previous, next }, null, 2));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.destroy();
}
