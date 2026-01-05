import { db, todos, standup, withUserContext } from "../db";
import { sql, eq, and, inArray, lt } from "drizzle-orm";

export interface TodayStandupResult {
  previousStandup: any | null;
  standup: any;
  todos: any[];
  previousTodos: any[];
}

/**
 * Helper function to get or create today's standup for a user
 * Returns the standup ID
 */
async function getOrCreateTodayStandup(
  userId: string,
  tx: any
): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try to find today's standup for this user
  let todayStandup = await tx
    .select()
    .from(standup)
    .where(and(eq(standup.date, today), eq(standup.user_id, userId)))
    .limit(1);

  // If no standup exists for today, create one
  if (todayStandup.length === 0) {
    const [newStandup] = await tx
      .insert(standup)
      .values({ date: today, user_id: userId })
      .returning();
    todayStandup = [newStandup];
  }

  return todayStandup[0].id;
}

export async function getTodayStandup(
  userId: string
): Promise<TodayStandupResult> {
  return withUserContext(userId, async (tx) => {
    console.log("getTodayStandup", userId, "service");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create today's standup
    const todayStandupId = await getOrCreateTodayStandup(userId, tx);

    // Get the standup object
    const todayStandup = await tx
      .select()
      .from(standup)
      .where(eq(standup.id, todayStandupId))
      .limit(1);

    // Find the most recent previous standup for this user
    const previousStandup = await tx
      .select()
      .from(standup)
      .where(and(lt(standup.date, today), eq(standup.user_id, userId)))
      .orderBy(sql`${standup.date} DESC`)
      .limit(1);

    console.log("Looked for previous standup");

    // Check if we need to copy todos (if this standup has no todos)
    const existingTodos = await tx
      .select()
      .from(todos)
      .where(
        and(eq(todos.standup_id, todayStandupId), eq(todos.user_id, userId))
      );

    const needToCopyTodos = existingTodos.length === 0;

    if (needToCopyTodos) {
      // If there's a previous standup, duplicate outstanding todos
      if (previousStandup.length > 0) {
        const outstandingTodos = await tx
          .select()
          .from(todos)
          .where(
            and(
              eq(todos.user_id, userId),
              eq(todos.standup_id, previousStandup[0]!.id),
              sql`${todos.status} IN ('pending', 'in_progress')`
            )
          );

        // Duplicate each outstanding todo for the new standup
        if (outstandingTodos.length > 0) {
          let oldIdToNewId = new Map<string, string>();
          outstandingTodos.forEach((todo) => {
            oldIdToNewId.set(todo.id, crypto.randomUUID());
          });
          const duplicatedTodos = outstandingTodos.map((todo) => ({
            id: oldIdToNewId.get(todo.id),
            text: todo.text,
            standup_id: todayStandupId,
            status: todo.status,
            parent_todo_id: todo.parent_todo_id
              ? oldIdToNewId.get(todo.parent_todo_id)
              : null,
            user_id: userId,
          }));

          await tx.insert(todos).values(duplicatedTodos);
        }
      }
    } else {
      console.log("Found today's standup");
    }

    // Get all todos for today's standup
    const standupIds = [todayStandupId];
    if (previousStandup[0]) {
      standupIds.push(previousStandup[0].id);
    }

    const recentTodos = await tx
      .select()
      .from(todos)
      .where(
        and(eq(todos.user_id, userId), inArray(todos.standup_id, standupIds))
      )
      .orderBy(todos.id);

    return {
      previousStandup: previousStandup[0] ?? null,
      standup: todayStandup[0]!,
      todos: recentTodos.filter((todo) => todo.standup_id === todayStandupId),
      previousTodos: recentTodos.filter(
        (todo) =>
          previousStandup[0] && todo.standup_id === previousStandup[0].id
      ),
    };
  });
}

export interface AddTodoInput {
  text: string[];
  standupId?: string;
  parentTodoId?: string;
}

