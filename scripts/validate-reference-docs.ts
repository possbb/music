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
  languages: ["es", "zh", "en"],
  languageMode: "aligned",
  targetApp: "suno",
  customApp: "",
  vocabularyRatio: 50,
  keywords: combinedKeywords,
  patterns: combinedPatterns.join("\n"),
  requirements: "副歌使用问答",
});

assert.match(prompt, /Suno/);
assert.match(prompt, /¿/);
assert.match(prompt, /一套歌词逐句多语言对照/);
assert.match(prompt, /ES:、中文：、EN:/);
assert.match(prompt, /不得混入未选择的语言/);
assert.match(prompt, /【Style of Music】/);
assert.match(prompt, /Suno Custom 模式/);
assert.match(prompt, /普通（约 50%）/);
assert.match(prompt, /至少自然使用 9 个上方关键词和 5 个教材句型/);

const separatePrompt = buildPrompt({
  topic: "友情",
  customTopic: "",
  style: "故事民谣",
  mood: "温暖",
  level: "A2 初级",
  length: "约 3 分钟（完整叙事结构）",
  languages: ["es", "zh"],
  languageMode: "separate",
  targetApp: "udio",
  customApp: "",
  vocabularyRatio: 80,
  keywords: combinedKeywords,
  patterns: combinedPatterns.join("\n"),
  requirements: "",
});
assert.match(separatePrompt, /分别生成 2 套完整歌词/);
assert.match(separatePrompt, /不要逐字硬译/);
assert.match(separatePrompt, /【Udio Prompt】/);
assert.match(separatePrompt, /guidance tags/);
assert.match(separatePrompt, /很多（约 80%）/);
assert.match(separatePrompt, /至少自然使用 15 个上方关键词和 8 个教材句型/);
assert.match(separatePrompt, /其余约 20% 可以根据主题、风格、情绪和目标应用自由创作/);
console.log(`Combined prompt: ${combinedKeywords.length} keywords, ${combinedPatterns.length} patterns, ${prompt.length} chars`);
