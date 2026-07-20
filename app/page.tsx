"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import * as mammoth from "mammoth";

type MaterialFile = {
  name: string;
  size: number;
  status: "done" | "error";
};

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

export function extractKeywords(text: string) {
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
    .slice(0, 18)
    .map(({ word }) => word);
}

export function extractPatterns(text: string) {
  const lines = text
    .split(/\r?\n|•|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ¿])/u)
    .map(normalizeLine)
    .flatMap((line) => line.split(/\s*\|\s*/).map(normalizeLine))
    .filter(Boolean);

  const ignored = /^(objetivo|para recordar|ejercicio|práctica|repaso|nota|grupo|número|español|english|中文|tema|uso|modelo|pregunta|respuesta)/i;
  const usefulVerb = /\b(me llamo|se llama|soy|eres|es|somos|tengo|tiene|trabajo|trabaja|vivo|vive|quiero|podemos|puedes|nos vemos|hasta luego)\b/i;
  const seen = new Set<string>();

  return lines
    .filter((line) => line.length >= 10 && line.length <= 125)
    .filter((line) => !/[\u3400-\u9fff]/u.test(line) && !ignored.test(line))
    .map((line) => line.replace(/_{3,}/g, "[信息]").replace(/\s*=\s*[^/]+(?:\/.*)?$/u, ""))
    .map((line) => ({
      line,
      key: line.toLocaleLowerCase("es").replace(/[^a-záéíóúüñ¿?]+/giu, " ").trim(),
      score: (line.includes("¿") ? 8 : 0) + (usefulVerb.test(line) ? 6 : 0) + (line.includes("[信息]") ? 2 : 0),
    }))
    .filter(({ key }) => key.length > 4 && !seen.has(key) && Boolean(seen.add(key)))
    .sort((a, b) => b.score - a.score || a.line.length - b.line.length)
    .slice(0, 10)
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
  keywords: string[];
  patterns: string;
  requirements: string;
}) {
  const topic = options.topic === "自定义主题" ? options.customTopic.trim() || "由教材内容自然发展" : options.topic;
  const patterns = options.patterns
    .split("\n")
    .map(normalizeLine)
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");

  return `你是一位擅长西班牙语教学歌曲的作词人。请根据以下教材内容，创作一首可直接用于 Suno 的西班牙语歌词。

【创作目标】
- 歌词主题：${topic}
- 编曲/歌词风格：${options.style}
- 情绪：${options.mood}
- 西语难度：${options.level}（优先使用短句、常用词和清晰语法）
- 歌曲长度：${options.length}
- 听众：正在学习西班牙语的中文母语初学者

【必须自然融入的关键词】
${options.keywords.length ? options.keywords.join("、") : "请从下方句型中自行提炼"}

【教材句型参考】
${patterns || "- 请围绕主题使用适合初学者的西班牙语完整句子"}

【写作要求】
1. 只输出西班牙语歌词，不要解释、翻译或添加创作说明。
2. 使用 [Intro]、[Verse 1]、[Pre-Chorus]、[Chorus]、[Verse 2]、[Bridge]、[Final Chorus] 标记结构；不需要的段落可省略。
3. 副歌要简单、朗朗上口，并重复 2—4 个核心句型帮助记忆。
4. 主歌要有连贯情境，不要把教材词汇机械罗列成清单。
5. 教材中的问句尽量配上自然回答；人称、阴阳性和动词变位必须正确。
6. 每行尽量控制在 4—10 个西语单词，适合演唱与清楚发音。
7. 可以押韵，但不能为了押韵使用超出 ${options.level} 太多的生僻词。
8. 不要写歌手姓名或模仿具体在世艺人的风格。
${options.requirements.trim() ? `9. 额外要求：${options.requirements.trim()}` : ""}

现在请直接写出完整歌词。`;
}

export default function Home() {
  const [files, setFiles] = useState<MaterialFile[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [manualText, setManualText] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [patterns, setPatterns] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [topic, setTopic] = useState("自我介绍");
  const [customTopic, setCustomTopic] = useState("");
  const [style, setStyle] = useState("清新流行");
  const [mood, setMood] = useState("温暖、轻快、有希望");
  const [level, setLevel] = useState("A1 入门");
  const [length, setLength] = useState("约 2 分钟（2 段主歌 + 重复副歌）");
  const [requirements, setRequirements] = useState("");
  const [generated, setGenerated] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const stats = useMemo(
    () => ({
      chars: (sourceText + manualText).trim().length,
      keywordCount: keywords.length,
      patternCount: patterns.split("\n").filter(Boolean).length,
    }),
    [sourceText, manualText, keywords, patterns],
  );

  function analyze(text: string) {
    const clean = text.trim();
    setKeywords(extractKeywords(clean));
    setPatterns(extractPatterns(clean).join("\n"));
    setGenerated("");
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

  function generate() {
    const prompt = buildPrompt({ topic, customTopic, style, mood, level, length, keywords, patterns, requirements });
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
          <p className="hero-description">上传课程笔记，提取真正值得记忆的关键词与句型，再生成一份可复制给大模型的歌词任务书。</p>
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

            <div className="result-block">
              <div className="block-title"><h3>核心关键词</h3><span>点击 × 可删除</span></div>
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
              <div className="block-title"><h3>可复用句型</h3><span>可直接编辑，每行一句</span></div>
              <textarea className="pattern-textarea" value={patterns} onChange={(event) => setPatterns(event.target.value)} placeholder="例如：¿Cómo te llamas? / Me llamo [名字]." />
            </div>
          </article>
        </div>

        <aside className="workspace-side">
          <article className="panel creative-panel">
            <div className="panel-heading"><div><span className="step">03</span><h2>设定创作方向</h2></div></div>

            <div className="field-grid two">
              <label>歌词主题
                <select value={topic} onChange={(event) => setTopic(event.target.value)}>{TOPICS.map((item) => <option key={item}>{item}</option>)}</select>
              </label>
              <label>语言难度
                <select value={level} onChange={(event) => setLevel(event.target.value)}><option>A1 入门</option><option>A2 初级</option><option>B1 中级</option></select>
              </label>
            </div>
            {topic === "自定义主题" && <label className="full-field">自定义主题<input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="例如：第一次在巴塞罗那问路" /></label>}

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
                <select value={length} onChange={(event) => setLength(event.target.value)}><option>约 1 分钟（短歌 + 循环副歌）</option><option>约 2 分钟（2 段主歌 + 重复副歌）</option><option>约 3 分钟（完整叙事结构）</option></select>
              </label>
            </div>
            <label className="full-field">额外要求（可选）<textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="例如：副歌加入问答；重点练习 R 和 RR 的发音……" /></label>

            <button className="primary-button" type="button" onClick={generate} disabled={!stats.chars && !patterns.trim()}>
              生成歌词提示词 <span>→</span>
            </button>
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
