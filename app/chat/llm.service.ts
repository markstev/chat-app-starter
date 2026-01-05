import OpenAI from "openai";
import { toolRegistry } from "@/app/mcp/tools.registry";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { baseURL } from "@/baseUrl";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Grok client (xAI) - uses OpenAI-compatible API
const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ChatCompletionResult {
  content: string;
  _meta?: Record<string, unknown>;
  structuredContent?: Record<string, unknown>;
  widgetId?: string;
}

export interface StreamChunk {
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
}

/**
 * Convert tools from registry to OpenAI format
 */
function getTools() {
  return toolRegistry.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(z.object(tool.inputSchema), {
        $refStrategy: "none", // Avoid $ref references for OpenAI compatibility
      }) as Record<string, unknown>,
    },
  }));
}

/**
 * Call OpenAI directly to get a chat completion with tool support
 * @param messages - Array of chat messages in OpenAI format
 * @param userId - User ID for authentication context
 * @returns The assistant's response content and metadata
 */
export async function getChatCompletion(
  messages: ChatMessage[],
  userId: string
): Promise<ChatCompletionResult> {
  try {
    // Create authInfo for tool handlers
    const authInfo = {
      token: "", // Not needed for our use case
      extra: {
        userId,
      },
    };

    const tools = getTools();
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    let currentMessages = [...messages];
    let finalMeta: Record<string, unknown> | undefined;
    let finalStructuredContent: Record<string, unknown> | undefined;
    let finalWidgetId: string | undefined;

    while (iteration < maxIterations) {
      iteration++;
      console.log("LLM iteration", iteration);

      // Use OpenAI SDK directly
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: currentMessages as any,
        temperature: 0.7,
        ...(tools.length > 0 && {
          tools: tools,
          tool_choice: "auto",
        }),
      });
      console.log("llm response", response);

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error("No message in LLM response");
      }

      // Handle tool calls - check for tool_calls in the response
      const toolCalls = message.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        // Filter to only function type tool calls
        const functionToolCalls = toolCalls.filter(
          (tc): tc is Extract<typeof tc, { type: "function" }> =>
            tc.type === "function"
        );

        // Add assistant message with tool calls to conversation
        currentMessages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: functionToolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        });

        // Execute all tool calls
        for (const toolCall of functionToolCalls) {
          const tool = toolRegistry.find(
            (t) => t.name === toolCall.function.name
          );
          if (!tool) {
            console.error(`Tool ${toolCall.function.name} not found`);
            currentMessages.push({
              role: "tool",
              content: JSON.stringify({
                error: `Tool ${toolCall.function.name} not found`,
              }),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
            continue;
          }

          try {
            // Parse arguments
            const args = JSON.parse(toolCall.function.arguments);

            // Call the tool handler
            console.log("calling tool", tool.name, args);
            const result = await tool.handler(args, { authInfo });
            console.log("called tool", result);

            // Store _meta, structuredContent, and widgetId from the first tool result that has them
            if (result._meta && !finalMeta) {
              finalMeta = result._meta as Record<string, unknown>;
              // Extract path from _meta if available
              const metaPath = (result._meta as Record<string, unknown>).path;
              if (metaPath && typeof metaPath === "string") {
                finalWidgetId = metaPath;
              }
            }

            // Store structuredContent from the tool result
            if (result.structuredContent && !finalStructuredContent) {
              finalStructuredContent = result.structuredContent as Record<
                string,
                unknown
              >;
            }

            // Add tool response to conversation
            // Extract text from content array
            const resultText = Array.isArray(result.content)
              ? result.content.map((item: any) => item.text || item).join("\n")
              : JSON.stringify(result.content);

            currentMessages.push({
              role: "tool",
              content: resultText,
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          } catch (error) {
            console.error(
              `Error executing tool ${toolCall.function.name}:`,
              error
            );
            currentMessages.push({
              role: "tool",
              content: JSON.stringify({
                error: `Error executing tool: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              }),
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }

        // Continue loop to get final response after tool calls
        continue;
      }

      // No tool calls, return final response
      const content = message.content || "";

      return {
        content,
        _meta: finalMeta,
        structuredContent: finalStructuredContent,
        widgetId: finalWidgetId,
      };
    }

    // If we've exceeded max iterations, return the last content
    throw new Error("Maximum tool call iterations exceeded");
  } catch (error) {
    console.error("Error calling LLM:", error);
    throw new Error(
      `Failed to get chat completion: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Stream chat completion with tool support using OpenAI SDK or Grok
 * @param messages - Array of chat messages in OpenAI format
 * @param userId - User ID for authentication context
 * @param provider - LLM provider to use: "openai" (default) or "grok"
 * @yields StreamChunk objects with content, tool calls, or metadata
 */
export async function* streamChatCompletion(
  messages: ChatMessage[],
  userId: string,
  provider: "openai" | "grok" = "grok"
): AsyncGenerator<StreamChunk> {
  try {
    // Create authInfo for tool handlers
    const authInfo = {
      token: "", // Not needed for our use case
      extra: {
        userId,
      },
    };

    const tools = getTools();
    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    let currentMessages = [...messages];
    let finalMeta: Record<string, unknown> | undefined;
    let finalStructuredContent: Record<string, unknown> | undefined;
    let finalWidgetId: string | undefined;

    while (iteration < maxIterations) {
      iteration++;
      console.log("LLM iteration", iteration);

      // Select client and model based on provider
      const client = provider === "grok" ? grok : openai;
      const model =
        provider === "grok" ? "grok-4-fast-non-reasoning" : "gpt-4o-mini";

      // Use OpenAI SDK directly for streaming (works with both OpenAI and Grok)
      const stream = await client.chat.completions.create({
        model: model,
        messages: currentMessages as any,
        temperature: 0.7,
        stream: true,
        ...(tools.length > 0 && {
          tools: tools,
          tool_choice: "auto",
        }),
      });
      console.log("Available tools", tools);

      let accumulatedContent = "";
      let toolCalls: Array<{
        id: string;
        name: string;
        arguments: string;
      }> = [];
      let hasToolCalls = false;

      // Stream the response
      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const delta = choice.delta;

        // Check for tool calls in the delta
        // In OpenAI streaming, tool_calls come in delta.tool_calls as an array
        // Each chunk may contain partial updates for tool calls (by index)
        const deltaToolCalls = delta.tool_calls;

        // Also check finish_reason to detect when tool calls are complete
        if (choice.finish_reason === "tool_calls") {
          hasToolCalls = true;
        }

        if (deltaToolCalls && deltaToolCalls.length > 0) {
          hasToolCalls = true;
          // Accumulate tool call information from delta
          // Each delta.tool_calls array element corresponds to a tool call by index
          // Filter to only function type tool calls
          for (const toolCallDelta of deltaToolCalls) {
            // Only process function type tool calls
            if (!toolCallDelta.function) continue;

            // Each toolCallDelta has: index, id (on first chunk), function.name (on first chunk), function.arguments (incremental)
            const index = toolCallDelta.index;
            if (index === undefined) continue;

            // Find or create tool call at this index
            if (index >= toolCalls.length) {
              // New tool call - initialize with empty values
              toolCalls.push({
                id: toolCallDelta.id || "",
                name: "",
                arguments: "",
              });
            }

            // Update the tool call at this index
            if (toolCallDelta.id) {
              toolCalls[index].id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              toolCalls[index].name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              // Arguments come incrementally, so append
              toolCalls[index].arguments += toolCallDelta.function.arguments;
            }
          }
        }

        // Accumulate content
        if (delta.content) {
          accumulatedContent += delta.content;
          // Yield content chunks as they arrive
          yield {
            type: "content",
            content: delta.content,
          };
        }
      }

      // After streaming is complete, check if we have tool calls
      if (hasToolCalls && toolCalls.length > 0) {
        console.log("has tool calls", toolCalls);
        // Yield tool calls notification
        yield {
          type: "tool_call",
          toolCalls: toolCalls,
        };

        // Add assistant message with tool calls to conversation
        currentMessages.push({
          role: "assistant",
          content: accumulatedContent,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        });

        // Execute all tool calls
        for (const toolCall of toolCalls) {
          console.log("executing tool", toolCall.name);
          const tool = toolRegistry.find((t) => t.name === toolCall.name);
          if (!tool) {
            console.error(`Tool ${toolCall.name} not found`);
            currentMessages.push({
              role: "tool",
              content: JSON.stringify({
                error: `Tool ${toolCall.name} not found`,
              }),
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
            continue;
          }

          try {
            // Parse arguments
            const args = toolCall.arguments
              ? JSON.parse(toolCall.arguments)
              : {};

            // Call the tool handler
            console.log("calling tool", tool.name, args);
            const result = await tool.handler(args, { authInfo });
            console.log("called tool", result);

            // Store _meta, structuredContent, and widgetId from the first tool result that has them
            if (result._meta && !finalMeta) {
              finalMeta = result._meta as Record<string, unknown>;
              const metaPath = (result._meta as Record<string, unknown>).path;
              if (metaPath && typeof metaPath === "string") {
                finalWidgetId = metaPath;
              }
            }

            if (result.structuredContent && !finalStructuredContent) {
              finalStructuredContent = result.structuredContent as Record<
                string,
                unknown
              >;
            }

            // Extract text from content array
            const resultText = Array.isArray(result.content)
              ? result.content.map((item: any) => item.text || item).join("\n")
              : JSON.stringify(result.content);

            // Yield tool result
            yield {
              type: "tool_result",
              content: resultText,
            };

            currentMessages.push({
              role: "tool",
              content: resultText,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
          } catch (error) {
            console.error(`Error executing tool ${toolCall.name}:`, error);
            const errorContent = JSON.stringify({
              error: `Error executing tool: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            });
            yield {
              type: "tool_result",
              content: errorContent,
            };
            currentMessages.push({
              role: "tool",
              content: errorContent,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            });
          }
        }

        // Continue loop to get final response after tool calls
        continue;
      }

      // No tool calls, stream is complete
      // Yield final metadata
      // TODO: move this yield above "continue" to give faster feedback to the user.
      if (finalMeta || finalStructuredContent || finalWidgetId) {
        yield {
          type: "metadata",
          metadata: {
            _meta: finalMeta,
            structuredContent: finalStructuredContent,
            widgetId: finalWidgetId,
          },
        };
      }

      yield { type: "done" };
      return;
    }

    // If we've exceeded max iterations
    throw new Error("Maximum tool call iterations exceeded");
  } catch (error) {
    console.error("Error streaming chat completion:", error);
    throw new Error(
      `Failed to stream chat completion: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
