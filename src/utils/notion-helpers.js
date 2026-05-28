const { AssetCache } = require("@11ty/eleventy-fetch");
const { NotionToMarkdown } = require("notion-to-md");
const MarkdownIt = require("markdown-it");

const md = new MarkdownIt();

/**
 * Converts a string to a slug.
 * @param {string} str 
 * @returns {string}
 */
const slugify = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

/**
 * Fetches page content from Notion, converts to HTML, and caches it.
 * @param {string} id - Notion Page ID
 * @param {object} notionClient - Notion Client instance
 * @param {string} lastEditedTime - ISO timestamp of when the page was last edited
 * @returns {Promise<string>} HTML content
 */
const fetchPageContent = async (id, notionClient, lastEditedTime) => {
  const cacheKey = `content_${id}`;
  const cache = new AssetCache(cacheKey);
  
  // If we have a cached value, check if it's still fresh based on lastEditedTime
  if (cache.isCacheValid("1y")) {
    try {
      const cachedObj = await cache.getCachedValue();
      if (cachedObj?.lastEditedTime === lastEditedTime) {
        return cachedObj.content;
      }
      if (cachedObj?.lastEditedTime) {
        console.log(`[Cache] Content stale for ${id}`);
      }
    } catch {
      // Missing or legacy cache entry — fetch below
    }
  }

  const n2m = new NotionToMarkdown({ notionClient: notionClient });
  const mdblocks = await n2m.pageToMarkdown(id);
  const mdString = n2m.toMarkdownString(mdblocks);
  const content = mdString.parent ? md.render(mdString.parent) : "";
  
  if (content) {
    // Save both content and timestamp
    await cache.save({
      lastEditedTime,
      content
    }, "json");
  } else {
      // Even if empty, strictly speaking we should probably cache it to avoid re-fetching empty pages constantly?
      // But keeping existing logic of only caching if content exists for now to be safe.
  }
  
  return content;
};

/**
 * Extracts images from a Notion files property.
 * @param {object} filesProperty - The Notion property object for files
 * @param {string} altText - Alt text for the images
 * @returns {Array} Array of image objects { url, alt, filename }
 */
const extractImages = (filesProperty, altText) => {
  if (!filesProperty || !filesProperty.files || filesProperty.files.length === 0) {
    return [];
  }
  
  return filesProperty.files.map(file => {
    return {
      url: file.file?.url || file.external?.url,
      alt: altText,
      filename: file.name
    };
  });
};

/**
 * Extracts cover image from page cover or a specific files property.
 * @param {object} page - The Notion page object
 * @param {object} coverProperty - The Notion property object for cover (optional)
 * @returns {string|null} URL of the cover image
 */
const extractCoverImage = (page, coverProperty) => {
  let coverImage = null;
  
  if (page.cover) {
    if (page.cover.type === "external") {
      coverImage = page.cover.external.url;
    } else if (page.cover.type === "file") {
      coverImage = page.cover.file.url;
    }
  }
  
  if (coverProperty && coverProperty.files && coverProperty.files.length > 0) {
    if (!coverImage) {
      coverImage = coverProperty.files[0].file?.url || coverProperty.files[0].external?.url;
    }
  }
  
  return coverImage;
};

const Image = require("@11ty/eleventy-img");
const EleventyFetch = require("@11ty/eleventy-fetch");
const sharp = require("sharp");

