import { baseURL } from "@/baseUrl";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyClerkToken } from "@clerk/mcp-tools/next";
import { auth } from "@clerk/nextjs/server";
import { widgetRegistry, toolRegistry } from "./tools.registry";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

const handler = createMcpHandler(async (server) => {
  for (const widget of widgetRegistry) {
    const html = await getAppsSdkCompatibleHtml(baseURL, widget.path);
    server.registerResource(
      "todo-widget",
      widget.templateUri,
      {
        title: widget.title,
        description: widget.description,
        mimeType: "text/html+skybridge",
        _meta: {
          "openai/widgetDescription": widget.description,
          "openai/widgetPrefersBorder": true,
        },
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html+skybridge",
            text: `<html>${html}</html>`,
            _meta: {
              "openai/widgetDescription": widget.description,
              "openai/widgetPrefersBorder": true,
              "openai/widgetDomain": widget.widgetDomain,
            },
          },
        ],
      })
    );
  }

  for (const tool of toolRegistry) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        _meta: tool._meta,
      },
      tool.handler
    );
  }
});

const authHandler = withMcpAuth(
  handler,
  async (_, token) => {
    const clerkAuth = await auth({ acceptsToken: "oauth_token" });
    return verifyClerkToken(clerkAuth, token);
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
  }
);
export const GET = authHandler;
export const POST = authHandler;
