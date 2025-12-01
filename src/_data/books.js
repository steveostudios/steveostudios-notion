
const { fetchDatabase } = require("./notionClient");

module.exports = async function () {
  const dbId = process.env.NOTION_DB_BOOKS;
  if (!dbId) return [];

  const raw = await fetchDatabase(dbId);

  const slugify = (str) => 
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");


  const mappedBooks = raw.map((page, index) => {
    const props = page.properties;

    const id = page.id;
    const title = props["Title"]?.title?.[0]?.plain_text || "";
    const subtitle = props["Subtitle"]?.rich_text?.[0]?.plain_text || "";
    const slug = props.Slug?.formula?.[0]?.string || slugify(props.Title?.title?.[0]?.plain_text) || "untitled";
    const author = props["Author(s)"]?.rich_text?.[0]?.plain_text || "";
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
    const fiction = props["Fiction"]?.checkbox || false;
    const own = props["Own"]?.checkbox || false;
      
    let coverImage = null;
    if (page.cover) {
      if (page.cover.type === "external") {
        coverImage = page.cover.external.url;
      } else if (page.cover.type === "file") {
        coverImage = page.cover.file.url;
      }
    }
    
    const coverProp = props["Cover"];
    if (coverProp && coverProp.files && coverProp.files.length > 0) {
        if (!coverImage) {
             coverImage = coverProp.files[0].file?.url || coverProp.files[0].external?.url;
        }
    }
    
    // if (coverImage) console.log("Found cover for:", title);
    
    return {
      id,
      title,
      subtitle,
      slug,
      author,
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
      coverImage,
      fiction,
      own
    };
  });

  return mappedBooks;
};

