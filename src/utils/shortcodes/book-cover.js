const Image = require("@11ty/eleventy-img");

module.exports = async function (book, showProgress = false) {
  let imageHtml = "";
  if (book.coverImage && book.coverImage.large) {
    try {
      // Use the pre-optimized large image
      imageHtml = `<img src="${book.coverImage.large}" alt="${book.title}" loading="lazy" decoding="async" style="width: 100%; height: auto;">`;
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
      <a href="/book/${book.slug}">
        ${imageHtml}
      </a>
    </div>
    <div class="book-cover-box-side"></div>
    <div class="book-cover-box-back"></div>
  </div>
${showProgress ? `<progress value="${book.progress}" max="1"></progress>` : ""}
</div>
`;
};
