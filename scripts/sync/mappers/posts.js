const { slugify } = require("./helpers");

module.exports = {
  name: "posts",
  envVar: "NOTION_DB_POSTS",

  async mapPage(page, ctx) {
    const props = page.properties;
    const title = props["Title"]?.title?.[0]?.plain_text || "";

    return {
      id: page.id,
      lastEditedTime: page.last_edited_time,
      title,
      slug: props.Slug?.formula?.[0]?.string || slugify(title) || "untitled",
      date: props["Date"]?.date?.start || null,
      tags: props["Tags"]?.multi_select || [],
      content: await ctx.content(page.id),
    };
  },

  finalize(records) {
    return records.sort((a, b) => new Date(b.date) - new Date(a.date));
  },
};
