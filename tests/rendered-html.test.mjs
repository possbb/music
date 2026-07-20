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
