import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is unavailable");
}

const regionCountryCodes = new Map([
  ["riyadh", "SA"],
  ["makkah", "SA"],
  ["eastern", "SA"],
  ["madinah", "SA"],
  ["qassim", "SA"],
  ["asir", "SA"],
  ["uae", "AE"],
  ["egypt", "EG"],
]);

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await connection.beginTransaction();

  const [countryRows] = await connection.query("SELECT id, code FROM countries WHERE isActive = 1");
  const countryIds = new Map(countryRows.map((row) => [String(row.code).toUpperCase(), Number(row.id)]));
  const [regionRows] = await connection.query("SELECT id, code FROM regions WHERE isActive = 1");

  let linkedCities = 0;
  for (const region of regionRows) {
    const countryCode = regionCountryCodes.get(String(region.code));
    if (!countryCode) continue;
    const countryId = countryIds.get(countryCode);
    if (!countryId) throw new Error(`Missing active country: ${countryCode}`);

    const [result] = await connection.execute(
      "UPDATE cities SET countryId = ? WHERE regionId = ? AND code NOT LIKE 'other%' AND (countryId IS NULL OR countryId <> ?)",
      [countryId, Number(region.id), countryId],
    );
    linkedCities += Number(result.affectedRows ?? 0);
  }

  // The old global `other` row predates country-specific cities. The API creates
  // `other-<country>` lazily, so keeping the legacy row active would show duplicates.
  await connection.execute("UPDATE cities SET isActive = 0 WHERE code = 'other' AND countryId IS NULL");

  const [unlinkedRows] = await connection.query(
    `SELECT c.code
       FROM cities c
       INNER JOIN regions r ON r.id = c.regionId
      WHERE c.isActive = 1
        AND c.countryId IS NULL
        AND c.code NOT LIKE 'other%'
        AND r.code <> 'international'`,
  );
  if (unlinkedRows.length) {
    throw new Error(`Unlinked active cities: ${unlinkedRows.map((row) => row.code).join(", ")}`);
  }

  await connection.commit();
  console.log(JSON.stringify({ ok: true, linkedCities, verified: true }, null, 2));
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
