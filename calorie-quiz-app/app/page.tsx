"use client";
import { useState, useEffect } from "react";
// ↓ トップページからは「同じ場所」にあるので "./"
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link"; // 管理画面へのリンクも追加しておきます

type QuizItem = {
  id: string;
  name: string;
  amount: string;
  calories: number;
  trivia: string;
  image_url?: string; // 画像URLも追加
};

export default function Home() {
  const [quizData, setQuizData] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [showTrivia, setShowTrivia] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "quizzes"));
        const items: QuizItem[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            name: data.name,
            amount: data.amount,
            calories: data.calories,
            trivia: data.trivia,
            image_url: data.image_url,
          });
        });
        setQuizData(items);
      } catch (error) {
        console.error("データの取得に失敗しました:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const currentQuiz = quizData[currentIndex];

  const handleAnswer = () => {
    const guess = Number(userInput);
    if (!userInput) return;
    const diff = Math.abs(currentQuiz.calories - guess);
    if (diff <= 50) {
      setResult(`すごい！正解です！（正解: ${currentQuiz.calories}kcal）`);
    } else {
      setResult(`惜しい... 正解は ${currentQuiz.calories}kcal でした。`);
    }
    setShowTrivia(true);
  };

  const handleNext = () => {
    if (currentIndex < quizData.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserInput("");
      setResult(null);
      setShowTrivia(false);
    } else {
      setResult("全ての問題が終了しました！お疲れ様でした！");
      setShowTrivia(false);
    }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center">読み込み中...</div>;
  if (quizData.length === 0) return <div className="min-h-screen flex justify-center items-center">クイズデータがありません。</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-6 text-orange-500">カロリー当てクイズ</h1>
        
        {currentIndex < quizData.length && result !== "全ての問題が終了しました！お疲れ様でした！" ? (
          <>
            <div className="mb-6">
              {/* 画像があれば表示、なければアイコン */}
              {currentQuiz.image_url && currentQuiz.image_url.startsWith("http") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentQuiz.image_url} alt={currentQuiz.name} className="w-full h-48 object-cover rounded mb-4" />
              ) : (
                <div className="text-6xl mb-2">🍽️</div>
              )}
              <h2 className="text-xl font-bold">{currentQuiz.name}</h2>
              <p className="text-gray-600">量：{currentQuiz.amount}</p>
            </div>

            {!showTrivia ? (
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="何kcalだと思う？"
                  className="w-full p-3 border border-gray-300 rounded text-center text-lg text-black"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                />
                <button onClick={handleAnswer} className="w-full bg-orange-500 text-white py-3 rounded hover:bg-orange-600 font-bold transition">回答する！</button>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-orange-50 rounded"><p className="font-bold text-lg text-black">{result}</p></div>
                <div className="text-left text-sm bg-gray-50 p-3 rounded border border-gray-200">
                  <p className="font-bold text-gray-700">💡 豆知識</p>
                  <p className="text-gray-600">{currentQuiz.trivia}</p>
                </div>
                <button onClick={handleNext} className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 font-bold transition">次の問題へ</button>
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-xl font-bold mb-4 text-black">全問終了！</p>
            <button onClick={() => window.location.reload()} className="bg-gray-800 text-white px-6 py-2 rounded mb-4">もう一度遊ぶ</button>
            <br />
            <Link href="/admin" className="text-blue-500 underline text-sm">管理者ページへ</Link>
          </div>
        )}
      </div>
    </div>
  );
}