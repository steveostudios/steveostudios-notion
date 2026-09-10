/** Shared property-flattening helpers, lifted from the old src/_data files. */

const slugify = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

/** Extracts images from a Notion files property. */
const extractImages = (filesProperty, altText) => {
  if (!filesProperty?.files?.length) return [];
  return filesProperty.files.map((file) => ({
    url: file.file?.url || file.external?.url,
    alt: altText,
    filename: file.name,
  }));
};

/** Page cover first, then a named files property as fallback. */
const extractCoverImage = (page, coverProperty) => {
  let coverImage = null;

  if (page.cover) {
    if (page.cover.type === "external") coverImage = page.cover.external.url;
    else if (page.cover.type === "file") coverImage = page.cover.file.url;
  }

  if (!coverImage && coverProperty?.files?.length) {
    coverImage = coverProperty.files[0].file?.url || coverProperty.files[0].external?.url;
  }

  return coverImage;
};

/** Appends -2, -3 … to repeated slugs, preserving first-come order. */
const dedupeSlugs = (records) => {
  const counts = {};
  return records.map((record) => {
    const base = record.slug;
    if (counts[base]) {
      counts[base]++;
      return { ...record, slug: `${base}-${counts[base]}` };
    }
    counts[base] = 1;
    return record;
  });
};

module.exports = { slugify, extractImages, extractCoverImage, dedupeSlugs };
