const { fetchDatabase } = require("./notionClient");
const { optimizeImage, limitConcurrency, slugify } = require("../utils/notion-helpers");
const { buildMarvelStats } = require("../utils/marvelStats");

const BASE_FIELDS = new Set([
  "Title",
  "IMDb",
  "IMDb Rating",
  "Movie Rating",
  "Poster",
  "Poster Image",
  "Year",
  "Order",
]);

const PREFERRED_MEMBER_ORDER = ["Lauren", "Steve", "Elliot", "Oliver", "Levi"];

function extractText(property) {
  if (!property) return "";

  switch (property.type) {
    case "title":
      return property.title?.map((item) => item.plain_text).join("") || "";
    case "rich_text":
      return property.rich_text?.map((item) => item.plain_text).join("") || "";
    case "number":
      return property.number == null ? "" : String(property.number);
    case "select":
      return property.select?.name || "";
    case "multi_select":
      return property.multi_select?.map((item) => item.name).join(", ") || "";
    case "date":
      return property.date?.start || "";
    case "checkbox":
      return property.checkbox ? "Yes" : "";
    case "url":
      return property.url || "";
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "formula": {
      const formula = property.formula || {};
      if (formula.type === "string") return formula.string || "";
      if (formula.type === "number") return formula.number == null ? "" : String(formula.number);
      if (formula.type === "boolean") return formula.boolean ? "Yes" : "";
      if (formula.type === "date") return formula.date?.start || "";
      return "";
    }
    default:
      return "";
  }
}

function zeroPad(value) {
  return String(value).padStart(2, "0");
}

function formatWatchedDate(value) {
  if (!value) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";

  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${zeroPad(month)}-${zeroPad(day)}-${String(year).slice(-2)}`;
  }

  const slashMatch = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const yearTwoDigit = year.length === 2 ? year : year.slice(-2);
    return `${zeroPad(month)}-${zeroPad(day)}-${yearTwoDigit}`;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return `${zeroPad(parsed.getMonth() + 1)}-${zeroPad(parsed.getDate())}-${String(parsed.getFullYear()).slice(-2)}`;
  }

  return normalized;
}

function extractPoster(property) {
  const file = property?.files?.[0];
  if (!file) return "";
  return file.file?.url || file.external?.url || "";
}

function getMemberField(propertyName) {
  const watchedMatch = propertyName.match(/^(.*)\s+(Date Watched|Watched)$/i);
  if (watchedMatch) {
    return { member: watchedMatch[1].trim(), field: "watched" };
  }

  const ratingMatch = propertyName.match(/^(.*)\s+Rating$/i);
  if (ratingMatch) {
    return { member: ratingMatch[1].trim(), field: "rating" };
  }

  return null;
}

/** Average of numeric family ratings; only meaningful when 2+ members rated. */
function familyScoreFromReviews(reviews) {
  const values = [];
  for (const review of Object.values(reviews)) {
    const raw = review?.rating;
    if (raw == null || raw === "") continue;
    const n = Number.parseFloat(String(raw).trim());
    if (!Number.isFinite(n)) continue;
    values.push(n);
  }
  if (values.length <= 1) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const rounded = Math.round(avg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

module.exports = async function () {
  const dbId = process.env.NOTION_DB_MARVEL_MOVIES;
  if (!dbId) return { members: [], movies: [], stats: null };

  const raw = await fetchDatabase(dbId);

  const memberSet = new Set();
  const movies = await limitConcurrency(raw, async (page) => {
    const props = page.properties || {};
    const title = extractText(props["Title"]);
    const imdbRating = extractText(props["IMDb Rating"] || props["IMDb"]);
    const movieRating = extractText(props["Movie Rating"]);
    const year = extractText(props["Year"]);
    const rawPoster = extractPoster(props["Poster Image"] || props["Poster"]);
    const optimizedPoster = await optimizeImage(rawPoster, "marvel", page.last_edited_time, page.id);
    const poster =
      optimizedPoster?.medium || optimizedPoster?.thumb || optimizedPoster?.large || rawPoster;
    const order = Number(extractText(props["Order"])) || 0;
    const reviews = {};

    Object.entries(props).forEach(([propName, propValue]) => {
      if (BASE_FIELDS.has(propName)) return;
      const memberField = getMemberField(propName);
      if (!memberField) return;

      const { member, field } = memberField;
      memberSet.add(member);
      if (!reviews[member]) {
        reviews[member] = { watched: "", rating: "" };
      }
      const extracted = extractText(propValue);
      reviews[member][field] = field === "watched" ? formatWatchedDate(extracted) : extracted;
    });

    Object.values(reviews).forEach((review) => {
      if (!review.watched) {
        review.rating = "";
      }
    });

    const familyScore = familyScoreFromReviews(reviews);

    return {
      title,
      slug: slugify(title) || "untitled",
      imdbRating,
      movieRating,
      year,
      poster,
      order,
      reviews,
      familyScore,
    };
  }, 5);

  movies.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title).localeCompare(String(b.title));
  });

  const slugCounts = {};
  for (let i = 0; i < movies.length; i++) {
    const base = movies[i].slug;
    if (slugCounts[base]) {
      slugCounts[base]++;
      movies[i] = { ...movies[i], slug: `${base}-${slugCounts[base]}` };
    } else {
      slugCounts[base] = 1;
    }
  }

  const members = [
    ...PREFERRED_MEMBER_ORDER,
    ...Array.from(memberSet)
      .filter((member) => !PREFERRED_MEMBER_ORDER.includes(member))
      .sort((a, b) => a.localeCompare(b)),
  ];

  return {
    members,
    movies,
    stats: buildMarvelStats(members, movies),
  };
};
