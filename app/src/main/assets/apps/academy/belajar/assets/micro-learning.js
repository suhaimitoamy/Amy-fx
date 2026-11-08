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

  function recordReadingHistory() {
    try {
      if (/\/level-\d+\/(?:index\.html)?$/i.test(window.location.pathname)) return;

      var h1 = document.querySelector('.ml-lesson-title-box h1, h1');
      if (!h1) return;
      var title = h1.textContent.trim();
      var pathname = decodeURIComponent(window.location.pathname || '');
      var path = '';
      var marker = '/apps/academy/';
      var idx = pathname.indexOf(marker);
      if (idx >= 0) {
        path = pathname.slice(idx + marker.length).replace(/^\/+/, '');
      } else {
        var bIdx = pathname.indexOf('belajar/');
        path = bIdx >= 0 ? pathname.slice(bIdx).replace(/^\/+/, '') : pathname.replace(/^\/+/, '');
      }

      var backLink = document.querySelector('.ml-back-link');
      var levelMatch = pathname.match(/level-(\d+)/i);
      var section = backLink ? backLink.textContent.trim().replace(/\s+/g, ' ') : (levelMatch ? 'Level ' + levelMatch[1] : 'Amy FX Academy');

      localStorage.setItem('amy_last_opened_title', title);
      localStorage.setItem('amy_last_opened_url', window.location.href);

      var nextBtn = document.querySelector('.ml-btn-next');
      var nextTitle = nextBtn ? nextBtn.textContent.trim().replace(/\s+/g, ' ') : '';
      var nextHref = nextBtn ? (nextBtn.getAttribute('href') || '') : '';

      var record = {
        version: 2,
        path: path,
        title: title,
        section: section,
        nextTitle: nextTitle,
        nextHref: nextHref,
        scrollY: Math.max(0, Math.round(window.scrollY || 0)),
        progress: 100,
        headingIndex: 0,
        headingText: title,
        namespace: 'micro-learning',
        status: 'reading',
        completed: false,
        updatedAt: Date.now()
      };
      localStorage.setItem('amy_academy_last_read_v2', JSON.stringify(record));

      var hist = [];
      try {
        hist = JSON.parse(localStorage.getItem('amy_academy_reading_history_v2') || '[]');
        if (!Array.isArray(hist)) hist = [];
        hist = hist.filter(function (it) { return it && it.path !== path; });
        hist.unshift(record);
        hist = hist.slice(0, 8);
        localStorage.setItem('amy_academy_reading_history_v2', JSON.stringify(hist));
      } catch (_) {}

      try {
        fetch('/api/academy-reading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastRead: record, history: hist, microProgress: getProgress() })
        }).catch(function () {});
      } catch (_) {}

      try {
        if (window.Android && typeof window.Android.recordLastStudiedLesson === 'function') {
          window.Android.recordLastStudiedLesson(title, window.location.href, section);
        } else if (window.AmyLearningReminder && typeof window.AmyLearningReminder.recordLesson === 'function') {
          window.AmyLearningReminder.recordLesson(title, window.location.href, section);
        }
      } catch (_) {}
    } catch (e) {
      console.warn('Gagal mencatat riwayat baca:', e);
    }
  }

  function injectAssistantIfMissing() {
    try {
      if (window.AmyLocalAssistant || document.getElementById('amy-local-root')) return;
      var s = document.createElement('script');
      s.src = '/apps/shared/amy-local-assistant.js';
      s.defer = true;
      document.head.appendChild(s);
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    recordReadingHistory();
    initQuiz();
    injectAssistantIfMissing();
  });

  window.AmyFXMicroLearning = {
    getProgress: getProgress,
    markLessonCompleted: markLessonCompleted
  };
})();
