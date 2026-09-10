function parseRating(rating) {
  const n = Number.parseFloat(String(rating ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function movieHasAnyWatch(movie, members) {
  return members.some((member) => Boolean(movie.reviews[member]?.watched));
}

/**
 * @param {string[]} members
 * @param {Array<{ title: string, slug: string, familyScore: string | null, reviews: Record<string, { watched: string, rating: string }> }>} movies
 */
function buildMarvelStats(members, movies) {
  const memberTopMovies = {};

  for (const member of members) {
    memberTopMovies[member] = movies
      .map((movie) => {
        const review = movie.reviews[member];
        const numericRating = parseRating(review?.rating);
        if (numericRating == null) return null;
        return { title: movie.title, rating: review.rating, numericRating };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.numericRating - a.numericRating || String(a.title).localeCompare(String(b.title))
      )
      .slice(0, 3)
      .map(({ title, rating }) => ({ title, rating }));
  }

  let topFamilyMovie = null;
  let topScore = -Infinity;
  for (const movie of movies) {
    const score = parseRating(movie.familyScore);
    if (score != null && score > topScore) {
      topScore = score;
      topFamilyMovie = { title: movie.title, rating: movie.familyScore };
    }
  }

  const nextMovie = movies.find((movie) => !movieHasAnyWatch(movie, members)) || null;

  return {
    memberTopMovies,
    topFamilyMovie,
    nextMovieSlug: nextMovie?.slug ?? null,
    nextMovieTitle: nextMovie?.title ?? null,
  };
}

module.exports = { buildMarvelStats, movieHasAnyWatch, parseRating };
