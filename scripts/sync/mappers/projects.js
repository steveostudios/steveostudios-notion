const { slugify, extractImages } = require("./helpers");

module.exports = {
  name: "projects",
  envVar: "NOTION_DB_PROJECTS",

  async mapPage(page, ctx) {
    const props = page.properties;
    const id = page.id;
    const title = props["Title"]?.title?.[0]?.plain_text || "";

    const rawImages = extractImages(props["Images"], title);
    const images = [];
    for (const [index, img] of rawImages.entries()) {
      // The raw Notion url is a signed S3 link that expires, and no template
      // reads it, so it is deliberately not committed.
      const { url: _rawUrl, ...meta } = img;
      images.push({ ...meta, ...(await ctx.image(img.url, "project", `${id}_${index}`)) });
    }

    return {
      id,
      lastEditedTime: page.last_edited_time,
      title,
      slug: props.Slug?.formula?.[0]?.string || slugify(title) || "untitled",
      frontEnd: props["Front End"]?.multi_select || null,
      backEnd: props["Back End"]?.multi_select || null,
      host: props["Host"]?.multi_select || null,
      url: props["URL"]?.url || null,
      githubUrl: props["Github URL"]?.url || null,
      client: props["Client"]?.select?.name || "Personal",
      image: images.length > 0 ? images[0] : null,
      images,
      order: props["Order"]?.number || null,
      content: await ctx.content(id),
    };
  },

  finalize(records) {
    return records.sort((a, b) => (a.order || 0) - (b.order || 0));
  },
};
