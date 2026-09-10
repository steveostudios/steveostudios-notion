const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const OUTPUT_DIR = path.join(__dirname, "..", "..", "src", "assets", "img", "notion");
const URL_PREFIX = "/assets/img/notion";

/**
 * Only sizes a template actually renders are generated. Each entry names its
 * consumer, so anything added here without a reader is dead weight in git.
 *
 *   book    large  -> src/utils/shortcodes/book-cover.js
 *   project thumb  -> partials/project-slider.njk (filmstrip)
 *           medium -> projects/projects.njk (index card)
 *           large  -> partials/project-slider.njk (main image)
 *   resume  large  -> partials/resume.njk
 *   marvel  medium -> the `poster` field consumed by marvel/marvel.njk
 */
const IMAGE_CONFIG = {
  book: {
    sizes: [{ width: 260, height: 400, key: "large" }],
    format: "jpeg",
  },
  marvel: {
    sizes: [{ width: 288, height: 432, key: "medium" }],
    format: "jpeg",
  },
  project: {
    sizes: [
      { width: 102, height: 56, key: "thumb" },
      { width: 366, height: 212, key: "medium" },
      { width: 1440, height: 800, key: "large" },
    ],
    format: "jpeg",
  },
  resume: {
    sizes: [{ width: 500, height: 48, key: "large" }],
    format: "png",
  },
};

const slugifyName = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);

const sha1 = (buffer) => crypto.createHash("sha1").update(buffer).digest("hex");

/** Writes only when the bytes differ, so unrelated Notion edits don't churn git. */
function writeIfChanged(filePath, buffer) {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath);
    if (existing.length === buffer.length && sha1(existing) === sha1(buffer)) {
      return false;
    }
  }
  fs.writeFileSync(filePath, buffer);
  return true;
}

/**
 * Downloads a Notion-hosted image and writes the configured sizes.
 * Notion file URLs expire, so nothing here is keyed on the URL — callers decide
 * whether to call us based on the page's last_edited_time.
 *
 * @returns {Promise<Record<string, string>|null>} size key -> site-relative URL
 */
async function optimizeImage(url, type, cacheId) {
  if (!url) return null;
  const config = IMAGE_CONFIG[type];
  if (!config) return null;

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let source;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    source = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(`[images] download failed (${type}): ${error.message}`);
    return null;
  }

  const stableName = slugifyName(cacheId || "image");
  const result = {};
  let written = 0;

  for (const size of config.sizes) {
    const filename = `${stableName}-${size.key}-${size.width}w.${config.format}`;
    try {
      const resized = await sharp(source)
        .resize(size.width, size.height, { fit: "cover", position: "center" })
        .toFormat(config.format)
        .toBuffer();

      if (writeIfChanged(path.join(OUTPUT_DIR, filename), resized)) written++;
      result[size.key] = `${URL_PREFIX}/${filename}`;
    } catch (error) {
      console.error(`[images] resize failed ${size.key} (${type}): ${error.message}`);
    }
  }

  return { sizes: Object.keys(result).length ? result : null, written };
}

/** Deletes generated images no record references any more. */
function pruneOrphans(referenced) {
  if (!fs.existsSync(OUTPUT_DIR)) return 0;
  const keep = new Set([...referenced].map((url) => path.basename(url)));
  let removed = 0;
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (!keep.has(file)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
      removed++;
    }
  }
  return removed;
}

module.exports = { optimizeImage, pruneOrphans, OUTPUT_DIR, URL_PREFIX };
