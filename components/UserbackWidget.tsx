"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useClerkReady } from "./ConditionalClerkProvider";
import { useIsChatGptApp } from "@/app/hooks";

// Component that uses Clerk hooks - only rendered when Clerk is available
function UserbackWidgetWithClerk() {
  const { user, isLoaded } = useUser();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) {
      return;
    }

    const token = process.env.NEXT_PUBLIC_USERBACK_TOKEN;
    if (!token) {
      return;
    }

    const initUserback = async () => {
      // Double-check to prevent race conditions
      if (initializedRef.current) {
        return;
      }

      try {
        const Userback = (await import("@userback/widget")).default;

        const options: {
          user_data?: {
            id: string;
            info: {
              name?: string;
              email?: string;
            };
          };
        } = {};

        // Add user data if available
        if (isLoaded && user) {
          options.user_data = {
            id: user.id,
            info: {
              name:
                user.firstName || user.lastName
                  ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                  : undefined,
              email: user.emailAddresses[0]?.emailAddress,
            },
          };
          console.log("UserbackWidget: Adding user data", options.user_data);
        }

        const userbackInstance = await Userback(token, options);
        initializedRef.current = true;
      } catch (error) {
        console.error("Failed to initialize Userback:", error);
      }
    };

    initUserback();
  }, [isLoaded, user]);

  return null;
}

// Component for ChatGPT app (no Clerk)
function UserbackWidgetWithoutClerk() {
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) {
      return;
    }

    const token = process.env.NEXT_PUBLIC_USERBACK_TOKEN;
    if (!token) {
      return;
    }

    const initUserback = async () => {
      // Double-check to prevent race conditions
      if (initializedRef.current) {
        return;
      }

      try {
        const Userback = (await import("@userback/widget")).default;
        const userbackInstance = await Userback(token, {});
        initializedRef.current = true;
      } catch (error) {
        console.error("Failed to initialize Userback:", error);
      }
    };

    initUserback();
  }, []);

  return null;
}

// Main component that conditionally renders based on environment
export function UserbackWidget() {
  const isClerkReady = useClerkReady();
  const isChatGptApp = useIsChatGptApp();

  // In ChatGPT app, render without Clerk
  if (isChatGptApp) {
    return <UserbackWidgetWithoutClerk />;
  }

  // Wait for Clerk to be ready
  if (!isClerkReady) {
    console.log("UserbackWidget: Waiting for Clerk to be ready...");
    return null;
  }

  // Clerk is ready, render with Clerk
  return <UserbackWidgetWithClerk />;
}
