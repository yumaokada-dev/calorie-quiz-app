"use client";
import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import Link from "next/link";

export default function AdminPage() {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [calories, setCalories] = useState("");
  const [trivia, setTrivia] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // AI自動生成ボタンの処理
  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setMessage("AIがメニューを考えています...🍳");
    
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // 取得したデータをフォームにセット
      setName(data.name);
      setAmount(data.amount);
      setCalories(data.calories);
      setTrivia(data.trivia);
      setImageUrl(data.image_url);
      
      setMessage("AI生成完了！内容を確認して保存してください。");
    } catch (error) {
      console.error(error);
      setMessage("AI生成に失敗しました。もう一度試してください。");
    } finally {
      setIsGenerating(false);
    }
  };

  // データベース保存処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !amount || !calories || !trivia) {
      alert("全ての項目を入力してください");
      return;
    }

    try {
      await addDoc(collection(db, "quizzes"), {
        name,
        amount,
        calories: Number(calories),
        trivia,
        // 画像がない場合は仮の画像を入れる
        image_url: imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
        createdAt: new Date(),
      });

      setMessage("保存しました！次の問題を作りましょう。");
      // フォームをクリア
      setName("");
      setAmount("");
      setCalories("");
      setTrivia("");
      setImageUrl("");
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-blue-600">問題作成ツール 📝</h1>

        {/* AI自動生成ボタン */}
        <button
          onClick={handleAutoGenerate}
          disabled={isGenerating}
          className={`w-full mb-6 py-3 rounded font-bold shadow-md transition flex justify-center items-center ${
            isGenerating 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
          }`}
        >
          {isGenerating ? (
            <span>思考中...🧠</span>
          ) : (
            <span>✨ AIにおまかせ生成</span>
          )}
        </button>

        <hr className="mb-6 border-gray-200" />

        {message && (
          <div className={`p-3 rounded mb-4 text-center text-sm font-bold ${
            message.includes("失敗") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700">料理名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded text-black"
              placeholder="例: カツ丼"
            />
          </div>

          {/* 画像プレビュー */}
          {imageUrl && (
            <div className="border p-2 rounded bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">画像のプレビュー:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="プレビュー" className="w-full h-32 object-cover rounded" />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700">画像URL</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full p-2 border rounded text-black text-xs"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">量</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 border rounded text-black"
              placeholder="例: 1杯"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">カロリー (kcal)</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full p-2 border rounded text-black"
              placeholder="例: 800"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">豆知識</label>
            <textarea
              value={trivia}
              onChange={(e) => setTrivia(e.target.value)}
              className="w-full p-2 border rounded h-24 text-black"
              placeholder="解説を入力..."
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 font-bold"
          >
            データベースに保存
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-500 underline">
            クイズ画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}