const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const { createApp } = require("../lib/web_app");
const { validateDataDirectory } = require("../lib/data_store");

function createTempDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agents-data-"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function requestJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: pathname },
      (res) => {
        let body = "";

        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, body });
        });
      },
    );

    req.on("error", reject);
  });
}

test("validateDataDirectory rejects malformed data", () => {
  const dataDir = createTempDataDir();

  writeJson(path.join(dataDir, "profile.json"), { name: "Jesse" });
  writeJson(path.join(dataDir, "messages.json"), { messages: [] });
  fs.writeFileSync(path.join(dataDir, "analytics.json"), "{");

  assert.throws(() => validateDataDirectory(dataDir), /Data integrity check failed/);
});

test("validateDataDirectory rejects schema mismatches", () => {
  const dataDir = createTempDataDir();

  writeJson(path.join(dataDir, "profile.json"), {
    name: "Jesse",
    role: "Executive Chef",
    business: "47-and-SIX",
  });
  writeJson(path.join(dataDir, "messages.json"), [{ from: "client", text: "Hello" }]);
  writeJson(path.join(dataDir, "analytics.json"), {
    visits: 120,
    messages: 42,
    conversion_rate: 0.31,
  });

  assert.throws(() => validateDataDirectory(dataDir), /Data integrity check failed/);
});

test("routes return shared JSON from the configured data directory", async () => {
  const dataDir = createTempDataDir();

  writeJson(path.join(dataDir, "profile.json"), {
    name: "Jesse",
    role: "Executive Chef",
    business: "47-and-SIX",
  });
  writeJson(path.join(dataDir, "messages.json"), {
    messages: [{ from: "client", text: "Hello" }],
  });
  writeJson(path.join(dataDir, "analytics.json"), {
    visits: 120,
    messages: 42,
    conversion_rate: 0.31,
  });

  validateDataDirectory(dataDir);

  const app = createApp({ dataDir });
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const profile = await requestJson(port, "/profile");
    const messages = await requestJson(port, "/messages");
    const analytics = await requestJson(port, "/analytics");
    const health = await requestJson(port, "/health");
    const metrics = await requestJson(port, "/metrics");
    const promMetrics = await requestJson(port, "/metrics/prometheus");

    assert.equal(profile.statusCode, 200);
    assert.equal(messages.statusCode, 200);
    assert.equal(analytics.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal(metrics.statusCode, 200);
    assert.equal(promMetrics.statusCode, 200);
    assert.deepEqual(JSON.parse(profile.body), {
      name: "Jesse",
      role: "Executive Chef",
      business: "47-and-SIX",
    });
    assert.deepEqual(JSON.parse(messages.body), {
      messages: [{ from: "client", text: "Hello" }],
    });
    assert.deepEqual(JSON.parse(analytics.body), {
      visits: 120,
      messages: 42,
      conversion_rate: 0.31,
    });
    assert.equal(JSON.parse(health.body).status, "ok");
    const metricsPayload = JSON.parse(metrics.body);
    assert.equal(metricsPayload.service, "node");
    assert.equal(metricsPayload.status, "ok");
    assert.equal(metricsPayload.data_ok, true);
    assert.equal(typeof metricsPayload.uptime_seconds, "number");
    assert.equal(typeof metricsPayload.rss_bytes, "number");
    assert.match(promMetrics.body, /# HELP chatterbate_up/);
    assert.match(promMetrics.body, /chatterbate_up\{service="node"\}/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
