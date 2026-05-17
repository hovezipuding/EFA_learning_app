/* EFA learning app – datasets + modes + localStorage */
const STATE_KEY = "efa_learning_state_v1";
const DATASET_KEY = "efa_learning_dataset_v1";

const ui = {
  datasetSelect: document.getElementById("datasetSelect"),
  modeSelect: document.getElementById("modeSelect"),
  topicSelect: document.getElementById("topicSelect"),
  orderSelect: document.getElementById("orderSelect"),
  resetStatsBtn: document.getElementById("resetStatsBtn"),
  modePill: document.getElementById("modePill"),
  topicPill: document.getElementById("topicPill"),
  progressText: document.getElementById("progressText"),

  qid: document.getElementById("qid"),
  qtopic: document.getElementById("qtopic"),
  question: document.getElementById("question"),
  options: document.getElementById("options"),

  explain: document.getElementById("explain"),
  showDetailsBtn: document.getElementById("showDetailsBtn"),
  retryBtn: document.getElementById("retryBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),

  okCount: document.getElementById("okCount"),
  badCount: document.getElementById("badCount"),
};

let allQuestions = [];
let queue = [];
let idx = 0;
let current = null;
let revealed = false;
let detailsShown = false;
let lastChosenLetter = null;
let sessionAnswers = {}; // odpovědi v aktuálním průchodu, aby šlo vracet se zpět

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { correct: {}, wrong: {}, wrongSet: {}, totals: { ok: 0, bad: 0 } };
    return JSON.parse(raw);
  } catch {
    return { correct: {}, wrong: {}, wrongSet: {}, totals: { ok: 0, bad: 0 } };
  }
}
function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function setPills() {
  const modeLabel = ui.modeSelect.value === "learn" ? "Learn" :
                    ui.modeSelect.value === "practice" ? "Practice" : "Repeat mistakes";
  ui.modePill.textContent = modeLabel;
  ui.topicPill.textContent = ui.topicSelect.value || "Vše";
}

function buildTopicOptions() {
  const topics = Array.from(new Set(allQuestions.map(q => q.topic || "Nezařazeno"))).sort();
  ui.topicSelect.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "Vše";
  optAll.textContent = "Vše";
  ui.topicSelect.appendChild(optAll);
  topics.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    ui.topicSelect.appendChild(opt);
  });
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQueue() {
  const state = loadState();
  const mode = ui.modeSelect.value;
  const topic = ui.topicSelect.value;
  const order = ui.orderSelect.value;

  let base = allQuestions.slice();
  if (topic && topic !== "Vše") base = base.filter(q => (q.topic || "Nezařazeno") === topic);

  if (mode === "mistakes") {
    const wrongIds = new Set(Object.keys(state.wrongSet || {}));
    base = base.filter(q => wrongIds.has(q.id));
  }

  queue = order === "random" ? shuffle(base) : base;
  idx = 0;
  sessionAnswers = {};
  updateProgress();
}

function updateProgress() {
  ui.progressText.textContent = `${queue.length ? (idx + 1) : 0}/${queue.length}`;
  const st = loadState();
  ui.okCount.textContent = st.totals?.ok ?? 0;
  ui.badCount.textContent = st.totals?.bad ?? 0;
}

function clearExplain() {
  ui.explain.style.display = "none";
  ui.explain.innerHTML = "";
}
function updateNavButtons() {
  ui.prevBtn.disabled = !queue.length || idx <= 0;
}

function setButtonsAfterRender() {
  ui.showDetailsBtn.disabled = true;
  ui.retryBtn.disabled = true;

  ui.prevBtn.disabled = !queue.length || idx <= 0;
  ui.nextBtn.disabled = true;
}

function renderQuestion() {
  revealed = false;
  detailsShown = false;
  lastChosenLetter = null;
  clearExplain();
  setButtonsAfterRender();

  if (!queue.length) {
    ui.qid.textContent = "–";
    ui.qtopic.textContent = "–";
    ui.question.textContent = ui.modeSelect.value === "mistakes"
      ? "Nemáš žádné chyby k opakování (zatím)."
      : "Žádné otázky pro zvolený filtr.";
    ui.options.innerHTML = "";
    ui.progressText.textContent = `0/0`;
    return;
  }

  current = queue[idx];
  const savedAnswer = sessionAnswers[idx];
  ui.qid.textContent = current.id || `Q${idx + 1}`;
  ui.qtopic.textContent = current.topic || "Nezařazeno";
  ui.question.textContent = current.question;

  ui.options.innerHTML = "";
  ["A","B","C","D"].forEach((L) => {
    const btn = document.createElement("button");
    btn.className = "opt";
    btn.dataset.letter = L;
    btn.textContent = `${L}) ${current.options[L]}`;
    btn.addEventListener("click", () => onAnswer(L));
    ui.options.appendChild(btn);
  });

  if (savedAnswer) {
    revealed = true;
    lastChosenLetter = savedAnswer.chosenLetter;
    detailsShown = savedAnswer.detailsShown || false;

    markButtons(current.correct, lastChosenLetter);
    ui.retryBtn.disabled = false;
    ui.nextBtn.disabled = idx >= queue.length - 1;
    ui.showDetailsBtn.disabled = (ui.modeSelect.value !== "practice");
    showExplanation();
  }

  updateProgress();
  updateNavButtons();
}

