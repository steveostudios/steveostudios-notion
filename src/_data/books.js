
const { fetchDatabase, notion } = require("./notionClient");
const { slugify, fetchPageContent, extractCoverImage, optimizeImage, limitConcurrency } = require("../utils/notion-helpers");

module.exports = async function () {
  const dbId = process.env.NOTION_DB_BOOKS;
  if (!dbId) return [];

async function run() {
  const db = await notion.databases.retrieve({
    database_id: dbId,
  });

  const props = db.properties;

  const simplified = Object.entries(props).map(([name, value]) => ({
    name,
    id: value.id,
    type: value.type,
    config: value[value.type] ?? null,
  }));

  console.log(JSON.stringify(simplified, null, 2));
}

run().catch(console.error);

  const raw = await fetchDatabase(dbId);

  const mappedBooks = await limitConcurrency(raw, async (page, index) => {
    const props = page.properties;

    const id = page.id;
    const lastEditedTime = page.last_edited_time;
    const title = props["Title"]?.title?.[0]?.plain_text || "";
    const subtitle = props["Subtitle"]?.rich_text?.[0]?.plain_text || "";
    const slug = props.Slug?.formula?.[0]?.string || slugify(props.Title?.title?.[0]?.plain_text) || "untitled";
    const authors = props["Author(s)"]?.multi_select || null;
    const pageTotal = props["Page Total"]?.number || null;
    const pagesRead = props["Pages Read"]?.number || null;
    const minutesTotal = props["Minutes Total"]?.number || null;
    const miniutesRead = props["Minutes Read"]?.number || null;
    const progress = props["Progress"]?.formula?.number || 0;
    const format = props["Format"]?.select?.name || "PAPERBACK";
    const dateStart = props["Date Start"]?.date?.start || null;
    const dateFinish = props["Date Finish"]?.date?.start || null;
    const stars = props["Stars"]?.select?.name.length || null;
    const asin = props["ASIN"]?.rich_text?.[0]?.plain_text || "";
    const isbn = props["ISBN"]?.rich_text?.[0]?.plain_text || "";
    const url = props["URL"]?.url || null;
    const fiction = props["Fiction"]?.checkbox || false;
    const own = props["Own"]?.checkbox || false;
      
    const rawCoverImage = extractCoverImage(page, props["Cover"]);
    const coverImage = await optimizeImage(rawCoverImage, "book");
    
    // Fetch Content
    const content = await fetchPageContent(id, notion, lastEditedTime);
    
    return {
      id,
      title,
      subtitle,
      slug,
      authors,
      pageTotal,
      pagesRead,
      minutesTotal,
      miniutesRead,
      progress,
      format,
      dateStart,
      dateFinish,
      stars,
      asin,
      isbn,
      url,
      coverImage,
      fiction,
      own,
      content
    };
  }, 5);

  // Deduplicate slugs
  const slugCounts = {};
  const deduplicatedBooks = mappedBooks.map(book => {
    let slug = book.slug;
    if (slugCounts[slug]) {
      slugCounts[slug]++;
      slug = `${slug}-${slugCounts[slug]}`;
    } else {
      slugCounts[slug] = 1;
    }
    return { ...book, slug };
  });

  return deduplicatedBooks.sort((a, b) => {
      // Sort by read date
      if (a.dateFinish && b.dateFinish) {
          return new Date(b.dateFinish) - new Date(a.dateFinish);
      }
      return 0; 
  });

};