const IMAGE_CONFIG = {
  book: { 
    sizes: [
      { width: 130, height: 200, key: "thumb" },
      { width: 205, height: 300, key: "medium" },
      { width: 260, height: 400, key: "large" }
    ],
    format: "jpeg"
  },
  marvel: {
    sizes: [
      { width: 144, height: 216, key: "thumb" },
      { width: 288, height: 432, key: "medium" },
      { width: 432, height: 648, key: "large" }
    ],
    format: "jpeg"
  },
  project: { 
    sizes: [
      { width: 102, height: 56, key: "thumb" },
      { width: 366, height: 212, key: "medium" },
      { width: 1440, height: 800, key: "large" }
    ],
    format: "jpeg"
  },
  resume: { 
    sizes: [
      { width: 250, height: 24, key: "thumb" },
      { width: 375, height: 36, key: "medium" },
      { width: 500, height: 48, key: "large" }
    ],
    format: "png"
  },
  post: {
    sizes: [
      { width: 300, height: 200, key: "thumb" },
      { width: 600, height: 400, key: "medium" },
      { width: 1200, height: 800, key: "large" }
    ],
    format: "jpeg"
  }
};

/**
 * Optimizes an image and returns URLs for specific sizes.
 * When cacheId and lastEditedTime are provided, skips download/processing if the page has not changed.
 * (Notion file URLs expire; cache by page revision, not by URL.)
 * @param {string} url - Image URL
 * @param {string} type - 'book', 'project', 'resume', 'marvel', or 'post'
 * @param {string} [lastEditedTime] - Notion page last_edited_time (ISO)
 * @param {string} [cacheId] - Stable id (usually Notion page id, or `${pageId}_${index}` for galleries)
 * @returns {Promise<object|null>} Object with thumb, medium, large URLs
 */
const optimizeImage = async (url, type, lastEditedTime, cacheId) => {
  if (!url) return null;
  const config = IMAGE_CONFIG[type];
  if (!config) return null;

  const canUseRevisionCache = Boolean(lastEditedTime && cacheId);
  const revisionCache = canUseRevisionCache
    ? new AssetCache(`optimized_image_${type}_${cacheId}`)
    : null;

  if (revisionCache?.isCacheValid("1y")) {
    try {
      const cached = await revisionCache.getCachedValue();
      if (cached?.lastEditedTime === lastEditedTime && cached?.sizes) {
        return cached.sizes;
      }
      if (cached?.lastEditedTime !== lastEditedTime) {
        console.log(`[Cache] Image stale for ${cacheId} (${type})`);
      }
    } catch {
      // Missing or legacy cache entry — reprocess below
    }
  }

  try {
    const buffer = await EleventyFetch(url, {
      duration: "1d",
      type: "buffer",
    });

    const result = {};
    const stableName = slugify(String(cacheId || url.split("/").pop().split("?")[0] || "image")).slice(
      0,
      50
    );

    await Promise.all(
      config.sizes.map(async (size) => {
        try {
          const resizedBuffer = await sharp(buffer)
            .resize(size.width, size.height, { fit: "cover", position: "center" })
            .toBuffer();

          const metadata = await Image(resizedBuffer, {
            widths: [size.width],
            formats: [config.format],
            outputDir: "./_site/assets/img/",
            urlPath: "/assets/img/",
            filenameFormat: function (_id, _src, width, format) {
              return `${stableName}-${size.key}-${width}w.${format}`;
            },
          });

          const entry = metadata[config.format][0];
          result[size.key] = entry.url;
        } catch (err) {
          console.error(`Error processing size ${size.key} for ${type}:`, err);
        }
      })
    );

    if (revisionCache && Object.keys(result).length > 0) {
      await revisionCache.save({ lastEditedTime, sizes: result }, "json");
    }

    return result;
  } catch (e) {
    console.error(`Error optimizing image (${type}): ${url}`, e);
    return null;
  }
};

/**
 * Processes an array of items with a concurrency limit.
 * @param {Array} items - Array of items to process
 * @param {Function} iteratorFn - Async function to process each item
 * @param {number} limit - Concurrency limit (default 3)
 * @returns {Promise<Array>} Array of results
 */
const limitConcurrency = async (items, iteratorFn, limit = 3) => {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    results.push(p);
    
    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.all(results);
};

module.exports = {
  slugify,
  fetchPageContent,
  extractImages,
  extractCoverImage,
  optimizeImage,
  limitConcurrency
};
