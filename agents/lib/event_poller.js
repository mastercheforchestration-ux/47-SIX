async function poll(url, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    onEvent = () => {},
    logger = console,
    retryDelayMs = 5000,
    maxRetryDelayMs = 120000,
    backoffFactor = 1.6,
    jitterRatio = 0.25,
    signal,
    attempt = 0,
  } = options;

  try {
    if (typeof fetchImpl !== "function") {
      throw new Error("A fetch implementation is required to poll events.");
    }

    if (signal?.aborted) {
      logger.info("Polling aborted; stopping poll cycle.");
      return;
    }

    const response = await fetchImpl(url, { signal });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const events = Array.isArray(data?.events) ? data.events : [];

    for (const event of events) {
      const eventType = event?.method || event?.type || event?.eventType || "unknown";
      if (typeof logger.debug === "function") {
        logger.debug(`Polled event type: ${eventType}`);
      } else if (typeof logger.info === "function") {
        logger.info(`Polled event type: ${eventType}`);
      }
      onEvent(event);
    }

    if (signal?.aborted) {
      logger.info("Polling aborted; stopping poll cycle.");
      return;
    }

    if (data?.nextUrl) {
      await poll(data.nextUrl, {
        fetchImpl,
        onEvent,
        logger,
        retryDelayMs,
        maxRetryDelayMs,
        backoffFactor,
        jitterRatio,
        signal,
        attempt: 0,
      });
    } else {
      logger.info("No nextUrl returned; stopping poll cycle.");
    }
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted) {
      logger.info("Polling aborted during request; stopping poll cycle.");
      return;
    }

    const nextAttempt = attempt + 1;
    const baseDelayMs = Math.min(
      retryDelayMs * Math.pow(backoffFactor, attempt),
      maxRetryDelayMs
    );
    const jitterWindowMs = baseDelayMs * jitterRatio;
    const jitterMs = (Math.random() * 2 - 1) * jitterWindowMs;
    const delayMs = Math.max(0, Math.round(baseDelayMs + jitterMs));

    logger.error("Polling error", error.message || error);
    if (typeof logger.warn === "function") {
      logger.warn(
        `Retrying poll in ${delayMs}ms (attempt ${nextAttempt}, base ${baseDelayMs}ms).`
      );
    }

    const timeoutId = setTimeout(() => {
      if (signal?.aborted) {
        logger.info("Polling aborted before retry; skipping retry.");
        return;
      }

      poll(url, {
        fetchImpl,
        onEvent,
        logger,
        retryDelayMs,
        maxRetryDelayMs,
        backoffFactor,
        jitterRatio,
        signal,
        attempt: nextAttempt,
      });
    }, delayMs);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeoutId);
          logger.info("Polling abort received; cleared pending retry.");
        },
        { once: true }
      );
    }
  }
}

module.exports = {
  poll,
};
