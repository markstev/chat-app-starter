import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

// Create the connection
const client = postgres(process.env.DATABASE_URL!);

// Create the drizzle instance
export const db = drizzle(client, { schema });

// Type for the transaction parameter
type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// Helper function to run queries with user context for RLS
// Uses SET LOCAL within a transaction to ensure proper cleanup
export async function withUserContext<T>(
  userId: string,
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // SET LOCAL doesn't support parameterized queries, so we use sql.raw
    // The userId should already be validated by the auth middleware
    await tx.execute(sql.raw(`SET LOCAL app.current_user_id = '${userId}'`));
    return callback(tx);
  });
}

// Export schema for convenience
export * from "./schema";
