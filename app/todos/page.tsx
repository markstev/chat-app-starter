"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../utils/trpc";
import {
  useIsChatGptApp,
  useOpenAIGlobal,
  useRequestDisplayMode,
  useSendMessage,
  useWidgetProps,
} from "../hooks";
import TodoList from "../../components/TodoList";

type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export default function TodosPage() {
  const [newTodoText, setNewTodoText] = useState("");
  const [editingTodo, setEditingTodo] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isPreviousDayOpen, setIsPreviousDayOpen] = useState(false);

  const sendMessageToChatGPT = useSendMessage();
  const requestDisplayMode = useRequestDisplayMode();

  const toolOutput = useWidgetProps<{
    name?: string;
    result?: {
      structuredContent?: { name?: string };
      _meta?: { path?: string };
    };
  }>();

  // tRPC queries and mutations
  const todayStandupQuery = trpc.getTodayStandup.useQuery(
    { userId: "1234" },
    { refetchInterval: 5000 } // Poll every 5 seconds
  );
  const changeTodoStatusMutation = trpc.changeTodoStatus.useMutation({
    onSuccess: () => {
      todayStandupQuery.refetch();
    },
  });
  const addTodoMutation = trpc.addTodo.useMutation({
    onSuccess: () => {
      todayStandupQuery.refetch();
      setNewTodoText("");
    },
  });
  const updateTodoMutation = trpc.updateTodo.useMutation({
    onSuccess: () => {
      todayStandupQuery.refetch();
      setEditingTodo(null);
      setEditingText("");
    },
  });
  const deleteTodoMutation = trpc.deleteTodo.useMutation({
    onSuccess: () => {
      todayStandupQuery.refetch();
    },
  });

  const handleAddTodo = () => {
    if (newTodoText.trim() && todayStandupQuery.data?.standup.id) {
      addTodoMutation.mutate({
        text: newTodoText.trim(),
        standupId: todayStandupQuery.data.standup.id,
      });
      sendMessageToChatGPT(
        "A new todo was added; you don't need to say much other than some brief encouragment if appropriate. For context, " +
          "this user is trying to be a solo founder making new chatgpt apps for the new apps sdk, like a todo app, a context/research management app, etc " +
          "with the goal of finding an app that is actually useful and generates revenue while making users happy. " +
          "DO NOT call the MCP to add this, it was already added." +
          JSON.stringify({
            action: "addTodo",
            todoText: newTodoText.trim(),
          })
      );
    }
  };

  const handleStatusChange = (todoId: string, newStatus: TodoStatus) => {
    changeTodoStatusMutation.mutate({
      id: todoId,
      status: newStatus,
    });
    sendMessageToChatGPT(
      "A todo was changed in status; you don't need to say much other than some brief encouragment/congratulations if appropriate. For context, " +
        "this user is trying to be a solo founder making new chatgpt apps for the new apps sdk, like a todo app, a context/research management app, etc " +
        "with the goal of finding an app that is actually useful and generates revenue while making users happy." +
        "DO NOT call the MCP to change this, it was already changed." +
        JSON.stringify({
          action: "changeTodoStatus",
          todoId: todoId,
          newStatus: newStatus,
        })
    );
  };

  const handleEditStart = (todoId: string, currentText: string) => {
    setEditingTodo(todoId);
    setEditingText(currentText);
  };

  const handleEditSave = (todoId: string, text: string) => {
    if (text.trim()) {
      updateTodoMutation.mutate({
        id: todoId,
        text: text.trim(),
      });
    }
  };

  const handleEditCancel = () => {
    setEditingTodo(null);
    setEditingText("");
  };

  const handleDeleteTodo = (todoId: string) => {
    deleteTodoMutation.mutate({ id: todoId });
  };

  const handleNestTodo = (todoId: string, parentId: string | null) => {
    updateTodoMutation.mutate({
      id: todoId,
      parentTodoId: parentId,
    });
  };

  const handleReviewYesterday = async () => {
    if (!previousTodos || previousTodos.length === 0) return;

    // Prepare the list of yesterday's todos with their status
    const todosList = previousTodos
      .map((todo) => `- ${todo.text} [${todo.status}]`)
      .join("\n");

    await requestDisplayMode("pip");

    // Send a single comprehensive prompt for standup review
    sendMessageToChatGPT(
      `Here's what was on my list yesterday:\n\n${todosList}\n\n` +
        `Let's do a quick standup review! Guide me through this in three parts as separate messages:\n\n` +
        `1. First, ask me about the highlights from yesterday - what went well?\n` +
        `2. Then, ask about the lowlights - what challenges did I face or what didn't go as planned?\n` +
        `3. Finally, ask what my top priorities should be for today based on yesterday's progress.\n\n` +
        `Be concise and encouraging - like a supportive manager or cofounder. Let me do most of the talking, ` +
        `but offer positivity and help me focus on what matters!`
    );
  };

  if (todayStandupQuery.isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-400 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (todayStandupQuery.error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Error loading standup: {todayStandupQuery.error.message}
          </p>
          <button
            onClick={() => todayStandupQuery.refetch()}
            className="px-5 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    standup,
    todos: todayTodos,
    previousStandup,
    previousTodos,
  } = todayStandupQuery.data!;
  const currentDate = new Date(standup.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const previousDate = previousStandup
    ? new Date(previousStandup.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                Daily Standup
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentDate}
              </p>
            </div>
            <button
              onClick={() => requestDisplayMode("pip")}
              className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              title="Pin to window"
            >
              📌 Pin
            </button>
          </div>
        </div>

        {/* Add New Todo */}
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a new todo..."
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAddTodo();
                }
              }}
            />
            <button
              onClick={handleAddTodo}
              disabled={addTodoMutation.isPending || !newTodoText.trim()}
              className="px-5 py-2.5 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addTodoMutation.isPending ? "Adding..." : "Add"}
            </button>
          </div>
          {addTodoMutation.error && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              Error: {addTodoMutation.error.message}
            </p>
          )}
        </div>

        {/* Previous Day's Standup Accordion */}
        {previousStandup && previousTodos && previousTodos.length > 0 && (
          <div className="mb-6">
            <div className="border border-gray-200 dark:border-gray-800 rounded">
              <div
                onClick={() => setIsPreviousDayOpen(!isPreviousDayOpen)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded focus:outline-none cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsPreviousDayOpen(!isPreviousDayOpen);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Previous Day
                    </h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {previousDate} · {previousTodos.length}{" "}
                      {previousTodos.length === 1 ? "todo" : "todos"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReviewYesterday();
                      }}
                      className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Review
                    </button>
                    <svg
                      className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
                        isPreviousDayOpen ? "rotate-180" : ""
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
                  </div>
                </div>
              </div>

              {isPreviousDayOpen && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                  <TodoList
                    todos={previousTodos}
                    title="Previous Day's Todos"
                    onStatusChange={handleStatusChange}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                    onDeleteTodo={handleDeleteTodo}
                    onNestTodo={handleNestTodo}
                    editingTodo={editingTodo}
                    editingText={editingText}
                    setEditingText={setEditingText}
                    changeTodoStatusMutation={changeTodoStatusMutation}
                    updateTodoMutation={updateTodoMutation}
                    deleteTodoMutation={deleteTodoMutation}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Today's TODOs */}
        <TodoList
          todos={todayTodos}
          title="Today's Todos"
          onStatusChange={handleStatusChange}
          onEditStart={handleEditStart}
          onEditSave={handleEditSave}
          onEditCancel={handleEditCancel}
          onDeleteTodo={handleDeleteTodo}
          onNestTodo={handleNestTodo}
          editingTodo={editingTodo}
          editingText={editingText}
          setEditingText={setEditingText}
          changeTodoStatusMutation={changeTodoStatusMutation}
          updateTodoMutation={updateTodoMutation}
          deleteTodoMutation={deleteTodoMutation}
        />

        {/* Summary */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {todayTodos.filter((t) => t.status === "pending").length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Pending
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-blue-500 dark:text-blue-400">
                {todayTodos.filter((t) => t.status === "in_progress").length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                In Progress
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-green-500 dark:text-green-400">
                {todayTodos.filter((t) => t.status === "completed").length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Completed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-600 dark:text-gray-400">
                {todayTodos.filter((t) => t.status === "cancelled").length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Cancelled
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
