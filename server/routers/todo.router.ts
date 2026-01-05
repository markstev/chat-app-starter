import { z } from "zod";
import { procedure, router, userProcedure } from "../trpc";
import { db, posts, todos, standup, Standup, withUserContext } from "../db";
import { sql, eq, and, inArray, lt } from "drizzle-orm";
import { getTodayStandup, addTodo } from "../services/todo.service";
import { chatRouter } from "../../app/chat/chat.router";
import { voiceRouter } from "../../app/voice/voice.router";
import { observable } from "@trpc/server/observable";

export const appRouter = router({
  hello: procedure
    .input(
      z.object({
        text: z.string(),
      })
    )
    .query((opts) => {
      return {
        greeting: `Hello ${opts.input.text}!`,
        timestamp: new Date().toISOString(),
      };
    }),

  getUser: procedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query((opts) => {
      // Simulate a user lookup
      return {
        id: opts.input.id,
        name: `User ${opts.input.id}`,
        email: `user${opts.input.id}@example.com`,
        createdAt: new Date().toISOString(),
      };
    }),

  createPost: procedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        authorId: z.string(),
      })
    )
    .mutation(async (opts) => {
      // Create a post in the database
      const [post] = await db
        .insert(posts)
        .values({
          title: opts.input.title,
          content: opts.input.content,
          user_id: opts.input.authorId,
        })
        .returning();

      return {
        success: true,
        post,
      };
    }),

  getPosts: procedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async (opts) => {
      // Fetch posts from the database
      const fetchedPosts = await db
        .select()
        .from(posts)
        .limit(opts.input.limit)
        .offset(opts.input.offset)
        .orderBy(posts.created_at);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(posts);

      return {
        posts: fetchedPosts,
        total: count,
        hasMore: opts.input.offset + opts.input.limit < count,
      };
    }),

  // Todos and Standup procedures
  getTodayStandup: userProcedure
    .input(
      z.object({
        userId: z.string().optional(),
      })
    )
    .query(async (opts) => {
      return getTodayStandup(opts.ctx.userId);
    }),

  changeTodoStatus: userProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
      })
    )
    .mutation(async (opts) => {
      return withUserContext(opts.ctx.userId, async (tx) => {
        const [updatedTodo] = await tx
          .update(todos)
          .set({
            status: opts.input.status,
            updated_at: new Date(),
          })
          .where(
            and(eq(todos.id, opts.input.id), eq(todos.user_id, opts.ctx.userId))
          )
          .returning();

        return updatedTodo;
      });
    }),

  addTodo: userProcedure
    .input(
      z.object({
        text: z.string().min(1),
        standupId: z.string().optional(),
        parentTodoId: z.string().optional(),
      })
    )
    .mutation(async (opts) => {
      return addTodo(opts.ctx.userId, {
        text: [opts.input.text],
        standupId: opts.input.standupId,
        parentTodoId: opts.input.parentTodoId,
      });
    }),

  updateTodo: userProcedure
    .input(
      z.object({
        id: z.string(),
        text: z.string().min(1).optional(),
        parentTodoId: z.string().nullable().optional(),
      })
    )
    .mutation(async (opts) => {
      return withUserContext(opts.ctx.userId, async (tx) => {
        const updateData: {
          text?: string;
          parent_todo_id?: string | null;
          updated_at: Date;
        } = {
          updated_at: new Date(),
        };

        if (opts.input.text !== undefined) {
          updateData.text = opts.input.text;
        }

        if (opts.input.parentTodoId !== undefined) {
          updateData.parent_todo_id = opts.input.parentTodoId;
        }

        const [updatedTodo] = await tx
          .update(todos)
          .set(updateData)
          .where(
            and(eq(todos.id, opts.input.id), eq(todos.user_id, opts.ctx.userId))
          )
          .returning();

        return updatedTodo;
      });
    }),

  deleteTodo: userProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async (opts) => {
      return withUserContext(opts.ctx.userId, async (tx) => {
        await tx
          .delete(todos)
          .where(
            and(eq(todos.id, opts.input.id), eq(todos.user_id, opts.ctx.userId))
          );

        return { success: true };
      });
    }),

  // Chat procedures
  chat: chatRouter,

  // Voice procedures
  voice: voiceRouter,

  // SSE subscription example: counts +1 every 200ms
  countStream: procedure.subscription(() => {
    return observable<{ count: number; timestamp: string }>((emit) => {
      let count = 0;
      const interval = setInterval(() => {
        count += 1;
        emit.next({
          count,
          timestamp: new Date().toISOString(),
        });
      }, 200);

      // Cleanup function
      return () => {
        clearInterval(interval);
      };
    });
  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;