function markButtons(correctLetter, chosenLetter) {
  const buttons = Array.from(ui.options.querySelectorAll("button.opt"));
  buttons.forEach(b => {
    const L = b.dataset.letter;
    b.disabled = true;
    if (L === correctLetter) b.classList.add("correct");
    if (L === chosenLetter && chosenLetter !== correctLetter) b.classList.add("wrong");
  });
}

function recordResult(isCorrect) {
  const st = loadState();
  st.totals = st.totals || { ok: 0, bad: 0 };
  if (isCorrect) {
    st.totals.ok += 1;
    st.correct[current.id] = (st.correct[current.id] || 0) + 1;
  } else {
    st.totals.bad += 1;
    st.wrong[current.id] = (st.wrong[current.id] || 0) + 1;
    st.wrongSet = st.wrongSet || {};
    st.wrongSet[current.id] = true;
  }
  saveState(st);
}

function showExplanation() {
  const correct = current.correct;
  const chosenLetter = lastChosenLetter;
  const isCorrect = chosenLetter === correct;
  const mode = ui.modeSelect.value;

  const showAllWrongNow = (mode === "learn") || (mode === "mistakes") || detailsShown;

  let html = `<h3>${isCorrect ? "✔️ Správně" : "❌ Špatně"}</h3>`;
  html += `<p><strong>Proč je správně (${correct}):</strong> ${current.explainCorrect || "—"}</p>`;

  if (showAllWrongNow) {
    ["A","B","C","D"].filter(l => l !== correct).forEach(l => {
      const t = (current.explainWrong && current.explainWrong[l]) ? current.explainWrong[l] : "—";
      html += `<p><strong>Proč je špatně (${l}):</strong> ${t}</p>`;
    });
  } else {
    html += `<p class="muted">Podrobnosti špatných možností jsou schované (Practice). Klikni na „Zobrazit podrobnosti“.</p>`;
  }

  html += `<p class="muted" style="margin-top:10px;">Tvoje volba: <strong>${chosenLetter}</strong></p>`;
  ui.explain.innerHTML = html;
  ui.explain.style.display = "block";
}

function onAnswer(letter) {
  if (revealed) return;
  revealed = true;
  lastChosenLetter = letter;

  const correct = current.correct;
  const isCorrect = letter === correct;

  markButtons(correct, letter);
  recordResult(isCorrect);
  sessionAnswers[idx] = { chosenLetter: letter, detailsShown: false };

  ui.nextBtn.disabled = false;
ui.prevBtn.disabled = idx <= 0;
ui.retryBtn.disabled = false;
ui.showDetailsBtn.disabled = (ui.modeSelect.value !== "practice");

  showExplanation();
  updateProgress();
}

ui.showDetailsBtn.addEventListener("click", () => {
  if (!revealed) return;
  detailsShown = true;
  if (sessionAnswers[idx]) sessionAnswers[idx].detailsShown = true;
  showExplanation();
});

ui.retryBtn.addEventListener("click", () => {
  delete sessionAnswers[idx];
  renderQuestion();
});

ui.prevBtn.addEventListener("click", () => {
  if (!queue.length || idx <= 0) return;
  idx -= 1;
  updateProgress();
  renderQuestion();
});

ui.prevBtn.addEventListener("click", () => {
  if (!queue.length || idx <= 0) return;
  idx = Math.max(idx - 1, 0);
  updateProgress();
  renderQuestion();
});

ui.resetStatsBtn.addEventListener("click", () => {
  localStorage.removeItem(STATE_KEY);
  updateProgress();
  buildQueue();
  renderQuestion();
});

ui.modeSelect.addEventListener("change", () => {
  setPills();
  buildQueue();
  renderQuestion();
});
ui.topicSelect.addEventListener("change", () => {
  setPills();
  buildQueue();
  renderQuestion();
});
ui.orderSelect.addEventListener("change", () => {
  buildQueue();
  renderQuestion();
});

ui.datasetSelect.addEventListener("change", async () => {
  localStorage.setItem(DATASET_KEY, ui.datasetSelect.value);
  await reloadQuestions();
});

async function loadDataset(name) {
  const res = await fetch(`data/${name}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nelze načíst data/${name}.json (${res.status})`);
  return await res.json();
}

async function reloadQuestions() {
  const dataset = ui.datasetSelect.value;
  const data = await loadDataset(dataset);

  allQuestions = data.map((q, i) => ({
    id: q.id || `${dataset.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
    topic: q.topic || "Nezařazeno",
    question: q.question,
    options: q.options,
    correct: q.correct,
    explainCorrect: q.explainCorrect || "",
    explainWrong: q.explainWrong || {}
  }));

  buildTopicOptions();
  setPills();
  buildQueue();
  renderQuestion();
}

async function init() {
  const savedDataset = localStorage.getItem(DATASET_KEY);
  if (savedDataset) ui.datasetSelect.value = savedDataset;
  await reloadQuestions();
}
init().catch(err => {
  ui.question.textContent = "Chyba při načítání dat – spouštěj přes lokální server.";
  ui.options.innerHTML = `<div class="muted">${String(err)}</div>`;
});