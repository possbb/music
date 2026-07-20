import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import * as mammoth from "mammoth";
import { buildPrompt, extractKeywords, extractPatterns } from "../app/page";

const filenames = process.argv.slice(2);
assert.ok(filenames.length > 0, "Pass at least one DOCX path.");

let combined = "";
for (const filename of filenames) {
  const result = await mammoth.extractRawText({ buffer: await readFile(filename) });
  const keywords = extractKeywords(result.value);
  const patterns = extractPatterns(result.value);

  assert.ok(result.value.length > 200, `${basename(filename)}: too little text extracted`);
  assert.ok(keywords.length >= 8, `${basename(filename)}: too few keywords`);
  assert.ok(patterns.length >= 5, `${basename(filename)}: too few sentence patterns`);
  combined += `\n${result.value}`;
  console.log(`${basename(filename)}: ${result.value.length} chars, ${keywords.length} keywords, ${patterns.length} patterns`);
}

const combinedKeywords = extractKeywords(combined);
const combinedPatterns = extractPatterns(combined);
const prompt = buildPrompt({
  topic: "自我介绍",
  customTopic: "",
  style: "清新流行",
  mood: "温暖、轻快、有希望",
  level: "A1 入门",
  length: "约 2 分钟（2 段主歌 + 重复副歌）",
  keywords: combinedKeywords,
  patterns: combinedPatterns.join("\n"),
  requirements: "副歌使用问答",
});

assert.match(prompt, /Suno/);
assert.match(prompt, /¿/);
assert.match(prompt, /只输出西班牙语歌词/);
console.log(`Combined prompt: ${combinedKeywords.length} keywords, ${combinedPatterns.length} patterns, ${prompt.length} chars`);
