const Image = require("@11ty/eleventy-img");

module.exports = async function (book, showProgress = false) {
  let imageHtml = "";
  if (book.coverImage) {
    try {
      let metadata = await Image(book.coverImage, {
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
        alt: book.title,
        sizes: "100vw",
        loading: "lazy",
        decoding: "async",
      };

      imageHtml = Image.generateHTML(metadata, imageAttributes);
    } catch (e) {
      console.error(`[bookCover] Error generating image for ${book.title}:`, e);
    }
  }

  const sideWidth = (book.pageTotal / 100) * 6 + 4;

  return `
<div
  class="book-cover"
  data-fiction="${ book.fiction ? "fiction" : "nonfiction" }" 
  data-stars="${ book.stars }" 
  data-format="${ book.format }" 
  data-review="${ book.review ? "true" : "false" }" 
  style="--sideWidth: ${sideWidth}px;"
>
  <div class="book-cover-box">
    <div class="book-cover-box-face">
      <a href="/book/${book.slug}-${book.id}">
        ${imageHtml}
      </a>
    </div>
    <div class="book-cover-box-side"></div>
    <div class="book-cover-box-back"></div>
  </div>
</div>
${showProgress ? `<progress value="${book.progress}" max="100"></progress>` : ""}
`;
};
