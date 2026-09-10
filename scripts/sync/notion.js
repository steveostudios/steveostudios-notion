const { Client } = require("@notionhq/client");

/**
 * Notion allows roughly 3 requests/second sustained. We run a little under that.
 * Every call the sync makes — including the ones notion-to-md makes internally —
 * goes through this single gate.
 */
const MIN_INTERVAL_MS = 400;
const MAX_ATTEMPTS = 6;

let chain = Promise.resolve();
let requestCount = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Serializes callers and spaces them MIN_INTERVAL_MS apart. */
const gate = () => {
  const next = chain.then(() => sleep(MIN_INTERVAL_MS));
  chain = next.catch(() => {});
  return next;
};

const isRateLimited = (error) =>
  error?.code === "rate_limited" || error?.status === 429;

const retryAfterMs = (error, attempt) => {
  const header = error?.headers?.["retry-after"] ?? error?.headers?.get?.("retry-after");
  const seconds = Number.parseFloat(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return Math.min(30000, 1000 * 2 ** attempt);
};

/** Runs one Notion call through the gate, retrying on 429 and 5xx. */
async function throttled(label, fn) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await gate();
    try {
      requestCount++;
      return await fn();
    } catch (error) {
      const retryable = isRateLimited(error) || (error?.status >= 500 && error?.status < 600);
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw error;
      const wait = retryAfterMs(error, attempt);
      console.warn(`[notion] ${label} ${error.code || error.status}, retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

/**
 * Wraps the client so notion-to-md's internal blocks.children.list calls are
 * throttled too. It calls methods on the instance we hand it, so wrapping the
 * nested objects is what actually catches that traffic.
 */
function createClient(auth) {
  const raw = new Client({ auth, notionVersion: "2022-06-28" });

  return {
    databases: {
      query: (args) => throttled("databases.query", () => raw.databases.query(args)),
    },
    pages: {
      retrieve: (args) => throttled("pages.retrieve", () => raw.pages.retrieve(args)),
      update: (args) => throttled("pages.update", () => raw.pages.update(args)),
    },
    blocks: {
      retrieve: (args) => throttled("blocks.retrieve", () => raw.blocks.retrieve(args)),
      children: {
        list: (args) => throttled("blocks.children.list", () => raw.blocks.children.list(args)),
      },
    },
  };
}

/** Pages through an entire database. */
async function queryDatabase(client, databaseId) {
  const pages = [];
  let cursor;

  do {
    const response = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return pages;
}

const getRequestCount = () => requestCount;

module.exports = { createClient, queryDatabase, getRequestCount };
