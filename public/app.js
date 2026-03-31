'use strict';

// ── STATE ────────────────────────────────────────────────────────────────────
const state = {
  currentScreen: 'home',
  selectedSubject: null,
  questions: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  totalAnswered: 0,
  correctAnswers: 0,
  timeLeft: 45,
  timerInterval: null,
  answered: false,
  usedIds: new Set(),
  isLoadingMore: false,
  startTime: null,
  totalElapsed: 0
};

const TIMER_MAX = 45;
const CIRCUMFERENCE = 2 * Math.PI * 28; // r=28

// ── SUBJECT CONFIG ──────────────────────────────────────────────────────────
const SUBJECT_CONFIG = {
  science:     { label: '🔬 Science',     icon: '🔬', desc: 'Plants, Animals, Human Body & more', color: 'science' },
  geography:   { label: '🗺️ Geography',   icon: '🗺️', desc: 'India, World Maps & Capitals',        color: 'geography' },
  history:     { label: '🏛️ History',     icon: '🏛️', desc: 'Freedom Fighters, Monuments & more',  color: 'history' },
  mathematics: { label: '🔢 Mathematics', icon: '🔢', desc: 'Numbers, Shapes & Puzzles',            color: 'mathematics' },
  gk:          { label: '🌍 G.K.',        icon: '🌍', desc: 'Sports, Science Facts & World Records',color: 'gk' }
};

// ── DOM HELPERS ─────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

function showScreen(name) {
  ['home', 'subject', 'quiz', 'result'].forEach(s => {
    const scr = $(`${s}-screen`);
    if (scr) scr.classList.toggle('hidden', s !== name);
  });
  state.currentScreen = name;
}

// ── NAVIGATION ──────────────────────────────────────────────────────────────
function goHome() {
  clearTimer();
  showScreen('home');
}

function goSubjectSelect() {
  clearTimer();
  showScreen('subject');
}

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildHomeScreen();
  buildSubjectScreen();
  buildQuizScreen();
  buildResultScreen();
  showScreen('home');
});

// ── HOME SCREEN ──────────────────────────────────────────────────────────────
function buildHomeScreen() {
  $('btn-start-quiz').addEventListener('click', goSubjectSelect);
}

// ── SUBJECT SCREEN ───────────────────────────────────────────────────────────
function buildSubjectScreen() {
  $('back-to-home').addEventListener('click', goHome);
  const grid = $('subjects-grid');
  Object.entries(SUBJECT_CONFIG).forEach(([key, cfg]) => {
    const card = el('div', 'subject-card');
    card.dataset.subject = key;
    card.innerHTML = `
      <span class="subject-icon">${cfg.icon}</span>
      <h3>${cfg.icon.replace(/\s/g,'')} ${key.charAt(0).toUpperCase() + key.slice(1)}</h3>
      <p>${cfg.desc}</p>
      <span class="subject-badge">50+ Questions</span>
    `;
    card.addEventListener('click', () => startQuiz(key));
    grid.appendChild(card);
  });
}

// ── QUIZ SCREEN BUILD ────────────────────────────────────────────────────────
function buildQuizScreen() {
  $('back-to-subjects').addEventListener('click', () => {
    clearTimer();
    goSubjectSelect();
  });
  $('btn-next').addEventListener('click', nextQuestion);
}

// ── START QUIZ ───────────────────────────────────────────────────────────────
function startQuiz(subject) {
  state.selectedSubject = subject;
  state.questions = window.QUESTIONS.filter(q => q.subject === subject);
  shuffleArray(state.questions);
  state.currentIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.maxStreak = 0;
  state.totalAnswered = 0;
  state.correctAnswers = 0;
  state.usedIds = new Set();
  state.startTime = Date.now();
  state.totalElapsed = 0;

  const cfg = SUBJECT_CONFIG[subject];
  $('subject-label').textContent = cfg.label;
  $('subject-label').className = `subject-label ${subject}`;
  $('btn-next').className = `btn-next hidden ${subject}`;
  $('progress-fill').className = `progress-fill ${subject}`;

  showScreen('quiz');
  renderQuestion();
  checkAndReplenish();
}

