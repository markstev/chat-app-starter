import { db, devSession, devMessage, withUserContext } from "../../server/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  getChatCompletion,
  streamChatCompletion,
  type ChatMessage,
  type StreamChunk,
} from "./llm.service";

/**
 * Create a new chat session for a user
 */
export async function createSession(
  userId: string,
  name: string
): Promise<typeof devSession.$inferSelect> {
  return withUserContext(userId, async (tx) => {
    const [session] = await tx
      .insert(devSession)
      .values({
        name,
        user_id: userId,
      })
      .returning();

    return session;
  });
}

/**
 * List all sessions for a user, ordered by most recently updated
 */
export async function listSessions(
  userId: string
): Promise<Array<typeof devSession.$inferSelect>> {
  return withUserContext(userId, async (tx) => {
    const sessions = await tx
      .select()
      .from(devSession)
      .where(eq(devSession.user_id, userId))
      .orderBy(desc(devSession.updated_at));

    return sessions;
  });
}

/**
 * Get all messages for a specific session
 */
export async function getMessages(
  userId: string,
  sessionId: string
): Promise<Array<typeof devMessage.$inferSelect>> {
  return withUserContext(userId, async (tx) => {
    // First verify the session belongs to the user
    const [session] = await tx
      .select()
      .from(devSession)
      .where(and(eq(devSession.id, sessionId), eq(devSession.user_id, userId)))
      .limit(1);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Get all messages for this session
    const messages = await tx
      .select()
      .from(devMessage)
      .where(
        and(
          eq(devMessage.session_id, sessionId),
          eq(devMessage.user_id, userId)
        )
      )
      .orderBy(devMessage.created_at);

    return messages;
  });
}

/**
 * Delete message(s) by ID(s)
 */
export async function deleteMessage(
  userId: string,
  messageIds: string[]
): Promise<{ success: boolean }> {
  return withUserContext(userId, async (tx) => {
    // Verify the messages belong to the user before deleting
    const deleted = await tx
      .delete(devMessage)
      .where(
        and(inArray(devMessage.id, messageIds), eq(devMessage.user_id, userId))
      );

    return { success: true };
  });
}

/**
 * Delete a session by ID (and all its messages)
 */
export async function deleteSession(
  userId: string,
  sessionId: string
): Promise<{ success: boolean }> {
  return withUserContext(userId, async (tx) => {
    // First verify the session belongs to the user
    const [session] = await tx
      .select()
      .from(devSession)
      .where(and(eq(devSession.id, sessionId), eq(devSession.user_id, userId)))
      .limit(1);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Delete all messages in the session first
    await tx
      .delete(devMessage)
      .where(
        and(
          eq(devMessage.session_id, sessionId),
          eq(devMessage.user_id, userId)
        )
      );

    // Delete the session
    await tx
      .delete(devSession)
      .where(and(eq(devSession.id, sessionId), eq(devSession.user_id, userId)));

    return { success: true };
  });
}

/**
 * Add a user message to a session and trigger an LLM response
 */
export async function addUserMessage(
  userId: string,
  sessionId: string,
  content: string,
  role: "user" | "system" | "assistant",
  structuredContent?: unknown,
  widgetId?: string
): Promise<typeof devMessage.$inferSelect> {
  console.log(
    "Adding user message:",
    content,
    role,
    structuredContent,
    widgetId
  );
  return withUserContext(userId, async (tx) => {
    // First verify the session belongs to the user
    const [session] = await tx
      .select()
      .from(devSession)
      .where(and(eq(devSession.id, sessionId), eq(devSession.user_id, userId)))
      .limit(1);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Create the user message
    const [userMessage] = await tx
      .insert(devMessage)
      .values({
        content,
        structured_content: structuredContent ? structuredContent : null,
        widget_id: widgetId || null,
        role: role,
        session_id: sessionId,
        user_id: userId,
      })
      .returning();

    // Update the session's updated_at timestamp
    await tx
      .update(devSession)
      .set({ updated_at: new Date() })
      .where(eq(devSession.id, sessionId));

    return userMessage;
  });
}

/**
 * Stream a chat response for a user message by message ID
 * This function reads the user message from the database, then streams the LLM response
 * @param userId - User ID
 * @param messageId - User message ID
 * @yields StreamChunk objects with content and metadata
 */
