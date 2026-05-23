import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function extractEnglishVerses(source) {
  const enMatch = source.match(/\ben\b\s*:\s*\{/);
  if (!enMatch) throw new Error("English section not found in CURATED_VERSES");

  const start = enMatch.index + enMatch[0].length - 1;
  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }

  const enBlock = source.slice(start, i + 1);
  const verseObjRegex = /\{\s*text:\s*"((?:[^"\\]|\\.)*)"\s*,\s*ref:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

  const categories = ["comfort", "wisdom", "hope", "love", "repentance"];
  const verses = [];
  let id = 1;

  for (const cat of categories) {
    const catRegex = new RegExp(`\\b${cat}\\b\\s*:\\s*\\[`);
    const catMatch = enBlock.match(catRegex);
    if (!catMatch) continue;

    const arrStart = enBlock.indexOf("[", catMatch.index);
    let arrDepth = 0;
    let j = arrStart;
    for (; j < enBlock.length; j++) {
      if (enBlock[j] === "[") arrDepth++;
      else if (enBlock[j] === "]") {
        arrDepth--;
        if (arrDepth === 0) break;
      }
    }
    const arrStr = enBlock.slice(arrStart, j + 1);
    let m;
    while ((m = verseObjRegex.exec(arrStr)) !== null) {
      verses.push({
        id: id++,
        book: "",
        chapter: 0,
        verse: 0,
        text: m[1],
        ref: m[2],
        categories: [cat],
      });
    }
  }
  return verses;
}

const appJs = fs.readFileSync(path.join(root, "legacy", "app.js"), "utf8");
const verses = extractEnglishVerses(appJs);
const out = {
  metadata: {
    version: "1.0.0",
    language: "en",
    translation: "Curated (KJV-style references)",
    total_verses: verses.length,
    categories: {
      comfort: "Comfort & peace",
      wisdom: "Wisdom",
      hope: "Hope & promises",
      love: "Love",
      repentance: "Repentance & forgiveness",
    },
  },
  verses,
};
fs.writeFileSync(
  path.join(root, "src", "data", "verses-en.json"),
  JSON.stringify(out, null, 2),
  "utf8"
);
console.log("Wrote", verses.length, "English verses to src/data/verses-en.json");
