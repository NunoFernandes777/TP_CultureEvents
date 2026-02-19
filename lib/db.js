import mysql from "mysql2/promise";

const MYSQL_CONFIG = {
  host: "127.0.0.1",
  user: "root",
  password: "",
  database: "cultural_events",
  port: 3306,
};

const globalForDb = globalThis;

export const db =
  globalForDb.db ??
  mysql.createPool({
    ...MYSQL_CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
