import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBY43MgauBJIFySKFqYWuD0SzErRSxC6bc",
  authDomain: "running-log-d7c7a.firebaseapp.com",
  projectId: "running-log-d7c7a",
  storageBucket: "running-log-d7c7a.firebasestorage.app",
  messagingSenderId: "825604439810",
  appId: "1:825604439810:web:2276af872f3e5856698c1b"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);

// データベース(Firestore)を使う準備をしてエクスポート
export const db = getFirestore(app);