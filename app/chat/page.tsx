"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { skipToken } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { trpc } from "../../utils/trpc";
import { STTButton } from "../voice/stt";
import { ChatSidebar } from "@/components/ChatSidebar";
import { UserbackWidget } from "@/components/UserbackWidget";
import { useAmplitude, useIsAdmin } from "../hooks";
import {
  CHAT_MESSAGE_TYPE,
  DISPLAY_MODE_MESSAGE_TYPE,
  CHAT_MESSAGE_FROM_PARENT_TYPE,
} from "../hooks/use-send-message";
import type { DisplayMode } from "../hooks/types";

// Types
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  structured_content?: {
    _meta?: { path?: string; [key: string]: unknown };
  } | null;
  widget_id?: string | null;
}

interface ChatSession {
  id: string;
  name: string;
  lastMessageTime: Date;
  messages: Message[];
}

// Markdown renderer using react-markdown
function MarkdownRenderer({ content }: { content: string }) {
  const components: Components = {
    // Headings
    h1: ({ ...props }) => (
      <h1 className="text-2xl font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h2: ({ ...props }) => (
      <h2 className="text-xl font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h3: ({ ...props }) => (
      <h3 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h4: ({ ...props }) => (
      <h4 className="text-base font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h5: ({ ...props }) => (
      <h5 className="text-sm font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h6: ({ ...props }) => (
      <h6 className="text-sm font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    // Paragraphs
    p: ({ ...props }) => (
      <p
        className="mb-2 last:mb-0 whitespace-pre-wrap break-words"
        {...props}
      />
    ),
    // Code blocks
    pre: ({ ...props }) => (
      <pre
        className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto my-2"
        {...props}
      />
    ),
    code: (props) => {
      const { className, children, ...rest } = props;
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match;
      return isInline ? (
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
          {...rest}
        >
          {children}
        </code>
      ) : (
        <code className={`text-sm font-mono ${className || ""}`} {...rest}>
          {children}
        </code>
      );
    },
    // Lists
    ul: ({ ...props }) => (
      <ul className="list-disc list-outside mb-2 space-y-1 ml-6" {...props} />
    ),
    ol: ({ ...props }) => (
      <ol
        className="list-decimal list-outside mb-2 space-y-1 ml-6"
        {...props}
      />
    ),
    li: ({ ...props }) => <li className="pl-2" {...props} />,
    // Links
    a: ({ ...props }) => (
      <a
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    // Blockquotes
    blockquote: ({ ...props }) => (
      <blockquote
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2"
        {...props}
      />
    ),
    // Horizontal rule
    hr: ({ ...props }) => (
      <hr className="my-4 border-gray-300 dark:border-gray-700" {...props} />
    ),
    // Strong and emphasis
    strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
    em: ({ ...props }) => <em className="italic" {...props} />,
    // Tables (from remark-gfm)
    table: ({ ...props }) => (
      <div className="overflow-x-auto my-2">
        <table
          className="border-collapse border border-gray-300 dark:border-gray-700"
          {...props}
        />
      </div>
    ),
    thead: ({ ...props }) => (
      <thead className="bg-gray-100 dark:bg-gray-800" {...props} />
    ),
    tbody: ({ ...props }) => <tbody {...props} />,
    tr: ({ ...props }) => <tr {...props} />,
    th: ({ ...props }) => (
      <th
        className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-semibold"
        {...props}
      />
    ),
    td: ({ ...props }) => (
      <td
        className="border border-gray-300 dark:border-gray-700 px-4 py-2"
        {...props}
      />
    ),
  };

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  );
}

// Get scroll key based on content length - only scrolls every 25 characters
function getContentScrollKey(content: string): number {
  return Math.round(content.length / 25);
}

// ScrollToMe component - scrolls itself into view when mounted, messageId changes, or content changes
function ScrollToMe({
  messageId,
  contentHash,
}: {
  messageId: string;
  contentHash: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messageId, contentHash]);

  return <div ref={ref} />;
}

// Message component
function MessageBubble({
  message,
  messages,
  onDelete,
  onRedo,
  pinnedWidget,
}: {
  message: Message;
  messages: Message[];
  onDelete: (messageId: string) => void;
  onRedo: (messageId: string) => void;
  pinnedWidget: { messageId: string; mode: "pin" | "pinRight" } | null;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [isCollapsed, setIsCollapsed] = useState(isSystem);
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Cleanup ResizeObserver on unmount
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div
      className={`group relative flex gap-4 py-4 px-6 ${
        isUser
          ? "bg-white dark:bg-gray-900"
          : isSystem
          ? "bg-gray-100 dark:bg-gray-800/30"
          : "bg-gray-50 dark:bg-gray-800/50"
      }`}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
        {isUser ? (
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        ) : isSystem ? (
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-gray-600 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isUser ? "You" : isSystem ? "System" : "Assistant"}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {/* Action buttons in top right */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title={isCollapsed ? "Expand" : "Collapse"}
              aria-label={isCollapsed ? "Expand message" : "Collapse message"}
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  isCollapsed ? "" : "rotate-180"
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this message? This action cannot be undone."
                  )
                ) {
                  onDelete(message.id);
                }
              }}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete message"
              aria-label="Delete message"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
        {!isCollapsed && (
          <>
            {message.content && (
              <div className="text-gray-800 dark:text-gray-200">
                <MarkdownRenderer content={message.content} />
              </div>
            )}
            {/* Display iframe for widget messages - fixed on top/right if pinned, inline otherwise */}
            {message.structured_content?._meta?.path && (
              <div
                className={`${
                  pinnedWidget?.messageId === message.id
                    ? pinnedWidget.mode === "pinRight"
                      ? "mt-4 lg:fixed lg:top-0 lg:right-0 lg:w-1/4 lg:h-screen lg:z-50 lg:mt-0 lg:flex lg:flex-col"
                      : "fixed top-0 left-1/2 transform -translate-x-1/2 w-[90%] max-w-4xl z-50 mt-0"
                    : "mt-4"
                } rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700`}
              >
                <iframe
                  ref={iframeRef}
                  src={
                    typeof window !== "undefined" &&
                    message.structured_content?._meta?.path
                      ? message.structured_content._meta.path.startsWith("http")
                        ? message.structured_content._meta.path
                        : `${window.location.origin}${message.structured_content._meta.path}`
                      : "" + "?firstParty=true"
                  }
                  className={`w-full border-0 ${
                    pinnedWidget?.messageId === message.id ? "flex-1" : ""
                  }`}
                  style={{
                    height:
                      pinnedWidget?.messageId === message.id
                        ? "100%"
                        : iframeHeight
                        ? `${iframeHeight}px`
                        : "auto",
                    minHeight:
                      pinnedWidget?.messageId === message.id ? "100%" : "200px",
                  }}
                  title="Widget Content"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  data-message-id={message.id}
                  onLoad={(e) => {
                    // Send structured content data to the iframe
                    const iframe = e.currentTarget;
                    const iframeWindow = iframe.contentWindow;

                    if (iframeWindow && message.structured_content) {
                      // Extract data from structured_content
                      const { _meta, ...restContent } =
                        message.structured_content;

                      // Build the globals object that matches OpenAIGlobals structure
                      const globals: Record<string, unknown> = {};

                      // toolOutput contains the structured content (excluding _meta)
                      // This is the data returned from the tool (e.g., action, standup, todos)
                      if (Object.keys(restContent).length > 0) {
                        globals.toolOutput = restContent;
                      } else if (message.structured_content) {
                        // If only _meta exists, still provide the full structured_content
                        // This handles backward compatibility
                        globals.toolOutput = message.structured_content;
                      }

                      // toolResponseMetadata contains the _meta (tool metadata like path, widget info)
                      globals.toolResponseMetadata = _meta || null;

                      // Send the data via postMessage
                      // Send every 200ms for 2s to handle slow-loading iframes
                      let attempts = 0;
                      const maxAttempts = 10; // 2s / 200ms = 10 attempts
                      const interval = setInterval(() => {
                        if (iframeWindow) {
                          iframeWindow.dispatchEvent(
                            new CustomEvent("openai:set_globals", {
                              detail: {
                                globals,
                              },
                            })
                          );
                        }
                        attempts++;
                        if (attempts >= maxAttempts) {
                          clearInterval(interval);
                        }
                      }, 200);
                    }

                    // Setup ResizeObserver after iframe loads to automatically track height
                    try {
                      const iframeWindow = iframe.contentWindow;
                      if (iframeWindow?.document?.body) {
                        const updateHeight = () => {
                          try {
                            if (iframeWindow?.document?.body) {
                              const height = Math.max(
                                iframeWindow.document.body.scrollHeight,
                                iframeWindow.document.body.offsetHeight,
                                iframeWindow.document.documentElement
                                  .scrollHeight,
                                iframeWindow.document.documentElement
                                  .offsetHeight
                              );
                              if (height > 0) {
                                setIframeHeight(height);
                              }
                            }
                          } catch (e) {
                            // Cross-origin or other error, ignore
                          }
                        };

                        // Clean up any existing observer
                        if (resizeObserverRef.current) {
                          resizeObserverRef.current.disconnect();
                        }

                        // Create new ResizeObserver
                        resizeObserverRef.current = new ResizeObserver(() => {
                          updateHeight();
                        });
                        resizeObserverRef.current.observe(
                          iframeWindow.document.body
                        );
                        // Get initial height
                        updateHeight();
                      }
                    } catch (e) {
                      // Cross-origin or other error, ignore
                    }
                  }}
                />
              </div>
            )}
            {!isUser && (
              <button
                className="mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
                onClick={() => {
                  onRedo(message.id);
                }}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Redo
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Chat input component
function ChatInput({
  onSend,
  isStreaming,
}: {
  onSend: (message: string) => void;
  isStreaming: boolean;
}) {
  const [input, setInput] = useState("");
  const [streamingTranscript, setStreamingTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Combine input and streaming transcript for display
  const displayValue = isTranscribing
    ? input +
      (streamingTranscript ? (input ? " " : "") + streamingTranscript : "")
    : input;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [displayValue]);

  // Focus the textarea when streaming completes
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    // Only focus if streaming changed from true to false (not on initial mount)
    if (prevIsStreamingRef.current && !isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalInput = isTranscribing
      ? input +
        (streamingTranscript ? (input ? " " : "") + streamingTranscript : "")
      : input;
    if (finalInput.trim() && !isStreaming && !isTranscribing) {
      onSend(finalInput.trim());
      setInput("");
      setStreamingTranscript("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Only allow editing if not transcribing
    if (!isTranscribing) {
      setInput(e.target.value);
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center flex-1 relative">
            <textarea
              ref={textareaRef}
              value={displayValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Message ChatGPT..."
              rows={1}
              disabled={isStreaming || isTranscribing}
              className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
            />
            <div className="absolute right-2 bottom-2">
              <STTButton
                onSpeechDone={(transcribedText) => {
                  // Merge streaming transcript into input on stop
                  if (transcribedText.trim()) {
                    setInput((prev) => {
                      const merged = prev
                        ? prev + " " + transcribedText
                        : transcribedText;
                      return merged;
                    });
                  }
                  setStreamingTranscript("");
                  setIsTranscribing(false);
                }}
                onStreamingTranscript={(transcript) => {
                  setStreamingTranscript(transcript);
                  setIsTranscribing(true);
                }}
                disabled={isStreaming}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="h-12 w-12 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
          >
            {isStreaming ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// Main chat page
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { track } = useAmplitude();
  const isAdmin = useIsAdmin();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{
    sessionId: string;
    messageId: string;
  } | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode | null>(null);
  const [pinnedWidget, setPinnedWidget] = useState<{
    messageId: string;
    mode: "pin" | "pinRight";
  } | null>(null);
  const utils = trpc.useUtils();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check for sessionId in URL params - prioritize URL over state
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get("sessionId");
    console.log("sessionIdFromUrl", sessionIdFromUrl);
    if (sessionIdFromUrl && sessionIdFromUrl !== currentSessionId) {
      setCurrentSessionId(sessionIdFromUrl);
    }
  }, [searchParams, currentSessionId]);

  // Update URL when sessionId changes (but not if it matches URL param)
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get("sessionId");
    if (currentSessionId && sessionIdFromUrl !== currentSessionId) {
      router.replace(`/chat?sessionId=${currentSessionId}`, { scroll: false });
    }
  }, [currentSessionId, router]);

  // Fetch all sessions
  const {
    data: sessionsData,
    refetch: refetchSessions,
    isLoading: isLoadingSessions,
  } = trpc.chat.listSessions.useQuery(undefined, {
    enabled: true,
  });

  // Fetch messages for current session
  const {
    data: messagesData,
    refetch: refetchMessages,
    isLoading: isLoadingMessages,
  } = trpc.chat.getMessages.useQuery(
    { sessionId: currentSessionId! },
    {
      enabled: !!currentSessionId,
    }
  );

  // Streaming subscription
  // Use a ref to track the current pendingMessage to avoid stale closures
  const pendingMessageRef = useRef(pendingMessage);
  useEffect(() => {
    pendingMessageRef.current = pendingMessage;
  }, [pendingMessage]);

  const streamSubscription = trpc.chat.streamMessage.useSubscription(
    pendingMessage
      ? {
          messageId: pendingMessage.messageId,
        }
      : skipToken,
    {
      onData: (chunk) => {
        // Use ref to get current value instead of closure
        const currentPendingMessage = pendingMessageRef.current;
        if (!currentPendingMessage) return;

        const sessionId = currentPendingMessage.sessionId;

        if (chunk.type === "content" && chunk.content) {
          // Update the last message (assistant message) in the cache with streaming content
          const content = chunk.content; // Extract to ensure type safety
          utils.chat.getMessages.setData({ sessionId }, (old) => {
            if (!old) return old;
            const updated = [...old];
            const lastMessage = updated[updated.length - 1];

            // If the last message is an assistant message, append to it
            if (lastMessage && lastMessage.role === "assistant") {
              updated[updated.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + content,
              };
            } else {
              // If there's no assistant message yet, create one
              const now = new Date().toISOString();
              updated.push({
                id: `streaming-${Date.now()}`,
                content: content,
                structured_content: null,
                widget_id: null,
                role: "assistant",
                session_id: sessionId,
                user_id: "",
                created_at: now,
                updated_at: now,
              });
            }
            return updated;
          });
          // Scroll when stream data arrives
          setTimeout(
            () =>
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
            0
          );
        } else if (chunk.type === "metadata" && chunk.metadata) {
          // Update the assistant message with metadata (structured content, widget info)
          const metadata = chunk.metadata; // Extract to ensure type safety
          utils.chat.getMessages.setData({ sessionId }, (old) => {
            if (!old) return old;
            const updated = [...old];
            const lastMessage = updated[updated.length - 1];

            // If the last message is an assistant message, update it with metadata
            if (lastMessage && lastMessage.role === "assistant") {
              const structuredContent = metadata.structuredContent
                ? {
                    ...(metadata._meta && { _meta: metadata._meta }),
                    ...metadata.structuredContent,
                  }
                : metadata._meta
                ? { _meta: metadata._meta }
                : null;

              updated[updated.length - 1] = {
                ...lastMessage,
                structured_content: structuredContent,
                widget_id: metadata.widgetId || null,
              };
            }
            return updated;
          });
        } else if (chunk.type === "done") {
          // Only clear if this subscription is still the active one
          const currentPendingMessage = pendingMessageRef.current;
          if (currentPendingMessage) {
            setIsStreaming(false);
            setPendingMessage(null);
            // Refetch messages to get the final saved message
            refetchMessages();
            refetchSessions();
          }
        }
      },
      onError: (error) => {
        console.error("Streaming error:", error);
        // Only clear if this subscription is still the active one
        const currentPendingMessage = pendingMessageRef.current;
        if (currentPendingMessage) {
          setIsStreaming(false);
          setPendingMessage(null);
        }
      },
    }
  );

  // Mutations
  const createSessionMutation = trpc.chat.createSession.useMutation({
    onSuccess: (session) => {
      setCurrentSessionId(session.id);
      router.replace(`/chat?sessionId=${session.id}`, { scroll: false });
      refetchSessions();
    },
  });

  // Send chat messages to widget iframes when messages change
  useEffect(() => {
    if (!messagesData || messagesData.length === 0) return;
    console.log("Sending messages to widget iframes", messagesData);

    // Find all iframes that are warmup widgets
    const iframes = document.querySelectorAll("iframe[data-message-id]");

    for (const iframe of iframes) {
      const iframeElement = iframe as HTMLIFrameElement;

      if (iframeElement.contentWindow) {
        // Send all messages to the widget
        const messagesToSend = messagesData
          // .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role,
            content: m.content,
            id: m.id,
          }));

        // Send via postMessage
        iframeElement.contentWindow.postMessage(
          {
            type: CHAT_MESSAGE_FROM_PARENT_TYPE,
            messages: messagesToSend,
          },
          "*"
        );
      }
    }
  }, [messagesData]);

  const deleteSessionMutation = trpc.chat.deleteSession.useMutation({
    onSuccess: (_, variables) => {
      refetchSessions();
      // If we deleted the current session, clear it
      if (currentSessionId === variables.sessionId) {
        setCurrentSessionId(null);
      }
    },
  });

  const deleteMessageMutation = trpc.chat.deleteMessage.useMutation({
    onMutate: async ({ messageIds }) => {
      if (!currentSessionId) return;

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await utils.chat.getMessages.cancel({ sessionId: currentSessionId });

      // Snapshot the previous value
      const previousMessages = utils.chat.getMessages.getData({
        sessionId: currentSessionId,
      });

      // Optimistically update to remove the message(s)
      utils.chat.getMessages.setData({ sessionId: currentSessionId }, (old) => {
        if (!old) return old;
        return old.filter((message) => !messageIds.includes(message.id));
      });

      // Return a context object with the snapshotted value
      return { previousMessages, sessionId: currentSessionId };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, rollback to the previous value
      if (context?.previousMessages && context.sessionId) {
        utils.chat.getMessages.setData(
          { sessionId: context.sessionId },
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      // Optionally refetch to ensure consistency, but optimistic update already happened
      refetchMessages();
    },
  });

  const addUserMessageMutation = trpc.chat.addUserMessage.useMutation();

  // Transform sessions data to ChatSession format
  const sessions: ChatSession[] = sessionsData
    ? sessionsData.map((session) => ({
        id: session.id,
        name: session.name,
        lastMessageTime: new Date(session.updated_at),
        messages: [], // Messages will be loaded separately per session
      }))
    : [];

  // Transform messages data to Message format
  const messages: Message[] = messagesData
    ? messagesData
        .filter((message) => {
          // Filter out system messages if user is not an admin
          if (message.role === "system" && !isAdmin) {
            return false;
          }
          return true;
        })
        .map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant" | "system",
          content: message.content,
          timestamp: new Date(message.created_at),
          structured_content: message.structured_content as {
            _meta?: { path?: string; [key: string]: unknown };
          } | null,
          widget_id: message.widget_id || null,
        }))
    : [];

  // Get current session with messages
  const currentSession: ChatSession = currentSessionId
    ? {
        id: currentSessionId,
        name:
          sessions.find((s) => s.id === currentSessionId)?.name ||
          "New conversation",
        lastMessageTime:
          sessions.find((s) => s.id === currentSessionId)?.lastMessageTime ||
          new Date(),
        messages,
      }
    : {
        id: "",
        name: "New conversation",
        lastMessageTime: new Date(),
        messages: [],
      };

  // Set initial session when sessions are loaded (only if no URL param)
  useEffect(() => {
    const sessionIdFromUrl = searchParams.get("sessionId");
    if (
      sessionsData &&
      sessionsData.length > 0 &&
      !currentSessionId &&
      !sessionIdFromUrl
    ) {
      setCurrentSessionId(sessionsData[0].id);
    }
  }, [sessionsData, currentSessionId, searchParams]);

  const handleSendMessage = useCallback(
    async (
      content: string,
      role: "user" | "system",
      structuredContent?: unknown,
      widgetId?: string
    ) => {
      // Guard against duplicate calls - don't allow sending if already streaming
      if (isStreaming) {
        console.warn("Already streaming, ignoring duplicate send request");
        return;
      }

      let sessionId = currentSessionId;

      // Create a new session if we don't have one
      if (!sessionId) {
        try {
          const newSession = await createSessionMutation.mutateAsync({
            name: content.slice(0, 50) || "New conversation",
          });
          sessionId = newSession.id;
          setCurrentSessionId(sessionId);
        } catch (error) {
          console.error("Error creating session:", error);
          return;
        }
      }

      const tempUserMessage = {
        id: `streaming-${Date.now()}`,
        content,
        structured_content: null,
        widget_id: null,
        role,
        session_id: sessionId,
        user_id: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Snapshot the previous value
      const previousMessages = utils.chat.getMessages.getData({
        sessionId,
      });

      // Update cache with the real message from the server
      utils.chat.getMessages.setData(
        { sessionId },
        previousMessages
          ? [...previousMessages, tempUserMessage]
          : [tempUserMessage]
      );

      // Scroll when new message is added
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        0
      );

      try {
        // First, create the user message via mutation
        const userMessage = await addUserMessageMutation.mutateAsync({
          sessionId,
          content,
          structuredContent,
          widgetId,
          role,
        });

        // Cancel any outgoing refetches (so they don't overwrite our update)
        await utils.chat.getMessages.cancel({ sessionId });

        setIsStreaming(true);

        // Set pending message with messageId to trigger subscription
        setPendingMessage({
          sessionId,
          messageId: userMessage.id,
        });

        // Track message sent event
        track("send_message");
      } catch (error) {
        console.error("Error adding user message:", error);
        setIsStreaming(false);
      }
    },
    [
      currentSessionId,
      createSessionMutation,
      addUserMessageMutation,
      utils,
      track,
      isStreaming,
    ]
  );

  // Use a ref to track pinnedWidget so it's accessible in event handlers
  const pinnedWidgetRef = useRef<{
    messageId: string;
    mode: "pin" | "pinRight";
  } | null>(null);
  useEffect(() => {
    pinnedWidgetRef.current = pinnedWidget;
  }, [pinnedWidget]);

  // Listen for messages from child iframes/widgets
  useEffect(() => {
    // Helper function to find the iframe element that sent the message
    const findIframeFromSource = (
      source: Window | MessageEventSource | null
    ): HTMLIFrameElement | null => {
      if (!source) return null;

      // Iterate through all iframes in the document
      const iframes = document.querySelectorAll("iframe");
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        if (iframe.contentWindow === source) {
          return iframe;
        }
      }
      return null;
    };

    const handleMessage = (event: MessageEvent) => {
      // Find the iframe that sent this message
      const sourceIframe = findIframeFromSource(event.source);

      // You can now use sourceIframe to identify which iframe sent the message
      // For example, you could get the message ID from the iframe's data attribute
      // or check the iframe's src attribute
      if (sourceIframe) {
        const messageId = sourceIframe.getAttribute("data-message-id");
        console.log("Message from iframe:", {
          src: sourceIframe.src,
          origin: event.origin,
          messageId: messageId, // The ID of the message that contains this iframe
        });
      }

      // Verify message type and structure
      if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === CHAT_MESSAGE_TYPE &&
        typeof event.data.prompt === "string"
      ) {
        handleSendMessage(event.data.prompt, "system");
      } else if (
        event.data &&
        typeof event.data === "object" &&
        event.data.type === DISPLAY_MODE_MESSAGE_TYPE &&
        event.data.displayMode
      ) {
        // Handle display mode change from child iframe
        // You can now identify which iframe requested this change
        if (sourceIframe) {
          const messageId = sourceIframe.getAttribute("data-message-id");
          console.log("Display mode change requested by iframe:", {
            messageId: messageId,
            displayMode: event.data.displayMode,
          });

          // Set pinned widget when display mode is "pin" or "pinRight"
          if (
            (event.data.displayMode === "pin" ||
              event.data.displayMode === "pinRight") &&
            messageId
          ) {
            // Only one pinned widget at a time - replace any existing pinned widget
            setPinnedWidget({
              messageId,
              mode: event.data.displayMode === "pinRight" ? "pinRight" : "pin",
            });
          } else if (
            event.data.displayMode !== "pin" &&
            event.data.displayMode !== "pinRight" &&
            messageId === pinnedWidgetRef.current?.messageId
          ) {
            // Unpin when the currently pinned widget switches to other display modes
            setPinnedWidget(null);
          }
        }
        setDisplayMode(event.data.displayMode);
      }
    };

    // Listen for postMessage events from child iframes
    window.addEventListener("message", handleMessage);

    // Also listen for custom events (for non-iframe scenarios)
    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.prompt === "string") {
        handleSendMessage(event.detail.prompt, "system");
      } else if (event.detail && event.detail.displayMode) {
        // Handle display mode change from custom event
        // For custom events, we can't identify the source iframe directly
        // You may need to include messageId in the event detail if needed
        if (
          (event.detail.displayMode === "pin" ||
            event.detail.displayMode === "pinRight") &&
          event.detail.messageId
        ) {
          setPinnedWidget({
            messageId: event.detail.messageId,
            mode: event.detail.displayMode === "pinRight" ? "pinRight" : "pin",
          });
        } else if (
          event.detail.displayMode !== "pin" &&
          event.detail.displayMode !== "pinRight"
        ) {
          setPinnedWidget(null);
        }
        setDisplayMode(event.detail.displayMode);
      }
    };

    window.addEventListener(
      CHAT_MESSAGE_TYPE,
      handleCustomEvent as EventListener
    );

    window.addEventListener(
      DISPLAY_MODE_MESSAGE_TYPE,
      handleCustomEvent as EventListener
    );

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener(
        CHAT_MESSAGE_TYPE,
        handleCustomEvent as EventListener
      );
      window.removeEventListener(
        DISPLAY_MODE_MESSAGE_TYPE,
        handleCustomEvent as EventListener
      );
    };
  }, [handleSendMessage]);

  // Listen for display mode changes from child iframes
  // Display mode changes are received via postMessage or custom events
  // (handled in the message listener above)
  useEffect(() => {
    if (displayMode === null) {
      return;
    }

    console.log("Display mode changed:", displayMode);
    // Handle the display mode change (e.g., pin/unpin conversation)
    // You can add your logic here to handle pinning
    if (displayMode === "pip") {
      // Conversation was pinned to picture-in-picture
      console.log("Conversation pinned to PiP");
    } else if (displayMode === "fullscreen") {
      // Conversation was expanded to fullscreen
      console.log("Conversation expanded to fullscreen");
    } else if (displayMode === "inline") {
      // Conversation was set back to inline
      console.log("Conversation set to inline");
    }
  }, [displayMode]);

  const handleNewChat = async () => {
    const newSession = await createSessionMutation.mutateAsync({
      name: "New conversation",
    });
    setCurrentSessionId(newSession.id);
    router.replace(`/chat?sessionId=${newSession.id}`, { scroll: false });
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this conversation? This action cannot be undone."
      )
    ) {
      await deleteSessionMutation.mutateAsync({ sessionId });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessageMutation.mutateAsync({ messageIds: [messageId] });
  };

  const handleRedo = async (messageId: string) => {
    if (!currentSessionId) return;

    // Guard against duplicate calls - don't allow redo if already streaming
    if (isStreaming) {
      console.warn("Already streaming, ignoring redo request");
      return;
    }

    // Find the current message index
    const currentIndex = currentSession.messages.findIndex(
      (msg) => msg.id === messageId
    );

    if (currentIndex === -1) return;

    // Find the message before this one (the user message that triggered this assistant response)
    const previousMessage =
      currentIndex > 0 ? currentSession.messages[currentIndex - 1] : null;

    if (!previousMessage) {
      console.error("No previous message found to redo from");
      return;
    }

    // Ensure the previous message is a user message (required for streaming)
    if (previousMessage.role === "assistant") {
      console.error("Previous message must be a user message to redo");
      return;
    }

    // Get all messages to delete (current message and all following messages)
    const messagesToDelete = currentSession.messages.slice(currentIndex);
    const messageIdsToDelete = messagesToDelete.map((msg) => msg.id);

    // Delete the messages
    await deleteMessageMutation.mutateAsync({
      messageIds: messageIdsToDelete,
    });

    // Trigger streaming with the previous message ID
    setPendingMessage({
      sessionId: currentSessionId,
      messageId: previousMessage.id,
    });
    setIsStreaming(true);
  };

  // Find the pinned message
  const pinnedMessage = pinnedWidget
    ? currentSession.messages.find((msg) => msg.id === pinnedWidget.messageId)
    : null;

  return (
    <div className="fixed inset-0 flex bg-white dark:bg-gray-900">
      <UserbackWidget />
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId || ""}
        onSelectSession={(sessionId) => {
          setCurrentSessionId(sessionId);
          router.replace(`/chat?sessionId=${sessionId}`, { scroll: false });
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isLoading={isLoadingSessions}
      />

      {/* Main chat area */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          pinnedWidget?.mode === "pinRight" ? "lg:pr-[25%]" : ""
        }`}
      >
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingMessages && currentSessionId ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <div className="flex gap-1 justify-center mb-4">
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  Loading messages...
                </p>
              </div>
            </div>
          ) : currentSession.messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center px-4">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  How can I help you today?
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Start a conversation by typing a message below
                </p>
              </div>
            </div>
          ) : (
            <div>
              {currentSession.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  messages={currentSession.messages}
                  onDelete={handleDeleteMessage}
                  onRedo={handleRedo}
                  pinnedWidget={pinnedWidget}
                />
              ))}
              {isStreaming &&
                currentSession.messages.length > 0 &&
                currentSession.messages[currentSession.messages.length - 1]
                  .role === "user" && (
                  <div className="flex gap-4 py-4 px-6 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <svg
                        className="w-5 h-5 text-gray-600 dark:text-gray-300 animate-pulse"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex gap-1">
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              {currentSession.messages.length > 0 && (
                <ScrollToMe
                  messageId={
                    currentSession.messages[currentSession.messages.length - 1]
                      .id
                  }
                  contentHash={getContentScrollKey(
                    currentSession.messages[currentSession.messages.length - 1]
                      .content
                  )}
                />
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSend={(content) => handleSendMessage(content, "user")}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
