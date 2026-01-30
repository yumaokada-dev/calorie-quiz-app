import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    // ★ここを変更！コードに直接書くのではなく、設定ファイルから読み込むようにします
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: "APIキーが設定されていません" }, { status: 500 });
    }

    // フロントエンドから送られてきた「料理名」を受け取る
    let keyword = "";
    try {
      const body = await request.json();
      keyword = body.keyword || "";
    } catch (e) {
      // ボディがない場合は無視
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 命令文（プロンプト）の作成
    let promptText = "";
    if (keyword) {
      promptText = `
        料理「${keyword}」について、カロリークイズ用のデータを作成してください。
        （もし${keyword}が料理名でない場合は、近い料理を推測するか、ランダムな料理にしてください）
      `;
    } else {
      promptText = `
        ランダムな料理や食べ物を1つ選んで、カロリークイズ用のデータを作成してください。
      `;
    }

    const prompt = `
      ${promptText}
      以下のJSON形式のみを出力してください。Markdown記法や余計な解説は不要です。
      
      {
        "name": "料理名（日本語）",
        "amount": "量（例: 1人前、100g）",
        "calories": 数値（整数）,
        "trivia": "その料理に関する豆知識（日本語）"
      }
    `;

    console.log(`AIリクエスト: ${keyword ? keyword : "ランダム生成"}`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log("AI成功:", text);

    const jsonString = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(jsonString);

    // 画像生成（Bing検索）
    data.image_url = `https://tse2.mm.bing.net/th?q=${encodeURIComponent(data.name + " 美味しそうな写真")}&w=500&h=500&c=7`;

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("★詳細なエラー:", error);
    return NextResponse.json({ 
      error: `生成失敗: ${error.message || "不明なエラー"}` 
    }, { status: 500 });
  }
}