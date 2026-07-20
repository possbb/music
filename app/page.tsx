"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import * as mammoth from "mammoth";

type MaterialFile = {
  name: string;
  size: number;
  status: "done" | "error";
};

export type LyricLanguage = "es" | "zh" | "en";

const LANGUAGE_OPTIONS: Array<{ value: LyricLanguage; label: string; native: string }> = [
  { value: "es", label: "西班牙语", native: "Español" },
  { value: "zh", label: "中文", native: "中文" },
  { value: "en", label: "英文", native: "English" },
];

export type TargetApp = "suno" | "udio" | "mureka" | "generic";

const TARGET_APPS: Array<{ value: TargetApp; label: string; detail: string; mark: string }> = [
  { value: "suno", label: "Suno", detail: "歌词、音乐风格与标题分栏", mark: "SU" },
  { value: "udio", label: "Udio", detail: "Prompt + Custom Lyrics 标签", mark: "UD" },
  { value: "mureka", label: "Mureka", detail: "歌词与音乐描述配套输出", mark: "MU" },
  { value: "generic", label: "其他 / 通用", detail: "适合复制到其他音乐应用", mark: "AI" },
];

export type VocabularyRatio = 20 | 50 | 80;

export type ExtractionScope = "focused" | "expanded" | "comprehensive";

const EXTRACTION_OPTIONS: Array<{ value: ExtractionScope; label: string; detail: string; keywords: number; patterns: number }> = [
  { value: "focused", label: "重点", detail: "适合短教材", keywords: 40, patterns: 24 },
  { value: "expanded", label: "丰富", detail: "推荐使用", keywords: 80, patterns: 48 },
  { value: "comprehensive", label: "全面", detail: "适合长教材", keywords: 160, patterns: 96 },
];

const VOCABULARY_OPTIONS: Array<{ value: VocabularyRatio; label: string; detail: string }> = [
  { value: 20, label: "较少", detail: "约 20% 来自教材，自由发挥更多" },
  { value: 50, label: "普通", detail: "约 50% 来自教材，创作较均衡" },
  { value: 80, label: "很多", detail: "约 80% 来自教材，强化课堂记忆" },
];

const SONG_STYLES = [
  { value: "清新流行", detail: "明亮、好记、适合课堂合唱", color: "mint" },
  { value: "情感抒情", detail: "温柔钢琴与渐进情绪", color: "rose" },
  { value: "故事民谣", detail: "用人物和情节串联句型", color: "sand" },
  { value: "拉丁律动", detail: "轻快节奏，突出西语韵律", color: "sun" },
  { value: "课堂儿歌", detail: "重复明确，适合初学记忆", color: "sky" },
  { value: "说唱节奏", detail: "短句押韵，适合数字与词汇", color: "violet" },
  { value: "电影叙事", detail: "画面感强，主歌层层推进", color: "blue" },
  { value: "摇滚励志", detail: "有力量的副歌与成长主题", color: "orange" },
] as const;

const TOPICS = [
  "自我介绍",
  "课堂日常",
  "旅行与相遇",
  "友情",
  "梦想与成长",
  "爱情与回忆",
  "自定义主题",
];

const LENGTH_OPTIONS = [
  "约 1 分钟（短歌 + 循环副歌）",
  "约 2 分钟（2 段主歌 + 重复副歌）",
  "约 3 分钟（完整叙事结构）",
  "约 4 分钟（3 段主歌 + 桥段 + 完整副歌）",
  "约 5 分钟（长篇故事 + 多次副歌变化）",
  "约 6 分钟（多章节长歌 + 完整起承转合）",
];

const PREFERENCE_STORAGE_KEY = "letralab:creative-options:v1";

type SavedPreferences = {
  extractionScope: ExtractionScope;
  topic: string;
  customTopic: string;
  style: string;
  mood: string;
  level: string;
  length: string;
  languages: LyricLanguage[];
  languageMode: "separate" | "aligned";
  targetApp: TargetApp;
  customApp: string;
  vocabularyRatio: VocabularyRatio;
  requirements: string;
};

const STOP_WORDS = new Set(
  `a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa ese eso esta estas este estos fue ha hay la las lo los más me mi mis mucha mucho muy no nos o otra para pero por porque que qué se si sin sobre son su sus te tu tus un una uno unas unos ya y yo tú usted ustedes él también cómo cuál dónde quién años english español clase notas alumnos alumnas respuesta pregunta ejemplo práctica recordar objetivo modelo fácil ayuda idea grupo frase palabra palabras número números ejercicio repaso tarea nota`.split(
    " ",
  ),
);

