/* ==========================================================================
   Amy FX Academy — Micro-Learning Core JS
   Interaksi kuis instan, penyimpanan progres offline, dan navigasi mulus
   ========================================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'amyfx.academy.micro_progress';

  function getProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (_) {
      return {};
    }
  }

  function markLessonCompleted(lessonId) {
    if (!lessonId) return;
    try {
      const prog = getProgress();
      prog[lessonId] = {
        completed: true,
        completedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prog));
    } catch (e) {
      console.warn('Gagal menyimpan progres:', e);
    }
  }

  function initQuiz() {
    const quizCard = document.querySelector('.ml-quiz-card');
    if (!quizCard) return;

    const lessonId = quizCard.dataset.lessonId || window.location.pathname;
    const buttons = quizCard.querySelectorAll('.ml-quiz-btn');
    const feedbackBox = quizCard.querySelector('.ml-quiz-feedback');

    buttons.forEach((btn) => {
      btn.addEventListener('click', function () {
        const isCorrect = this.dataset.correct === 'true';

        buttons.forEach((b) => {
          b.disabled = true;
          if (b.dataset.correct === 'true') {
            b.classList.add('correct');
            b.innerHTML = '✓ ' + b.innerHTML;
          } else {
            b.style.opacity = '0.5';
          }
        });

        if (feedbackBox) {
          if (isCorrect) {
            this.classList.add('correct');
            feedbackBox.className = 'ml-quiz-feedback show-correct';
            feedbackBox.innerHTML = '<strong>Tepat Sekali! 🎉</strong> ' + (this.dataset.explanation || 'Pemahamanmu sudah tepat untuk konsep ini.');
            markLessonCompleted(lessonId);
          } else {
            this.classList.add('incorrect');
            this.innerHTML = '✕ ' + this.innerHTML;
            feedbackBox.className = 'ml-quiz-feedback show-incorrect';
            feedbackBox.innerHTML = '<strong>Belum Tepat.</strong> ' + (this.dataset.explanation || 'Periksa kembali penjelasan di atas ya.');
          }
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initQuiz();
  });

  window.AmyFXMicroLearning = {
    getProgress: getProgress,
    markLessonCompleted: markLessonCompleted
  };
})();
