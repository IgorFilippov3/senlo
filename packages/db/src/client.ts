import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Load environment variables if not already set (e.g., when running scripts locally)
if (!process.env.DATABASE_URL) {
  const envPaths = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "apps/web/.env"),
    path.join(process.cwd(), "../../.env"),
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || "").trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
          }
          process.env[key] = value;
        }
      });
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Database connection may fail.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