const SAMPLE_MATERIAL = `Hola, buenos días. ¿Cómo te llamas? Me llamo Carlos.
¿De dónde eres? Soy de China. ¿A qué te dedicas? Soy ingeniero.
¿Cuántos años tienes? Tengo treinta y cinco años.
Ella se llama Lea. Es canadiense. Es científica. Tiene cuarenta y un años.
¿Cómo se escribe Carlos? Se escribe C-A-R-L-O-S.
¿Puedes repetir, por favor? ¿Puedes hablar más despacio, por favor?
el libro, la silla, el cuaderno, la mesa, el bolígrafo, la mochila
Soy china, pero vivo en mis sueños. El tiempo pasa rápido. Nos vemos.`;

function normalizeLine(value: string) {
  return value.replace(/[\t\u00a0]+/g, " ").replace(/\s+/g, " ").trim();
}

export function extractKeywords(text: string, limit = EXTRACTION_OPTIONS[1].keywords) {
  const counts = new Map<string, number>();
  const preferred = new Set([
    "llamo",
    "soy",
    "tengo",
    "tiene",
    "trabajo",
    "trabaja",
    "amigos",
    "familia",
    "nombre",
    "vida",
    "corazón",
    "sueños",
    "gracias",
    "hola",
    "adiós",
  ]);

  const words = text.toLocaleLowerCase("es").match(/[a-záéíóúüñ]{2,}/giu) ?? [];
  for (const word of words) {
    if (STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, score: count * 3 + (preferred.has(word) ? 6 : 0) + Math.min(word.length, 8) / 4 }))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, "es"))
    .slice(0, limit)
    .map(({ word }) => word);
}

