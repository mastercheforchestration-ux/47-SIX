const LOG_LEVEL_VALUE = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const HISTOGRAM_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000];

const state = {
  log_count_total: 0,
  log_error_total: 0,
  request_latency_sum_ms: 0,
  request_latency_count: 0,
  latency_bucket_counts: Object.fromEntries(HISTOGRAM_BUCKETS_MS.map((bucket) => [bucket, 0])),
};

function recordLogEvent(level) {
  state.log_count_total += 1;
  if (String(level).toLowerCase() === "error") {
    state.log_error_total += 1;
  }
}

function observeRequestLatencyMs(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  state.request_latency_sum_ms += durationMs;
  state.request_latency_count += 1;

  for (const bucket of HISTOGRAM_BUCKETS_MS) {
    if (durationMs <= bucket) {
      state.latency_bucket_counts[bucket] += 1;
    }
  }
}

function getLogMetricsSnapshot(uptimeSeconds, logLevel) {
  const uptime = Number(uptimeSeconds) > 0 ? Number(uptimeSeconds) : 0;
  const rate = uptime > 0 ? state.log_count_total / uptime : 0;

  return {
    log_count_total: state.log_count_total,
    log_error_total: state.log_error_total,
    log_latency_count: state.request_latency_count,
    log_latency_sum_ms: Number(state.request_latency_sum_ms.toFixed(3)),
    log_rate_per_second: Number(rate.toFixed(6)),
    log_level_value: LOG_LEVEL_VALUE[String(logLevel || "info").toLowerCase()] ?? 2,
  };
}

function renderLogPrometheusMetrics(service, uptimeSeconds, logLevel) {
  const uptime = Number(uptimeSeconds) > 0 ? Number(uptimeSeconds) : 0;
  const rate = uptime > 0 ? state.log_count_total / uptime : 0;
  const level = String(logLevel || "info").toLowerCase();
  const levelValue = LOG_LEVEL_VALUE[level] ?? 2;

  const lines = [
    "# HELP chatterbate_log_count_total Total number of logs emitted.",
    "# TYPE chatterbate_log_count_total counter",
    `chatterbate_log_count_total{service=\"${service}\"} ${state.log_count_total}`,
    "# HELP chatterbate_log_error_total Total number of error logs emitted.",
    "# TYPE chatterbate_log_error_total counter",
    `chatterbate_log_error_total{service=\"${service}\"} ${state.log_error_total}`,
    "# HELP chatterbate_log_latency_ms Latency histogram for handled requests in milliseconds.",
    "# TYPE chatterbate_log_latency_ms histogram",
  ];

  for (const bucket of HISTOGRAM_BUCKETS_MS) {
    lines.push(
      `chatterbate_log_latency_ms_bucket{service=\"${service}\",le=\"${bucket}\"} ${state.latency_bucket_counts[bucket]}`
    );
  }

  lines.push(
    `chatterbate_log_latency_ms_bucket{service=\"${service}\",le=\"+Inf\"} ${state.request_latency_count}`,
    `chatterbate_log_latency_ms_sum{service=\"${service}\"} ${Number(state.request_latency_sum_ms.toFixed(3))}`,
    `chatterbate_log_latency_ms_count{service=\"${service}\"} ${state.request_latency_count}`,
    "# HELP chatterbate_log_level Gauge value for active log level.",
    "# TYPE chatterbate_log_level gauge",
    `chatterbate_log_level{service=\"${service}\",level=\"${level}\"} ${levelValue}`,
    "# HELP chatterbate_log_rate Average logs per second since process start.",
    "# TYPE chatterbate_log_rate gauge",
    `chatterbate_log_rate{service=\"${service}\"} ${Number(rate.toFixed(6))}`
  );

  return lines.join("\n");
}

module.exports = {
  getLogMetricsSnapshot,
  observeRequestLatencyMs,
  recordLogEvent,
  renderLogPrometheusMetrics,
};
