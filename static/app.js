const API = "";
const S = {
  view: "home", sets: [], set: null, cards: [],
  reviewCards: [], currentIdx: 0, showAnswer: false, userInput: "",
  sessionResults: [], inputMode: "text",
  previewCards: null, previewTitle: "",
  setId: null, pendingCard: null, userQuality: 0, judgeResult: null,
};

function $(s) { return document.querySelector(s); }

function render() {
  const app = $("#app");
  app.innerHTML = "";
  const views = {
    home: renderHome, create: renderCreate, set: renderSet,
    review: renderReview, results: renderResults, judge: renderJudge,
  };
  (views[S.view] || renderHome)(app);
}

async function loadHome() {
  const res = await fetch(`${API}/api/sets`);
  S.sets = await res.json();
  S.view = "home";
  render();
}

async function loadSet(id) {
  const res = await fetch(`${API}/api/sets/${id}`);
  S.set = await res.json();
  S.view = "set";
  render();
}

/* ---- HOME ---- */
function renderHome(app) {
  app.innerHTML = `
    <div class="page-header">
      <h1>Flashcards</h1>
      <button class="btn btn-primary btn-sm" onclick="startCreate()">+ New</button>
    </div>
    ${S.sets.length === 0 ? '<div class="empty-state"><p>No study sets yet.</p><button class="btn btn-primary btn-lg" onclick="startCreate()">Create Your First Set</button></div>' : ""}
    <div class="set-list">
      ${S.sets.map(s => `
        <div class="set-card" onclick="loadSet(${s.id})">
          <div>
            <div class="set-card-title">${esc(s.title)}</div>
            <div class="set-card-meta">${s.card_count} card${s.card_count !== 1 ? "s" : ""}</div>
          </div>
          <div class="set-card-badge">${s.card_count}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ---- CREATE ---- */
function startCreate() {
  S.view = "create"; S.inputMode = "text"; S.previewCards = null;
  render();
}

function renderCreate(app) {
  app.innerHTML = `
    <div class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadHome()">&larr;</button>
      <span class="nav-title">New Set</span>
    </div>
    <div class="tab-bar">
      <button class="tab ${S.inputMode === "text" ? "active" : ""}" onclick="switchInputMode('text')">Paste</button>
      <button class="tab ${S.inputMode === "photo" ? "active" : ""}" onclick="switchInputMode('photo')">Photo</button>
    </div>
    <div id="create-body">${S.inputMode === "text" ? createTextForm() : createPhotoForm()}</div>
  `;
}

function switchInputMode(mode) {
  S.inputMode = mode; S.previewCards = null; render();
}

function createTextForm() {
  return `
    <div class="form-group">
      <label class="form-label">Set Title</label>
      <input id="set-title" class="text-input" placeholder="e.g. Biology Ch.5">
    </div>
    <div class="form-group">
      <label class="form-label">Vocabulary</label>
      <textarea id="vocab-input" class="textarea-input" placeholder="Paste terms here...

photosynthesis | plants convert light
mitosis, cell division
DNA &rarr; genetic material"></textarea>
    </div>
    <div class="actions">
      <button class="btn btn-primary btn-lg" onclick="parseText()">Parse &amp; Create</button>
    </div>
    <div id="preview"></div>
  `;
}

function createPhotoForm() {
  return `
    <input type="file" id="camera-input" accept="image/*" capture="environment" class="hidden" onchange="onImageSelected(event)">
    <input type="file" id="gallery-input" accept="image/*" class="hidden" onchange="onImageSelected(event)">
    <div class="photo-grid">
      <div class="photo-btn" onclick="$('#camera-input').click()">
        <div class="photo-btn-icon">&#x1F4F7;</div>
        <div>Take Photo</div>
      </div>
      <div class="photo-btn" onclick="$('#gallery-input').click()">
        <div class="photo-btn-icon">&#x1F5BC;</div>
        <div>Gallery</div>
      </div>
    </div>
    <img id="photo-preview" class="photo-preview hidden">
    <div id="photo-status" class="photo-status"></div>
    <div id="preview"></div>
  `;
}

function onImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const img = $("#photo-preview");
  const reader = new FileReader();
  reader.onload = function(e) {
    img.src = e.target.result;
    img.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
  $("#photo-status").innerHTML = '<div class="spinner"></div><p class="mt-8">Scanning image with AI&hellip;</p>';
  const formData = new FormData();
  formData.append("image", file);
  fetch(`${API}/api/parse-image`, { method: "POST", body: formData })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      if (!data.cards || data.cards.length === 0) throw new Error("No flashcards found");
      S.previewCards = data.cards;
      showPreview();
    })
    .catch(e => {
      $("#photo-status").innerHTML = `<p style="color:var(--wrong)">Error: ${esc(e.message)}</p>`;
    });
}

