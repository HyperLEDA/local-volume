/** @type {import("schemalint").Config } */
module.exports = {
  connection: {
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 6433),
    user: process.env.PGUSER ?? "lv",
    password: process.env.PGPASSWORD ?? "password",
    database: process.env.PGDATABASE ?? "lv",
  },
  schemas: [{ name: "lv" }, { name: "public" }],
  rules: {
    "name-casing": ["error", "snake"],
    "prefer-text-to-varchar": ["error"],
  },
  ignores: [
    { identifierPattern: "public\\.schema_version.*", rulePattern: ".*" },
  ],
};
