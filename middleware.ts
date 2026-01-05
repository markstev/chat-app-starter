import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { NextResponse } from "next/server";
import { getCorsHeaders } from "@/utils/cors";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const isPublicRoute = createRouteMatcher([
  "/.well-known/oauth-authorization-server(.*)",
  "/.well-known/oauth-protected-resource(.*)",
  "/.well-known/openid-configuration(.*)",
  "/mcp(.*)",
  "/",
  "/todos(.*)",
  "/custom-page(.*)",
  "/trpc-demo(.*)",
  "/api/trpc(.*)",
  "/chat(.*)",
]);

// Note: Admin routes removed - add your own admin routes here if needed
const isAdminRoute = createRouteMatcher([]);

export default clerkMiddleware(async (auth, req) => {
  console.log("req.url", req.url);

  const origin = req.headers.get("origin");

  // Allow public access to .well-known endpoints, /mcp, and main app routes
  if (isPublicRoute(req)) {
    // Handle CORS preflight for public routes
    if (req.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    return NextResponse.next({
      headers: getCorsHeaders(origin),
    });
  }

  // Handle CORS preflight for protected routes
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Protect all other routes
  await auth.protect();

  // Check admin access for admin routes
  if (isAdminRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: getCorsHeaders(origin),
      });
    }

    // Fetch user to get publicMetadata (not included in session claims by default)
    try {
      const user = await clerkClient.users.getUser(userId);
      const isAdmin =
        (user.publicMetadata as { role?: string })?.role === "admin";

      if (!isAdmin) {
        return new NextResponse("Forbidden: Admin access required", {
          status: 403,
          headers: getCorsHeaders(origin),
        });
      }
    } catch (userError) {
      console.error("Failed to fetch user for admin check:", userError);
      return new NextResponse("Internal Server Error", {
        status: 500,
        headers: getCorsHeaders(origin),
      });
    }
  }

  // Add CORS headers to protected routes as well
  return NextResponse.next({
    headers: getCorsHeaders(origin),
  });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
