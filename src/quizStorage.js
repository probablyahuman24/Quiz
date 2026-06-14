import { db } from "./firebase";
import {
  collection, addDoc, getDocs,
  orderBy, query
} from "firebase/firestore";

// ── Firestore: save a completed attempt ──────────────────
export async function saveScore({ name, score, total }) {
  await addDoc(collection(db, "scores"), {
    name,
    score,
    total,
    date: new Date()
  });
}

// ── Firestore: get all scores, sorted best first ─────────
export async function getScores() {
  const q = query(collection(db, "scores"), orderBy("score", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ── localStorage: save mid-quiz progress ─────────────────
export function saveProgress(state) {
  localStorage.setItem("quizProgress", JSON.stringify(state));
}

// ── localStorage: load mid-quiz progress ─────────────────
export function loadProgress() {
  return JSON.parse(localStorage.getItem("quizProgress") || "null");
}

// ── localStorage: clear on quiz complete/abandon ─────────
export function clearProgress() {
  localStorage.removeItem("quizProgress");
}
