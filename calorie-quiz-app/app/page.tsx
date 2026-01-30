"use client";
import { useState, useEffect } from "react";
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

// 配列をランダムにシャッフルする関数
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

  // ★新しい機能：ゲームモードと選択肢
  const [gameMode, setGameMode] = useState<"choice" | "input" | null>(null); // nullならモード選択画面
  const [currentChoices, setCurrentChoices] = useState<number[]>([]); // 現在の4択

  // データを取得
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
        console.error("データの取得に失敗:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ★問題が変わったときに「4択」を作る
  useEffect(() => {
    if (quizData.length > 0 && gameMode === "choice") {
      generateChoices(quizData[currentIndex].calories);
    }
  }, [currentIndex, gameMode, quizData]);

  // ★ハズレの選択肢を自動で作る関数
  const generateChoices = (correct: number) => {
    // 正解 ± 20% 〜 50% くらいのズレた数字を作る
    const wrong1 = Math.round(correct * 0.8); // ちょっと少ない
    const wrong2 = Math.round(correct * 1.2); // ちょっと多い
    const wrong3 = Math.round(correct * 1.5); // すごく多い
    // シャッフルしてセット
    const choices = shuffleArray([correct, wrong1, wrong2, wrong3]);
    setCurrentChoices(choices);
  };

  const currentQuiz = quizData[currentIndex];

  // ★4択ボタンを押したときの処理
  const handleChoiceAnswer = (choice: number) => {
    if (choice === currentQuiz.calories) {
      setResult(`大正解！🎉 (${currentQuiz.calories}kcal)`);
    } else {
      setResult(`残念... 正解は ${currentQuiz.calories}kcal でした。`);
    }
    setShowTrivia(true);
  };

  // ★数字入力で回答したときの処理
  const handleInputAnswer = () => {
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

  // 読み込み中画面
  if (loading) return <div className="min-h-screen flex justify-center items-center">読み込み中...</div>;
  if (quizData.length === 0) return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4">
      <p>クイズデータがありません。</p>
      <Link href="/admin" className="text-blue-500 underline">問題を作る</Link>
    </div>
  );

  // ★ここから画面表示

  // 1. まだモードを選んでいない場合 → モード選択画面を表示
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-orange-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-xl shadow-xl max-w-md w-full text-center space-y-8">
          <h1 className="text-4xl font-extrabold text-orange-500 tracking-wider">カロリー<br/>High & Low</h1>
          <p className="text-gray-600">遊び方を選んでください</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => setGameMode("choice")}
              className="w-full bg-gradient-to-r from-blue-400 to-blue-600 text-white py-4 rounded-xl text-xl font-bold shadow-lg hover:scale-105 transition transform"
            >
              🅰️ 4択クイズ
            </button>
            <button 
              onClick={() => setGameMode("input")}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-600 text-white py-4 rounded-xl text-xl font-bold shadow-lg hover:scale-105 transition transform"
            >
              🔢 数字入力チャレンジ
            </button>
          </div>
          
          <div className="mt-8 pt-4 border-t">
            <Link href="/admin" className="text-gray-400 text-sm hover:text-gray-600">管理者ページへ</Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. クイズ本編画面
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        
        {/* ヘッダー部分 */}
        <div className="flex justify-between items-center mb-4">
          <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">
            第 {currentIndex + 1} 問
          </span>
          <button onClick={() => setGameMode(null)} className="text-xs text-gray-400 underline">
            モード変更
          </button>
        </div>

        {currentIndex < quizData.length && result !== "全ての問題が終了しました！お疲れ様でした！" ? (
          <>
            <div className="mb-6">
              <div className="relative w-full h-56 mb-4 rounded-lg overflow-hidden bg-gray-100 shadow-inner">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img 
                   src={currentQuiz.image_url || "https://placehold.jp/150x150.png?text=NoImage"} 
                   alt={currentQuiz.name} 
                   className="w-full h-full object-cover" 
                 />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">{currentQuiz.name}</h2>
              <p className="text-orange-500 font-bold">{currentQuiz.amount}</p>
            </div>

            {/* まだ回答していない時 */}
            {!showTrivia ? (
              <div className="space-y-4">
                
                {/* ★4択モードの場合 */}
                {gameMode === "choice" && (
                  <div className="grid grid-cols-2 gap-3">
                    {currentChoices.map((choice, i) => (
                      <button
                        key={i}
                        onClick={() => handleChoiceAnswer(choice)}
                        className="bg-blue-50 text-blue-600 font-bold py-4 rounded-lg border-2 border-blue-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition shadow-sm"
                      >
                        {choice} kcal
                      </button>
                    ))}
                  </div>
                )}

                {/* ★数字入力モードの場合 */}
                {gameMode === "input" && (
                  <>
                    <input
                      type="number"
                      placeholder="何kcalだと思う？"
                      className="w-full p-4 border-2 border-gray-200 rounded-lg text-center text-xl font-bold text-gray-800 focus:outline-none focus:border-orange-500"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                    />
                    <button onClick={handleInputAnswer} className="w-full bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 font-bold transition shadow-md">
                      回答する！
                    </button>
                  </>
                )}
              </div>
            ) : (
              // 回答後の結果画面
              <div className="space-y-4 animate-fade-in-up">
                <div className={`p-4 rounded-lg border-l-4 ${result?.includes("正解") ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700"}`}>
                  <p className="font-bold text-lg">{result}</p>
                </div>
                
                <div className="text-left bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-700 mb-2 border-b pb-1">💡 豆知識</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{currentQuiz.trivia}</p>
                </div>

                <button onClick={handleNext} className="w-full bg-gray-800 text-white py-3 rounded-lg hover:bg-black font-bold transition shadow-lg">
                  次の問題へ →
                </button>
              </div>
            )}
          </>
        ) : (
          // 全問終了画面
          <div className="py-10">
            <div className="text-6xl mb-6 animate-bounce">🎊</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-800">全問クリア！</h2>
            <p className="text-gray-500 mb-8">お疲れ様でした！</p>
            <button onClick={() => window.location.reload()} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
              タイトルに戻る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}