// ── RENDER QUESTION ──────────────────────────────────────────────────────────
function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) { showResult(); return; }

  state.usedIds.add(q.id);
  state.answered = false;

  // Meta
  $('question-num').textContent = `Question ${state.totalAnswered + 1}`;
  $('difficulty-badge').textContent = q.difficulty;
  $('difficulty-badge').className = `difficulty-badge ${q.difficulty}`;

  // Visual
  const visualEl = $('question-visual');
  if (q.visual) {
    visualEl.textContent = q.visual;
    visualEl.style.display = 'block';
  } else {
    visualEl.style.display = 'none';
  }

  // India map
  const mapWrapper = $('map-wrapper');
  if (q.hasMap) {
    mapWrapper.style.display = 'block';
    highlightState(q.mapState);
  } else {
    mapWrapper.style.display = 'none';
  }

  // Question text
  $('question-text').textContent = q.question;

  // Answers
  const letters = ['A', 'B', 'C', 'D'];
  const answersEl = $('answers-grid');
  answersEl.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = el('button', 'answer-btn');
    btn.innerHTML = `<span class="answer-letter">${letters[i]}</span><span>${opt}</span>`;
    btn.addEventListener('click', () => handleAnswer(i));
    answersEl.appendChild(btn);
  });

  // Trivia hide
  $('trivia-card').classList.add('hidden');
  $('btn-next').classList.add('hidden');

  // Progress
  const total = state.questions.length;
  const pct = Math.min((state.totalAnswered / Math.min(total, 50)) * 100, 100);
  $('progress-fill').style.width = pct + '%';
  $('progress-info-left').textContent = `${state.totalAnswered} answered`;
  $('progress-info-right').textContent = `${Math.min(total, 50) - state.totalAnswered} remaining`;

  // Timer
  startTimer();
}

// ── HANDLE ANSWER ─────────────────────────────────────────────────────────────
function handleAnswer(selected) {
  if (state.answered) return;
  state.answered = true;
  clearTimer();

  const q = state.questions[state.currentIndex];
  const btns = $('answers-grid').querySelectorAll('.answer-btn');
  btns.forEach(b => b.disabled = true);

  const isCorrect = selected === q.correct;
  btns[selected].classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) btns[q.correct].classList.add('correct');

  state.totalAnswered++;

  if (isCorrect) {
    state.correctAnswers++;
    state.streak++;
    if (state.streak > state.maxStreak) state.maxStreak = state.streak;

    // Speed tiers: answered in ≤15s → +15, ≤30s → +12, >30s → +10
    const bonus = state.timeLeft >= 30 ? 15 : state.timeLeft >= 15 ? 12 : 10;
    state.score += bonus;
    showScorePop(`+${bonus}`);
  } else {
    state.streak = 0;
  }

  updateScoreDisplay();
  updateStreakDisplay();
  showTrivia(q.trivia);
  $('btn-next').classList.remove('hidden');

  if (state.totalAnswered % 10 === 0 || state.questions.length - state.currentIndex < 12) {
    checkAndReplenish();
  }
}

// ── TIMER ─────────────────────────────────────────────────────────────────────
function startTimer() {
  state.timeLeft = TIMER_MAX;
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      clearTimer();
      timeOut();
    }
  }, 1000);
}

function clearTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const pct = state.timeLeft / TIMER_MAX;
  const offset = CIRCUMFERENCE * (1 - pct);
  const circle = $('timer-progress');
  const textEl = $('timer-text');
  if (!circle || !textEl) return;

  circle.style.strokeDashoffset = offset;
  textEl.textContent = state.timeLeft;

  const urgent = state.timeLeft <= 10;
  circle.classList.toggle('urgent', urgent);
  textEl.classList.toggle('urgent', urgent);
}

function timeOut() {
  if (state.answered) return;
  state.answered = true;

  const q = state.questions[state.currentIndex];
  const btns = $('answers-grid').querySelectorAll('.answer-btn');
  btns.forEach(b => b.disabled = true);
  btns[q.correct].classList.add('correct');

  state.totalAnswered++;
  state.streak = 0;
  updateScoreDisplay();
  updateStreakDisplay();
  showTrivia(q.trivia);
  $('btn-next').classList.remove('hidden');
}

// ── NEXT QUESTION ─────────────────────────────────────────────────────────────
function nextQuestion() {
  if (state.totalAnswered >= 50) { showResult(); return; }
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    showResult();
    return;
  }
  renderQuestion();
}

// ── SCORE / STREAK UI ─────────────────────────────────────────────────────────
function updateScoreDisplay() {
  $('score-value').textContent = state.score;
}

