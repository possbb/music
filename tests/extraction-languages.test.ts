import assert from "node:assert/strict";
import test from "node:test";

import { extractKeywords, extractPatterns } from "../app/page";

const material = `Hola, buenos días. ¿Cómo te llamas? Me llamo Ana.
Hello, good morning. What is your name? My name is Anna.
你好，早上好。你叫什么名字？我叫安娜。`;

test("extracts Spanish, English, and Chinese keywords independently", () => {
  const spanish = extractKeywords(material, 40, ["es"]);
  const english = extractKeywords(material, 40, ["en"]);
  const chinese = extractKeywords(material, 40, ["zh"]);

  assert.ok(spanish.includes("hola"));
  assert.ok(spanish.includes("llamas"));
  assert.ok(!spanish.includes("hello"));
  assert.ok(english.includes("hello"));
  assert.ok(english.includes("morning"));
  assert.ok(!english.includes("hola"));
  assert.ok(chinese.includes("你好"));
  assert.ok(chinese.includes("名字"));
  assert.ok(chinese.every((word) => /[\u3400-\u9fff]/u.test(word)));
});

test("keeps sentence patterns in the selected extraction language", () => {
  const spanish = extractPatterns(material, 20, ["es"]);
  const english = extractPatterns(material, 20, ["en"]);
  const chinese = extractPatterns(material, 20, ["zh"]);

  assert.ok(spanish.some((line) => line.includes("¿Cómo te llamas?")));
  assert.ok(spanish.every((line) => !/[\u3400-\u9fff]/u.test(line) && !line.includes("Hello")));
  assert.ok(english.some((line) => line.includes("What is your name?")));
  assert.ok(english.every((line) => !/[\u3400-\u9fff]/u.test(line) && !line.includes("Hola")));
  assert.ok(chinese.some((line) => line.includes("你叫什么名字？")));
  assert.ok(chinese.every((line) => /[\u3400-\u9fff]/u.test(line) && !/[a-z]/iu.test(line)));
});
