import { useCallback } from "react";

/**
 * Message type for cross-frame communication
 */
export const CHAT_MESSAGE_TYPE = "chat-warmup:send-message";

/**
 * Message type for display mode changes from child iframe to parent
 */
export const DISPLAY_MODE_MESSAGE_TYPE = "chat-warmup:display-mode-change";

/**
 * Message type for chat messages sent from parent to widget iframe
 */
export const CHAT_MESSAGE_FROM_PARENT_TYPE =
  "chat-warmup:chat-message-from-parent";

/**
 * Hook to send follow-up messages to the ChatGPT conversation.
 * If not in a ChatGPT context, sends the message to the parent frame (if in an iframe)
 * or dispatches a custom event for the parent page to listen to.
 *
 * @returns A function that sends a message prompt to ChatGPT or parent frame
 *
 * @example
 * ```tsx
 * const sendMessage = useSendMessage();
 *
 * const handleAction = async () => {
 *   await sendMessage("Tell me more about this topic");
 * };
 * ```
 */
export function useSendMessage() {
  const sendMessage = useCallback((prompt: string) => {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    // First, try ChatGPT API if available
    if (window?.openai?.sendFollowUpMessage) {
      return window.openai.sendFollowUpMessage({ prompt });
    }

    // If not in ChatGPT context, send to parent frame if in an iframe
    const isInIframe = window.self !== window.top;

    if (isInIframe && window.parent) {
      // Send message to parent frame via postMessage
      window.parent.postMessage(
        {
          type: CHAT_MESSAGE_TYPE,
          prompt,
        },
        "*" // In production, you might want to specify the origin
      );
      return Promise.resolve();
    }

    // If not in an iframe, dispatch a custom event that the parent page can listen to
    // This is useful when the widget is embedded directly (not in an iframe)
    window.dispatchEvent(
      new CustomEvent(CHAT_MESSAGE_TYPE, {
        detail: { prompt },
      })
    );

    return Promise.resolve();
  }, []);

  return sendMessage;
}
