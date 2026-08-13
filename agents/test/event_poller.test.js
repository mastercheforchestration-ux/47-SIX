const test = require('node:test');
const assert = require('node:assert/strict');
const { poll } = require('../lib/event_poller');

test('poll collects events from each page until nextUrl is absent', async () => {
  const calls = [];
  const events = [];

  const fetchImpl = async (url) => {
    calls.push(url);

    if (url === 'https://example.test/first') {
      return {
        ok: true,
        json: async () => ({ events: [{ id: 1 }], nextUrl: 'https://example.test/second' }),
      };
    }

    return {
      ok: true,
      json: async () => ({ events: [{ id: 2 }], nextUrl: null }),
    };
  };

  await poll('https://example.test/first', {
    fetchImpl,
    onEvent: (event) => events.push(event),
  });

  assert.deepEqual(calls, ['https://example.test/first', 'https://example.test/second']);
  assert.deepEqual(events.map((event) => event.id), [1, 2]);
});

test('poll abort clears pending retry and prevents retry call', async () => {
  const controller = new AbortController();
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;

  let timeoutCallback;
  let timeoutDelay;
  let clearCalled = false;
  const timeoutToken = { id: 'retry-timeout' };
  let fetchCalls = 0;

  global.setTimeout = (cb, delay) => {
    timeoutCallback = cb;
    timeoutDelay = delay;
    return timeoutToken;
  };

  global.clearTimeout = (token) => {
    if (token === timeoutToken) {
      clearCalled = true;
    }
  };

  try {
    await poll('https://example.test/retry', {
      fetchImpl: async () => {
        fetchCalls += 1;
        throw new Error('network down');
      },
      signal: controller.signal,
      retryDelayMs: 100,
      maxRetryDelayMs: 1000,
      backoffFactor: 2,
      jitterRatio: 0,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });

    assert.equal(timeoutDelay, 100);
    assert.equal(fetchCalls, 1);

    controller.abort();

    assert.equal(clearCalled, true);
    await timeoutCallback();
    assert.equal(fetchCalls, 1);
  } finally {
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  }
});
