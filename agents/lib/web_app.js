const express = require("express");
const { exec } = require("child_process");
const { getConfigHealthReport } = require("./config");
const { getDataHealthReport, loadJSON, DATA_DIR } = require("./data_store");
const { createLogger } = require("./logger");
const {
  getLogMetricsSnapshot,
  observeRequestLatencyMs,
  renderLogPrometheusMetrics,
} = require("./telemetry");

function getRuntimeMetrics(dataDir) {
  const config = getConfigHealthReport();
  const data = getDataHealthReport(dataDir);
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Number(process.uptime().toFixed(3));
  const logMetrics = getLogMetricsSnapshot(uptimeSeconds, config.log_level);

  return {
    service: "node",
    uptime_seconds: uptimeSeconds,
    status: data.ok ? "ok" : "error",
    data_ok: data.ok,
    problem_count: data.problems.length,
    log_level: config.log_level,
    ...logMetrics,
    rss_bytes: memoryUsage.rss,
    heap_used_bytes: memoryUsage.heapUsed,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function renderPrometheusMetrics(metrics) {
  const upValue = metrics.status === "ok" ? 1 : 0;
  const dataOkValue = metrics.data_ok ? 1 : 0;
  const level = String(metrics.log_level || "info").toLowerCase();

  return [
    "# HELP chatterbate_up Service health status where 1=ok and 0=error.",
    "# TYPE chatterbate_up gauge",
    `chatterbate_up{service="node"} ${upValue}`,
    "# HELP chatterbate_data_ok Data integrity status where 1=ok and 0=error.",
    "# TYPE chatterbate_data_ok gauge",
    `chatterbate_data_ok{service="node"} ${dataOkValue}`,
    "# HELP chatterbate_problem_count Number of data integrity problems.",
    "# TYPE chatterbate_problem_count gauge",
    `chatterbate_problem_count{service="node"} ${metrics.problem_count}`,
    "# HELP chatterbate_uptime_seconds Service uptime in seconds.",
    "# TYPE chatterbate_uptime_seconds gauge",
    `chatterbate_uptime_seconds{service="node"} ${metrics.uptime_seconds}`,
    "# HELP chatterbate_memory_rss_bytes Resident set size in bytes.",
    "# TYPE chatterbate_memory_rss_bytes gauge",
    `chatterbate_memory_rss_bytes{service="node"} ${metrics.rss_bytes}`,
    "# HELP chatterbate_memory_heap_used_bytes Heap used in bytes.",
    "# TYPE chatterbate_memory_heap_used_bytes gauge",
    `chatterbate_memory_heap_used_bytes{service="node"} ${metrics.heap_used_bytes}`,
    "# HELP chatterbate_log_level_info Active log level marker metric with value 1.",
    "# TYPE chatterbate_log_level_info gauge",
    `chatterbate_log_level_info{service="node",level="${level}"} 1`,
    renderLogPrometheusMetrics("node", metrics.uptime_seconds, level),
    "# HELP chatterbate_timestamp_seconds Current UNIX timestamp.",
    "# TYPE chatterbate_timestamp_seconds gauge",
    `chatterbate_timestamp_seconds{service="node"} ${metrics.timestamp}`,
    "",
  ].join("\n");
}

function createApp(options = {}) {
  const dataDir = options.dataDir || DATA_DIR;
  const logger = options.logger || createLogger("node-web");
  const app = express();

  app.use((req, res, next) => {
    const startNs = process.hrtime.bigint();
    const headerValue = req.headers["x-request-id"];
    const requestId =
      (typeof headerValue === "string" && headerValue.trim()) ||
      `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      observeRequestLatencyMs(durationMs);
      logger.info("HTTP request completed", {
        request_id: requestId,
        method: req.method,
        path: req.originalUrl,
        status_code: res.statusCode,
        duration_ms: Number(durationMs.toFixed(3)),
      });
    });

    next();
  });

  app.get("/", (req, res) => {
    res.send("Agents backend is running");
  });

  app.get("/run-pulse", (req, res) => {
    exec("python omni_master_pulse.py", (error, stdout) => {
      if (error) {
        logger.error("Pulse command failed", {
          request_id: req.requestId,
          error_message: error.message,
        });
        return res.status(500).send(error.message);
      }
      res.send("Pulse executed:\n" + stdout);
    });
  });

  app.get("/profile", (req, res) => {
    try {
      res.json(loadJSON("profile.json", dataDir));
    } catch (error) {
      logger.warn("Profile route failed", {
        request_id: req.requestId,
        error_message: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/messages", (req, res) => {
    try {
      res.json(loadJSON("messages.json", dataDir));
    } catch (error) {
      logger.warn("Messages route failed", {
        request_id: req.requestId,
        error_message: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/analytics", (req, res) => {
    try {
      res.json(loadJSON("analytics.json", dataDir));
    } catch (error) {
      logger.warn("Analytics route failed", {
        request_id: req.requestId,
        error_message: error.message,
      });
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/health", (req, res) => {
    const config = getConfigHealthReport();
    const data = getDataHealthReport(dataDir);
    const healthy = data.ok && config.cb_username_present && config.event_url_present;

    res.json({
      status: healthy ? "ok" : "error",
      service: "node",
      config,
      data,
    });
  });

  app.get("/metrics", (req, res) => {
    res.json(getRuntimeMetrics(dataDir));
  });

  app.get("/metrics/prometheus", (req, res) => {
    const metrics = getRuntimeMetrics(dataDir);
    res.type("text/plain").send(renderPrometheusMetrics(metrics));
  });

  return app;
}

module.exports = { createApp };
