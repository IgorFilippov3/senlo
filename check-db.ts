import { db } from "./packages/db/src/client";
import { sql } from "drizzle-orm";

async function checkSchema() {
  try {
    const result = await db.execute(sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('workflows', 'workflow_nodes', 'workflow_edges')
      ORDER BY table_name, ordinal_position;
    `);
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error("Error checking schema:", error);
  } finally {
    process.exit(0);
  }
}

checkSchema();
