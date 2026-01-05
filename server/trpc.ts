import { initTRPC, TRPCError } from "@trpc/server";
import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "@clerk/nextjs/server";
import { verifyToken, createClerkClient } from "@clerk/backend";
import jwt from "jsonwebtoken";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Context type with optional userId and admin status
export type Context = {
  userId?: string;
  isAdmin?: boolean;
};

// Create context from the request
export const createContext = async (
  opts: FetchCreateContextFnOptions
): Promise<Context> => {
  const authHeader = opts.req.headers.get("Authorization");

  if (!authHeader) {
    // Try using Clerk's auth() for requests that come through Next.js middleware
    // This works when Clerk middleware has set up the auth context from cookies
    try {
      const clerkAuth = await auth();
      if (clerkAuth.userId) {
        // Fetch user to get publicMetadata (not included in session claims by default)
        try {
          const user = await clerkClient.users.getUser(clerkAuth.userId);
          const isAdmin =
            (user.publicMetadata as { role?: string })?.role === "admin";
          return { userId: clerkAuth.userId, isAdmin };
        } catch (userError) {
          // If fetching user fails, continue without admin check
          console.warn("Failed to fetch user for admin check:", userError);
          return { userId: clerkAuth.userId, isAdmin: false };
        }
      }
    } catch (error) {
      // If auth() fails, continue - this is expected for custom token flows
    }
    return {};
  }

  // Check for CustomBearer prefix (ChatGPT custom JWT)
  if (authHeader.startsWith("CustomBearer ")) {
    const token = authHeader.substring(13); // Remove "CustomBearer " prefix

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      return { userId: decoded.userId };
    } catch (error) {
      console.error("Custom JWT verification failed:", error);
      return {};
    }
  }

  // Check for Bearer prefix (Clerk token)
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      // First, try to verify the token explicitly using Clerk's verifyToken function
      // This is the most reliable way to verify tokens from Authorization headers
      try {
        const verified = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        if (verified.sub) {
          // Fetch user to get publicMetadata (not included in token by default)
          try {
            const user = await clerkClient.users.getUser(verified.sub);
            const isAdmin =
              (user.publicMetadata as { role?: string })?.role === "admin";
            return { userId: verified.sub, isAdmin };
          } catch (userError) {
            // If fetching user fails, continue without admin check
            console.warn("Failed to fetch user for admin check:", userError);
            return { userId: verified.sub, isAdmin: false };
          }
        }
      } catch (verifyError) {
        // If explicit verification fails, try auth() as fallback
        // This handles cases where cookies might be available
        console.warn(
          "Clerk token verification failed, trying auth() fallback:",
          verifyError
        );

        try {
          const clerkAuth = await auth({ acceptsToken: "oauth_token" });
          if (clerkAuth.userId) {
            // Fetch user to get publicMetadata (not included in session claims by default)
            try {
              const user = await clerkClient.users.getUser(clerkAuth.userId);
              const isAdmin =
                (user.publicMetadata as { role?: string })?.role === "admin";
              return { userId: clerkAuth.userId, isAdmin };
            } catch (userError) {
              // If fetching user fails, continue without admin check
              console.warn("Failed to fetch user for admin check:", userError);
              return { userId: clerkAuth.userId, isAdmin: false };
            }
          }
        } catch (authError) {
          console.error("Clerk auth() fallback also failed:", authError);
        }
      }
    } catch (error) {
      console.error("Clerk token verification failed:", error);
      return {};
    }
  }

  // No valid auth header format
  return {};
};

// Initialize tRPC with context
const t = initTRPC.context<Context>().create({
  transformer: undefined,
});

// Middleware to ensure user is authenticated
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  return next({
    ctx: {
      userId: ctx.userId, // userId is guaranteed to be defined here
      isAdmin: ctx.isAdmin, // Pass through isAdmin for potential admin checks
    },
  });
});

// Middleware to ensure user is admin
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    });
  }

  if (!ctx.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({
    ctx: {
      userId: ctx.userId, // userId is guaranteed to be defined here
      isAdmin: ctx.isAdmin, // isAdmin is guaranteed to be true here
    },
  });
});

// Base router and procedure helpers
export const router = t.router;
export const procedure = t.procedure;

// Protected procedure that requires authentication
export const userProcedure = t.procedure.use(isAuthenticated);

// Protected procedure that requires admin access
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
