module.exports = {
  numToOrdinal: function (num) {
    let ord = "th";
    if (num % 10 == 1 && num % 100 != 11) {
      ord = "st";
    } else if (num % 10 == 2 && num % 100 != 12) {
      ord = "nd";
    } else if (num % 10 == 3 && num % 100 != 13) {
      ord = "rd";
    }
    return num + ord;
  },
  numWithDelimiter: function (num) {
    return Number(num).toLocaleString();
  },
};
