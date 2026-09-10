const { slugify, extractCoverImage, dedupeSlugs } = require("./helpers");

module.exports = {
  name: "books",
  envVar: "NOTION_DB_BOOKS",

  async mapPage(page, ctx) {
    const props = page.properties;
    const id = page.id;

    const rawCover = extractCoverImage(page, props["Cover"]);

    return {
      id,
      lastEditedTime: page.last_edited_time,
      title: props["Title"]?.title?.[0]?.plain_text || "",
      subtitle: props["Subtitle"]?.rich_text?.[0]?.plain_text || "",
      slug:
        props.Slug?.formula?.[0]?.string ||
        slugify(props.Title?.title?.[0]?.plain_text) ||
        "untitled",
      authors: props["Author(s)"]?.multi_select || null,
      pageTotal: props["Page Total"]?.number || null,
      pagesRead: props["Pages Read"]?.number || null,
      minutesTotal: props["Minutes Total"]?.number || null,
      miniutesRead: props["Minutes Read"]?.number || null,
      progress: props["Progress"]?.formula?.number || 0,
      format: props["Format"]?.select?.name || "PAPERBACK",
      dateStart: props["Date Start"]?.date?.start || null,
      dateFinish: props["Date Finish"]?.date?.start || null,
      stars: props["Stars"]?.select?.name.length || null,
      asin: props["ASIN"]?.rich_text?.[0]?.plain_text || "",
      isbn: props["ISBN"]?.rich_text?.[0]?.plain_text || "",
      url: props["URL"]?.url || null,
      coverImage: await ctx.image(rawCover, "book", id),
      fiction: props["Fiction"]?.checkbox || false,
      own: props["Own"]?.checkbox || false,
      content: await ctx.content(id),
    };
  },

  finalize(records) {
    return dedupeSlugs(records).sort((a, b) => {
      if (a.dateFinish && b.dateFinish) {
        return new Date(b.dateFinish) - new Date(a.dateFinish);
      }
      return 0;
    });
  },
};
