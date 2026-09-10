const { slugify, extractImages } = require("./helpers");

module.exports = {
  name: "resumes",
  envVar: "NOTION_DB_RESUMES",

  async mapPage(page, ctx) {
    const props = page.properties;
    const id = page.id;
    const name = props["Name"]?.title?.[0]?.plain_text || "";

    const rawImages = extractImages(props["Logo"], name);
    const images = [];
    for (const [index, img] of rawImages.entries()) {
      // The raw Notion url is a signed S3 link that expires, and no template
      // reads it, so it is deliberately not committed.
      const { url: _rawUrl, ...meta } = img;
      images.push({ ...meta, ...(await ctx.image(img.url, "resume", `${id}_${index}`)) });
    }

    return {
      id,
      lastEditedTime: page.last_edited_time,
      name,
      slug: props.Slug?.formula?.[0]?.string || slugify(name) || "untitled",
      bio: props["Bio"]?.rich_text?.[0]?.plain_text || "",
      active: props["Active"]?.checkbox || false,
      image: images.length > 0 ? images[0] : null,
      images,
      content: await ctx.content(id),
    };
  },

  // Every resume is synced, active or not, so toggling the checkbox in Notion
  // never forces a refetch. src/_data/resumes.js filters to the active ones.
  finalize(records) {
    return records;
  },
};
