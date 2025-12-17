const { bookStats } = require('./src/utils/bookStats.js');

// Mock collectionApi
const mockBooks = [
    {
        title: "Book 1",
        dateFinish: "2025-01-15",
        pageTotal: 300,
        year: undefined // Simulating missing year property
    },
    {
        title: "Book 2",
        dateFinish: "2024-12-20",
        pageTotal: 250,
        year: undefined
    },
    {
        title: "Book 3", // Currently reading
        dateFinish: null,
        dateStart: "2025-02-01",
        pageTotal: 400,
        year: undefined
    }
];

const mockCollectionApi = {
    getAll: () => [{
        data: {
            books: mockBooks
        }
    }]
};

console.log("--- Running bookStats with mock data ---");
const stats = bookStats(mockCollectionApi);

console.log("thisYearBooks:", stats.thisYearBooks);
console.log("thisYearPages:", stats.thisYearPages);

if (stats.thisYearBooks === 0) {
    console.log("FAIL: thisYearBooks is 0, expected 1");
} else {
    console.log("PASS: thisYearBooks is not 0");
}
