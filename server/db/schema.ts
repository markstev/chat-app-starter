import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { unique } from "drizzle-orm/pg-core";

// Enum for todo status
export const todoStatusEnum = pgEnum("todo_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

// Enum for message role (ChatGPT API roles)
export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
]);

// Note: Removed learning-specific enums (sessionTypeEnum, microScoreEnum, visibilityEnum)

export const posts = pgTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  user_id: text("user_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export const standup = pgTable("standup", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(),
  date: timestamp("date", { withTimezone: false }).notNull(),
  created_at: timestamp("created_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export const todos = pgTable("todos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull(),
  text: text("text").notNull(),
  parent_todo_id: text("parent_todo_id"),
  status: todoStatusEnum("status").notNull().default("pending"),
  standup_id: text("standup_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export const devSession = pgTable("dev_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  user_id: text("user_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export const devMessage = pgTable("dev_message", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  content: text("content").notNull(),
  structured_content: jsonb("structured_content"),
  // Optional name of the widget to show in addition to the content.
  // structured_content will be passed to the widget.
  widget_id: text("widget_id"),
  role: messageRoleEnum("role").notNull(),
  session_id: text("session_id").notNull(),
  user_id: text("user_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Standup = typeof standup.$inferSelect;
export type NewStandup = typeof standup.$inferInsert;

export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

export type DevSession = typeof devSession.$inferSelect;
export type NewDevSession = typeof devSession.$inferInsert;

export type DevMessage = typeof devMessage.$inferSelect;
export type NewDevMessage = typeof devMessage.$inferInsert;

// Relations
export const todosRelations = relations(todos, ({ one, many }) => ({
  parent: one(todos, {
    fields: [todos.parent_todo_id],
    references: [todos.id],
    relationName: "parent-child",
  }),
  children: many(todos, {
    relationName: "parent-child",
  }),
  standup: one(standup, {
    fields: [todos.standup_id],
    references: [standup.id],
  }),
}));

export const devSessionRelations = relations(devSession, ({ many }) => ({
  messages: many(devMessage),
}));

export const devMessageRelations = relations(devMessage, ({ one }) => ({
  session: one(devSession, {
    fields: [devMessage.session_id],
    references: [devSession.id],
  }),
}));
