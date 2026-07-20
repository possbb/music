import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Spanish lyric prompt workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LetraLab/);
  assert.match(html, /把课堂句型/);
  assert.match(html, /加入教材/);
  assert.match(html, /检查提取结果/);
  assert.match(html, /设定创作方向/);
  assert.match(html, /歌词语言/);
  assert.match(html, /西班牙语/);
  assert.match(html, /中文/);
  assert.match(html, /英文/);
  assert.match(html, /分别生成多套/);
  assert.match(html, /逐句多语言对照/);
  assert.match(html, /歌曲创作应用/);
  assert.match(html, /Suno/);
  assert.match(html, /Udio/);
  assert.match(html, /Mureka/);
  assert.match(html, /教材词汇使用比例/);
  assert.match(html, /较少/);
  assert.match(html, /普通/);
  assert.match(html, /很多/);
  assert.match(html, /20%/);
  assert.match(html, /50%/);
  assert.match(html, /80%/);
  assert.match(html, /4 分钟/);
  assert.match(html, /5 分钟/);
  assert.match(html, /6 分钟/);
  assert.match(html, /复制给大模型/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("defaults textbook usage to 80 percent", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /useState<VocabularyRatio>\(80\)/);
});

test("persists creative options without storing textbook files", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /letralab:creative-options:v1/);
  assert.match(pageSource, /localStorage\.getItem/);
  assert.match(pageSource, /localStorage\.setItem/);
  assert.match(pageSource, /SavedPreferences/);
  assert.doesNotMatch(pageSource, /const preferences: SavedPreferences = \{[^}]*\bsourceText\b/);
  assert.doesNotMatch(pageSource, /const preferences: SavedPreferences = \{[^}]*\bmanualText\b/);
});

test("extracts a broader set of textbook terms and patterns", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /"focused"[\s\S]*?keywords: 40, patterns: 24/);
  assert.match(pageSource, /"expanded"[\s\S]*?keywords: 80, patterns: 48/);
  assert.match(pageSource, /"comprehensive"[\s\S]*?keywords: 160, patterns: 96/);
  assert.match(pageSource, /useState<ExtractionScope>\("expanded"\)/);
  assert.match(pageSource, /changeExtractionScope/);
  assert.match(pageSource, /line\.length >= 8 && line\.length <= 180/);
});

test("places the prompt output beside the creative settings on wide screens", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.workspace-side \{ grid-template-columns: minmax\(390px, 1\.12fr\) minmax\(320px, \.88fr\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.workspace-side \{ grid-template-columns: 1fr; \}/);
});

test("uses compact selects for arrangement, music app, and textbook ratio", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /className="field-grid compact-controls"/);
  assert.match(pageSource, /<select value=\{languageMode\}/);
  assert.match(pageSource, /<select value=\{targetApp\}/);
  assert.match(pageSource, /<select value=\{vocabularyRatio\}/);
  assert.doesNotMatch(pageSource, /name="language-mode"|name="target-app"|name="vocabulary-ratio"/);
});
