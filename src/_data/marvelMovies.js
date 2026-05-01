const { fetchDatabase } = require("./notionClient");

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

module.exports = async function () {
  const dbId = process.env.NOTION_DB_MARVEL_MOVIES;
  if (!dbId) return { members: [], movies: [] };

  const raw = await fetchDatabase(dbId);

  const memberSet = new Set();
  const movies = raw.map((page) => {
    const props = page.properties || {};
    const title = extractText(props["Title"]);
    const imdbRating = extractText(props["IMDb Rating"] || props["IMDb"]);
    const movieRating = extractText(props["Movie Rating"]);
    const year = extractText(props["Year"]);
    const poster = extractPoster(props["Poster Image"] || props["Poster"]);
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

    return {
      title,
      imdbRating,
      movieRating,
      year,
      poster,
      order,
      reviews,
    };
  });

  movies.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return String(a.title).localeCompare(String(b.title));
  });

  const extraMembers = Array.from(memberSet)
    .filter((member) => !PREFERRED_MEMBER_ORDER.includes(member))
    .sort((a, b) => a.localeCompare(b));

  return {
    members: [...PREFERRED_MEMBER_ORDER, ...extraMembers],
    movies,
  };
};
