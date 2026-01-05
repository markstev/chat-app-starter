import { z, ZodRawShape } from "zod";
import jwt from "jsonwebtoken";

export interface ToolResult {
  [x: string]: unknown;
  content: {
    type: "text";
    text: string;
  }[];
  structuredContent?: Record<string, unknown>;
  widgetId?: string;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (params: any, authInfo: any) => Promise<ToolResult>;
  _meta?: Record<string, unknown>;
}

export type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  path: string;
  description: string;
  widgetDomain: string;
};

export const getJwtFromAuthInfo = (authInfo: {
  extra: Record<string, unknown>;
}) => {
  // Wraps the userId in a secure JWT, with a 1d timeout
  return jwt.sign({ userId: authInfo.extra.userId }, process.env.JWT_SECRET!, {
    expiresIn: "1d",
  });
};

export function widgetMeta(
  widget: ContentWidget,
  authInfo?: { token: string; extra: Record<string, unknown> }
) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
    authInfo: authInfo,
    userJwt: authInfo ? getJwtFromAuthInfo(authInfo) : undefined,
    path: widget.path,
  } as const;
}

// Example: Todo widget (for reference - see app/todos/page.tsx for the full implementation)
// const todoWidget: ContentWidget = {
//   id: "todo_widget",
//   title: "Todo List",
//   templateUri: "ui://widget/todo-template.html?v=" + new Date().getTime(),
//   invoking: "Loading todo list...",
//   invoked: "Todo list ready",
//   path: "/todos",
//   description: "Manage your daily todos and standup",
//   widgetDomain: "https://nextjs.org/docs",
// };

// Example: Todo tool (for reference)
// const todoTool: ToolDefinition = {
//   name: "show_todos",
//   title: "Show Todos",
//   description: "Display the user's todo list",
//   inputSchema: {},
//   _meta: widgetMeta(todoWidget),
//   handler: async (_, { authInfo }) => {
//     return {
//       content: [
//         {
//           type: "text",
//           text: "Here's your todo list",
//         },
//       ],
//       _meta: widgetMeta(
//         todoWidget,
//         authInfo as { token: string; extra: Record<string, unknown> }
//       ),
//     };
//   },
// };

// Register your tools and widgets here
export const toolRegistry: ToolDefinition[] = [
  // Add your tools here
  // Example: todoTool,
];

export const widgetRegistry: ContentWidget[] = [
  // Add your widgets here
  // Example: todoWidget,
];
