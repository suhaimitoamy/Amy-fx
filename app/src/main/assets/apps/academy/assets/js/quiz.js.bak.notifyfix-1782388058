document.addEventListener('DOMContentLoaded', async () => {
    const container = document.querySelector('.quiz-container');
    if (!container) return;

    const moduleName = container.getAttribute('data-module');
    if (!moduleName) return;

    try {
        const root = typeof ROOT_PATH !== 'undefined' ? ROOT_PATH : '../';
        const response = await fetch(root + 'assets/data/quizzes.json');
        const allQuizzes = await response.json();
        const quizzes = allQuizzes[moduleName];
        
        if (!quizzes || quizzes.length === 0) return;

        let currentQ = 0;
        let score = 0;

        function renderQuiz() {
            if (currentQ >= quizzes.length) {
                renderResult();
                return;
            }

            const q = quizzes[currentQ];
            let html = `
                <div class="quiz-box glass-panel">
                    <div class="quiz-header">
                        <span class="quiz-badge">Evaluasi Akhir Modul</span>
                        <span class="quiz-progress">Pertanyaan ${currentQ + 1} dari ${quizzes.length}</span>
                    </div>
                    <h3 class="quiz-question">${q.question}</h3>
                    <div class="quiz-options">
                        ${q.options.map((opt, i) => `
                            <button class="quiz-btn" onclick="selectAnswer(${i})">${String.fromCharCode(65 + i)}. ${opt}</button>
                        `).join('')}
                    </div>
                    <div id="quiz-feedback" class="quiz-feedback" style="display:none;"></div>
                    <button id="quiz-next" class="btn primary" style="display:none; margin-top:15px; width:100%" onclick="nextQuestion()">Lanjut Pertanyaan</button>
                </div>
            `;
            container.innerHTML = html;
        }

        window.selectAnswer = function(idx) {
            const btns = document.querySelectorAll('.quiz-btn');
            btns.forEach(b => b.disabled = true);
            
            const q = quizzes[currentQ];
            const feedback = document.getElementById('quiz-feedback');
            const nextBtn = document.getElementById('quiz-next');
            
            if (idx === q.correctIndex) {
                btns[idx].classList.add('correct');
                feedback.innerHTML = `<strong>Benar! 🎉</strong><br>${q.explanation}`;
                feedback.className = 'quiz-feedback success';
                score++;
            } else {
                btns[idx].classList.add('wrong');
                btns[q.correctIndex].classList.add('correct');
                feedback.innerHTML = `<strong>Salah! ❌</strong><br>${q.explanation}`;
                feedback.className = 'quiz-feedback error';
            }
            
            feedback.style.display = 'block';
            nextBtn.style.display = 'block';
        };

        window.nextQuestion = function() {
            currentQ++;
            renderQuiz();
        };

        function renderResult() {
            let passed = score === quizzes.length;
            let html = `
                <div class="quiz-box glass-panel" style="text-align:center">
                    <h2 style="color:${passed ? '#4ade80' : '#ffc107'}">${passed ? 'Lulus Sempurna! 🎉' : 'Evaluasi Selesai!'}</h2>
                    <p style="margin-bottom:20px;">Anda menjawab ${score} dari ${quizzes.length} pertanyaan dengan benar.</p>
                    ${passed ? '<p style="color:#a1a3ab">Pengetahuan Anda di modul ini sudah sangat matang.</p>' : '<p style="color:#a1a3ab">Silakan baca ulang materi ini jika masih ada konsep yang membingungkan.</p>'}
                    <button class="btn primary" onclick="location.reload()">Ulangi Kuis</button>
                </div>
            `;
            container.innerHTML = html;

            if (passed) {
                // Confetti effect
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
                script.onload = () => {
                    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                };
                document.body.appendChild(script);
            }
        }

        renderQuiz();

    } catch (e) {
        console.error("Gagal memuat kuis:", e);
    }
});
