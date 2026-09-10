const { NotionToMarkdown } = require("notion-to-md");
const MarkdownIt = require("markdown-it");

const md = new MarkdownIt();

/**
 * Converts a Notion page body to HTML.
 *
 * Unlike the old build-time version, an empty result is a perfectly good result.
 * Callers cache it alongside last_edited_time, so pages with no body are fetched
 * once rather than on every run.
 */
async function renderPageContent(client, pageId) {
  const n2m = new NotionToMarkdown({ notionClient: client });
  const blocks = await n2m.pageToMarkdown(pageId);
  const markdown = n2m.toMarkdownString(blocks);
  return markdown.parent ? md.render(markdown.parent) : "";
}

module.exports = { renderPageContent };
