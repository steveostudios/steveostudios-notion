const fs = require('fs');
const path = require('path');

const csvPath = 'Books 2b1aec2d56b7800e894aca8f5ad03c6d_all.csv';

try {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  
  if (lines.length < 2) {
    console.log('CSV file is empty or has no data.');
    process.exit(0);
  }

  const header = lines[0].split(',');
  const slugIndex = header.indexOf('Slug');

  if (slugIndex === -1) {
    console.error('Slug column not found in header.');
    process.exit(1);
  }

  const slugCounts = {};
  const duplicates = [];

  // Helper to parse CSV line properly respecting quotes
  // Simple parser: matches quoted fields or non-comma sequences
  const parseCSVLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = parseCSVLine(line);
    // Handle case where some lines might be malformed or different length found
    if (columns.length <= slugIndex) continue;

    const slug = columns[slugIndex].trim();
    
    if (slug) {
      slugCounts[slug] = (slugCounts[slug] || 0) + 1;
    }
  }

  for (const [slug, count] of Object.entries(slugCounts)) {
    if (count > 1) {
      duplicates.push({ slug, count });
    }
  }

  if (duplicates.length > 0) {
    console.log('Found duplicate slugs:');
    duplicates.forEach(d => console.log(`- "${d.slug}": ${d.count} times`));
  } else {
    console.log('No duplicate slugs found.');
  }

} catch (err) {
  console.error('Error reading/processing file:', err);
}