/* ---- PARSE TEXT ---- */
async function parseText() {
  const text = $("#vocab-input").value.trim();
  const title = $("#set-title").value.trim() || "Untitled Set";
  if (!text) return;
  const btn = $(".btn-primary");
  btn.disabled = true; btn.textContent = "Parsing...";
  try {
    const res = await fetch(`${API}/api/parse`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({text})
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.cards || data.cards.length === 0) throw new Error("No flashcards found");
    S.previewCards = data.cards;
    S.previewTitle = title;
    showPreview();
  } catch (e) {
    alert(e.message);
  }
  btn.disabled = false; btn.textContent = "Parse & Create";
}

function showPreview() {
  const cards = S.previewCards;
  const el = $("#preview") || document.getElementById("preview");
  if (!el) return;
  el.innerHTML = `
    <div class="or-divider"><span>${cards.length} cards extracted</span></div>
    <div class="preview-box">
      ${cards.slice(0, 20).map(c => `
        <div class="card-list-item"><strong>${esc(c.term)}</strong> &mdash; ${esc(c.definition)}</div>
      `).join("")}
      ${cards.length > 20 ? `<div class="preview-more">+ ${cards.length - 20} more</div>` : ""}
    </div>
    <div class="form-group">
      <label class="form-label">Set Title</label>
      <input id="preview-title" class="text-input" value="${esc(S.previewTitle || "Untitled Set")}">
    </div>
    <button class="btn btn-primary btn-lg" onclick="savePreviewSet()">Save Set</button>
  `;
  el.scrollIntoView({ behavior: "smooth" });
}

async function savePreviewSet() {
  const title = ($("#preview-title").value || "").trim() || "Untitled Set";
  const res = await fetch(`${API}/api/sets`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({title, source: "ai"})
  });
  const {id} = await res.json();
  await fetch(`${API}/api/sets/${id}/cards`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({cards: S.previewCards})
  });
  loadSet(id);
}

/* ---- SET VIEW ---- */
function renderSet(app) {
  const s = S.set;
  const st = s.stats || {total: 0, studied: 0, due: 0};
  app.innerHTML = `
    <div class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadHome()">&larr;</button>
      <span class="nav-title">${esc(s.title)}</span>
    </div>
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val text-muted">${st.total}</div><div class="stat-lbl">Cards</div></div>
      <div class="stat-box"><div class="stat-val text-green">${st.studied}</div><div class="stat-lbl">Learned</div></div>
      <div class="stat-box"><div class="stat-val ${st.due > 0 ? "text-red" : "text-green"}">${st.due}</div><div class="stat-lbl">Due</div></div>
    </div>
    <button class="btn btn-primary btn-lg mb-16" onclick="startReview(${s.id})" ${st.due === 0 ? 'disabled' : ""}>Study (${st.due})</button>
    <button class="btn btn-ghost btn-sm btn-delete mb-16" onclick="deleteSet(${s.id})">Delete set</button>
    <h2 class="section-title">All Cards (${s.cards.length})</h2>
    <div class="card-list">${s.cards.map(c =>
      `<div class="card-list-item"><strong>${esc(c.term)}</strong> &mdash; ${esc(c.definition)}</div>`
    ).join("")}</div>
  `;
}

