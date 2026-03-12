type EventPayload = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(eventName: string, payload: EventPayload = {}) {
  const event = {
    eventName,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    const posthog = (window as Window & { posthog?: { capture: (name: string, data?: EventPayload) => void } })
      .posthog;
    if (posthog?.capture) {
      posthog.capture(eventName, payload);
    }
  }

  // Keep a local trail so admins can inspect funnel flow without external tooling.
  console.info("[telemetry]", event);
}

export function reportClientError(error: unknown, context: string) {
  console.error("[client-error]", context, error);
  trackEvent("client_error", { context, message: error instanceof Error ? error.message : String(error) });
}
