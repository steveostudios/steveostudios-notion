
const { fetchDatabase, notion } = require("./notionClient");
const { slugify, fetchPageContent, extractImages, optimizeImage, limitConcurrency } = require("../utils/notion-helpers");

module.exports = async function () {
  const dbId = process.env.NOTION_DB_PROJECTS;
  if (!dbId) return [];

  const raw = await fetchDatabase(dbId);

  const mappedItems = await limitConcurrency(raw, async (item, index) => {
    const props = item.properties;

    const id = item.id;
    const lastEditedTime = item.last_edited_time;
    const title = props["Title"]?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.formula?.[0]?.string || slugify(props.Title?.title?.[0]?.plain_text) || "untitled";
    const frontEnd = props["Front End"]?.multi_select || null;
    const backEnd = props["Back End"]?.multi_select || null;
    const host = props["Host"]?.multi_select || null;
    const url = props["URL"]?.url || null;
    const githubUrl = props["Github URL"]?.url || null;
    const client = props["Client"]?.select?.name || "Personal";
    const order = props["Order"]?.number || null;    
    
    const rawImages = extractImages(props["Images"], title);
    const images = await Promise.all(rawImages.map(async (img) => {
      const optimized = await optimizeImage(img.url, "project");
      return {
        ...img,
        ...optimized
      };
    }));
    
    const image = images.length > 0 ? images[0] : null;

    // Fetch Content
    const content = await fetchPageContent(id, notion, lastEditedTime);
      
    return {
      id,
      title,
      slug,
      frontEnd,
      backEnd,
      host,
      url,
      githubUrl,
      client,
      image,
      images,
      order,
      content
    };
  }, 5);

  return mappedItems.sort((a, b) => {
    return (a.order || 0) - (b.order || 0);
  });
};

