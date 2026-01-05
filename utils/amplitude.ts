import * as amplitude from "@amplitude/analytics-browser";

let isInitialized = false;

/**
 * Get the domain string from the current hostname
 * Returns the hostname for tracking purposes
 */
export function getDomainFromHost(): string {
  if (typeof window === "undefined") {
    return "localhost";
  }

  return window.location.hostname;
}

/**
 * Initialize Amplitude SDK
 * Should be called once on app startup (client-side only)
 */
export function initAmplitude(userId?: string): void {
  if (typeof window === "undefined" || isInitialized) {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) {
    console.warn(
      "NEXT_PUBLIC_AMPLITUDE_API_KEY is not set. Amplitude tracking will be disabled."
    );
    return;
  }

  try {
    amplitude.init(apiKey, userId || undefined, {
      defaultTracking: false,
    });
    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize Amplitude:", error);
  }
}

/**
 * Track an event with Amplitude
 * Automatically includes domain property
 */
export function trackEvent(
  eventName: string,
  eventProperties?: Record<string, unknown>,
  userId?: string
): void {
  if (typeof window === "undefined" || !isInitialized) {
    return;
  }

  const domain = getDomainFromHost();
  const properties = {
    ...eventProperties,
    domain,
  };

  try {
    amplitude.track(
      eventName,
      properties,
      userId ? { user_id: userId } : undefined
    );
  } catch (error) {
    console.error("Failed to track Amplitude event:", error);
  }
}
