import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/routers/todo.router";

export const trpc = createTRPCReact<AppRouter>();