export function extractPatterns(text: string, limit = EXTRACTION_OPTIONS[1].patterns) {
  const lines = text
    .split(/\r?\n|•|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ¿])/u)
    .map(normalizeLine)
    .flatMap((line) => line.split(/\s*\|\s*/).map(normalizeLine))
    .filter(Boolean);

  const ignored = /^(objetivo|para recordar|ejercicio|práctica|repaso|nota|grupo|número|español|english|中文|tema|uso|modelo|pregunta|respuesta)/i;
  const usefulVerb = /\b(me llamo|se llama|soy|eres|es|somos|son|estoy|est\u00e1s|est\u00e1|tengo|tienes|tiene|tenemos|trabajo|trabajas|trabaja|vivo|vives|vive|quiero|quieres|quiere|me gusta|te gusta|le gusta|hay|voy|vas|va|puedo|puedes|puede|podemos|necesito|necesitas|prefiero|prefieres|nos vemos|hasta luego)\b/i;
  const seen = new Set<string>();

  return lines
    .filter((line) => line.length >= 8 && line.length <= 180)
    .filter((line) => !/[\u3400-\u9fff]/u.test(line) && !ignored.test(line))
    .map((line) => line.replace(/_{3,}/g, "[信息]").replace(/\s*=\s*[^/]+(?:\/.*)?$/u, ""))
    .map((line) => ({
      line,
      key: line.toLocaleLowerCase("es").replace(/[^a-záéíóúüñ¿?]+/giu, " ").trim(),
      score: (line.includes("¿") ? 8 : 0) + (usefulVerb.test(line) ? 6 : 0) + (line.includes("[信息]") ? 2 : 0),
    }))
    .filter(({ key }) => key.length > 4 && !seen.has(key) && Boolean(seen.add(key)))
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length)
    .slice(0, limit)
    .map(({ line }) => line.replace(/^[-–—]\s*/, ""));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes > 1024 * 100 ? 0 : 1)} KB`;
}

async function readMaterial(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }
  if (extension === "txt" || extension === "md") return file.text();
  throw new Error("暂不支持该格式");
}

export function buildPrompt(options: {
  topic: string;
  customTopic: string;
  style: string;
  mood: string;
  level: string;
  length: string;
  languages: readonly LyricLanguage[];
  languageMode: "separate" | "aligned";
  targetApp: TargetApp;
  customApp: string;
  vocabularyRatio: VocabularyRatio;
  keywords: string[];
  patterns: string;
  requirements: string;
}) {
  const topic = options.topic === "自定义主题" ? options.customTopic.trim() || "由教材内容自然发展" : options.topic;
  const patternItems = options.patterns
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean);
  const patterns = patternItems
    .map((line) => `- ${line}`)
    .join("\n");
  const requiredKeywordCount = options.keywords.length ? Math.max(1, Math.ceil(options.keywords.length * options.vocabularyRatio / 100)) : 0;
  const requiredPatternCount = patternItems.length ? Math.max(1, Math.ceil(patternItems.length * options.vocabularyRatio / 100)) : 0;
  const vocabularyLabel = VOCABULARY_OPTIONS.find((item) => item.value === options.vocabularyRatio)?.label;
  const languageNames = options.languages.map((language) => LANGUAGE_OPTIONS.find((item) => item.value === language)?.label).filter(Boolean);
  const languageOrder = options.languages.map((language) => ({ es: "ES", zh: "中文", en: "EN" })[language]).join(" → ");
  const languageInstruction = options.languages.length === 1
    ? `只生成一套${languageNames[0]}歌词。`
    : options.languageMode === "separate"
      ? `分别生成 ${options.languages.length} 套完整歌词，每种语言一套。各版本的故事、段落结构和副歌含义要一致，但应按各语言习惯自然押韵，不要逐字硬译。每套歌词前分别使用清楚的版本标题。`
      : `只生成一套多语言对照歌词。每个对应句组按“${languageOrder}”顺序逐句排列，各行只写纯歌词，不要添加 ES:、中文：、EN: 或其他语言提示；每个多语言对应句组之间留一个空行。对应行必须表达相同含义。`;
  const targetName = options.targetApp === "generic" ? options.customApp.trim() || "通用 AI 音乐创作应用" : TARGET_APPS.find((item) => item.value === options.targetApp)?.label;
  const appInstruction = {
    suno: `严格按以下三个区块输出：\n【Title】简短歌名\n【Style of Music】用简洁英文关键词描述曲风、情绪、速度、主要乐器和人声，不写具体艺人姓名\n【Lyrics】带段落标签的完整歌词，可直接粘贴到 Suno Custom 模式`,
    udio: `严格按以下三个区块输出：\n【Title】简短歌名\n【Udio Prompt】用简洁关键词描述主题、曲风、情绪、速度和乐器\n【Custom Lyrics】使用 [Verse]、[Chorus]、[Bridge] 等 guidance tags；需要时可用圆括号标记和声`,
    mureka: `严格按以下三个区块输出：\n【Title】简短歌名\n【Music Description】描述曲风、情绪、速度、乐器和人声\n【Lyrics】带清楚段落标签的完整歌词`,
    generic: `严格按以下三个区块输出：\n【Title】简短歌名\n【Music Style Prompt】可复制到 ${targetName} 的音乐风格描述\n【Lyrics】带清楚段落标签的完整歌词`,
  }[options.targetApp];

  return `你是一位擅长语言教学歌曲的多语种作词人。请根据以下西班牙语教材内容，创作可直接用于 ${targetName} 的歌曲素材。

【创作目标】
- 目标歌曲应用：${targetName}
- 歌词主题：${topic}
- 编曲/歌词风格：${options.style}
- 情绪：${options.mood}
- 歌词语言：${languageNames.join("、")}
- 多语言编排：${options.languages.length === 1 ? "单语言歌词" : options.languageMode === "separate" ? "分别生成多套完整歌词" : "一套歌词逐句多语言对照"}
- 教材词汇使用比例：${vocabularyLabel}（约 ${options.vocabularyRatio}%）
- 表达难度：${options.level}（优先使用短句、常用词和清晰语法）
- 歌曲长度：${options.length}
- 听众：正在学习西班牙语的中文母语初学者

【必须自然融入的关键词】
${options.keywords.length ? options.keywords.join("、") : "请从下方句型中自行提炼"}

【教材句型参考】
${patterns || "- 请围绕主题使用适合初学者的西班牙语完整句子"}

【教材使用比例规则】
- 以歌词中的核心实词、短语、句型和表达含义估算，约 ${options.vocabularyRatio}% 必须来自教材；冠词、介词等功能词不计入比例。
- 至少自然使用 ${requiredKeywordCount} 个上方关键词和 ${requiredPatternCount} 个教材句型，不要为了凑数量生硬堆砌。
- 其余约 ${100 - options.vocabularyRatio}% 可以根据主题、风格、情绪和目标应用自由创作，但不得偏离设定的语言难度。
- 西班牙语版本优先使用教材原词；中文或英文版本使用相同教材概念的自然对应表达，不要强行夹入西班牙语。