export async function* streamUserMessageById(
  userId: string,
  messageId: string
): AsyncGenerator<StreamChunk & { assistantMessageId?: string }> {
  // First, read the user message and get context
  const userMessage = await withUserContext(userId, async (tx) => {
    // Get the user message
    const [userMsg] = await tx
      .select()
      .from(devMessage)
      .where(and(eq(devMessage.id, messageId), eq(devMessage.user_id, userId)))
      .limit(1);

    if (!userMsg) {
      throw new Error(`User message with ID ${messageId} not found`);
    }

    const sessionId = userMsg.session_id;

    // Verify the session belongs to the user
    const [session] = await tx
      .select()
      .from(devSession)
      .where(and(eq(devSession.id, sessionId), eq(devSession.user_id, userId)))
      .limit(1);

    if (!session) {
      throw new Error(`Session with ID ${sessionId} not found`);
    }

    // Update the session's updated_at timestamp
    await tx
      .update(devSession)
      .set({ updated_at: new Date() })
      .where(eq(devSession.id, sessionId));

    // Get all previous messages for this session to build the conversation history
    const allPreviousMessages = await tx
      .select()
      .from(devMessage)
      .where(
        and(
          eq(devMessage.session_id, sessionId),
          eq(devMessage.user_id, userId)
        )
      )
      .orderBy(devMessage.created_at);

    let previousMessages: (typeof devMessage.$inferSelect)[] = [];
    allPreviousMessages.forEach((msg) => {
      if (msg.content.includes("-- IGNORE CONVERSATION BEFORE THIS LINE --")) {
        console.log("Ignoring conversation before this line:", msg.content);
        previousMessages = [];
      }
      previousMessages.push(msg);
    });

    return { userMsg, previousMessages, sessionId, session };
  });

  // Convert messages to OpenAI chat format
  const chatMessages: ChatMessage[] = userMessage.previousMessages.map(
    (msg) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    })
  );

  const sessionId = userMessage.sessionId;
  const structuredContent = userMessage.userMsg.structured_content;
  const widgetId = userMessage.userMsg.widget_id;

  // Stream the LLM response
  let accumulatedContent = "";
  let finalMeta: Record<string, unknown> | undefined;
  let finalStructuredContent: Record<string, unknown> | undefined;
  let finalWidgetId: string | undefined;

  try {
    for await (const chunk of streamChatCompletion(chatMessages, userId)) {
      // Forward the chunk
      yield chunk;

      // Accumulate content
      if (chunk.type === "content" && chunk.content) {
        accumulatedContent += chunk.content;
      }

      // Store metadata
      if (chunk.type === "metadata" && chunk.metadata) {
        finalMeta = chunk.metadata._meta;
        finalStructuredContent = chunk.metadata.structuredContent;
        finalWidgetId = chunk.metadata.widgetId;
      }

      // When done, save the assistant message
      if (chunk.type === "done") {
        // Save the assistant message to the database
        const assistantMessage = await withUserContext(userId, async (tx) => {
          const combinedStructuredContent =
            finalStructuredContent || finalMeta
              ? {
                  ...(finalStructuredContent || {}),
                  ...(finalMeta ? { _meta: finalMeta } : {}),
                }
              : null;

          console.log("Stream saving accumulatedContent:", accumulatedContent);
          const [assistantMsg] = await tx
            .insert(devMessage)
            .values({
              content: accumulatedContent,
              structured_content: combinedStructuredContent,
              widget_id: finalWidgetId || null,
              role: "assistant",
              session_id: sessionId,
              user_id: userId,
            })
            .returning();

          // Update the session's updated_at timestamp
          await tx
            .update(devSession)
            .set({ updated_at: new Date() })
            .where(eq(devSession.id, sessionId));

          return assistantMsg;
        });

        // Check if we now have 4 messages total and generate a session name if needed
        // previousMessages.length includes the current user message + all previous messages
        // After saving assistant: total = previousMessages.length + 1 (assistant)
        // For 4 total: previousMessages.length === 3
        if (
          userMessage.previousMessages.length === 3 &&
          userMessage.session.name === "New conversation"
        ) {
          try {
            // Build conversation summary for name generation (previousMessages already includes current user message)
            const conversationSummary = [
              ...userMessage.previousMessages,
              {
                role: "assistant" as const,
                content: accumulatedContent,
              },
            ];

            // Call OpenAI to generate a short name
            const nameResult = await getChatCompletion(
              [
                {
                  role: "system",
                  content:
                    "Based on the following conversation, generate a short, descriptive name (3-5 words max) for this chat session. Return only the name, nothing else.",
                },
                ...conversationSummary.map((msg) => ({
                  role: msg.role as "user" | "assistant" | "system",
                  content: msg.content,
                })),
              ],
              userId
            );

            const generatedName = nameResult.content.trim();

            // Update the session name
            if (generatedName) {
              await withUserContext(userId, async (tx) => {
                await tx
                  .update(devSession)
                  .set({ name: generatedName })
                  .where(eq(devSession.id, sessionId));
              });
              console.log("Generated session name:", generatedName);
            }
          } catch (error) {
            // Log error but don't fail the request
            console.error("Error generating session name:", error);
          }
        }

        // Yield the assistant message ID
        yield {
          type: "done",
          assistantMessageId: assistantMessage.id,
        };
      }
    }
  } catch (error) {
    console.error("Error streaming chat response:", error);
    // // Still try to save a partial message if we have content
    // if (accumulatedContent) {
    //   try {
    //     const assistantMessage = await withUserContext(userId, async (tx) => {
    //       const [assistantMsg] = await tx
    //         .insert(devMessage)
    //         .values({
    //           content:
    //             accumulatedContent ||
    //             `Error: ${
    //               error instanceof Error ? error.message : "Unknown error"
    //             }`,
    //           structured_content: null,
    //           widget_id: null,
    //           role: "assistant",
    //           session_id: sessionId,
    //           user_id: userId,
    //         })
    //         .returning();

    //       await tx
    //         .update(devSession)
    //         .set({ updated_at: new Date() })
    //         .where(eq(devSession.id, sessionId));

    //       return assistantMsg;
    //     });
    //     yield {
    //       type: "done",
    //       assistantMessageId: assistantMessage.id,
    //     };
    //   } catch (saveError) {
    //     console.error("Error saving partial message:", saveError);
    //   }
    // }
    throw error;
  }
}
