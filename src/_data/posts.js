const { fetchDatabase, notion } = require("./notionClient");
const { slugify, fetchPageContent, limitConcurrency } = require("../utils/notion-helpers");

module.exports = async function () {
  const dbId = process.env.NOTION_DB_POSTS;
  if (!dbId) return [];

  const raw = await fetchDatabase(dbId);

  const mappedPosts = await limitConcurrency(raw, async (page, index) => {
    const props = page.properties;

    const id = page.id;
    const lastEditedTime = page.last_edited_time;
    const title = props["Title"]?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.formula?.[0]?.string || slugify(title) || "untitled";
    const date = props["Date"]?.date?.start || null;
    const tags = props["Tags"]?.multi_select || [];
    
    // Fetch Content
    const content = await fetchPageContent(id, notion, lastEditedTime);

    return {
      id,
      title,
      slug,
      date,
      tags,
      content
    };
  }, 5);

  // Sort by date descending
  return mappedPosts.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });
};