function updateStreakDisplay() {
  const el = $('streak-display');
  el.textContent = `🔥 ${state.streak} streak`;
  el.classList.toggle('on-fire', state.streak >= 3);
}

function showTrivia(text) {
  const card = $('trivia-card');
  $('trivia-text').textContent = text;
  card.classList.remove('hidden');
}

function showScorePop(text) {
  const pop = el('div', 'score-pop', text);
  const scoreEl = $('score-display');
  const rect = scoreEl.getBoundingClientRect();
  pop.style.left = rect.left + 'px';
  pop.style.top  = rect.top + 'px';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1000);
}

// ── INDIA MAP ─────────────────────────────────────────────────────────────────
function highlightState(stateName) {
  const svgEl = $('india-map-svg');
  if (!svgEl) return;
  svgEl.querySelectorAll('path').forEach(p => {
    p.classList.remove('highlighted');
  });
  svgEl.querySelectorAll('text').forEach(t => {
    t.classList.remove('highlighted');
  });
  if (stateName) {
    const target = svgEl.querySelector(`[data-state="${stateName}"]`);
    if (target) {
      target.classList.add('highlighted');
      const label = svgEl.querySelector(`text[data-state="${stateName}"]`);
      if (label) label.classList.add('highlighted');
    }
  }
}

// ── RESULT SCREEN ─────────────────────────────────────────────────────────────
function buildResultScreen() {
  $('btn-play-again').addEventListener('click', () => startQuiz(state.selectedSubject));
  $('btn-change-subject').addEventListener('click', goSubjectSelect);
}

function showResult() {
  clearTimer();
  state.totalElapsed = Math.round((Date.now() - state.startTime) / 1000);

  const total = state.totalAnswered;
  const correct = state.correctAnswers;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  let trophy, message;
  if (pct >= 90)      { trophy = '🏆'; message = 'Outstanding Explorer!'; }
  else if (pct >= 70) { trophy = '⭐'; message = 'Great Job, Star!'; }
  else if (pct >= 50) { trophy = '🚀'; message = 'Good Effort! Keep Exploring!'; }
  else                { trophy = '💪'; message = 'Keep Learning! You\'ll Do Better!'; }

  $('result-trophy').textContent = trophy;
  $('result-message').textContent = message;
  $('result-big-score').innerHTML = `${correct}<span>/${total}</span>`;
  $('result-accuracy').textContent = `${pct}% Accuracy`;
  $('result-streak').textContent = state.maxStreak;
  $('result-correct').textContent = correct;
  $('result-time').textContent = formatTime(state.totalElapsed);

  showScreen('result');

  if (pct >= 50) fireConfetti();
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// ── CONFETTI ──────────────────────────────────────────────────────────────────
function fireConfetti() {
  const colours = ['#ffd700','#ff6b9d','#60a5fa','#4ade80','#c084fc','#fb923c'];
  const container = el('div', 'confetti-container');
  document.body.appendChild(container);
  for (let i = 0; i < 90; i++) {
    const piece = el('div', 'confetti-piece');
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.top = '-10px';
    piece.style.background = colours[Math.floor(Math.random() * colours.length)];
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (6 + Math.random() * 8) + 'px';
    piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    piece.style.animationDelay = (Math.random() * 0.8) + 's';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 4000);
}

// ── REPLENISH FROM CLAUDE API ─────────────────────────────────────────────────
async function checkAndReplenish() {
  const remaining = state.questions.length - state.currentIndex;
  if (remaining >= 15 || state.isLoadingMore) return;

  state.isLoadingMore = true;
  $('loading-indicator').classList.remove('hidden');

  try {
    const resp = await fetch('/api/replenish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: state.selectedSubject,
        existingIds: [...state.usedIds]
      })
    });

    if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
    const newQs = await resp.json();

    newQs.forEach((q, i) => {
      q.id       = 10000 + Date.now() % 1000000 + i;
      q.subject  = state.selectedSubject;
      q.hasMap   = false;
      q.mapState = null;
      q.visual   = q.visual || null;
      q.difficulty = q.difficulty || 'medium';
    });

    state.questions.push(...newQs);
  } catch (e) {
    // Silent fail — enough local questions to continue
  } finally {
    state.isLoadingMore = false;
    $('loading-indicator').classList.add('hidden');
  }
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
