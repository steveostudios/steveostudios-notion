
const bookStats = (collectionApi) => {
	const books = collectionApi
		.getAll()[0]
		.data.books.sort((a, b) => new Date(b.dateFinish) - new Date(a.dateFinish));
	// create array of years with their book/page stats.
	// -- used for graphs, stats, and "shelves"
	const yearStats = Object.entries(
		books
			.filter((book) => book.dateFinish) // filter only finished books
			.sort((a, b) => new Date(b.dateFinish) - new Date(a.dateFinish)) // sort by finish date
			.reduce((acc, cur) => {
				const year = new Date(cur["dateFinish"]).getFullYear();
				if (!acc[year]) {
					acc[year] = [];
				}
				acc[year].push(cur);
				return acc;
			}, {})
	) // put into array
		.reverse() // sort reverse (recent first)
		.map(
			(
				[year, booksArray] // add meta for each year
			) => ({
				year: parseInt(year),
				books: booksArray.length,
				pages: booksArray.reduce((acc, cur) => acc + (cur.pageTotal || 0), 0),
				items: booksArray,
			})
		);

	// Most
	const mostBooks = [...yearStats].sort((a, b) => b.books - a.books)[0];
	const mostPages = [...yearStats].sort((a, b) => b.pages - a.pages)[0];
	const mostBooksBooks = mostBooks.books;
	const mostBooksYear = mostBooks.year;
	const mostPagesPages = mostPages.pages;
	const mostPagesYear = mostPages.year;

	// This Year
	const now = new Date().getFullYear();
	const thisYear = books.filter((book) => {
		if (!book.dateFinish) return false;
		return new Date(book.dateFinish).getFullYear() === now;
	});
	const thisYearBooks = thisYear.length;
	const thisYearPages = thisYear.reduce((acc, cur) => acc + (cur.pageTotal || 0), 0);
	const thisYearBooksRank = yearStats.filter(
		(year) => year.books >= yearStats.find((item) => item.year === now).books
	).length;

	const thisYearPagesRank = yearStats.filter(
		(year) => year.pages >= yearStats.find((item) => item.year === now).pages
	).length;

	// Current
	const currentlyReading = books
		.filter((book) => book.dateStart !== null && book.dateFinish === null)
		.sort((a, b) => new Date(b.dateStart) - new Date(a.dateStart)); // sort by start date, most recent first
	const currentlyReadingBooks = currentlyReading.length;
	const currentlyReadingPages = currentlyReading.reduce(
		(acc, cur) => acc + (cur.pageTotal || 0),
		0
	);
	const currentlyReadingProgress = currentlyReading.reduce(
		(acc, cur) => acc + Math.floor(cur.progress * (cur.pageTotal || 0)),
		0
	);

	// Totals
	const total = books.filter((book) => book.dateFinish);
	const totalBooks = total.length;
	const totalPages = total.reduce((acc, cur) => acc + (cur.pageTotal || 0), 0);

	return {
		mostBooksBooks,
		mostBooksYear,
		mostPagesPages,
		mostPagesYear,
		thisYearBooks,
		thisYearPages,
		thisYearBooksRank,
		thisYearPagesRank,
    currentlyReading,
		currentlyReadingBooks,
		currentlyReadingPages,
		currentlyReadingProgress,
		totalBooks,
		totalPages,
		yearStats,
	};
};

module.exports = {
	bookStats: bookStats,
};
