const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const ROOT_DIR = path.join(__dirname, "..");
const DEFAULT_DATA_DIR = path.join(ROOT_DIR, "client", "data");
const DEFAULT_EVENT_URL = "https://eventsapi.chaturbate.com/events/47andsix/DAavfieQYdUKCEiF0iWvcjZJ/";
const DEFAULT_LOG_LEVEL = "info";
const ALLOWED_LOG_LEVELS = new Set(["error", "warn", "info", "debug"]);

function resolveDataDir(value = process.env.AGENTS_DATA_DIR) {
  if (!value) {
    return DEFAULT_DATA_DIR;
  }

  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

function resolveLogLevel(value = process.env.LOG_LEVEL) {
  const level = String(value || DEFAULT_LOG_LEVEL).toLowerCase();
  return ALLOWED_LOG_LEVELS.has(level) ? level : DEFAULT_LOG_LEVEL;
}

const DATA_DIR = resolveDataDir();
const START_URL = process.env.CB_EVENT_URL || DEFAULT_EVENT_URL;
const POLL_EVENTS = (process.env.POLL_EVENTS || "true").toLowerCase() !== "false";
const LOG_LEVEL = resolveLogLevel();

function getConfigHealthReport() {
  return {
    cb_username_present: Boolean(process.env.CB_USERNAME),
    cb_password_present: Boolean(process.env.CB_PASSWORD),
    event_url_present: Boolean(START_URL),
    poll_events_enabled: POLL_EVENTS,
    log_level: LOG_LEVEL,
    data_dir: DATA_DIR,
  };
}

module.exports = {
  DATA_DIR,
  getConfigHealthReport,
  LOG_LEVEL,
  POLL_EVENTS,
  ROOT_DIR,
  START_URL,
};