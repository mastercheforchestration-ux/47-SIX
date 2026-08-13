const { poll } = require("./lib/event_poller");
const { POLL_EVENTS, START_URL } = require("./lib/config");
const { createLogger } = require("./lib/logger");
const { createApp } = require("./lib/web_app");
const { validateDataDirectory } = require("./lib/data_store");

const PORT = process.env.PORT || 5000;
const logger = createLogger("node-api");
const app = createApp();

function attachShutdownHandlers(server, pollController) {
  let shuttingDown = false;

  const shutdown = (signalName) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info(`Received ${signalName}; starting graceful shutdown.`);
    pollController.abort();

    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Graceful shutdown timed out; forcing exit.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

function start() {
  validateDataDirectory();
  const pollController = new AbortController();

  const server = app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
    if (POLL_EVENTS) {
      poll(START_URL, {
        logger,
        signal: pollController.signal,
        onEvent: (evt) => {
          logger.debug("Incoming event", {
            method: evt?.method || "unknown",
            id: evt?.id || "unknown",
            object: evt?.object || null,
          });
        },
      });
    } else {
      logger.info("Event polling disabled by POLL_EVENTS=false");
    }
  });

  server.pollController = pollController;
  return server;
}

if (require.main === module) {
  try {
    const server = start();
    attachShutdownHandlers(server, server.pollController);
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

module.exports = { app, start };
