"use client";

import { useSearchParams } from "next/navigation";

export function useIsChatGptApp(): boolean {
  const searchParams = useSearchParams();

  // Check URL params for app=chatgpt
  if (searchParams.get("app") === "chatgpt") {
    return true;
  }

  // Check URL params for firstParty=true
  if (searchParams.get("firstParty") === "true") {
    return false;
  }

  // Check window global (client-side only)
  if (typeof window !== "undefined") {
    return (window as any).__isChatGptApp ?? false;
  }

  return false;
}
