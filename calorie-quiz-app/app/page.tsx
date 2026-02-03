"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase";
import { 
  collection, getDocs, doc, setDoc, getDoc, updateDoc, onSnapshot, 
  addDoc, query, where, orderBy, limit 
} from "firebase/firestore";
import Link from "next/link";

// --- 型定義 ---
type QuizItem = {
  id: string;
  name: string;
  amount: string;
  calories: number;
  trivia: string;
  image_url?: string;
};

type BattleState = {
  status: "waiting" | "playing" | "finished";
  mode: "choice" | "input";
  questions: QuizItem[];
  hostScore: number | null;
  guestScore: number | null;
  hostName: string;
  guestName: string;
};

type RankItem = {
  id: string;
  name: string;
  score: number;
};

// --- ヘルパー関数 ---
const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const generateRoomId = () => Math.floor(1000 + Math.random() * 9000).toString();

export default function Home() {
  // --- 共通ステート ---
  const [allQuizzes, setAllQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ゲーム進行ステート ---
  const [gameMode, setGameMode] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<QuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [showTrivia, setShowTrivia] = useState(false);
  const [currentChoices, setCurrentChoices] = useState<number[]>([]);
  const [score, setScore] = useState(0);

  // --- ユーザー & ランキング用ステート ---
  const [userName, setUserName] = useState(""); // ★名前入力用
  const [ranking, setRanking] = useState<RankItem[]>([]); // ★ランキングデータ
  const hasSavedRef = useRef(false); // 重複保存防止用

  // --- 対戦用ステート ---
  const [battleModeInput, setBattleModeInput] = useState<"choice" | "input">("input");
  const [roomId, setRoomId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [inputRoomId, setInputRoomId] = useState("");
  const [battleData, setBattleData] = useState<BattleState | null>(null);
  const [battleMessage, setBattleMessage] = useState("");

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 1. 初回データ取得
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

  // 2. ブラウザバック対策
  useEffect(() => {
    if (gameMode) {
      window.history.pushState(null, "", window.location.href);
      const handlePopState = () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        setGameMode(null);
        setQuizData([]);
        setRoomId("");
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [gameMode]);

  // --- ゲーム開始前のチェック ---
  const startGame = (mode: "choice" | "input") => {
    if (!userName.trim()) {
      alert("名前を入力してください！");
      return;
    }
    
    // 初期化
    if (allQuizzes.length > 0) {
      const shuffled = shuffle(allQuizzes);
      setQuizData(shuffled.slice(0, 10));
      setCurrentIndex(0);
      setScore(0);
      setResult(null);
      setShowTrivia(false);
      hasSavedRef.current = false; // 保存フラグをリセット
      setRanking([]); // ランキング表示をリセット
      setGameMode(mode);
    }
  };

  // --- ランキング保存 & 取得処理 (ソロ終了時) ---
  useEffect(() => {
    const saveAndFetchRanking = async () => {
      // ソロモード終了時のみ実行
      if (result === "FINISHED" && (gameMode === "choice" || gameMode === "input") && !hasSavedRef.current) {
        hasSavedRef.current = true; // 二重保存防止

        try {
          // 1. スコア保存
          await addDoc(collection(db, "scores"), {
            name: userName,
            score: score,
            mode: gameMode,
            createdAt: new Date()
          });

          // 2. ランキング取得 (同じモードの上位10件)
          // 注意: where + orderBy を組み合わせると Firestore の複合インデックスが必要になるため、
          // ここではサーバ側での orderBy を使わずに同モードの全件を取得してクライアント側でソートします。
          const q = query(
            collection(db, "scores"),
            where("mode", "==", gameMode)
          );
          
          const querySnapshot = await getDocs(q);
          const rankList: RankItem[] = [];
          querySnapshot.forEach((doc) => {
            const d = doc.data();
            rankList.push({ id: doc.id, name: d.name, score: d.score });
          });
          // クライアント側でスコア降順にソートして上位10件にする
          rankList.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          setRanking(rankList.slice(0, 10));

        } catch (error) {
          console.error("ランキング処理エラー:", error);
        }
      }
    };

    saveAndFetchRanking();
  }, [result, gameMode, score, userName]);


  // --- 対戦ロジック: 部屋作成 (Host) ---
  const createRoom = async () => {
    if (!userName.trim()) {
      alert("名前を入力してください！");
      return;
    }
    if (allQuizzes.length < 10) {
      alert("問題数が足りません");
      return;
    }
    const newRoomId = generateRoomId();
    const questions = shuffle(allQuizzes).slice(0, 10);

    try {
      await setDoc(doc(db, "rooms", newRoomId), {
        status: "waiting",
        mode: battleModeInput,
        questions: questions,
        hostScore: null,
        guestScore: null,
        hostName: userName,
        guestName: "",
        createdAt: new Date()
      });

      setRoomId(newRoomId);
      setIsHost(true);
      setGameMode("battle_lobby");
      startRoomListener(newRoomId);
    } catch (e) {
      console.error(e);
      alert("部屋の作成に失敗しました");
    }
  };

  // --- 対戦ロジック: 部屋参加 (Guest) ---
  const joinRoom = async () => {
    if (!userName.trim()) {
      alert("名前を入力してください！");
      return;
    }
    if (!inputRoomId) return;
    try {
      const roomRef = doc(db, "rooms", inputRoomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        alert("その番号の部屋は見つかりません");
        return;
      }
      
      await updateDoc(roomRef, {
        guestName: userName
      });

      setRoomId(inputRoomId);
      setIsHost(false);
      setGameMode("battle_lobby");
      startRoomListener(inputRoomId);
    } catch (e) {
      console.error(e);
      alert("参加に失敗しました");
    }
  };

  // --- 対戦ロジック: リアルタイム監視 ---
  const startRoomListener = (id: string) => {
    if (unsubscribeRef.current) unsubscribeRef.current();

    const roomRef = doc(db, "rooms", id);
    const unsub = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as BattleState;
        setBattleData(data);

        if (data.status === "playing") {
            setQuizData(data.questions);
            setGameMode("battle_game");
            if (currentIndex === 0 && score === 0) {
                setCurrentIndex(0);
                setScore(0);
                setResult(null);
                setShowTrivia(false);
            }
        }
      }
    });
    unsubscribeRef.current = unsub;
  };

  const startBattle = async () => {
    if (!roomId) return;
    await updateDoc(doc(db, "rooms", roomId), {
      status: "playing"
    });
  };

  // --- 4択生成 ---
  const isChoiceMode = gameMode === "choice" || (gameMode === "battle_game" && battleData?.mode === "choice");

  useEffect(() => {
    if (isChoiceMode && quizData.length > 0 && quizData[currentIndex]) {
      generateChoices(quizData[currentIndex].calories);
    }
  }, [currentIndex, isChoiceMode, quizData]);

  const generateChoices = (correct: number) => {
    const wrong1 = Math.round(correct * 0.8);
    const wrong2 = Math.round(correct * 1.2);
    const wrong3 = Math.round(correct * 1.5);
    const choices = shuffle([correct, wrong1, wrong2, wrong3]);
    setCurrentChoices(choices);
  };

  // --- 回答処理 ---
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

  const handleNext = useCallback(async () => {
    if (currentIndex < quizData.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setUserInput("");
      setResult(null);
      setShowTrivia(false);
    } else {
      if (gameMode === "battle_game") {
        setBattleMessage("相手の終了を待っています...");
        const updateData = isHost ? { hostScore: score } : { guestScore: score };
        await updateDoc(doc(db, "rooms", roomId), updateData);
        setGameMode("battle_result");
      } else {
        setResult("FINISHED");
        setShowTrivia(false);
      }
    }
  }, [currentIndex, quizData.length, gameMode, isHost, roomId, score]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setUserInput("");
      setResult(null);
      setShowTrivia(false);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleInputAnswer();
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const currentIsInput = gameMode === "input" || (gameMode === "battle_game" && battleData?.mode === "input");
        if (currentIsInput && !showTrivia) {
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
  }, [gameMode, showTrivia, handleNext, battleData]);

  // --- ランク・シェア ---
  const getRankData = (score: number) => {
    if (score === 10) return { title: "カロリー神 🏆", msg: "AIを超えた眼力！", color: "text-yellow-500" };
    if (score >= 8) return { title: "カロリー博士 🎓", msg: "素晴らしい知識！", color: "text-purple-600" };
    if (score >= 5) return { title: "健康オタク 🥗", msg: "なかなかの好成績！", color: "text-green-600" };
    if (score >= 2) return { title: "一般人 🙂", msg: "まあまあの結果。", color: "text-blue-500" };
    return { title: "ジャンクフード愛好家 🍔", msg: "気にしない生き様！", color: "text-red-500" };
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

  if (loading) return <div className="min-h-screen bg-orange-50 flex justify-center items-center"><div className="animate-spin text-4xl">🥦</div></div>;

  if (allQuizzes.length === 0) return (
    <div className="min-h-screen flex flex-col justify-center items-center gap-4 bg-orange-50">
      <p className="font-bold text-gray-600">まだ問題がありません🙇‍♂️</p>
      <Link href="/admin" className="text-blue-500 underline">管理者ページで作る</Link>
    </div>
  );

  // --- UI: タイトル画面 ---
  if (!gameMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 to-green-600 flex flex-col items-center justify-center p-6 text-white">
        <div className="text-center space-y-2 mb-10">
          <div className="text-7xl mb-4 animate-bounce">🥦</div>
          <h1 className="text-5xl font-black tracking-widest drop-shadow-md">カロリーQ</h1>
          <p className="text-green-100 font-bold opacity-90">全10問！あなたの実力は？</p>
        </div>
        
        {/* ★名前入力欄を追加 */}
        <div className="w-full max-w-sm mb-6">
          <label className="block text-sm font-bold text-green-100 mb-1 text-center">ニックネームを入力</label>
          <input 
            type="text" 
            placeholder="例: カロリー博士"
            className="w-full p-4 border-2 border-white/50 rounded-xl font-bold text-lg text-center bg-white/20 text-white placeholder-white/50 focus:bg-white focus:text-slate-800 transition"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>

        <div className="space-y-4 w-full max-w-sm">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => startGame("choice")} className="bg-white text-green-600 py-4 rounded-xl text-lg font-bold shadow-lg hover:scale-105 transition">
              🅰️ 4択で遊ぶ
            </button>
            <button onClick={() => startGame("input")} className="bg-green-800 bg-opacity-40 border-2 border-white text-white py-4 rounded-xl text-lg font-bold shadow-lg hover:bg-opacity-50 transition backdrop-blur-sm">
              🔢 数字で挑む
            </button>
          </div>
          <button onClick={() => setGameMode("battle_menu")} className="w-full bg-orange-500 text-white py-4 rounded-xl text-lg font-bold shadow-lg hover:bg-orange-600 transition flex items-center justify-center gap-2 mt-4">
            <span className="text-2xl">⚔️</span> オンライン対戦
          </button>
        </div>
        <div className="mt-12"><Link href="/admin" className="text-white/60 text-sm hover:text-white underline decoration-dotted">管理者ページへ</Link></div>
      </div>
    );
  }

  // --- UI: 対戦メニュー (作成/参加) ---
  if (gameMode === "battle_menu") {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-slate-700">
        <h2 className="text-3xl font-black mb-6 text-orange-600">⚔️ オンライン対戦</h2>
        
        {/* 名前入力 (既にタイトルで入れている場合はそのまま表示) */}
        <div className="w-full max-w-sm mb-6">
          <label className="block text-sm font-bold text-gray-500 mb-1">あなたの名前</label>
          <input 
            type="text" 
            placeholder="例: カロリー博士"
            className="w-full p-4 border-2 border-orange-200 rounded-xl font-bold text-lg text-center bg-white"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>

        <div className="w-full max-w-sm space-y-6">
          <div className="bg-white p-6 rounded-xl shadow border border-orange-100">
            <p className="font-bold text-center mb-3 text-orange-500">部屋を作る</p>
            <div className="flex gap-2 mb-4 justify-center">
              <button onClick={() => setBattleModeInput("choice")} className={`px-4 py-2 rounded-lg font-bold text-sm ${battleModeInput === "choice" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>🅰️ 4択</button>
              <button onClick={() => setBattleModeInput("input")} className={`px-4 py-2 rounded-lg font-bold text-sm ${battleModeInput === "input" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400"}`}>🔢 数字</button>
            </div>
            <button onClick={createRoom} className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold shadow hover:bg-orange-600 transition">この設定で部屋を作る</button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
            <p className="font-bold text-center mb-2 text-slate-500">友達の部屋に参加</p>
            <div className="flex gap-2">
              <input type="number" placeholder="番号" className="flex-1 p-3 border-2 border-slate-200 rounded-lg font-bold text-lg text-center" value={inputRoomId} onChange={(e) => setInputRoomId(e.target.value)} />
              <button onClick={joinRoom} className="bg-slate-700 text-white px-6 rounded-lg font-bold hover:bg-slate-800 transition">参加</button>
            </div>
          </div>
          <button onClick={() => setGameMode(null)} className="w-full text-slate-400 mt-2 underline text-sm">戻る</button>
        </div>
      </div>
    );
  }

  // --- UI: 対戦ロビー ---
  if (gameMode === "battle_lobby") {
    return (
      <div className="min-h-screen bg-slate-800 text-white flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <p className="text-sm font-bold text-slate-400 mb-2">ROOM ID</p>
          <p className="text-6xl font-black tracking-widest font-mono text-yellow-400">{roomId}</p>
          <p className="text-sm text-slate-400 mt-2 font-bold">モード: {battleData?.mode === "choice" ? "🅰️ 4択" : "🔢 数字"}</p>
        </div>
        
        <div className="bg-slate-700 p-8 rounded-2xl w-full max-w-sm mb-8 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-600 pb-2">
            <div><span className="text-xs text-slate-400 block">HOST</span><span className="font-bold text-xl">{battleData?.hostName || "ホスト"}</span></div>
            <span className="font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded text-xs">準備OK</span>
          </div>
          <div className="flex justify-between items-center">
            <div><span className="text-xs text-slate-400 block">GUEST</span><span className="font-bold text-xl">{battleData?.guestName || "---"}</span></div>
            {battleData?.guestName ? <span className="font-bold text-green-400 bg-green-900/30 px-2 py-1 rounded text-xs">準備OK</span> : <span className="text-slate-500 text-xs animate-pulse">待機中...</span>}
          </div>
        </div>
        {isHost ? <button onClick={startBattle} disabled={!battleData?.guestName} className={`w-full max-w-sm py-4 rounded-xl font-bold text-xl transition ${battleData?.guestName ? "bg-gradient-to-r from-orange-500 to-red-500 hover:scale-105 text-white shadow-lg" : "bg-slate-600 text-slate-400 cursor-not-allowed"}`}>{battleData?.guestName ? "バトル開始！ 🔥" : "対戦相手を待っています..."}</button> : <div className="text-center"><p className="text-xl font-bold animate-bounce">ホストの開始を待っています...</p></div>}
        <button onClick={() => setGameMode(null)} className="mt-8 text-slate-500 underline text-sm">キャンセル</button>
      </div>
    );
  }

  // --- UI: 対戦結果画面 ---
  if (gameMode === "battle_result") {
    const isWaiting = battleData?.hostScore === null || battleData?.guestScore === null;
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        {isWaiting ? (
          <div className="text-center"><div className="text-6xl mb-4 animate-bounce">⏳</div><h2 className="text-2xl font-bold">{battleMessage}</h2><p className="text-slate-400 mt-2">相手が解き終わるまでお待ちください</p></div>
        ) : (
          <div className="w-full max-w-md text-center">
            <h2 className="text-3xl font-black mb-8 text-yellow-400">BATTLE RESULT</h2>
            <div className="bg-slate-800 rounded-2xl overflow-hidden mb-8 border border-slate-700">
               <div className="grid grid-cols-3 bg-slate-700 p-2 text-xs text-slate-400 font-bold"><div className="text-left pl-4">PLAYER</div><div>SCORE</div><div>WINNER</div></div>
               <div className={`grid grid-cols-3 p-4 items-center border-b border-slate-700 ${battleData!.hostScore! > battleData!.guestScore! ? "bg-yellow-900/20" : ""}`}>
                 <div className="text-left font-bold truncate pl-2">{battleData?.hostName}</div><div className="font-black text-2xl">{battleData?.hostScore}</div><div className="text-2xl">{battleData!.hostScore! > battleData!.guestScore! ? "👑" : ""}</div>
               </div>
               <div className={`grid grid-cols-3 p-4 items-center ${battleData!.guestScore! > battleData!.hostScore! ? "bg-yellow-900/20" : ""}`}>
                 <div className="text-left font-bold truncate pl-2">{battleData?.guestName}</div><div className="font-black text-2xl">{battleData?.guestScore}</div><div className="text-2xl">{battleData!.guestScore! > battleData!.hostScore! ? "👑" : ""}</div>
               </div>
            </div>
            <div className="mb-10">{(() => { const my = isHost ? battleData?.hostScore : battleData?.guestScore; const op = isHost ? battleData?.guestScore : battleData?.hostScore; if (my! > op!) return <p className="text-5xl font-black text-green-400 animate-bounce">YOU WIN! 🏆</p>; if (my! < op!) return <p className="text-5xl font-black text-red-400">YOU LOSE... 💀</p>; return <p className="text-5xl font-black text-slate-300">DRAW 🤝</p>; })()}</div>
            <button onClick={() => setGameMode(null)} className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition">タイトルに戻る</button>
          </div>
        )}
      </div>
    );
  }

  // --- クイズ画面 ---
  if (!currentQuiz && result !== "FINISHED") {
    return <div className="min-h-screen bg-green-50 flex justify-center items-center"><div className="animate-spin text-4xl">🥦</div></div>;
  }

  // --- ソロ結果画面 (ランキング表示) ---
  const isBattle = gameMode === "battle_game";
  const isFinished = result === "FINISHED";

  if (isFinished && !isBattle) {
     const rank = getRankData(score);
     const modeText = gameMode === "choice" ? "【4択モード】" : "【数字入力モード】";
     const shareText = `「カロリーQ」${modeText}で【${rank.title}】の称号を獲得！(正解数: ${score}/10)`;

     return (
       <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 px-4 overflow-hidden">
         <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col relative">
           <div className="py-10 px-6 text-center bg-gradient-to-b from-white to-green-50 h-full flex flex-col justify-center animate-fade-in-up">
            <div className="mb-4">
              <p className="text-gray-500 font-bold mb-2">SCORE</p>
              <div className="text-6xl font-black text-slate-800">{score}<span className="text-2xl text-gray-400">/10</span></div>
              <p className="text-gray-400 text-sm font-bold mt-2">MODE: {gameMode === "choice" ? "4択" : "数字入力"}</p>
            </div>

            {/* ★ランキング表示エリア */}
            <div className="w-full bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
                <h3 className="font-bold text-slate-500 text-sm mb-3">🏆 {gameMode === "choice" ? "4択" : "数字"}モード 歴代TOP10</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {ranking.length > 0 ? ranking.map((r, i) => (
                        <div key={r.id} className={`flex justify-between items-center p-2 rounded ${r.name === userName && r.score === score ? "bg-yellow-100 border border-yellow-300" : "bg-white border border-slate-100"}`}>
                            <div className="flex items-center gap-2 truncate">
                                <span className={`font-bold w-5 text-center ${i < 3 ? "text-yellow-600" : "text-slate-400"}`}>{i+1}</span>
                                <span className="text-sm font-bold truncate max-w-[120px]">{r.name}</span>
                            </div>
                            <span className="font-black text-slate-700">{r.score}点</span>
                        </div>
                    )) : <p className="text-xs text-center text-slate-400">ランキング読み込み中...</p>}
                </div>
            </div>

            <div className="space-y-3 mb-8">
              <a href={getShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="block w-full bg-black text-white py-4 rounded-full font-bold shadow-lg hover:bg-gray-800 transition transform hover:-translate-y-1 text-center flex items-center justify-center gap-2">
                <span className="text-xl">𝕏</span> 結果をポストする
              </a>
              <a href={getLineShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#06C755] text-white py-4 rounded-full font-bold shadow-lg hover:brightness-110 transition transform hover:-translate-y-1 text-center flex items-center justify-center gap-2">
                <span className="text-xl font-black bg-white text-[#06C755] rounded-full w-6 h-6 flex items-center justify-center text-xs">L</span> LINEで送る
              </a>
            </div>
            <button onClick={() => setGameMode(null)} className="w-full bg-white text-slate-600 border-2 border-slate-200 py-3 rounded-full font-bold hover:bg-slate-50 transition">タイトルに戻る</button>
           </div>
         </div>
       </div>
     );
  }

  // クイズプレイ画面 (ソロ & 対戦共通)
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8 px-4 overflow-hidden">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden min-h-[600px] flex flex-col relative">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center z-10 relative">
          <span className="font-bold text-sm tracking-widest">
            {isBattle ? "⚔️ BATTLE" : "QUESTION"} {currentIndex + 1} / {quizData.length}
          </span>
          <button onClick={() => setGameMode(null)} className="text-xs bg-slate-700 px-3 py-1 rounded-full hover:bg-slate-600">退出</button>
        </div>

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
              {isChoiceMode ? (
                <div className="grid grid-cols-2 gap-3">
                  {currentChoices.map((choice, i) => (
                    <button key={i} onClick={() => handleChoiceAnswer(choice)} className="bg-white text-slate-700 font-bold py-4 rounded-xl border-2 border-slate-200 hover:border-green-500 hover:bg-green-50 hover:text-green-600 transition shadow-sm active:scale-95">
                      {choice} <span className="text-xs">kcal</span>
                    </button>
                  ))}
                </div>
              ) : (
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
              <button onClick={handleNext} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg active:scale-95">{showTrivia ? (currentIndex === quizData.length - 1 ? (isBattle ? "結果送信！" : "結果を見る！") : "次の問題へ →") : "スキップ →"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}