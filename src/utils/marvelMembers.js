/**
 * Groups the synced Marvel data by family member, one entry per person.
 *
 * This is presentation shaping over local JSON, so it belongs in the build
 * rather than in the sync. Sync owns ingestion; nothing here touches Notion.
 */

const slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/**
 * A rating only counts when it is a positive number. A 0 means the person
 * started the film and never finished it, so it is not an opinion.
 */
const toRating = (value) => {
  const n = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toNumber = (value) => {
  const n = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(n) ? n : null;
};

/** The family's highest and lowest scoring films, across everyone. */
function familyExtremes(movies) {
  const scored = movies
    .map((movie) => ({ slug: movie.slug, score: toNumber(movie.familyScore) }))
    .filter((entry) => entry.score != null)
    .sort((a, b) => b.score - a.score);

  return {
    bestSlug: scored.length ? scored[0].slug : null,
    // With only one scored film, "best" and "worst" would be the same row.
    worstSlug: scored.length > 1 ? scored[scored.length - 1].slug : null,
  };
}

/** One row in a member's watched table. */
function toRow(movie, review, extremes) {
  const ratingNumber = toRating(review.rating);
  const unfinished = review.rating !== "" && ratingNumber === null;

  return {
    title: movie.title,
    slug: movie.slug,
    year: movie.year,
    order: movie.order,
    poster: movie.poster,
    watched: review.watched,
    // The display string sorts by month before year, so tables sort on this.
    watchedISO: review.watchedISO || "",
    rating: ratingNumber === null ? "" : review.rating,
    ratingNumber,
    unfinished,
    familyScore: movie.familyScore,
    familyNumber: toNumber(movie.familyScore),
    familyBadge:
      movie.slug === extremes.bestSlug
        ? "best"
        : movie.slug === extremes.worstSlug
          ? "worst"
          : null,
    // Filled in per member once their ratings are ranked.
    personalBadge: null,
  };
}

/**
 * Marks each member's three favourites and three least favourites.
 * The counts shrink on small collections so a film can never be both.
 */
function assignPersonalBadges(rated) {
  const ranked = [...rated].sort(
    (a, b) => b.ratingNumber - a.ratingNumber || a.title.localeCompare(b.title)
  );

  const count = Math.min(3, Math.floor(ranked.length / 2));

  ranked.slice(0, count).forEach((row, index) => {
    row.personalBadge = { kind: "top", rank: index + 1 };
  });

  ranked
    .slice(ranked.length - count)
    .reverse()
    .forEach((row, index) => {
      row.personalBadge = { kind: "bottom", rank: index + 1 };
    });

  return ranked;
}

function buildMember(name, movies, extremes) {
  const watched = [];

  for (const movie of movies) {
    const review = movie.reviews?.[name];
    if (review?.watched) watched.push(toRow(movie, review, extremes));
  }

  const rated = watched.filter((row) => row.ratingNumber != null);
  const ranked = assignPersonalBadges(rated);

  // Newest first is the useful default; the table can re-sort client side.
  watched.sort((a, b) => b.watchedISO.localeCompare(a.watchedISO) || a.order - b.order);

  const average = rated.length
    ? Math.round((rated.reduce((sum, row) => sum + row.ratingNumber, 0) / rated.length) * 10) / 10
    : null;

  // Next up is the first film in release order this person has not rated,
  // which covers "not watched" and "started but never finished" alike.
  const nextToRate = movies.find((movie) => toRating(movie.reviews?.[name]?.rating) === null) || null;

  return {
    name,
    slug: slugify(name),
    url: `/marvel/${slugify(name)}/`,
    watched,
    watchedCount: watched.length,
    ratedCount: rated.length,
    unfinishedCount: watched.filter((row) => row.unfinished).length,
    remaining: movies.length - rated.length,
    averageRating: average === null ? null : average.toFixed(1),
    highest: ranked[0] || null,
    lowest: ranked.length > 1 ? ranked[ranked.length - 1] : null,
    nextToRate: nextToRate
      ? {
          title: nextToRate.title,
          slug: nextToRate.slug,
          year: nextToRate.year,
          poster: nextToRate.poster,
          order: nextToRate.order,
        }
      : null,
  };
}

/** @returns {Array} one entry per member, in the order marvel.json lists them */
function buildMarvelMembers(members, movies) {
  const extremes = familyExtremes(movies || []);
  return (members || []).map((name) => buildMember(name, movies || [], extremes));
}

module.exports = { buildMarvelMembers, slugify };
