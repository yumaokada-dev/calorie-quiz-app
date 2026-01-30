"use client";
import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";

// 型定義などは変更なし
type QuizItem = {
  id: string;
  name: string;
  amount: string;
  calories: number;
  trivia: string;
  image_url?: string;
};

const shuffleArray = (array: number[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function Home() {
  const [quizData, setQuizData] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [showTrivia, setShowTrivia] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameMode, setGameMode] = useState<"choice" | "input" | null>(null);
  const [currentChoices, setCurrentChoices] = useState<number[]>([]);

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
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (quizData.length > 0 && gameMode === "choice" && quizData[currentIndex]) {
      generateChoices(quizData[currentIndex].calories);
    }
  }, [currentIndex, gameMode, quizData]);

  const generateChoices = (correct: number) => {
    const wrong1 = Math.round(correct * 0.8);
    const wrong2 = Math.round(correct * 1.2);
    const wrong3 = Math.round(correct * 1.5);
    const choices = shuffleArray([correct, wrong1, wrong2, wrong3]);
    setCurrentChoices(choices);
  };

  const currentQuiz = quizData[currentIndex];

  const handleChoiceAnswer = (choice: number) => {
    if (choice === currentQuiz.calories) {
      setResult(`✨ 大正解！ ✨ (${currentQuiz.calories}kcal)`);
    } else {
      setResult(`💦 残念... 正解は ${currentQuiz.calories}kcal`);
    }
    setShowTrivia(true);
  };

  const handleInputAnswer = () => {
    const guess = Number(userInput);
    if (!userInput) return;
    const diff = Math.abs(currentQuiz.calories - guess);
    if (diff <= 50) {
      setResult(`✨ お見事！正解！ ✨\n(正解: ${currentQuiz.calories}kcal)`);
    } else {
      setResult(`💦 残念... 正解は ${currentQuiz.calories}kcal`);
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
      setResult("🎉 全問クリア！ 🎉");
      setShowTrivia(false);
    }
  };

  const getShareUrl = (text: string) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=カロリークイズ`;
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex justify-center items-center">
      <div className="animate-spin text-4xl">🍔</div>
    </div>
  );

  if (quizData.length === 0) return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-orange-50">
      <p className="font-bold text-gray-600">まだ問題がありません🙇‍♂️</p>
      <Link href="/admin" className="text-blue-500 underline">管理者ページで作る</Link>
    </div>
  );

  // ★デザイン変更：モード選択画面
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 to-red-500 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-center space-y-2 mb-10">
          <div className="text-7xl mb-4 animate-bounce">🍔</div>
          <h1 className="text-4xl font-black tracking-widest drop-shadow-md">直感！<br/>カロリークイズ</h1>
          <p className="text-orange-100 font-bold opacity-90">あなたの「目利き」は本物か？</p>
        </div>
        
        <div className="space-y-4 w-full max-w-sm">
          <button 
            onClick={() => setGameMode("choice")}
            className="w-full bg-white text-orange-600 py-5 rounded-2xl text-xl font-bold shadow-lg hover:scale-105 transition transform flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🅰️</span> 4択で遊ぶ
          </button>
          <button 
            onClick={() => setGameMode("input")}
            className="w-full bg-orange-700 bg-opacity-40 border-2 border-white text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-opacity-50 transition transform flex items-center justify-center gap-3 backdrop-blur-sm"
          >
            <span className="text-2xl">🔢</span> 数字を入力して挑む
          </button>
        </div>
        
        <div className="mt-12">
          <Link href="/admin" className="text-white/60 text-sm hover:text-white underline decoration-dotted">
            管理者ページへ
          </Link>
        </div>
      </div>
    );
  }

  // ★デザイン変更：クイズ画面
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* ヘッダー */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
          <span className="font-bold text-sm tracking-widest">QUESTION {currentIndex + 1} / {quizData.length}</span>
          <button onClick={() => setGameMode(null)} className="text-xs bg-slate-700 px-3 py-1 rounded-full hover:bg-slate-600">
            やめる
          </button>
        </div>

        {currentIndex < quizData.length && result !== "🎉 全問クリア！ 🎉" ? (
          <div className="p-6">
            <div className="mb-6 text-center">
              <div className="relative w-full aspect-video mb-4 rounded-xl overflow-hidden bg-gray-100 shadow-inner border-2 border-gray-100">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={currentQuiz.image_url || "https://placehold.jp/150x150.png?text=NoImage"} alt={currentQuiz.name} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-1">{currentQuiz.name}</h2>
              <p className="inline-block bg-orange-100 text-orange-600 px-3 py-1 rounded-full font-bold text-sm">{currentQuiz.amount}</p>
            </div>

            {!showTrivia ? (
              <div className="space-y-4">
                {gameMode === "choice" && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentChoices.map((choice, i) => (
                      <button key={i} onClick={() => handleChoiceAnswer(choice)} className="bg-white text-slate-700 font-bold py-4 rounded-xl border-2 border-slate-200 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-600 transition shadow-sm active:scale-95">
                        {choice} <span className="text-xs">kcal</span>
                      </button>
                    ))}
                  </div>
                )}
                {gameMode === "input" && (
                  <div className="flex flex-col gap-3">
                    <input type="number" placeholder="0" className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-center text-3xl font-bold text-gray-800 focus:outline-none focus:border-orange-500" value={userInput} onChange={(e) => setUserInput(e.target.value)} />
                    <button onClick={handleInputAnswer} className="w-full bg-orange-500 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-orange-600 transition active:scale-95">
                      決定！
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in-up">
                <div className={`p-5 rounded-xl border-l-8 text-center ${result?.includes("正解") ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"}`}>
                  <p className="font-black text-xl whitespace-pre-wrap">{result}</p>
                </div>
                
                <a 
                  href={getShareUrl(`【${currentQuiz.name}】は ${currentQuiz.calories}kcalでした！\n${result?.includes("正解") ? "🎯 見事正解！" : "😱 知らなかった..."}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-gray-800 transition text-center shadow-md flex items-center justify-center gap-2"
                >
                  <span className="text-lg">𝕏</span> 結果をシェア
                </a>

                <div className="text-left bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-500 text-xs mb-2 tracking-wider">MAME-CHISHIKI</p>
                  <p className="text-slate-700 text-sm leading-relaxed font-medium">{currentQuiz.trivia}</p>
                </div>

                <button onClick={handleNext} className="w-full bg-blue-600 text-white py-4 rounded-xl hover:bg-blue-700 font-bold transition shadow-lg active:scale-95">
                  次の問題へ →
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-16 px-6 text-center bg-gradient-to-b from-white to-yellow-50 h-full">
            <div className="text-7xl mb-6 animate-bounce">🏆</div>
            <h2 className="text-3xl font-black mb-4 text-slate-800">全問クリア！</h2>
            <p className="text-slate-500 mb-10 font-bold">あなたのカロリー感覚は完璧です。</p>
            
            <a 
              href={getShareUrl(`「直感！カロリークイズ」を全問クリアしました！🏆\nあなたは食べ物のカロリー、どれくらい知ってる？`)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-black text-white py-4 rounded-full font-bold shadow-lg hover:bg-gray-800 transition transform hover:-translate-y-1 text-center mb-4"
            >
              𝕏 で自慢する
            </a>

            <button onClick={() => window.location.reload()} className="text-slate-400 font-bold underline mt-4 hover:text-slate-600">
              タイトルに戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}