async function deleteSet(id) {
  if (!confirm("Delete this set?")) return;
  await fetch(`${API}/api/sets/${id}`, {method: "DELETE"});
  loadHome();
}

/* ---- REVIEW ---- */
async function startReview(setId) {
  S.setId = setId;
  const res = await fetch(`${API}/api/sets/${setId}/review`);
  S.reviewCards = await res.json();
  if (S.reviewCards.length === 0) { alert("No cards due for review!"); return; }
  S.currentIdx = 0; S.showAnswer = false; S.userInput = ""; S.sessionResults = [];
  S.view = "review";
  render();
}

function renderReview(app) {
  if (S.currentIdx >= S.reviewCards.length) { finishReview(); return; }
  const card = S.reviewCards[S.currentIdx];
  const total = S.reviewCards.length;
  const done = S.sessionResults.length;
  const showTerm = S.currentIdx % 2 === 0;

  app.innerHTML = `
    <div class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadSet(${S.setId})">&larr;</button>
      <span class="nav-title">${done + 1} / ${total}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(done/total)*100}%"></div></div>
    ${S.showAnswer ? renderAnswer(card) : renderQuestion(card, showTerm)}
  `;
  if (!S.showAnswer) setTimeout(() => { const i = $("#answer-input"); if (i) i.focus(); }, 150);
}

function renderQuestion(card, showTerm) {
  return `
    <div class="flashcard">
      <div>
        <div class="flashcard-label">${showTerm ? "TERM" : "DEFINITION"}</div>
        <div class="flashcard-content">${esc(showTerm ? card.term : card.definition)}</div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Type the ${showTerm ? "definition" : "term"}</label>
      <input id="answer-input" class="review-input" type="text" placeholder="Your answer..."
        onkeydown="if(event.key==='Enter')revealAnswer()" autocomplete="off">
    </div>
    <button class="btn btn-ghost btn-lg" onclick="revealAnswer()">Show Answer</button>
  `;
}

function renderAnswer(card) {
  const input = S.userInput || $("#answer-input")?.value || "";
  const expected = [card.term.toLowerCase().trim(), card.definition.toLowerCase().trim()];
  const got = input.toLowerCase().trim();
  const correct = expected.some(e => got === e) || expected.some(e => got.includes(e)) || got.includes(expected[0]) || got.includes(expected[1]);

  return `
    <div class="result-card ${correct ? "" : "wrong"}">
      <div class="result-term">${esc(card.term)}</div>
      <div class="result-def">${esc(card.definition)}</div>
      <div class="result-verdict ${correct ? "ok" : "ko"}">
        ${correct ? "&#10003; Correct" : "&#10007; You typed: " + esc(input)}
      </div>
    </div>
    <p class="nav-title mb-16">How well did you know it?</p>
    <div class="quality-grid">
      <button class="quality-btn" data-quality="0" onclick="rate(0)">Forgot</button>
      <button class="quality-btn" data-quality="1" onclick="rate(1)">Hard</button>
      <button class="quality-btn" data-quality="2" onclick="rate(2)">Good</button>
      <button class="quality-btn" data-quality="3" onclick="rate(3)">Easy</button>
    </div>
  `;
}

function revealAnswer() {
  S.userInput = $("#answer-input")?.value || "";
  S.showAnswer = true;
  render();
}

async function rate(quality) {
  const card = S.reviewCards[S.currentIdx];
  S.pendingCard = card;
  S.userQuality = quality;
  S.view = "judge";
  render();
  const input = S.userInput || "";
  try {
    const res = await fetch(`${API}/api/judge`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({term: card.term, definition: card.definition, answer: input || "(blank)"})
    });
    S.judgeResult = await res.json();
  } catch {
    S.judgeResult = null;
  }
  render();
}

