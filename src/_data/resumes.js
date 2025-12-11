
const { fetchDatabase, notion } = require("./notionClient");
const { slugify, fetchPageContent, extractImages, optimizeImage, limitConcurrency } = require("../utils/notion-helpers");

module.exports = async function () {
  const dbId = process.env.NOTION_DB_RESUMES;
  if (!dbId) return [];

  const raw = await fetchDatabase(dbId);

  const mappedItems = await limitConcurrency(raw, async (item, index) => {
    const props = item.properties;

    const id = item.id;
    const name = props["Name"]?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.formula?.[0]?.string || slugify(name) || "untitled";
    const bio = props["Bio"]?.rich_text?.[0]?.plain_text || "";
    const active = props["Active"]?.checkbox || false;
    
    const rawImages = extractImages(props["Logo"], name);
    const images = await Promise.all(rawImages.map(async (img) => {
      const optimized = await optimizeImage(img.url, "resume");
      return {
        ...img,
        ...optimized
      };
    }));
    
    const image = images.length > 0 ? images[0] : null;

    // Fetch Content
    const content = await fetchPageContent(id, notion);
      
    return {
      id,
      name,
      slug,
      bio,
      active,
      image,
      images,
      content
    };
  }, 5);

  // Filter for active resumes
  return mappedItems.filter(item => item.active);
};
