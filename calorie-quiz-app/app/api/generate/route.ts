import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST() {
  try {
    // APIキー
    const apiKey = "AIzaSyD_YTiNeJP5nOW02z7X5xX7rXkbXA6poUI";
    
    if (!apiKey) {
      return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // モデルは gemini-2.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      ランダムな料理や食べ物を1つ選んで、カロリークイズ用のデータを作成してください。
      以下のJSON形式のみを出力してください。Markdown記法や余計な解説は不要です。
      
      {
        "name": "料理名（日本語）",
        "amount": "量（例: 1人前、100g）",
        "calories": 数値（整数）,
        "trivia": "その料理に関する豆知識（日本語）",
        "image_query": "英語の料理名"
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

    // ★Bing画像検索のサムネイルを使用（ここが最新の修正点）
    data.image_url = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(data.name + " 美味しそうな写真")}&w=500&h=500&c=7`;

    // ★★★ここが消えていた原因です！★★★
    // 生成したデータをブラウザに返します
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("★詳細なエラー:", error);
    return NextResponse.json({ 
      error: `生成失敗: ${error.message || "不明なエラー"}` 
    }, { status: 500 });
  }
}