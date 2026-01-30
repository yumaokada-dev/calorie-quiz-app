"use client";
import { useState } from "react";
import { db } from "../firebase"; // 1つ上の階層にあるfirebase.tsを読み込む
import { collection, addDoc } from "firebase/firestore";
import Link from "next/link";

export default function AdminPage() {
  // 入力フォームの状態管理
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [calories, setCalories] = useState("");
  const [trivia, setTrivia] = useState("");
  const [message, setMessage] = useState(""); // 保存完了メッセージ用

  // 保存ボタンを押したときの処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // 画面のリロードを防ぐ

    if (!name || !amount || !calories || !trivia) {
      alert("全ての項目を入力してください");
      return;
    }

    try {
      // Firestoreの "quizzes" コレクションにデータを追加
      await addDoc(collection(db, "quizzes"), {
        name: name,
        amount: amount,
        calories: Number(calories), // 数字として保存
        trivia: trivia,
        createdAt: new Date(), // 作成日時も入れておく（並び替え用）
      });

      setMessage("保存しました！");
      // フォームを空にする
      setName("");
      setAmount("");
      setCalories("");
      setTrivia("");
    } catch (error) {
      console.error("エラー:", error);
      alert("保存に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 text-blue-600">問題作成ツール 📝</h1>

        {message && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4 text-center">
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
              placeholder="例: チーズバーガー"
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">量（サイズ）</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="例: 1個、Mサイズ"
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">カロリー (kcal)</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="例: 350"
              className="w-full p-2 border rounded text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">豆知識・解説</label>
            <textarea
              value={trivia}
              onChange={(e) => setTrivia(e.target.value)}
              placeholder="例: チーズにはカルシウムが含まれています..."
              className="w-full p-2 border rounded h-24 text-black"
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