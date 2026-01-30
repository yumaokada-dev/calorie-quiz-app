"use client";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore"; // 必要な機能を追加
import Link from "next/link";

// データの型定義
type QuizItem = {
  id: string;
  name: string;
  calories: number;
  image_url?: string;
};

export default function AdminPage() {
  // 入力フォームの状態
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [calories, setCalories] = useState("");
  const [trivia, setTrivia] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // ★一覧表示用の状態
  const [quizList, setQuizList] = useState<QuizItem[]>([]);

  // ★画面が開いた時に、登録済みのクイズを取得する
  useEffect(() => {
    fetchQuizzes();
  }, []);

  // クイズ一覧をデータベースから取得する関数
  const fetchQuizzes = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "quizzes"));
      const list: QuizItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name,
          calories: data.calories,
          image_url: data.image_url,
        });
      });
      // 作成日順などで並び替えたい場合はここでsortする（今回は簡易的にそのまま）
      setQuizList(list);
    } catch (error) {
      console.error("一覧の取得に失敗:", error);
    }
  };

  // ★削除ボタンを押したときの処理
  const handleDelete = async (id: string) => {
    if (!confirm("本当に削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "quizzes", id)); // データベースから削除
      setMessage("削除しました🗑️");
      fetchQuizzes(); // 一覧を再読み込みして画面を更新
    } catch (error) {
      console.error("削除エラー:", error);
      alert("削除に失敗しました");
    }
  };

  // AI自動生成ボタン
  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setMessage("AIがメニューを考えています...🍳");
    
    try {
      const res = await fetch("/api/generate", { method: "POST" });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

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

  // 保存ボタン
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
        image_url: imageUrl || "https://placehold.jp/150x150.png?text=NoImage",
        createdAt: new Date(),
      });

      setMessage("保存しました！リストに追加されました✨");
      // フォームをクリア
      setName("");
      setAmount("");
      setCalories("");
      setTrivia("");
      setImageUrl("");
      
      // ★保存したら一覧も更新する
      fetchQuizzes();
      
    } catch (error) {
      console.error("保存エラー:", error);
      alert("保存に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full mb-10">
        <h1 className="text-2xl font-bold mb-6 text-blue-600">問題作成ツール 📝</h1>

        <button
          onClick={handleAutoGenerate}
          disabled={isGenerating}
          className={`w-full mb-6 py-3 rounded font-bold shadow-md transition flex justify-center items-center ${
            isGenerating 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
          }`}
        >
          {isGenerating ? <span>思考中...🧠</span> : <span>✨ AIにおまかせ生成</span>}
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
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded text-black" placeholder="例: カツ丼" />
          </div>

          {imageUrl && (
            <div className="border p-2 rounded bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">画像のプレビュー:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="プレビュー" className="w-full h-32 object-cover rounded" />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700">画像URL</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full p-2 border rounded text-black text-xs" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">量</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2 border rounded text-black" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">カロリー (kcal)</label>
            <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} className="w-full p-2 border rounded text-black" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">豆知識</label>
            <textarea value={trivia} onChange={(e) => setTrivia(e.target.value)} className="w-full p-2 border rounded h-24 text-black" />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700 font-bold">データベースに保存</button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-500 underline">クイズ画面に戻る</Link>
        </div>
      </div>

      {/* ★ここから下：登録済みリスト表示エリア */}
      <div className="max-w-4xl w-full">
        <h2 className="text-xl font-bold mb-4 text-gray-700 border-l-4 border-blue-500 pl-3">
          登録済みのクイズ一覧 ({quizList.length}問)
        </h2>
        
        {quizList.length === 0 ? (
          <p className="text-gray-500 text-center">まだ登録された問題はありません。</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quizList.map((quiz) => (
              <div key={quiz.id} className="bg-white p-4 rounded-lg shadow flex flex-col">
                <div className="relative h-40 mb-3 bg-gray-100 rounded overflow-hidden">
                  {quiz.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={quiz.image_url} alt={quiz.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">🍽️</div>
                  )}
                </div>
                
                <h3 className="font-bold text-lg mb-1 truncate">{quiz.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{quiz.calories} kcal</p>
                
                <button 
                  onClick={() => handleDelete(quiz.id)}
                  className="mt-auto bg-red-100 text-red-600 py-2 rounded hover:bg-red-200 transition text-sm font-bold flex items-center justify-center gap-2"
                >
                  🗑️ 削除する
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}