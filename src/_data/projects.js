
const { fetchDatabase, notion } = require("./notionClient");
const { AssetCache } = require("@11ty/eleventy-fetch");
const { NotionToMarkdown } = require("notion-to-md");
const MarkdownIt = require("markdown-it");

const n2m = new NotionToMarkdown({ notionClient: notion });
const md = new MarkdownIt();

module.exports = async function () {
  const dbId = process.env.NOTION_DB_PROJECTS;
  if (!dbId) return [];

  const raw = await fetchDatabase(dbId);

  const slugify = (str) => 
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const mappedItems = await Promise.all(raw.map(async (item, index) => {
    const props = item.properties;

    const id = item.id;
    const title = props["Title"]?.title?.[0]?.plain_text || "";
    const slug = props.Slug?.formula?.[0]?.string || slugify(props.Title?.title?.[0]?.plain_text) || "untitled";
    const frontEnd = props["Front End"]?.multi_select || null;
    const backEnd = props["Back End"]?.multi_select || null;
    const host = props["Host"]?.multi_select || null;
    const url = props["URL"]?.url || null;
    const githubUrl = props["Github URL"]?.url || null;
    const client = props["Client"]?.select?.name || "Personal";
    const order = props["Order"]?.number || null;    
    const imagesProp = props["Images"];
    let images = [];
    if (imagesProp && imagesProp.files && imagesProp.files.length > 0) {
      images = imagesProp.files.map(file => {
        return {
          url: file.file?.url || file.external?.url,
          alt: title,
          filename: file.name
        };
      });
    }

    const image = images.length > 0 ? images[0].url : null;

    // Fetch Content
    const cacheKey = `project_content_${id}`;
    const cache = new AssetCache(cacheKey);
    let content = "";

    if (cache.isCacheValid("1d")) {
      content = cache.getCachedValue();
    } else {
      const mdblocks = await n2m.pageToMarkdown(id);
      const mdString = n2m.toMarkdownString(mdblocks);
      content = md.render(mdString.parent);
      await cache.save(content, "json");
    }
      
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
  }));

  return mappedItems.sort((a, b) => {
    return (a.order || 0) - (b.order || 0);
  });
};

