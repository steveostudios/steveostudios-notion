const dotenv = require("dotenv");
const { bookStats }= require("./utils/bookStats.js")
const Image = require("@11ty/eleventy-img");
const { goalProgress } = require("./utils/shortcodes/goal-progress");
const bookCover = require("./utils/shortcodes/book-cover");
const { lineGraph } = require("./utils/shortcodes/graph.js");
const { numToOrdinal, numWithDelimiter } = require("./utils/filters/numbers.js");
dotenv.config();

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");

  // get current year (for footer)
  eleventyConfig.addNunjucksShortcode("currentYear", function() {
    return new Date().getFullYear();
  });

  // Collections
	eleventyConfig.addCollection("stats", bookStats);

  // Filters
  
  // Read SVG file contents for inline embedding
  eleventyConfig.addFilter("svgContents", function(filePath) {
    const fs = require("fs");
    const path = require("path");
    const fullPath = path.join(__dirname, "src", filePath);
    
    try {
      return fs.readFileSync(fullPath, "utf8");
    } catch (error) {
      console.error(`Error reading SVG file: ${fullPath}`, error.message);
      return "";
    }
  });

  // Add number formatting filters
  eleventyConfig.addFilter("number_with_delimiter", numWithDelimiter);
  eleventyConfig.addFilter("to_ordinal", numToOrdinal);
  
  // Images
  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, sizes) {
    if(!src) return "";

    let metadata = await Image(src, {
      widths: [300, 600],
      formats: ["jpeg"],
      outputDir: "./_site/assets/img/",
      urlPath: "/assets/img/",
      cacheOptions: {
        duration: "1d",
        directory: ".cache",
        removeUrlQueryParams: false,
      },
    });

    let imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };

    return Image.generateHTML(metadata, imageAttributes);
  });

  // Graphs
  eleventyConfig.addNunjucksShortcode(
		"booksByYearSVG",
		(books, optionsJSON = "{}") => {
			const options = JSON.parse(optionsJSON);
			return lineGraph(books, "books", options);
		}
	);
	eleventyConfig.addNunjucksShortcode(
		"pagesByYearSVG",
		(books, optionsJSON = "{}") => {
			const options = { ...{ gap: 1000 }, ...JSON.parse(optionsJSON) };
			return lineGraph(books, "pages", options);
		}
	);

  // Goals
  eleventyConfig.addNunjucksShortcode("goalProgress", (goals, books) =>
		goalProgress(goals, books)
	);

  // Book Cover
  eleventyConfig.addNunjucksAsyncShortcode("bookCover", bookCover);
  
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html"],
  };
};