【写作要求】
1. ${languageInstruction}
2. 除目标应用需要的标题、音乐风格提示、版本标题和歌曲段落标记外，不要解释或添加创作说明；歌词不得混入未选择的语言。
3. 使用 [Intro]、[Verse 1]、[Pre-Chorus]、[Chorus]、[Verse 2]、[Bridge]、[Final Chorus] 标记结构；不需要的段落可省略。
4. 副歌要简单、朗朗上口，并重复 2—4 个核心句型帮助记忆。
5. 主歌要有连贯情境，不要把教材词汇机械罗列成清单。
6. 教材中的问句尽量配上自然回答；所有语言的语法和表达必须正确、自然。
7. 每行尽量简短，适合演唱与清楚发音；不同语言的对应行长度尽量接近。
8. 可以押韵，但不能为了押韵使用超出 ${options.level} 太多的生僻词。
9. 不要写歌手姓名或模仿具体在世艺人的风格。
${options.requirements.trim() ? `10. 额外要求：${options.requirements.trim()}` : ""}

【${targetName} 输出格式】
${appInstruction}

现在请严格按上述格式直接输出结果。`;
}

export default function Home() {
  const [files, setFiles] = useState<MaterialFile[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [manualText, setManualText] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [patterns, setPatterns] = useState("");
  const [extractionScope, setExtractionScope] = useState<ExtractionScope>("expanded");
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [topic, setTopic] = useState("自我介绍");
  const [customTopic, setCustomTopic] = useState("");
  const [style, setStyle] = useState("清新流行");
  const [mood, setMood] = useState("温暖、轻快、有希望");
  const [level, setLevel] = useState("A1 入门");
  const [length, setLength] = useState("约 2 分钟（2 段主歌 + 重复副歌）");
  const [languages, setLanguages] = useState<LyricLanguage[]>(["es"]);
  const [languageMode, setLanguageMode] = useState<"separate" | "aligned">("separate");
  const [targetApp, setTargetApp] = useState<TargetApp>("suno");
  const [customApp, setCustomApp] = useState("");
  const [vocabularyRatio, setVocabularyRatio] = useState<VocabularyRatio>(80);
  const [requirements, setRequirements] = useState("");
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
      if (!stored) return;
      const saved = JSON.parse(stored) as Partial<SavedPreferences>;
      if (saved.extractionScope && EXTRACTION_OPTIONS.some((item) => item.value === saved.extractionScope)) setExtractionScope(saved.extractionScope);
      if (typeof saved.topic === "string" && TOPICS.includes(saved.topic)) setTopic(saved.topic);
      if (typeof saved.customTopic === "string") setCustomTopic(saved.customTopic);
      if (typeof saved.style === "string" && SONG_STYLES.some((item) => item.value === saved.style)) setStyle(saved.style);
      if (typeof saved.mood === "string") setMood(saved.mood);
      if (typeof saved.level === "string" && ["A1 入门", "A2 初级", "B1 中级"].includes(saved.level)) setLevel(saved.level);
      if (typeof saved.length === "string" && LENGTH_OPTIONS.includes(saved.length)) setLength(saved.length);
      if (Array.isArray(saved.languages)) {
        const validLanguages = LANGUAGE_OPTIONS.map((item) => item.value).filter((language) => saved.languages?.includes(language));
        if (validLanguages.length) setLanguages(validLanguages);
      }
      if (saved.languageMode === "separate" || saved.languageMode === "aligned") setLanguageMode(saved.languageMode);
      if (saved.targetApp && TARGET_APPS.some((item) => item.value === saved.targetApp)) setTargetApp(saved.targetApp);
      if (typeof saved.customApp === "string") setCustomApp(saved.customApp);
      if (saved.vocabularyRatio === 20 || saved.vocabularyRatio === 50 || saved.vocabularyRatio === 80) setVocabularyRatio(saved.vocabularyRatio);
      if (typeof saved.requirements === "string") setRequirements(saved.requirements);
    } catch {
      // Ignore unavailable or invalid browser storage and keep safe defaults.
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    const preferences: SavedPreferences = {
      extractionScope,
      topic,
      customTopic,
      style,
      mood,
      level,
      length,
      languages,
      languageMode,
      targetApp,
      customApp,
      vocabularyRatio,
      requirements,
    };
    try {
      window.localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Private browsing or storage restrictions should not block the app.
    }
  }, [preferencesReady, extractionScope, topic, customTopic, style, mood, level, length, languages, languageMode, targetApp, customApp, vocabularyRatio, requirements]);

  const activeExtractionOption = EXTRACTION_OPTIONS.find((item) => item.value === extractionScope) ?? EXTRACTION_OPTIONS[1];

  const stats = useMemo(
    () => ({
      chars: (sourceText + manualText).trim().length,
      keywordCount: keywords.length,
      patternCount: patterns.split("\n").filter(Boolean).length,
    }),
    [sourceText, manualText, keywords, patterns],
  );

  function analyze(text: string, scope = extractionScope) {
    const clean = text.trim();
    const limits = EXTRACTION_OPTIONS.find((item) => item.value === scope) ?? EXTRACTION_OPTIONS[1];
    setKeywords(extractKeywords(clean, limits.keywords));
    setPatterns(extractPatterns(clean, limits.patterns).join("\n"));
    setGenerated("");
  }

  function changeExtractionScope(scope: ExtractionScope) {
    setExtractionScope(scope);
    analyze([sourceText, manualText].filter(Boolean).join("\n"), scope);
  }

  async function handleFiles(selected: File[]) {
    if (!selected.length) return;
    setIsReading(true);
    const nextFiles: MaterialFile[] = [];
    const texts: string[] = [];

    for (const file of selected) {
      try {
        const text = await readMaterial(file);
        texts.push(text);
        nextFiles.push({ name: file.name, size: file.size, status: "done" });
      } catch {
        nextFiles.push({ name: file.name, size: file.size, status: "error" });
      }
    }

    const combined = [sourceText, ...texts].filter(Boolean).join("\n");
    setFiles((current) => [...current, ...nextFiles]);
    setSourceText(combined);
    analyze([combined, manualText].filter(Boolean).join("\n"));
    setIsReading(false);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(Array.from(event.dataTransfer.files));
  }

  function loadSample() {
    setManualText(SAMPLE_MATERIAL);
    analyze([sourceText, SAMPLE_MATERIAL].filter(Boolean).join("\n"));
  }

  function toggleLanguage(language: LyricLanguage) {
    setLanguages((current) => {
      if (current.includes(language)) return current.length === 1 ? current : current.filter((item) => item !== language);
      return LANGUAGE_OPTIONS.map((item) => item.value).filter((item) => [...current, language].includes(item));
    });
    setGenerated("");
  }

  function generate() {
    const prompt = buildPrompt({ topic, customTopic, style, mood, level, length, languages, languageMode, targetApp, customApp, vocabularyRatio, keywords, patterns, requirements });
    setGenerated(prompt);
    setCopied(false);
    window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  async function copyPrompt() {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LetraLab 首页">
          <span className="brand-mark">L</span>
          <span>LetraLab</span>
        </a>
        <span className="privacy-note"><i /> 文件仅在你的浏览器中处理</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">西班牙语教材 → 歌词创作提示词</p>
          <h1>把课堂句型，<br />变成会唱的西语。</h1>
          <p className="hero-description">上传课程笔记，提取真正值得记忆的关键词与句型，再生成单语言、多套语言或逐句对照的歌词任务书。</p>
        </div>
        <div className="hero-card" aria-label="使用流程">
          <span className="mini-label">4 步完成</span>
          <ol>
            <li><b>01</b><span>上传教材</span></li>
            <li><b>02</b><span>检查提取结果</span></li>
            <li><b>03</b><span>选择主题风格</span></li>
            <li><b>04</b><span>复制提示词</span></li>
          </ol>
        </div>
      </section>

      <section className="workspace" aria-label="歌词提示词工作台">
        <div className="workspace-main">
          <article className="panel material-panel">
            <div className="panel-heading">
              <div><span className="step">01</span><h2>加入教材</h2></div>
              <button className="text-button" type="button" onClick={loadSample}>载入示例</button>
            </div>
            <div
              className={`dropzone ${isDragging ? "is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input ref={fileInputRef} type="file" accept=".docx,.txt,.md" multiple onChange={onFileChange} />
              <span className="upload-icon" aria-hidden="true">↑</span>
              <h3>{isReading ? "正在读取教材…" : "拖入教材，或选择文件"}</h3>
              <p>支持 DOCX、TXT、Markdown，可一次上传多份</p>
              <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} disabled={isReading}>选择教材</button>
            </div>

            {files.length > 0 && (
              <div className="file-list" aria-label="已上传文件">
                {files.map((file, index) => (
                  <div className="file-row" key={`${file.name}-${index}`}>
                    <span className="file-type">DOC</span>
                    <span><b>{file.name}</b><small>{formatSize(file.size)}</small></span>
                    <em className={file.status}>{file.status === "done" ? "已提取" : "格式不支持"}</em>
                  </div>
                ))}
              </div>
            )}

            <label className="paste-label" htmlFor="manual-material">也可以直接粘贴教材文字</label>
            <textarea
              id="manual-material"
              className="material-textarea"
              value={manualText}
              onChange={(event) => setManualText(event.target.value)}
              onBlur={() => analyze([sourceText, manualText].filter(Boolean).join("\n"))}
              placeholder="粘贴课堂笔记、单词表或对话……"
            />
            <button className="analyze-button" type="button" onClick={() => analyze([sourceText, manualText].filter(Boolean).join("\n"))}>重新提取内容</button>
          </article>

          <article className="panel extract-panel">
            <div className="panel-heading">
              <div><span className="step">02</span><h2>检查提取结果</h2></div>
              <div className="statline"><span>{stats.chars.toLocaleString()} 字符</span><span>{stats.keywordCount} 关键词</span><span>{stats.patternCount} 句型</span></div>
            </div>

            <div className="result-block extraction-level">
              <div className="block-title"><h3>提取数量</h3><span>切换后立即重新提取</span></div>
              <div className="extraction-options">
                {EXTRACTION_OPTIONS.map((item) => (
                  <label className={extractionScope === item.value ? "selected" : ""} key={item.value}>
                    <input type="radio" name="extraction-scope" value={item.value} checked={extractionScope === item.value} onChange={() => changeExtractionScope(item.value)} />
                    <span><b>{item.label}</b><small>{item.detail}</small></span>
                    <em>{item.keywords} 词 / {item.patterns} 句</em>
                  </label>
                ))}
              </div>
            </div>

            <div className="result-block">
              <div className="block-title"><h3>核心关键词</h3><span>最多提取 {activeExtractionOption.keywords} 个，点击 × 可删除</span></div>
              {keywords.length ? (
                <div className="chips">
                  {keywords.map((keyword) => (
                    <button key={keyword} type="button" onClick={() => setKeywords((current) => current.filter((item) => item !== keyword))}>
                      {keyword}<span aria-hidden="true">×</span><span className="sr-only">删除</span>
                    </button>
                  ))}
                </div>
              ) : <p className="empty-state">上传教材后，这里会出现高频且有教学价值的词。</p>}
            </div>

            <div className="result-block">
              <div className="block-title"><h3>可复用句型</h3><span>最多提取 {activeExtractionOption.patterns} 句，可直接编辑</span></div>
              <textarea className="pattern-textarea" value={patterns} onChange={(event) => setPatterns(event.target.value)} placeholder="例如：¿Cómo te llamas? / Me llamo [名字]." />
            </div>
          </article>
        </div>

        <aside className="workspace-side">
          <article className="panel creative-panel">
            <div className="panel-heading"><div><span className="step">03</span><h2>设定创作方向</h2></div></div>

            <fieldset className="language-fieldset">
              <legend>歌词语言 <span>至少保留一种，可多选</span></legend>
              <div className="language-options">
                {LANGUAGE_OPTIONS.map((item) => (
                  <label className={languages.includes(item.value) ? "selected" : ""} key={item.value}>
                    <input type="checkbox" checked={languages.includes(item.value)} onChange={() => toggleLanguage(item.value)} />
                    <span><b>{item.label}</b><small>{item.native}</small></span>
                    <i aria-hidden="true">{languages.includes(item.value) ? "✓" : "+"}</i>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={`mode-fieldset ${languages.length === 1 ? "inactive" : ""}`}>
              <legend>多语言编排 <span>{languages.length === 1 ? "选择两种以上后生效" : `已选择 ${languages.length} 种语言`}</span></legend>
              <div className="mode-options">
                <label className={languageMode === "separate" ? "selected" : ""}>
                  <input type="radio" name="language-mode" value="separate" checked={languageMode === "separate"} onChange={() => setLanguageMode("separate")} disabled={languages.length === 1} />
                  <b>分别生成多套</b><small>每种语言一首完整歌词</small>
                </label>
                <label className={languageMode === "aligned" ? "selected" : ""}>
                  <input type="radio" name="language-mode" value="aligned" checked={languageMode === "aligned"} onChange={() => setLanguageMode("aligned")} disabled={languages.length === 1} />
                  <b>逐句多语言对照</b><small>一套歌词按语言逐行排列</small>
                </label>
              </div>
            </fieldset>

            <fieldset className="app-fieldset">
              <legend>歌曲创作应用 <span>提示词会自动适配</span></legend>
              <div className="app-options">
                {TARGET_APPS.map((item) => (
                  <label className={targetApp === item.value ? "selected" : ""} key={item.value}>
                    <input type="radio" name="target-app" value={item.value} checked={targetApp === item.value} onChange={() => setTargetApp(item.value)} />
                    <i aria-hidden="true">{item.mark}</i>
                    <span><b>{item.label}</b><small>{item.detail}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {targetApp === "generic" && <label className="full-field">应用名称（可选）<input value={customApp} onChange={(event) => setCustomApp(event.target.value)} placeholder="例如：其他 AI 音乐应用" /></label>}

            <div className="field-grid two">
              <label>歌词主题
                <select value={topic} onChange={(event) => setTopic(event.target.value)}>{TOPICS.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label>表达难度
                <select value={level} onChange={(event) => setLevel(event.target.value)}><option>A1 入门</option><option>A2 初级</option><option>B1 中级</option></select>
              </label>
            </div>
            {topic === "自定义主题" && <label className="full-field">自定义主题<input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="例如：第一次在巴塞罗那问路" /></label>}

            <fieldset className="vocabulary-fieldset">
              <legend>教材词汇使用比例 <span>其余内容由模型自由发挥</span></legend>
              <div className="vocabulary-options">
                {VOCABULARY_OPTIONS.map((item) => (
                  <label className={vocabularyRatio === item.value ? "selected" : ""} key={item.value}>
                    <input type="radio" name="vocabulary-ratio" value={item.value} checked={vocabularyRatio === item.value} onChange={() => setVocabularyRatio(item.value)} />
                    <span><b>{item.value}%</b><em>{item.label}</em></span>
                    <small>{item.detail}</small>
                  </label>
                ))}
              </div>
              <p className="ratio-note">比例按核心词汇、短语和句型估算，不计算冠词、介词等功能词。</p>
            </fieldset>

            <fieldset>
              <legend>编制风格</legend>
              <div className="style-grid">
                {SONG_STYLES.map((item) => (
                  <label className={`style-option ${style === item.value ? "selected" : ""}`} key={item.value}>
                    <input type="radio" name="style" value={item.value} checked={style === item.value} onChange={() => setStyle(item.value)} />
                    <i className={item.color} aria-hidden="true" />
                    <span><b>{item.value}</b><small>{item.detail}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field-grid two">
              <label>整体情绪<input value={mood} onChange={(event) => setMood(event.target.value)} /></label>
              <label>歌曲长度
                <select value={length} onChange={(event) => setLength(event.target.value)}>
                  {LENGTH_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label className="full-field">额外要求（可选）<textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="例如：副歌加入问答；重点练习 R 和 RR 的发音……" /></label>

            <button className="primary-button" type="button" onClick={generate} disabled={!stats.chars && !patterns.trim()}>
              生成歌词提示词 <span>→</span>
            </button>
            <p className="saved-options-note"><i aria-hidden="true">✓</i> 自动记住本机创作选项；教材文件和提取内容不会保存</p>
          </article>

          <article className={`panel output-panel ${generated ? "has-output" : ""}`} ref={outputRef}>
            <div className="panel-heading">
              <div><span className="step">04</span><h2>复制给大模型</h2></div>
              {generated && <button className={`copy-button ${copied ? "copied" : ""}`} type="button" onClick={copyPrompt}>{copied ? "已复制" : "复制全文"}</button>}
            </div>
            {generated ? <pre>{generated}</pre> : (
              <div className="prompt-placeholder">
                <span>Aa</span>
                <p>完成前三步后，提示词会出现在这里。</p>
                <small>可复制到 ChatGPT、Claude 等大模型生成歌词，再交给 Suno 作曲。</small>
              </div>
            )}
          </article>
        </aside>
      </section>

      <footer><span>LetraLab</span><p>从教材出发，让记忆有旋律。</p></footer>
    </main>
  );
}
