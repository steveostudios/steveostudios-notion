
const year = (year, value, x, y, h, position, scale, fontSizeScale) => {
	const fontSize = 10 * scale * fontSizeScale; // base font scaled by user multiplier
	const circleRadius = 4 * scale;
	const labelOffset = 8 * scale;

	return `
    <g class="year ${year}">
      <circle class="dot" cx="${x}" cy="${y}" r="${circleRadius}"/>
      <text class="value" 
            x="${x}" 
            y="${y - labelOffset}" 
            text-anchor="${position}" 
            font-size="${fontSize}">
        ${value}
      </text>
      <text class="xyear" 
            x="${x}" 
            y="${h + 5 * scale}" 
            font-size="${fontSize * 0.75}">
        '${year.toString().slice(-2)}
      </text>
    </g>
  `;
};

module.exports = {
	lineGraph: function (data, prop, options = {}) {
		// === Options with defaults ===
		const viewBox = {
			w: options.width || 420,
			h: options.height || 180,
		};

		const fontSizeScale = options.fontSizeScale ?? 1;

		// Base scale reference (original graph dimensions)
		const base = { w: 420, h: 180 };
		const scale = Math.min(viewBox.w / base.w, viewBox.h / base.h);

		// Define margins as proportions of the viewBox
		const margin = {
			top: viewBox.h * 0.2 * (fontSizeScale / 2 || 1),
			right: viewBox.w * 0.02,
			bottom: viewBox.h * 0.1 * fontSizeScale,
			left: viewBox.w * 0.02,
		};

		// Graph area
		const graphDims = {
			x: margin.left,
			y: margin.top,
			w: viewBox.w - margin.left - margin.right,
			h: viewBox.h - margin.top - margin.bottom,
		};

		const horLinesGap = options?.gap || 5;

		// === PREPARE DATA ===
		data = data
			.filter((item) => item.year !== "current")
			.sort((a, b) => a.year - b.year);

		// Return empty if no data
		if (!data || data.length === 0) {
			console.warn("No data available for graph");
			return "";
		}

		const firstYear = data[0].year;
		const lastYear = data[data.length - 1].year;
		const steps = lastYear - firstYear + 1;

		const filledInBooks = Array.from({ length: steps }).map((_, i) => {
			const match = data.find(
				(item) => parseInt(item.year) === i + parseInt(firstYear)
			);
			return (
				match || {
					year: (i + parseInt(firstYear)).toString(),
					books: 0,
					pages: 0,
				}
			);
		});

		// === SCALE CALCULATIONS ===
		const graphHeight = [...filledInBooks].sort((a, b) => b[prop] - a[prop])[0][
			prop
		];
		const divisions = {
			h: graphDims.w / (steps - 1),
			v: graphDims.h / graphHeight,
		};

		// === HORIZONTAL LINES ===
		const horLines = [...Array(Math.ceil(graphHeight / horLinesGap))].map(
			(_, i) => {
				const y = graphDims.h - divisions.v * i * horLinesGap + graphDims.y;
				return `<line class="horizontal" 
                     x1="${graphDims.x}" 
                     x2="${graphDims.w + graphDims.x}" 
                     y1="${y}" y2="${y}" 
                     stroke-width="${1 * scale}"></line>`;
			}
		);

		// === POINTS ===
		const points = filledInBooks.map((item, i) => [
			(item.year - firstYear) * divisions.h + graphDims.x,
			(graphHeight - item[prop]) * divisions.v + graphDims.y,
		]);

		const fillPath = `${points
			.join(" ")
			.replace("NaN", filledInBooks.length * divisions.h)} ${
			graphDims.w + graphDims.x
		},${graphDims.h + graphDims.y} 0, ${graphDims.h + graphDims.y}`;

		const linePath = points
			.join(" ")
			.replace("NaN", filledInBooks.length * divisions.h);

		// === YEAR LABELS ===
		const years = points.map((item, i) =>
			year(
				filledInBooks[i].year,
				filledInBooks[i][prop],
				item[0],
				item[1],
				graphDims.h + graphDims.y,
				i === 0 ? "start" : i === filledInBooks.length - 1 ? "end" : "middle",
				scale,
				fontSizeScale
			)
		);

		// === SVG OUTPUT ===
		return `<svg viewBox="0 0 ${viewBox.w} ${viewBox.h}" width="${
			viewBox.w
		}" height="${viewBox.h}">
      ${horLines.join("")}
      <polyline class="fill" points="${fillPath}" stroke-width="${1 * scale}"/>
      <polyline class="line" points="${linePath}" stroke-width="${2 * scale}"/>
      ${years.join("")}
    </svg>`;
	},
};
