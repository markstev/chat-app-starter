import { z } from "zod";
import { router, userProcedure } from "../../server/trpc";
import { observable } from "@trpc/server/observable";
import {
  createSession,
  listSessions,
  getMessages,
  deleteMessage,
  deleteSession,
  addUserMessage,
  streamUserMessageById,
} from "./chat.service";

export const chatRouter = router({
  createSession: userProcedure
    .input(
      z.object({
        name: z.string().min(1),
      })
    )
    .mutation(async (opts) => {
      return createSession(opts.ctx.userId, opts.input.name);
    }),

  listSessions: userProcedure.query(async (opts) => {
    return listSessions(opts.ctx.userId);
  }),

  getMessages: userProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async (opts) => {
      return getMessages(opts.ctx.userId, opts.input.sessionId);
    }),

  deleteMessage: userProcedure
    .input(
      z.object({
        messageIds: z.array(z.string()),
      })
    )
    .mutation(async (opts) => {
      return deleteMessage(opts.ctx.userId, opts.input.messageIds);
    }),

  deleteSession: userProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(async (opts) => {
      return deleteSession(opts.ctx.userId, opts.input.sessionId);
    }),

  addUserMessage: userProcedure
    .input(
      z.object({
        sessionId: z.string(),
        content: z.string().min(1),
        structuredContent: z.unknown().optional(),
        widgetId: z.string().optional(),
        role: z.enum(["user", "system", "assistant"]),
      })
    )
    .mutation(async (opts) => {
      return addUserMessage(
        opts.ctx.userId,
        opts.input.sessionId,
        opts.input.content,
        opts.input.role,
        opts.input.structuredContent,
        opts.input.widgetId
      );
    }),

  streamMessage: userProcedure
    .input(
      z.object({
        messageId: z.string(),
      })
    )
    .subscription(async (opts) => {
      return observable<{
        type: "content" | "tool_call" | "tool_result" | "done" | "metadata";
        content?: string;
        toolCalls?: Array<{
          id: string;
          name: string;
          arguments: string;
        }>;
        metadata?: {
          _meta?: Record<string, unknown>;
          structuredContent?: Record<string, unknown>;
          widgetId?: string;
        };
        assistantMessageId?: string;
      }>((emit) => {
        // Convert async generator to observable
        const stream = streamUserMessageById(
          opts.ctx.userId,
          opts.input.messageId
        );

        // Process the stream
        (async () => {
          try {
            for await (const chunk of stream) {
              emit.next(chunk);
            }
          } catch (error) {
            emit.error(
              error instanceof Error
                ? error
                : new Error("Unknown error during streaming")
            );
          }
        })();

        // Cleanup function
        return () => {
          // Stream cleanup is handled automatically when the generator completes
        };
      });
    }),
});
