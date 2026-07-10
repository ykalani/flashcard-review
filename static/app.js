const API = "";
let state = { view: "home", sets: [], set: null, cards: [], reviewCards: [], currentIdx: 0, showAnswer: false, userInput: "", sessionResults: [], inputMode: "text" };

function $(s) { return document.querySelector(s); }

function render() {
  const app = $("#app");
  app.innerHTML = "";
  switch (state.view) {
    case "home": renderHome(app); break;
    case "create": renderCreate(app); break;
    case "set": renderSet(app); break;
    case "review": renderReview(app); break;
    case "results": renderResults(app); break;
    case "judge": renderJudge(app); break;
  }
}

async function loadHome() {
  const res = await fetch(`${API}/api/sets`);
  state.sets = await res.json();
  state.view = "home";
  render();
}

async function loadSet(id) {
  const res = await fetch(`${API}/api/sets/${id}`);
  state.set = await res.json();
  state.view = "set";
  render();
}

/* ---- HOME ---- */
function renderHome(app) {
  app.innerHTML = `
    <div class="page-header">
      <h1>Flashcards</h1>
      <button class="btn btn-primary btn-sm" onclick="startCreate()">+ New</button>
    </div>
    ${state.sets.length === 0 ? '<div class="empty-state"><p>No study sets yet.</p><button class="btn btn-primary btn-lg" onclick="startCreate()">Create Your First Set</button></div>' : ""}
    <div id="set-list">
      ${state.sets.map(s => `
        <div class="set-card" onclick="loadSet(${s.id})">
          <div>
            <div class="title">${esc(s.title)}</div>
            <div class="meta">${s.card_count} card${s.card_count !== 1 ? "s" : ""}</div>
          </div>
          <div class="badge">${s.card_count}</div>
        </div>
      `).join("")}
    </div>
  `;
}

/* ---- CREATE ---- */
function startCreate() {
  state.view = "create";
  state.inputMode = "text";
  state.previewCards = null;
  render();
}

function renderCreate(app) {
  app.innerHTML = `
    <nav class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadHome()">&larr;</button>
      <h1 style="margin:0">New Set</h1>
    </nav>

    <div class="tab-bar">
      <button class="tab ${state.inputMode === "text" ? "active" : ""}" onclick="switchInputMode('text')">Paste</button>
      <button class="tab ${state.inputMode === "photo" ? "active" : ""}" onclick="switchInputMode('photo')">Photo</button>
    </div>

    <div id="create-body">${state.inputMode === "text" ? createTextForm() : createPhotoForm()}</div>
  `;
}

function switchInputMode(mode) {
  state.inputMode = mode;
  state.previewCards = null;
  render();
}

function createTextForm() {
  return `
    <div class="form-group">
      <label>Set Title</label>
      <input id="set-title" class="review-input" style="text-align:left" placeholder="e.g. Biology Ch.5">
    </div>
    <div class="form-group">
      <label>Vocabulary</label>
      <textarea id="vocab-input" placeholder="Paste terms here...

photosynthesis | plants convert light
mitosis, cell division
DNA → genetic material"></textarea>
    </div>
    <div class="actions">
      <button class="btn btn-primary btn-lg" onclick="parseText()">Parse & Create</button>
    </div>
    <div id="preview"></div>
  `;
}