export async function addTodo(
  userId: string,
  input: AddTodoInput
): Promise<any[]> {
  return withUserContext(userId, async (tx) => {
    // If no standupId provided, get or create today's standup
    const standupId =
      input.standupId || (await getOrCreateTodayStandup(userId, tx));

    const todosToInsert = input.text.map((text) => ({
      id: crypto.randomUUID(),
      text,
      standup_id: standupId,
      status: "pending" as const,
      user_id: userId,
      parent_todo_id: input.parentTodoId ?? null,
    }));

    const newTodos = await tx.insert(todos).values(todosToInsert).returning();

    return newTodos;
  });
}

export interface UpdateTodoInput {
  id: string;
  text?: string;
  status?: "pending" | "in_progress" | "completed" | "cancelled";
}

export async function updateTodo(
  userId: string,
  input: UpdateTodoInput
): Promise<any> {
  return withUserContext(userId, async (tx) => {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (input.text !== undefined) {
      updateData.text = input.text;
    }

    if (input.status !== undefined) {
      updateData.status = input.status;
    }

    const [updatedTodo] = await tx
      .update(todos)
      .set(updateData)
      .where(and(eq(todos.id, input.id), eq(todos.user_id, userId)))
      .returning();

    if (!updatedTodo) {
      throw new Error(`Todo with ID ${input.id} not found`);
    }

    return updatedTodo;
  });
}

export async function deleteTodo(userId: string, todoId: string): Promise<any> {
  return withUserContext(userId, async (tx) => {
    // First get the todo to show what was deleted
    const todoToDelete = await tx
      .select()
      .from(todos)
      .where(and(eq(todos.id, todoId), eq(todos.user_id, userId)))
      .limit(1);

    if (todoToDelete.length === 0) {
      throw new Error(`Todo with ID ${todoId} not found`);
    }

    await tx
      .delete(todos)
      .where(and(eq(todos.id, todoId), eq(todos.user_id, userId)));

    return todoToDelete[0];
  });
}

export interface OrganizeTodosInput {
  relationships: Array<{
    childTodoText: string;
    parentTodoText: string;
  }>;
}

export interface OrganizeTodosResult {
  updatedTodos: Array<{
    child: any;
    parent: any;
    updatedTodo: any;
  }>;
  errors: string[];
}

export async function organizeTodos(
  userId: string,
  input: OrganizeTodosInput
): Promise<OrganizeTodosResult> {
  // Get today's standup and todos
  const todayStandup = await getTodayStandup(userId);
  const todayTodos = todayStandup.todos;

  return withUserContext(userId, async (tx) => {
    // Create maps for quick lookup by text
    const todoByText = new Map<string, any>();
    todayTodos.forEach((todo) => {
      todoByText.set(todo.text, todo);
    });

    const updatedTodos = [];
    const errors = [];

    // Process each relationship
    for (const relationship of input.relationships) {
      const childTodo = todoByText.get(relationship.childTodoText);
      const parentTodo = todoByText.get(relationship.parentTodoText);

      if (!childTodo) {
        errors.push(`Child todo not found: "${relationship.childTodoText}"`);
        continue;
      }

      if (!parentTodo) {
        errors.push(`Parent todo not found: "${relationship.parentTodoText}"`);
        continue;
      }

      if (childTodo.id === parentTodo.id) {
        errors.push(
          `Cannot set todo as its own parent: "${relationship.childTodoText}"`
        );
        continue;
      }

      // Update the child todo to set the parent
      const [updatedTodo] = await tx
        .update(todos)
        .set({
          parent_todo_id: parentTodo.id,
          updated_at: new Date(),
        })
        .where(and(eq(todos.id, childTodo.id), eq(todos.user_id, userId)))
        .returning();

      if (updatedTodo) {
        updatedTodos.push({
          child: childTodo,
          parent: parentTodo,
          updatedTodo,
        });
      }
    }

    return {
      updatedTodos,
      errors,
    };
  });
}
