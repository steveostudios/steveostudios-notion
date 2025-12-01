
const { fetchDatabase } = require("./notionClient");

module.exports = async function () {
  const dbId = process.env.NOTION_DB_PROJECTS;
  if (!dbId) return [];

  const raw = await fetchDatabase(dbId);

  const slugify = (str) => 
  str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");


  const mappedItems = raw.map((item, index) => {
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
      images = imagesProp.files.map(file => file.file?.url || file.external?.url);
    }

    const image = images.length > 0 ? images[0] : null;
      
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
      order
    };
  });

  return mappedItems.sort((a, b) => {
    return (a.order || 0) - (b.order || 0);
  });
};