function createPhotoForm() {
  return `
    <input type="file" id="camera-input" accept="image/*" capture="environment" style="display:none" onchange="onImageSelected(event)">
    <input type="file" id="gallery-input" accept="image/*" style="display:none" onchange="onImageSelected(event)">
    <div class="photo-method">
      <div class="photo-btn" onclick="$('#camera-input').click()">
        <div class="icon">&#x1F4F7;</div>
        <div>Take Photo</div>
      </div>
      <div class="photo-btn" onclick="$('#gallery-input').click()">
        <div class="icon">&#x1F5BC;</div>
        <div>Choose from Gallery</div>
      </div>
    </div>
    <img id="photo-preview" class="photo-preview" style="display:none">
    <div id="photo-status" style="text-align:center;padding:12px;color:var(--text2);font-size:0.9rem"></div>
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
    img.style.display = "block";
  };
  reader.readAsDataURL(file);
  $("#photo-status").innerHTML = '<div class="spinner"></div><p style="margin-top:12px">Scanning image with AI...</p>';
  const formData = new FormData();
  formData.append("image", file);
  fetch(`${API}/api/parse-image`, { method: "POST", body: formData })
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      const cards = data.cards;
      if (!cards || cards.length === 0) throw new Error("No flashcards found");
      state.previewCards = cards;
      showPreview();
    })
    .catch(e => {
      $("#photo-status").innerHTML = `<p style="color:var(--wrong)">Error: ${e.message}</p>`;
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
    state.previewCards = data.cards;
    state.previewTitle = title;
    showPreview();
  } catch (e) {
    alert(e.message);
  }
  btn.disabled = false; btn.textContent = "Parse & Create";
}

function showPreview() {
  const cards = state.previewCards;
  const el = $("#preview") || $("#photo-status").parentElement.querySelector("#preview");
  if (!el) return;
  el.innerHTML = `
    <div class="or-divider"><span>${cards.length} cards extracted</span></div>
    <div style="max-height:280px;overflow-y:auto;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);padding:12px">
      ${cards.slice(0, 20).map(c => `
        <div class="card-list-item"><strong>${esc(c.term)}</strong> &mdash; ${esc(c.definition)}</div>
      `).join("")}
      ${cards.length > 20 ? `<div style="padding:8px;text-align:center;color:var(--text2);font-size:0.85rem">+ ${cards.length - 20} more</div>` : ""}
    </div>
    <div class="form-group">
      <label>Set Title</label>
      <input id="preview-title" class="review-input" style="text-align:left" value="${esc(state.previewTitle || "Untitled Set")}">
    </div>
    <button class="btn btn-primary btn-lg" onclick="savePreviewSet()">Save Set</button>
  `;
  el.scrollIntoView({ behavior: "smooth" });
}

async function savePreviewSet() {
  const cards = state.previewCards;
  const title = $("#preview-title").value.trim() || "Untitled Set";
  const res = await fetch(`${API}/api/sets`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({title, source: "ai"})
  });
  const {id} = await res.json();
  await fetch(`${API}/api/sets/${id}/cards`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({cards})
  });
  loadSet(id);
}

/* ---- SET VIEW ---- */
function renderSet(app) {
  const s = state.set;
  const st = s.stats || {total: 0, studied: 0, due: 0};
  app.innerHTML = `
    <nav class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadHome()">&larr;</button>
      <h1 style="margin:0;font-size:1.2rem">${esc(s.title)}</h1>
    </nav>
    <div style="display:flex;gap:12px;margin-bottom:20px">
      <button class="btn btn-primary btn-lg" onclick="startReview(${s.id})" ${st.due === 0 ? 'disabled style="opacity:0.5"' : ""}>Study (${st.due})</button>
    </div>
    <div class="results-grid">
      <div><div class="val" style="color:var(--text2)">${st.total}</div><div class="lbl">Cards</div></div>
      <div><div class="val" style="color:var(--correct)">${st.studied}</div><div class="lbl">Learned</div></div>
      <div><div class="val" style="color:${st.due > 0 ? "var(--wrong)" : "var(--correct)"}">${st.due}</div><div class="lbl">Due</div></div>
    </div>
    <div style="margin-bottom:12px;display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="deleteSet(${s.id})" style="flex:0">Delete</button>
    </div>
    <h2>All Cards (${s.cards.length})</h2>
    <div>${s.cards.map(c =>
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
  state.setId = setId;
  const res = await fetch(`${API}/api/sets/${setId}/review`);
  state.reviewCards = await res.json();
  if (state.reviewCards.length === 0) { alert("No cards due for review!"); return; }
  state.currentIdx = 0; state.showAnswer = false; state.userInput = ""; state.sessionResults = [];
  state.view = "review";
  render();
}

function renderReview(app) {
  if (state.currentIdx >= state.reviewCards.length) { finishReview(); return; }
  const card = state.reviewCards[state.currentIdx];
  const total = state.reviewCards.length;
  const done = state.sessionResults.length;
  const showTerm = state.currentIdx % 2 === 0;

  app.innerHTML = `
    <nav class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadSet(${state.setId})">&larr;</button>
      <div style="flex:1;text-align:center;font-size:0.85rem;color:var(--text2)">${done + 1} / ${total}</div>
    </nav>
    <div class="progress-bar"><div class="fill" style="width:${(done/total)*100}%"></div></div>
    ${state.showAnswer ? renderAnswer(card) : renderQuestion(card, showTerm)}
  `;
  if (!state.showAnswer) setTimeout(() => { const i = $("#answer-input"); if (i) i.focus(); }, 150);
}

function renderQuestion(card, showTerm) {
  return `
    <div class="flashcard">
      <div>
        <div class="label">${showTerm ? "TERM" : "DEFINITION"}</div>
        <div>${esc(showTerm ? card.term : card.definition)}</div>
      </div>
    </div>
    <div class="form-group">
      <label>Type the ${showTerm ? "definition" : "term"}</label>
      <input id="answer-input" class="review-input" type="text" placeholder="Your answer..."
        onkeydown="if(event.key==='Enter')revealAnswer()" autocomplete="off">
    </div>
    <button class="btn btn-ghost btn-lg" onclick="revealAnswer()">Show Answer</button>
  `;
}

function renderAnswer(card) {
  const input = state.userInput || $("#answer-input")?.value || "";
  const expected = [card.term.toLowerCase().trim(), card.definition.toLowerCase().trim()];
  const got = input.toLowerCase().trim();
  const correct = expected.some(e => got === e) || expected.some(e => got.includes(e)) || got.includes(expected[0]) || got.includes(expected[1]);

  return `
    <div class="result-box ${correct ? "correct" : "wrong"}">
      <div class="term">${esc(card.term)}</div>
      <div class="def">${esc(card.definition)}</div>
      <div style="margin-top:10px;font-weight:600;font-size:0.9rem;color:${correct ? "var(--correct)" : "var(--wrong)"}">
        ${correct ? "&#10003; Correct" : "&#10007; You typed: " + esc(input)}
      </div>
    </div>
    <p style="text-align:center;color:var(--text2);margin-bottom:12px;font-size:0.9rem">How well did you know it?</p>
    <div class="quality-buttons">
      <button class="btn btn-ghost" onclick="rate(0)" style="border-color:#ef4444;color:#ef4444">Forgot</button>
      <button class="btn btn-ghost" onclick="rate(1)" style="border-color:#f97316;color:#f97316">Hard</button>
      <button class="btn btn-ghost" onclick="rate(2)" style="border-color:#22c55e;color:#22c55e">Good</button>
      <button class="btn btn-ghost" onclick="rate(3)" style="border-color:#3b82f6;color:#3b82f6">Easy</button>
    </div>
  `;
}

function revealAnswer() {
  state.userInput = $("#answer-input")?.value || "";
  state.showAnswer = true;
  render();
}

async function rate(quality) {
  const card = state.reviewCards[state.currentIdx];
  state.pendingCard = card;
  state.userQuality = quality;

  state.view = "judge";
  render();

  const input = state.userInput || "";
  try {
    const res = await fetch(`${API}/api/judge`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({term: card.term, definition: card.definition, answer: input || "(blank)"})
    });
    state.judgeResult = await res.json();
  } catch {
    state.judgeResult = null;
  }
  render();
}

function renderJudge(app) {
  const card = state.pendingCard;
  const jr = state.judgeResult;
  const llmCorrect = jr && !jr.error && jr.quality >= 2;

  app.innerHTML = `
    <nav class="nav-top">
      <button class="btn btn-ghost btn-icon" onclick="loadSet(${state.setId})">&larr;</button>
      <div style="flex:1;text-align:center;font-size:0.85rem;color:var(--text2)">LLM Judge</div>
    </nav>

    <div class="result-box correct">
      <div class="term">${esc(card.term)}</div>
      <div class="def">${esc(card.definition)}</div>
    </div>

    <div style="margin-bottom:16px;padding:12px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">
      <div style="font-size:0.75rem;color:var(--text2);margin-bottom:4px;font-weight:600">YOUR ANSWER</div>
      <div>${esc(state.userInput || "(blank)")}</div>
    </div>

    ${jr && !jr.error ? `
      <div class="judge-verdict" style="margin-bottom:16px;padding:16px;background:var(--surface);border-radius:var(--radius);border:2px solid ${llmCorrect ? "var(--correct)" : "var(--wrong)"}">
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:6px;font-weight:600">LLM VERDICT</div>
        <div style="font-size:1.2rem;font-weight:700;margin-bottom:8px;color:${llmCorrect ? "var(--correct)" : "var(--wrong)"}">
          ${llmCorrect ? "&#10003; Correct" : "&#10007; Wrong"}
        </div>
        <div style="color:var(--text2);font-size:0.9rem;line-height:1.5">${esc(jr.reasoning || "")}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary btn-lg" onclick="acceptJudge(${jr.quality})">Continue (${llmCorrect ? "Correct" : "Wrong"})</button>
        <button class="btn btn-ghost btn-lg" onclick="acceptJudge(${llmCorrect ? 0 : 3})" style="border-color:${llmCorrect ? "var(--wrong)" : "var(--correct)"};color:${llmCorrect ? "var(--wrong)" : "var(--correct)"}">
          Mark as ${llmCorrect ? "Wrong" : "Correct"}
        </button>
      </div>
    ` : jr && jr.error ? `
      <div class="judge-verdict" style="margin-bottom:16px;padding:16px;background:var(--surface);border-radius:var(--radius);border:2px solid var(--wrong)">
        <div style="font-size:0.75rem;color:var(--text2);margin-bottom:6px;font-weight:600">JUDGE UNAVAILABLE</div>
        <div style="color:var(--wrong);font-size:0.9rem">${esc(jr.error)}</div>
      </div>
      <button class="btn btn-primary btn-lg" onclick="acceptJudge(${state.userQuality})">Continue with My Rating</button>
    ` : `
      <div style="text-align:center;padding:20px">
        <div class="spinner"></div>
        <p style="margin-top:12px;color:var(--text2)">LLM is judging your answer...</p>
      </div>
    `}
  `;
}

async function acceptJudge(quality) {
  const card = state.pendingCard;
  state.sessionResults.push({card_id: card.id, quality});
  await fetch(`${API}/api/sets/${state.setId}/review`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({card_id: card.id, quality})
  });
  if (quality === 0) state.reviewCards.splice(state.currentIdx, 0, card);
  state.currentIdx++; state.showAnswer = false; state.userInput = "";
  state.view = "review";
  render();
}

function finishReview() { state.view = "results"; render(); }

/* ---- RESULTS ---- */
function renderResults(app) {
  const total = state.sessionResults.length, forgot = state.sessionResults.filter(r => r.quality === 0).length;
  const hard = state.sessionResults.filter(r => r.quality === 1).length;
  const good = state.sessionResults.filter(r => r.quality >= 2).length;
  const score = total > 0 ? Math.round((good/total)*100) : 0;

  app.innerHTML = `
    <div class="results-summary">
      <div class="big-num" style="color:${score >= 80 ? "var(--correct)" : score >= 50 ? "#f97316" : "var(--wrong)"}">${score}%</div>
      <div class="sub">Session complete</div>
    </div>
    <div class="results-grid">
      <div><div class="val" style="color:var(--correct)">${good}</div><div class="lbl">Known</div></div>
      <div><div class="val" style="color:#f97316">${hard}</div><div class="lbl">Hard</div></div>
      <div><div class="val" style="color:var(--wrong)">${forgot}</div><div class="lbl">Forgot</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-primary btn-lg" onclick="startReview(${state.setId})">Study Again</button>
      <button class="btn btn-ghost btn-lg" onclick="loadSet(${state.setId})">Back to Set</button>
    </div>
  `;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

loadHome();