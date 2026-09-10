#!/usr/bin/env node
/**
 * Pulls every Notion database into committed JSON under content/ and committed
 * images under src/assets/img/notion/.
 *
 * The committed JSON *is* the cache: each record carries its Notion id and
 * last_edited_time, so an unchanged page costs zero API calls. Databases are
 * always queried in full, because that is the only way to notice deletions, and
 * five paginated queries is negligible traffic.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const { createClient, queryDatabase, getRequestCount } = require("./notion");
const { renderPageContent } = require("./content");
const { optimizeImage, pruneOrphans, URL_PREFIX } = require("./images");

dotenv.config();

const CONTENT_DIR = path.join(__dirname, "..", "..", "content");
const MAP_CONCURRENCY = 4;
const FORCE = process.argv.includes("--force");

const MAPPERS = [
  require("./mappers/books"),
  require("./mappers/posts"),
  require("./mappers/projects"),
  require("./mappers/resumes"),
  require("./mappers/marvel"),
];

/** Runs tasks with a concurrency cap while preserving input order in the results. */
async function mapWithLimit(items, limit, iterator) {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await iterator(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

/** Collects every generated-image URL anywhere inside a record. */
function referencedImages(value, found = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith(`${URL_PREFIX}/`)) found.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => referencedImages(item, found));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => referencedImages(item, found));
  }
  return found;
}

function readPrevious(mapper) {
  const file = path.join(CONTENT_DIR, `${mapper.name}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(file, "utf8"));
    return mapper.extractRecords ? mapper.extractRecords(payload) : payload;
  } catch (error) {
    console.warn(`[sync] could not reuse ${mapper.name}.json: ${error.message}`);
    return [];
  }
}

/** A record is reusable only if it is unchanged AND its image files are still on disk. */
function isReusable(record, page) {
  if (FORCE) return false;
  if (!record || record.lastEditedTime !== page.last_edited_time) return false;

  for (const url of referencedImages(record)) {
    if (!fs.existsSync(path.join(__dirname, "..", "..", "src", url))) return false;
  }
  return true;
}

async function syncDatabase(client, mapper) {
  const dbId = process.env[mapper.envVar];
  if (!dbId) {
    console.warn(`[sync] ${mapper.envVar} not set, skipping ${mapper.name}`);
    return null;
  }

  const pages = await queryDatabase(client, dbId);
  const previousById = new Map(readPrevious(mapper).map((record) => [record.id, record]));

  let reused = 0;
  let imagesWritten = 0;

  const records = await mapWithLimit(pages, MAP_CONCURRENCY, async (page) => {
    const previous = previousById.get(page.id);
    if (isReusable(previous, page)) {
      reused++;
      return previous;
    }

    const ctx = {
      content: (pageId) => renderPageContent(client, pageId),
      image: async (url, type, cacheId) => {
        const result = await optimizeImage(url, type, cacheId);
        if (!result) return null;
        imagesWritten += result.written;
        return result.sizes;
      },
    };

    return mapper.mapPage(page, ctx);
  });

  const payload = mapper.finalize(records);

  const currentIds = new Set(pages.map((page) => page.id));
  let removed = 0;
  for (const id of previousById.keys()) if (!currentIds.has(id)) removed++;

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CONTENT_DIR, `${mapper.name}.json`),
    `${JSON.stringify(payload, null, 2)}\n`
  );

  console.log(
    `[sync] ${mapper.name}: ${pages.length} pages, ${reused} reused, ` +
      `${pages.length - reused} refreshed, ${imagesWritten} image files written` +
      (removed > 0 ? `, ${removed} removed` : "")
  );

  return payload;
}

async function main() {
  if (!process.env.NOTION_API_KEY) {
    console.error("[sync] NOTION_API_KEY is not set");
    process.exit(1);
  }

  const started = Date.now();
  const client = createClient(process.env.NOTION_API_KEY);
  const allImages = new Set();
  let skipped = 0;

  for (const mapper of MAPPERS) {
    const payload = await syncDatabase(client, mapper);
    if (payload) referencedImages(payload, allImages);
    else skipped++;
  }

  // Pruning is only safe when every database reported in. A skipped mapper would
  // otherwise look like "nothing references these images" and delete them.
  const orphans = skipped === 0 ? pruneOrphans(allImages) : 0;
  if (skipped > 0) console.warn(`[sync] ${skipped} database(s) skipped, orphan pruning disabled`);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `[sync] done in ${seconds}s, ${getRequestCount()} Notion requests, ` +
      `${allImages.size} images referenced${orphans ? `, ${orphans} orphans pruned` : ""}`
  );
}

main().catch((error) => {
  console.error("[sync] failed:", error);
  process.exit(1);
});
