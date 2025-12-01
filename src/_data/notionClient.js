const { Client } = require("@notionhq/client");
const { AssetCache } = require("@11ty/eleventy-fetch");

if (!process.env.NOTION_API_KEY) {
  console.warn("WARNING: NOTION_API_KEY not set");
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function fetchDatabase(databaseId) {
  const cache = new AssetCache(`notion_db_${databaseId}`);

  // Check if cache is valid (less than 1 day old)
  if (cache.isCacheValid("1d")) {
    console.log(`[Cache] Using cached data for database ${databaseId}`);
    return cache.getCachedValue();
  }

  console.log(`[Cache] Fetching fresh data for database ${databaseId}`);
  const pages = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });

    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  await cache.save(pages, "json");
  return pages;
}

async function fetchPage(pageId) {
  const cache = new AssetCache(`notion_page_${pageId}`);

  if (cache.isCacheValid("1d")) {
    console.log(`[Cache] Using cached data for page ${pageId}`);
    return cache.getCachedValue();
  }

  console.log(`[Cache] Fetching fresh data for page ${pageId}`);
  const response = await notion.pages.retrieve({ page_id: pageId });
  
  await cache.save(response, "json");
  return response;
}

async function fetchBlocks(blockId) {
  const cache = new AssetCache(`notion_blocks_${blockId}`);

  if (cache.isCacheValid("1d")) {
    console.log(`[Cache] Using cached data for blocks ${blockId}`);
    return cache.getCachedValue();
  }

  console.log(`[Cache] Fetching fresh data for blocks ${blockId}`);
  const blocks = [];
  let cursor = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    });

    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  await cache.save(blocks, "json");
  return blocks;
}

module.exports = {
  notion,
  fetchDatabase,
  fetchPage,
  fetchBlocks,
};

