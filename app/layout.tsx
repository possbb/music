import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "LetraLab｜西班牙语教材歌词提示词生成器",
    description: "上传西班牙语教材，提取关键词与句型，生成适配 Suno、Udio、Mureka 等歌曲应用的多语言歌词提示词。",
    openGraph: {
      title: "LetraLab｜把课堂句型，变成会唱的西语",
      description: "从教材中提取关键词与句型，生成单语言、多套语言或逐句对照的教学歌曲提示词。",
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "LetraLab 西班牙语教材歌词提示词生成器" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LetraLab｜把课堂句型，变成会唱的西语",
      description: "从教材中提取关键词与句型，生成单语言、多套语言或逐句对照的教学歌曲提示词。",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
