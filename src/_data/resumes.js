// Synced from Notion by `npm run sync`. Every resume is stored; only the ones
// flagged Active in Notion are published.
const resumes = require("../../content/resumes.json");

module.exports = resumes.filter((resume) => resume.active);
