import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeWeakSpots,
  generateWeakSpotQuiz,
  generateSpacedRepetitionQuiz,
  MISTAKE_TOPIC_MAP
} from '../lib/weak-spot-quiz-suggester.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const quizzesPath = path.resolve(__dirname, '../app/src/main/assets/apps/academy/assets/data/quizzes.json');
const quizzesData = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'));

test('analyzeWeakSpots mengidentifikasi kelemahan Moved SL secara akurat', () => {
  const result = analyzeWeakSpots('Sering geser SL saat floating minus karena takut kena stop out');
  assert.equal(result.hasIdentifiedWeakness, true);
  assert.equal(result.primaryWeakness, 'moved_sl');
  assert.equal(result.primaryRecommendation.category, 'trade-management-advanced');
  assert.match(result.primaryRecommendation.lessonUrl, /kapan-memindahkan-stop-loss/);
});

test('analyzeWeakSpots mengidentifikasi FOMO & Chasing dari riwayat array trade jurnal', () => {
  const trades = [
    { mistakes: 'FOMO kejar harga di pucuk candle M5' },
    { evaluation: 'Terlambat entry karena chasing price' },
    { lessons: 'Tunggu retracement ke discount zone' }
  ];
  const result = analyzeWeakSpots(trades);
  assert.equal(result.hasIdentifiedWeakness, true);
  assert.equal(result.primaryWeakness, 'fomo_chasing');
  assert.equal(result.primaryRecommendation.category, 'psikologi-trading');
  assert.match(result.primaryRecommendation.lessonUrl, /analysis-freeze/);
});

test('generateWeakSpotQuiz menghasilkan 3 soal kuis remedial terarah dari quizzes.json', () => {
  const quiz = generateWeakSpotQuiz('FOMO entry kejar harga tanpa retracement', quizzesData, 3);
  assert.equal(quiz.questions.length, 3);
  assert.equal(quiz.weaknessKey, 'fomo_chasing');
  assert.ok(quiz.title.includes('Mini Kuis Remedial'));
  assert.ok(quiz.advice.length > 10);

  quiz.questions.forEach((q, idx) => {
    assert.ok(q.question.length > 5, `Soal ${idx} harus memiliki teks`);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2, `Soal ${idx} harus memiliki minimal 2 opsi`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, `Soal ${idx} correctIndex valid`);
  });
});

test('generateSpacedRepetitionQuiz memprioritaskan kategori yang belum pernah diuji', () => {
  const history = [
    { category: 'pemula-nol', correct: true, timestamp: 1000 },
    { category: 'membaca-chart', correct: true, timestamp: 2000 }
  ];
  const quiz = generateSpacedRepetitionQuiz(quizzesData, history, 3);
  assert.equal(quiz.questions.length, 3);
  const categories = quiz.questions.map(q => q.category);
  // Harus mengambil kategori yang belum pernah diuji
  assert.ok(categories.some(c => c !== 'pemula-nol' && c !== 'membaca-chart'));
});
