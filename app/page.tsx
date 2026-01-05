"use client";

import Link from "next/link";
import {
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "./hooks";
import { useClerkReady } from "@/components/ConditionalClerkProvider";

// Inner component that uses hooks
function HomeContent() {
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();

  return (
    <div
      className="min-h-screen bg-white dark:bg-gray-900"
      style={maxHeight ? { maxHeight: `${maxHeight}px`, overflow: "auto" } : {}}
    >
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 sm:text-5xl md:text-6xl">
            ChatGPT Apps Framework
          </h1>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 sm:text-xl max-w-2xl mx-auto">
            Build apps that integrate seamlessly with ChatGPT using the OpenAI
            Apps SDK. Create interactive widgets, tools, and experiences that
            work natively in ChatGPT.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/chat"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Chat Sandbox
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Test and develop your apps in a ChatGPT-like interface without the
              MCP complexity.
            </p>
          </Link>

          <Link
            href="/todos"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Example: Todo App
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              See a complete example app with widgets, tRPC integration, and
              database operations.
            </p>
          </Link>

          <Link
            href="/custom-page"
            className="block p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Custom Widget
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              A simple example of creating a custom widget page.
            </p>
          </Link>
        </div>

        <div className="mt-12">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Getting Started
            </h3>
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              This framework provides everything you need to build ChatGPT apps:
              MCP server integration, widget system, tRPC for authenticated API
              calls, and a chat sandbox for development. Check out the example
              todo app to see how it all works together.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Outer wrapper that handles Clerk readiness
export default function Home() {
  const isChatGptApp = useIsChatGptApp();
  const isClerkReady = useClerkReady();

  // In ChatGPT app, we don't need Clerk - show content directly
  if (isChatGptApp) {
    return <HomeContent />;
  }

  // Wait for Clerk to be ready before rendering components that use Clerk hooks
  if (!isClerkReady) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  // Clerk is ready, safe to use Clerk hooks
  return <HomeContent />;
}
