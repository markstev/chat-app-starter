import { useCallback } from "react";
import type { DisplayMode } from "./types";
import { DISPLAY_MODE_MESSAGE_TYPE } from "./use-send-message";

/**
 * Hook to request display mode changes from the ChatGPT host.
 *
 * @returns A function to request a specific display mode. The host may reject the request.
 *          For mobile, PiP is always coerced to fullscreen.
 *
 * @example
 * ```tsx
 * const requestDisplayMode = useRequestDisplayMode();
 *
 * const handleExpand = async () => {
 *   const { mode } = await requestDisplayMode("fullscreen");
 *   console.log("Granted mode:", mode);
 * };
 * ```
 */
export function useRequestDisplayMode() {
  const requestDisplayMode = useCallback(async (mode: DisplayMode) => {
    let result: { mode: DisplayMode };

    if (typeof window !== "undefined" && window?.openai?.requestDisplayMode) {
      result = await window.openai.requestDisplayMode({ mode });
    } else {
      result = { mode };
    }

    // Notify parent frame about the display mode change
    // This ensures the parent knows about the change even if SET_GLOBALS_EVENT_TYPE
    // hasn't fired yet or if we're not in a ChatGPT context
    if (typeof window !== "undefined") {
      const isInIframe = window.self !== window.top;

      if (isInIframe && window.parent) {
        window.parent.postMessage(
          {
            type: DISPLAY_MODE_MESSAGE_TYPE,
            displayMode: result.mode,
          },
          "*"
        );
      } else {
        window.dispatchEvent(
          new CustomEvent(DISPLAY_MODE_MESSAGE_TYPE, {
            detail: { displayMode: result.mode },
          })
        );
      }
    }

    return result;
  }, []);

  return requestDisplayMode;
}
