"use client";
import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";

type QuizItem = {
  id: string;
  name: string;
  amount: string;
  calories: number;
  trivia: string;
  image_url?: string;
};

const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function Home() {
  const [allQuizzes, setAllQuizzes] = useState<QuizItem[]>([]);
  const [quizData, setQuizData] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [showTrivia, setShowTrivia] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [gameMode, setGameMode] = useState<"choice" | "input" | null>(null);
  const [currentChoices, setCurrentChoices] = useState<number[]>([]);
  const [score, setScore] = useState(0);

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
        setAllQuizzes(items);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (gameMode && allQuizzes.length > 0) {
      const shuffled = shuffle(allQuizzes);
      setQuizData(shuffled.slice(0, 10));
      setCurrentIndex(0);
      setScore(0);
      setResult(null);
      setShowTrivia(false);
      
      window.history.pushState(null, "", window.location.href);
      const handlePopState = () => {
        setGameMode(null);
        setQuizData([]);
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [gameMode, allQuizzes]);

  useEffect(() => {
    if (quizData.length > 0 && gameMode === "choice" && quizData[currentIndex]) {
      generateChoices(quizData[currentIndex].calories);
    }
  }, [currentIndex, gameMode, quizData]);

  const generateChoices = (correct: number) => {
    const wrong1 = Math.round(correct * 0.8);
    const wrong2 = Math.round(correct * 1.2);
    const wrong3 = Math.round(correct * 1.5);
    const choices = shuffle([correct, wrong1, wrong2, wrong3]);
    setCurrentChoices(choices);
  };

  const currentQuiz = quizData[currentIndex];

  const handleChoiceAnswer = (choice: number) => {
    if (choice === currentQuiz.calories) {
      setResult(`✨ 大正解！ ✨ (${currentQuiz.calories}kcal)`);
      setScore((prev) => prev + 1);
    } else {
      setResult(`💦 残念... 正解は ${currentQuiz.calories}kcal`);
    }
    setShowTrivia(true);
  };

  const handleInputAnswer = () => {
    const guess = Number(userInput);
    if (!userInput) return;
    const diff = Math.abs(currentQuiz.calories - guess);

    if (diff <= 10) {
      setResult(`🏆 すごい！完全正解！ 🏆\n(正解: ${currentQuiz.calories}kcal)`);
      setScore((prev) => prev + 1);
    } else if (diff <= 50) {
      setResult(`🥈 惜しい！！\n正解は ${currentQuiz.calories}kcal でした`);
      setScore((prev) => prev + 1);
    } else if (diff <= 150) {
      setResult(`🥉 がんばろう！あとちょっと\n正解は ${currentQuiz.calories}kcal でした`);
    } else {
      setResult(`💦 残念...\n正解は ${currentQuiz.calories}kcal`);
    }
    setShowTrivia(true);
  };

  const handleNext = useCallback(() => {
    if (currentIndex < quizData.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput("");
      setResult(null);
      setShowTrivia(false);
    } else {
      setResult("FINISHED");
      setShowTrivia(false);
    }
  }, [currentIndex, quizData.length]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setUserInput("");
      setResult(null);
      setShowTrivia(false);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputAnswer();
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (gameMode === "input" && !showTrivia) {
          return;
        }
        e.preventDefault();
        handleNext();
      }
    };

    if (gameMode) {
      window.addEventListener("keydown", handleGlobalKeyDown);
    }
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [gameMode, showTrivia, handleNext]);

  const getRankData = (score: number) => {
    if (score === 10) return { title: "カロリー神 🏆", msg: "もはや人間業ではありません。\nあなたの眼力はAIを超えました。", color: "text-yellow-500" };
    if (score >= 8) return { title: "カロリー博士 🎓", msg: "素晴らしい！\nほぼ完璧なカロリー感覚を持っています。", color: "text-purple-600" };
    if (score >= 5) return { title: "健康オタク 🥗", msg: "なかなかの好成績！\n食事管理はバッチリですね。", color: "text-green-600" };
    if (score >= 2) return { title: "一般人 🙂", msg: "まあまあの結果です。\nもう少し成分表示を見てみましょう！", color: "text-blue-500" };
    return { title: "ジャンクフード愛好家 🍔", msg: "カロリーなんて気にしない！\nその生き様、嫌いじゃないです。", color: "text-red-500" };
  };

  const getShareUrl = (text: string) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=カロリーQ`;
  };

  const getLineShareUrl = (text: string) => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const lineText = `${text}\n${url}`; 
    return `https://line.me/R/share?text=${encodeURIComponent(lineText)}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-orange-50 flex justify-center items-center">
      <div className="animate-spin text-4xl">🥦</div>
    </div>
  );

  if (allQuizzes.length === 0) return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-orange-50">
      <p className="font-bold text-gray-600">まだ問題がありません🙇‍♂️</p>
      <Link href="/admin" className="text-blue-500 underline">管理者ページで作る</Link>
    </div>
  );

  // --- 1. モード選択画面 ---
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-center space-y-2 mb-10">
          <div className="text-7xl mb-4 animate-bounce">🥦</div>
          {/* ★タイトル変更 */}
          <h1 className="text-5xl font-black tracking-widest drop-shadow-md">カロリーQ</h1>
          <p className="text-green-100 font-bold opacity-90">全10問！あなたの実力は？</p>
        </div>
        
        <div className="space-y-4 w-full max-w-sm">
          <button onClick={() => setGameMode("choice")} className="w-full bg-white text-green-600 py-5 rounded-2xl text-xl font-bold shadow-lg hover:scale-105 transition transform flex items-center justify-center gap-3">
            <span className="text-2xl">🅰️</span> 4択で遊ぶ
          </button>
          <button onClick={() => setGameMode("input")} className="w-full bg-green-800 bg-opacity-40 border-2 border-white text-white py-5 rounded-2xl text-xl font-bold shadow-lg hover:bg-opacity-50 transition transform flex items-center justify-center gap-3 backdrop-blur-sm">
            <span className="text-2xl">🔢</span> 数字を入力して挑む
          </button>
        </div>
        <div className="mt-12"><Link href="/admin" className="text-white/60 text-sm hover:text-white underline decoration-dotted">管理者ページへ</Link></div>
      </div>
    );
  }

  if (!currentQuiz && result !== "FINISHED") {
    return (
      <div className="min-h-screen bg-green-50 flex justify-center items-center">
        <div className="animate-spin text-4xl">🥦</div>
      </div>
    );
  }

  // --- 2. クイズ画面 ---
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 px-4 overflow-hidden">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col relative">
        <div className="bg-slate-800 text-white p-4 flex justify-center items-center z-10 relative">
          <span className="font-bold text-sm tracking-widest">QUESTION {currentIndex + 1} / {quizData.length}</span>
        </div>

        {result !== "FINISHED" ? (
          <div key={currentIndex} className="p-6 flex-1 flex flex-col animate-slide-in">
            <div className="mb-6 text-center">
              <div className="relative w-full aspect-video mb-4 rounded-xl overflow-hidden bg-gray-100 shadow-inner border-2 border-gray-100">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={currentQuiz.image_url || "https://placehold.jp/150x150.png?text=NoImage"} alt={currentQuiz.name} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-1">{currentQuiz.name}</h2>
              <p className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold text-sm">{currentQuiz.amount}</p>
            </div>

            {!showTrivia ? (
              <div className="space-y-4">
                {gameMode === "choice" && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentChoices.map((choice, i) => (
                      <button key={i} onClick={() => handleChoiceAnswer(choice)} className="bg-white text-slate-700 font-bold py-4 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 hover:text-green-600 transition shadow-sm active:scale-95">
                        {choice} <span className="text-xs">kcal</span>
                      </button>
                    ))}
                  </div>
                )}
                {gameMode === "input" && (
                  <div className="flex flex-col gap-3">
                    <input 
                      type="number" 
                      placeholder="0" 
                      className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-center text-3xl font-bold text-gray-800 focus:outline-none focus:border-green-500" 
                      value={userInput} 
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={handleKeyDownInput} 
                    />
                    <button onClick={handleInputAnswer} className="w-full bg-green-500 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-600 transition active:scale-95">決定！</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in-up">
                <div className={`p-5 rounded-xl border-l-8 text-center ${
                  result?.includes("完全正解") || result?.includes("大正解") ? "bg-green-50 border-green-500 text-green-700" : 
                  result?.includes("惜しい") ? "bg-cyan-50 border-cyan-500 text-cyan-700" : 
                  result?.includes("がんばろう") ? "bg-yellow-50 border-yellow-500 text-yellow-700" :
                  "bg-red-50 border-red-500 text-red-700"
                }`}>
                  <p className="font-black text-xl whitespace-pre-wrap">{result}</p>
                </div>
                
                <div className="text-left bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-500 text-xs mb-2 tracking-wider">MAME-CHISHIKI</p>
                  <p className="text-slate-700 text-sm leading-relaxed font-medium">{currentQuiz.trivia}</p>
                </div>
              </div>
            )}
            
            <div className="mt-auto pt-6 space-y-3">
              <div className="flex gap-3">
                <button onClick={handlePrev} disabled={currentIndex === 0} className={`flex-1 py-3 rounded-xl font-bold transition ${currentIndex === 0 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}>← 前へ</button>
                <button onClick={handleNext} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg active:scale-95">{showTrivia ? (currentIndex === quizData.length - 1 ? "結果を見る！" : "次の問題へ →") : "スキップ →"}</button>
              </div>
              <button onClick={() => setGameMode(null)} className="w-full text-xs text-slate-400 py-2 hover:text-slate-600 underline">
                タイトルへ
              </button>
            </div>
          </div>
        ) : (
          // --- 3. 結果発表画面 ---
          <div className="py-10 px-6 text-center bg-gradient-to-b from-white to-green-50 h-full flex flex-col justify-center animate-fade-in-up">
            <div className="mb-8">
              <p className="text-gray-500 font-bold mb-2">SCORE</p>
              <div className="text-6xl font-black text-slate-800">{score}<span className="text-2xl text-gray-400">/10</span></div>
            </div>
            {(() => {
              const rank = getRankData(score);
              return (
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-8 border-2 border-gray-100">
                  <h2 className={`text-2xl font-black mb-3 ${rank.color}`}>{rank.title}</h2>
                  <p className="text-gray-600 font-medium whitespace-pre-wrap leading-relaxed">{rank.msg}</p>
                </div>
              );
            })()}
            
            <div className="space-y-3 mb-8">
              <a href={getShareUrl(`「カロリーQ」で【${getRankData(score).title}】の称号を獲得！(正解数: ${score}/10)\nあなたは食べ物のカロリー、どれくらい知ってる？`)} target="_blank" rel="noopener noreferrer" className="block w-full bg-black text-white py-4 rounded-full font-bold shadow-lg hover:bg-gray-800 transition transform hover:-translate-y-1 text-center flex items-center justify-center gap-2">
                <span className="text-xl">𝕏</span> 結果をポストする
              </a>

              <a href={getLineShareUrl(`「カロリーQ」で【${getRankData(score).title}】の称号を獲得！(正解数: ${score}/10)\nあなたは食べ物のカロリー、どれくらい知ってる？`)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#06C755] text-white py-4 rounded-full font-bold shadow-lg hover:brightness-110 transition transform hover:-translate-y-1 text-center flex items-center justify-center gap-2">
                <span className="text-xl font-black bg-white text-[#06C755] rounded-full w-6 h-6 flex items-center justify-center text-xs">L</span> LINEで送る
              </a>
            </div>

            <button onClick={() => setGameMode(null)} className="w-full bg-white text-slate-600 border-2 border-slate-200 py-3 rounded-full font-bold hover:bg-slate-50 transition">タイトルに戻る</button>
          </div>
        )}
      </div>
    </div>
  );
}