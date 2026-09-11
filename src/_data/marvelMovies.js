// Synced from Notion by `npm run sync`. Family stats are baked in at sync time;
// the per-member grouping is derived here because it is purely presentational.
const marvel = require("../../content/marvel.json");
const { buildMarvelMembers } = require("../utils/marvelMembers");

module.exports = {
  ...marvel,
  byMember: buildMarvelMembers(marvel.members, marvel.movies),
};
