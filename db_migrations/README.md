# Database Migrations

## Running Migrations

To apply migrations to your PostgreSQL database, run them in order:

### Initial Setup

```bash
psql -d your_database_name -f db_migrations/migration.sql
```

### Add User ID and RLS

```bash
psql -d your_database_name -f db_migrations/add_user_id_and_rls.sql
```

Or using environment variable:

```bash
psql $DATABASE_URL -f db_migrations/add_user_id_and_rls.sql
```

## What Changed

### Schema Updates

- Added `user_id` column to `standup` table
- Added `user_id` column to `todos` table
- All existing records are set to `user_33bRx1aSmte4xDBFxxMjwr7Jq6p`

### Row Level Security (RLS)

- Enabled RLS on both `standup` and `todos` tables
- Created policies for SELECT, INSERT, UPDATE, and DELETE operations
- Users can only access their own data

### Application Layer Security

The tRPC router has been updated to:

- Filter all queries by `user_id` from the authenticated user context
- Automatically set `user_id` when creating new standups and todos
- Prevent users from modifying other users' data

### Notes

- RLS policies use `current_setting('app.current_user_id', TRUE)` for user context
- Application-level filtering in tRPC provides primary security
- Database-level RLS provides defense in depth
- All changes are backward compatible with existing data
