import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST() {
  try {
    // APIキー（Google AI Studioで取得した新しいキー）
    const apiKey = "AIzaSyD_YTiNeJP5nOW02z7X5xX7rXkbXA6poUI";
    
    if (!apiKey) {
      return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 最新モデル gemini-2.5-flash を使用
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      ランダムな料理や食べ物を1つ選んで、カロリークイズ用のデータを作成してください。
      以下のJSON形式のみを出力してください。Markdown記法や余計な解説は不要です。
      
      {
        "name": "料理名（日本語）",
        "amount": "量（例: 1人前、100g）",
        "calories": 数値（整数）,
        "trivia": "その料理に関する豆知識（日本語）",
        "image_query": "英語の料理名（例: sushi, hamburger）"
      }
    `;

    console.log("AIにリクエスト送信中... (Model: gemini-2.5-flash)");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("AI成功:", text);

    // JSONを抽出
    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonString);

   // ★ここを修正！
    // Lorem Flickrを使って、Flickrから「英語の料理名」に一致する写真を探して表示します
    // 600x400 は画像のサイズです
    data.image_url = `https://loremflickr.com/600/400/${encodeURIComponent(data.image_query)}`;
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("★詳細なエラー:", error);
    return NextResponse.json({ 
      error: `生成失敗: ${error.message || "不明なエラー"}` 
    }, { status: 500 });
  }
}