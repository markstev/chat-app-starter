"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

interface Todo {
  id: string;
  text: string;
  status: TodoStatus;
  created_at: string;
  updated_at: string;
  parent_todo_id: string | null;
}

interface TodoListProps {
  todos: Todo[];
  title: string;
  onStatusChange: (todoId: string, newStatus: TodoStatus) => void;
  onEditStart: (todoId: string, currentText: string) => void;
  onEditSave: (todoId: string, text: string) => void;
  onEditCancel: () => void;
  onDeleteTodo: (todoId: string) => void;
  onNestTodo: (todoId: string, parentId: string | null) => void;
  editingTodo: string | null;
  editingText: string;
  setEditingText: (text: string) => void;
  changeTodoStatusMutation: { isPending: boolean };
  updateTodoMutation: { isPending: boolean };
  deleteTodoMutation: { isPending: boolean };
}

interface TodoNode extends Todo {
  children: TodoNode[];
}

const statusIcons = {
  pending: (
    <svg
      className="w-6 h-6 text-gray-400 dark:text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
    </svg>
  ),
  in_progress: (
    <svg
      className="w-6 h-6 text-blue-500 dark:text-blue-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 6v6l4 2" />
    </svg>
  ),
  completed: (
    <svg
      className="w-6 h-6 text-green-500 dark:text-green-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4"
      />
    </svg>
  ),
  cancelled: (
    <svg
      className="w-6 h-6 text-gray-400 dark:text-gray-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
};

const statusLabels = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const getNextStatus = (currentStatus: TodoStatus): TodoStatus => {
  switch (currentStatus) {
    case "pending":
      return "in_progress";
    case "in_progress":
      return "completed";
    case "completed":
      return "cancelled";
    case "cancelled":
      return "pending";
    default:
      return "pending";
  }
};

// Helper function to build tree structure from flat list
function buildTodoTree(todos: Todo[]): TodoNode[] {
  const todoMap = new Map<string, TodoNode>();
  const roots: TodoNode[] = [];

  // First pass: create nodes
  todos.forEach((todo) => {
    todoMap.set(todo.id, { ...todo, children: [] });
  });

  // Second pass: build tree
  todos.forEach((todo) => {
    const node = todoMap.get(todo.id)!;
    if (todo.parent_todo_id && todoMap.has(todo.parent_todo_id)) {
      const parent = todoMap.get(todo.parent_todo_id)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

interface DraggableTodoItemProps {
  node: TodoNode;
  depth: number;
  isCollapsed: boolean;
  onToggleCollapse: (id: string) => void;
  onStatusChange: (todoId: string, newStatus: TodoStatus) => void;
  onEditStart: (todoId: string, currentText: string) => void;
  onEditSave: (todoId: string, text: string) => void;
  onEditCancel: () => void;
  onDeleteTodo: (todoId: string) => void;
  onNestTodo: (todoId: string, parentId: string | null) => void;
  editingTodo: string | null;
  editingText: string;
  setEditingText: (text: string) => void;
  changeTodoStatusMutation: { isPending: boolean };
  updateTodoMutation: { isPending: boolean };
  deleteTodoMutation: { isPending: boolean };
  collapsedTodos: Set<string>;
  activeDragId: string | null;
}

function DraggableTodoItem({
  node,
  depth,
  isCollapsed,
  onToggleCollapse,
  onStatusChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDeleteTodo,
  onNestTodo,
  editingTodo,
  editingText,
  setEditingText,
  changeTodoStatusMutation,
  updateTodoMutation,
  deleteTodoMutation,
  collapsedTodos,
  activeDragId,
}: DraggableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: node.id,
    data: { todoId: node.id },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `drop-zone-${node.id}`,
    data: { todoId: node.id },
  });

  const hasChildren = node.children.length > 0;

  // Show drop zone highlight if something is being dragged over this item
  // but not if we're dragging this item itself
  const showDropZone =
    isOver && activeDragId !== node.id && activeDragId !== null;

  return (
    <>
      <div
        className={`${depth > 0 ? "ml-8" : ""} ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <div
          className={`group px-3 py-2.5 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors`}
        >
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <div
              ref={setDraggableRef}
              {...attributes}
              {...listeners}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing p-1.5 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Drag to nest under another todo"
            >
              <svg
                className="w-5 h-5 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8h16M4 16h16"
                />
              </svg>
            </div>

            {/* Collapse/Expand Icon */}
            {hasChildren ? (
              <button
                onClick={() => onToggleCollapse(node.id)}
                className="flex-shrink-0 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={isCollapsed ? "Expand" : "Collapse"}
              >
                <svg
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${
                    isCollapsed ? "" : "rotate-90"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <div className="w-8" />
            )}

            {/* Status Icon */}
            <button
              onClick={() =>
                onStatusChange(node.id, getNextStatus(node.status))
              }
              disabled={changeTodoStatusMutation.isPending}
              className="flex-shrink-0 p-1.5 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
              title={`${statusLabels[node.status]} - Click to change`}
              aria-label={`Change status from ${statusLabels[node.status]}`}
            >
              {statusIcons[node.status]}
            </button>

            {/* Todo Content */}
            <div className="flex-1 min-w-0">
              {editingTodo === node.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEditSave(node.id, editingText)}
                      disabled={
                        updateTodoMutation.isPending || !editingText.trim()
                      }
                      className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={onEditCancel}
                      className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100 break-words leading-relaxed">
                    {node.text}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(node.created_at).toLocaleDateString()}
                    {node.updated_at !== node.created_at && (
                      <span> • Updated</span>
                    )}
                    {hasChildren && (
                      <span>
                        {" "}
                        • {node.children.length} subtask
                        {node.children.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Drop Zone Button */}
            {activeDragId && activeDragId !== node.id && (
              <div
                ref={setDroppableRef}
                className={`flex-shrink-0 flex items-center justify-center px-4 py-2 rounded-md transition-all ${
                  showDropZone
                    ? "bg-blue-500 dark:bg-blue-600 text-white shadow-lg"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 opacity-60 hover:opacity-100"
                }`}
                title="Drop here to nest as subtask"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
                <span className="text-xs font-medium whitespace-nowrap">
                  {showDropZone ? "Drop here" : "Nest"}
                </span>
              </div>
            )}

            {/* Action Icons */}
            {editingTodo !== node.id && !activeDragId && (
              <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Un-nest Icon (only show if this is a nested todo) */}
                {depth > 0 && (
                  <button
                    onClick={() => onNestTodo(node.id, null)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Move to top level"
                    aria-label="Un-nest todo"
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
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                  </button>
                )}

                {/* Edit Icon */}
                <button
                  onClick={() => onEditStart(node.id, node.text)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="Edit"
                  aria-label="Edit todo"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>

                {/* Delete Icon */}
                <button
                  onClick={() => onDeleteTodo(node.id)}
                  disabled={deleteTodoMutation.isPending}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete"
                  aria-label="Delete todo"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Render children if not collapsed */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-2 mt-2">
            {node.children.map((child) => (
              <DraggableTodoItem
                key={child.id}
                node={child}
                depth={depth + 1}
                isCollapsed={collapsedTodos.has(child.id)}
                onToggleCollapse={onToggleCollapse}
                onStatusChange={onStatusChange}
                onEditStart={onEditStart}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
                onDeleteTodo={onDeleteTodo}
                onNestTodo={onNestTodo}
                editingTodo={editingTodo}
                editingText={editingText}
                setEditingText={setEditingText}
                changeTodoStatusMutation={changeTodoStatusMutation}
                updateTodoMutation={updateTodoMutation}
                deleteTodoMutation={deleteTodoMutation}
                collapsedTodos={collapsedTodos}
                activeDragId={activeDragId}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function TodoList({
  todos,
  title,
  onStatusChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  onDeleteTodo,
  onNestTodo,
  editingTodo,
  editingText,
  setEditingText,
  changeTodoStatusMutation,
  updateTodoMutation,
  deleteTodoMutation,
}: TodoListProps) {
  const [collapsedTodos, setCollapsedTodos] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    })
  );

  const todoTree = buildTodoTree(todos);

  const handleToggleCollapse = (id: string) => {
    setCollapsedTodos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) {
      return;
    }

    // Extract the actual todo ID from drop zone ID
    const overId = over.id.toString();
    const targetTodoId = overId.startsWith("drop-zone-")
      ? overId.replace("drop-zone-", "")
      : overId;

    if (active.id === targetTodoId) {
      return;
    }

    // Find the dragged todo and the target todo
    const draggedTodo = todos.find((t) => t.id === active.id);
    const targetTodo = todos.find((t) => t.id === targetTodoId);

    if (!draggedTodo || !targetTodo) {
      return;
    }

    // Check if we're trying to nest a todo under its own descendant
    const isDescendant = (parentId: string, childId: string): boolean => {
      const parent = todos.find((t) => t.id === parentId);
      if (!parent) return false;
      if (parent.parent_todo_id === childId) return true;
      if (parent.parent_todo_id) {
        return isDescendant(parent.parent_todo_id, childId);
      }
      return false;
    };

    if (isDescendant(targetTodo.id, draggedTodo.id)) {
      console.log("Cannot nest a parent under its own child");
      return;
    }

    // Nest the dragged todo under the target todo
    onNestTodo(draggedTodo.id, targetTodo.id);
  };

  const activeTodo = activeDragId
    ? todos.find((t) => t.id === activeDragId)
    : null;

  return (
    <div className="mb-6">
      <h2 className="text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
        {title}{" "}
        <span className="text-gray-500 dark:text-gray-400">
          ({todos.length})
        </span>
      </h2>

      {todos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No todos for this day.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2">
            {/* Instruction hint when dragging */}
            {activeDragId && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> Click the "Nest" button on any todo to
                make it a subtask
              </div>
            )}
            {todoTree.map((node) => (
              <DraggableTodoItem
                key={node.id}
                node={node}
                depth={0}
                isCollapsed={collapsedTodos.has(node.id)}
                onToggleCollapse={handleToggleCollapse}
                onStatusChange={onStatusChange}
                onEditStart={onEditStart}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
                onDeleteTodo={onDeleteTodo}
                onNestTodo={onNestTodo}
                editingTodo={editingTodo}
                editingText={editingText}
                setEditingText={setEditingText}
                changeTodoStatusMutation={changeTodoStatusMutation}
                updateTodoMutation={updateTodoMutation}
                deleteTodoMutation={deleteTodoMutation}
                collapsedTodos={collapsedTodos}
                activeDragId={activeDragId}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTodo ? (
              <div className="px-3 py-2.5 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 shadow-lg opacity-90 w-96 max-w-96 pointer-events-none">
                <p className="text-sm text-gray-900 dark:text-gray-100 break-words">
                  {activeTodo.text}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
