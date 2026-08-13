const { LOG_LEVEL } = require("./config");
const { recordLogEvent } = require("./telemetry");

const LEVEL_ORDER = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function shouldLog(level) {
  return LEVEL_ORDER[level] <= LEVEL_ORDER[LOG_LEVEL];
}

function normalizeMetaValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

function normalizeMeta(meta) {
  if (!meta.length) {
    return undefined;
  }

  if (meta.length === 1) {
    return normalizeMetaValue(meta[0]);
  }

  return meta.map((item) => normalizeMetaValue(item));
}

function logWithConsole(method, level, scope, message, ...meta) {
  if (!shouldLog(level)) {
    return;
  }

  recordLogEvent(level);

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message: String(message),
  };

  const metaValue = normalizeMeta(meta);
  if (metaValue !== undefined) {
    entry.meta = metaValue;
  }

  console[method](JSON.stringify(entry));
}

function createLogger(scope) {
  return {
    error(message, ...meta) {
      logWithConsole("error", "error", scope, message, ...meta);
    },
    warn(message, ...meta) {
      logWithConsole("warn", "warn", scope, message, ...meta);
    },
    info(message, ...meta) {
      logWithConsole("log", "info", scope, message, ...meta);
    },
    debug(message, ...meta) {
      logWithConsole("debug", "debug", scope, message, ...meta);
    },
    log(message, ...meta) {
      logWithConsole("log", "info", scope, message, ...meta);
    },
  };
}

module.exports = {
  createLogger,
};