function renderJudge(app) {
  const card = S.pendingCard;
  const jr = S.judgeResult;
  const llmOk = jr && !jr.error && jr.quality >= 2;

  app.innerHTML = `
    <div class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadSet(${S.setId})">&larr;</button>
      <span class="nav-title">LLM Judge</span>
    </div>

    <div class="result-card">
      <div class="result-term">${esc(card.term)}</div>
      <div class="result-def">${esc(card.definition)}</div>
    </div>

    <div class="judge-box">
      <div class="judge-box-label">Your Answer</div>
      <div class="judge-box-text">${esc(S.userInput || "(blank)")}</div>
    </div>

    ${jr && !jr.error ? `
      <div class="judge-verdict ${llmOk ? "ok" : "ko"}">
        <div class="judge-verdict-label">LLM Verdict</div>
        <div class="judge-verdict-outcome">${llmOk ? "&#10003; Correct" : "&#10007; Wrong"}</div>
        <div class="judge-reasoning">${esc(jr.reasoning || "")}</div>
      </div>
      <div class="judge-actions">
        <button class="btn btn-primary btn-lg" onclick="acceptJudge(${jr.quality})">Continue as ${llmOk ? "Correct" : "Wrong"}</button>
        <button class="btn btn-ghost-accent btn-lg" onclick="acceptJudge(${llmOk ? 0 : 3})">
          Override &mdash; Mark ${llmOk ? "Wrong" : "Correct"}
        </button>
      </div>
    ` : jr && jr.error ? `
      <div class="judge-verdict ko">
        <div class="judge-verdict-label">Judge Unavailable</div>
        <div class="judge-reasoning">${esc(jr.error)}</div>
      </div>
      <button class="btn btn-primary btn-lg" onclick="acceptJudge(${S.userQuality})">Continue with My Rating</button>
    ` : `
      <div style="text-align:center;padding:20px">
        <div class="spinner"></div>
        <p class="mt-8 text-muted">Judge is evaluating your answer&hellip;</p>
      </div>
    `}
  `;
}

async function acceptJudge(quality) {
  const card = S.pendingCard;
  S.sessionResults.push({card_id: card.id, quality});
  await fetch(`${API}/api/sets/${S.setId}/review`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({card_id: card.id, quality})
  });
  if (quality === 0) S.reviewCards.splice(S.currentIdx, 0, card);
  S.currentIdx++; S.showAnswer = false; S.userInput = "";
  S.view = "review";
  render();
}

function finishReview() { S.view = "results"; render(); }

/* ---- RESULTS ---- */
function renderResults(app) {
  const total = S.sessionResults.length;
  const forgot = S.sessionResults.filter(r => r.quality === 0).length;
  const hard = S.sessionResults.filter(r => r.quality === 1).length;
  const good = S.sessionResults.filter(r => r.quality >= 2).length;
  const score = total > 0 ? Math.round((good/total)*100) : 0;

  app.innerHTML = `
    <div class="results-hero">
      <div class="results-score ${score >= 80 ? "text-green" : score >= 50 ? "text-orange" : "text-red"}">${score}%</div>
      <div class="results-sub">Session complete</div>
    </div>
    <div class="results-grid">
      <div><div class="val text-green">${good}</div><div class="lbl">Known</div></div>
      <div><div class="val text-orange">${hard}</div><div class="lbl">Hard</div></div>
      <div><div class="val text-red">${forgot}</div><div class="lbl">Forgot</div></div>
    </div>
    <div class="results-actions">
      <button class="btn btn-primary btn-lg" onclick="startReview(${S.setId})">Study Again</button>
      <button class="btn btn-ghost btn-lg" onclick="loadSet(${S.setId})">Back to Set</button>
    </div>
  `;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

loadHome();
