"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { useClerkReady } from "@/components/ConditionalClerkProvider";

// Types
interface ChatSession {
  id: string;
  name: string;
  lastMessageTime: Date;
  messages: unknown[];
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  isLoading?: boolean;
}

// Sidebar component
export function ChatSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isLoading,
}: ChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isClerkReady = useClerkReady();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 dark:bg-gray-950 border-r border-gray-800 dark:border-gray-800 transform transition-transform duration-200 ease-in-out overflow-x-hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full overflow-x-hidden">
          {/* Header */}
          <div className="p-3 border-b border-gray-800 dark:border-gray-800">
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-700 dark:border-gray-700 hover:bg-gray-800 dark:hover:bg-gray-800 transition-colors text-sm text-white"
            >
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New chat
            </button>
          </div>

          {/* Sessions list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
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
            ) : (
              <div className="space-y-1">
                {sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      No conversations yet
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-600 mt-1">
                      Start a new chat to begin
                    </p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group relative rounded-lg text-sm transition-colors ${
                        session.id === currentSessionId
                          ? "bg-gray-800 dark:bg-gray-800"
                          : "hover:bg-gray-800/50 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <button
                        onClick={() => {
                          onSelectSession(session.id);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                          session.id === currentSessionId
                            ? "text-white"
                            : "text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-300"
                        }`}
                      >
                        <div className="font-medium truncate pr-8">
                          {session.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                          {session.lastMessageTime.toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 rounded transition-opacity z-10 ${
                          session.id === currentSessionId
                            ? "text-gray-400 hover:text-white hover:bg-gray-700/80 bg-gray-800/80"
                            : "text-gray-500 hover:text-gray-300 hover:bg-gray-700/80 bg-gray-800/50"
                        }`}
                        title="Delete session"
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
                  ))
                )}
              </div>
            )}
          </div>

          {/* User profile section */}
          <div className="p-3 border-t border-gray-800 dark:border-gray-800">
            {isClerkReady ? (
              <>
                <SignedOut>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <svg
                      className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 dark:text-gray-400">
                        Sign in to access your account
                      </p>
                    </div>
                  </div>
                  <SignInButton mode="modal">
                    <button className="w-full mt-2 px-3 py-2 rounded-lg bg-gray-800 dark:bg-gray-800 text-white hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors text-sm font-medium">
                      Sign In
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        elements: {
                          avatarBox: "w-8 h-8",
                        },
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 dark:text-gray-400 font-medium">
                        Account
                      </p>
                    </div>
                  </div>
                </SignedIn>
              </>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <svg
                  className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 dark:text-gray-400">
                    Loading...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 left-4 z-30 lg:hidden p-3 bg-gray-900 dark:bg-gray-900 text-white rounded-full shadow-lg"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </>
  );
}
