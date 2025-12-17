const dotenv = require("dotenv");
const { bookStats }= require("./src/utils/bookStats.js")
const Image = require("@11ty/eleventy-img");
const { goalProgress } = require("./src/utils/shortcodes/goal-progress.js");
const bookCover = require("./src/utils/shortcodes/book-cover.js");
const { lineGraph } = require("./src/utils/shortcodes/graph.js");
const { numToOrdinal, numWithDelimiter } = require("./src/utils/filters/numbers.js");
dotenv.config();

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");

  // get current year (for footer)
  eleventyConfig.addNunjucksShortcode("currentYear", function() {
    return new Date().getFullYear();
  });

  // Layout Aliases
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("resume", "layouts/resume.njk");
  eleventyConfig.addLayoutAlias("analytics", "layouts/analytics.njk");

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
  
  // Date filter
  eleventyConfig.addFilter("date", (dateObj, format) => {
    if (!dateObj) return "";
    const date = new Date(dateObj);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });
  
  // Images
  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, sizes, format) {
    if(!src) return "";

    let metadata = await Image(src, {
      widths: [300, 600],
      formats: [format || "jpeg"],
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

    if (!metadata) {
      console.error("Metadata is null/undefined for src:", src);
      return "";
    }

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

