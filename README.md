# LetraLab

把西班牙语教材转换为歌词创作提示词的本地网页工具。

GitHub Pages：https://possbb.github.io/music/

备用在线版本：https://letralab-spanish-songs.possbb.chatgpt.site

## 功能

- 上传多份 DOCX、TXT 或 Markdown 教材
- 在浏览器中提取高价值关键词与可复用句型，可选择四档提取数量
- 选择西班牙语、中文或英文，支持分别生成多套或逐句多语言对照
- 选择歌词主题、语言难度、情绪、歌曲速度、长度和八种编制风格
- 适配 Suno、Udio、Mureka 及其他歌曲创作应用
- 设置教材词汇使用比例，并生成可复制给大模型的歌词任务书
- 要求大模型用独立 Markdown 区块输出 Style 和 Lyrics
- 同时生成一套可复制的网易云 LRC Markdown 歌词初稿
- 自动记住当前浏览器中的创作选项
- 教材内容不上传到服务器

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

构建与测试：

```bash
npm test
```

构建 GitHub Pages 静态版本：

```bash
npm run build:pages
```
