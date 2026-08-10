import {
  getState,
  getActiveSession,
  startSession,
  pauseActiveSession,
  resumeActiveSession,
  stopActiveSession,
  adjustActiveDuration,
  checkAndCompleteActiveSession,
  addManualSession,
  updateSessionRecord,
  deleteSessionRecord,
} from "./storage.js";
import { computeRemainingSeconds, formatMMSS, formatDurationHuman, sessionDurationSeconds } from "./timer.js";
import {
  getSyncConfig,
  enableSync,
  disableSync,
  regenerateToken,
  generateSyncToken,
  runSync,
} from "./sync.js";

let state = null;
let syncConfig = null;
let editingId = null;

const STATUS_LABELS = {
  completed: "Completed",
  stopped: "Stopped early",
  manual: "Manual entry",
  active: "Active",
  paused: "Paused",
};

async function refreshAndRender() {
  state = await getState();
  syncConfig = await getSyncConfig();
  render();
  // Fire-and-forget: pushes whatever local mutation just happened. Any
  // pulled/merged changes surface on the next render trigger rather than
  // re-rendering here, so this can't chain into itself indefinitely.
  if (syncConfig.enabled) runSync();
}

function render() {
  renderCurrentSection();
  renderHistory();
  renderSync();
}

// ---------- Current session (start form or active timer) ----------

function renderCurrentSection() {
  const container = document.getElementById("current-section");
  container.innerHTML = "";
  const session = getActiveSession(state);
  container.appendChild(session ? buildActiveCard(session) : buildStartForm());
}

function buildStartForm() {
  const form = document.createElement("form");
  form.className = "card";
  form.innerHTML = `
    <h2>Start a pomodoro</h2>
    <label>Title
      <input type="text" id="start-title" required maxlength="120" placeholder="What are you working on?">
    </label>
    <label>Description
      <textarea id="start-description" rows="2" maxlength="500" placeholder="Optional details"></textarea>
    </label>
    <label>Duration (minutes)
      <input type="number" id="start-duration" min="1" max="180" value="${state.settings.defaultDurationMinutes}">
    </label>
    <div class="form-actions"><button type="submit" class="primary">Start</button></div>
    <p class="error hidden" id="start-error"></p>
  `;
  form.addEventListener("submit", onStartSubmit);
  return form;
}

async function onStartSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("start-title").value.trim();
  const description = document.getElementById("start-description").value.trim();
  const duration = Number(document.getElementById("start-duration").value);
  const errorEl = document.getElementById("start-error");
  errorEl.classList.add("hidden");

  if (!title) {
    return showError(errorEl, "Title is required.");
  }
  if (!duration || duration <= 0) {
    return showError(errorEl, "Duration must be a positive number.");
  }

  try {
    await startSession({ title, description, plannedDurationMinutes: duration });
    await refreshAndRender();
  } catch (err) {
    showError(errorEl, err.message);
  }
}

function buildActiveCard(session) {
  const card = document.createElement("div");
  card.className = "card timer-card";
  const remaining = computeRemainingSeconds(session);
  const isPaused = session.status === "paused";

  card.innerHTML = `
    <span class="status-pill ${isPaused ? "paused" : ""}">${STATUS_LABELS[session.status]}</span>
    <div class="timer-title"></div>
    <div class="timer-description"></div>
    <div class="countdown" id="countdown">${formatMMSS(remaining)}</div>
    <div class="timer-controls">
      <button id="toggle-pause-btn">${isPaused ? "Resume" : "Pause"}</button>
      <button id="stop-btn">Stop</button>
    </div>
    <div class="adjust-row">
      Total minutes:
      <input type="number" id="adjust-duration" min="1" max="180" value="${session.plannedDurationMinutes}">
      <button id="adjust-apply">Apply</button>
    </div>
  `;

  card.querySelector(".timer-title").textContent = session.title;
  const descEl = card.querySelector(".timer-description");
  if (session.description) {
    descEl.textContent = session.description;
  } else {
    descEl.remove();
  }

  card.querySelector("#toggle-pause-btn").addEventListener("click", async () => {
    if (isPaused) {
      await resumeActiveSession();
    } else {
      await pauseActiveSession();
    }
    await refreshAndRender();
  });

  card.querySelector("#stop-btn").addEventListener("click", async () => {
    if (confirm("Stop this pomodoro now?")) {
      await stopActiveSession();
      await refreshAndRender();
    }
  });

  card.querySelector("#adjust-apply").addEventListener("click", async () => {
    const value = Number(card.querySelector("#adjust-duration").value);
    if (value > 0) {
      await adjustActiveDuration(value);
      await refreshAndRender();
    }
  });

  return card;
}

// ---------- Live countdown tick (recomputes from timestamps, no drift) ----------

async function tick() {
  if (!state) return;
  const session = getActiveSession(state);
  if (!session || session.status !== "active") return;

  const remaining = computeRemainingSeconds(session);
  const el = document.getElementById("countdown");
  if (el) el.textContent = formatMMSS(remaining);

  if (remaining <= 0) {
    state = await checkAndCompleteActiveSession();
    render();
  }
}

// ---------- Manual log / edit form ----------

function toLocalInputValue(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resetManualForm() {
  editingId = null;
  document.getElementById("manual-form").reset();
  document.getElementById("manual-error").classList.add("hidden");
  document.getElementById("manual-form").querySelector("h2").textContent = "Log a past session";
}

function openEditForm(session) {
  editingId = session.id;
  document.getElementById("manual-title").value = session.title;
  document.getElementById("manual-description").value = session.description || "";
  document.getElementById("manual-start").value = toLocalInputValue(session.startTime);
  document.getElementById("manual-end").value = toLocalInputValue(session.endTime);
  document.getElementById("manual-form").querySelector("h2").textContent = "Edit session";
  document.getElementById("manual-form").classList.remove("hidden");
  document.getElementById("manual-form").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function onManualSubmit(e) {
  e.preventDefault();
  const title = document.getElementById("manual-title").value.trim();
  const description = document.getElementById("manual-description").value.trim();
  const startVal = document.getElementById("manual-start").value;
  const endVal = document.getElementById("manual-end").value;
  const errorEl = document.getElementById("manual-error");
  errorEl.classList.add("hidden");

  if (!title || !startVal || !endVal) {
    return showError(errorEl, "Title, start, and end are all required.");
  }
  const start = new Date(startVal);
  const end = new Date(endVal);
  if (end <= start) {
    return showError(errorEl, "End time must be after start time.");
  }

  if (editingId) {
    await updateSessionRecord(editingId, {
      title,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      plannedDurationMinutes: Math.round((end - start) / 60000),
    });
  } else {
    await addManualSession({
      title,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
  }

  resetManualForm();
  document.getElementById("manual-form").classList.add("hidden");
  await refreshAndRender();
}

// ---------- History list ----------

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderHistory() {
  const list = document.getElementById("history-list");
  list.innerHTML = "";
  const entries = state.sessions.filter((s) => s.id !== state.activeSessionId && !s.deletedAt);
  document.getElementById("history-empty").classList.toggle("hidden", entries.length > 0);
  for (const session of entries) {
    list.appendChild(buildHistoryItem(session));
  }
}

function buildHistoryItem(session) {
  const li = document.createElement("li");
  li.className = "history-item";
  li.innerHTML = `
    <div class="history-item-top">
      <span class="history-item-title"></span>
      <span class="badge">${STATUS_LABELS[session.status] || session.status}</span>
    </div>
    <div class="history-item-meta">
      ${formatDurationHuman(sessionDurationSeconds(session))} · ${formatDateTime(session.startTime)}${
    session.endTime ? " – " + formatDateTime(session.endTime) : ""
  }
    </div>
    <div class="history-item-description"></div>
    <div class="history-item-actions">
      <button data-role="edit">Edit</button>
      <button data-role="delete" class="danger">Delete</button>
    </div>
  `;

  li.querySelector(".history-item-title").textContent = session.title;
  const descEl = li.querySelector(".history-item-description");
  if (session.description) {
    descEl.textContent = session.description;
  } else {
    descEl.remove();
  }

  li.querySelector('[data-role="edit"]').addEventListener("click", () => openEditForm(session));
  li.querySelector('[data-role="delete"]').addEventListener("click", async () => {
    if (confirm(`Delete "${session.title}"? This can't be undone.`)) {
      await deleteSessionRecord(session.id);
      await refreshAndRender();
    }
  });

  return li;
}

// ---------- Sync settings ----------

function renderSync() {
  const container = document.getElementById("sync-content");
  container.innerHTML = "";
  container.appendChild(syncConfig.enabled ? buildSyncEnabledCard() : buildSyncSetupCard());
}

function buildSyncSetupCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <p class="sync-meta">Link this device to another one: generate a code here and
    paste it into the other device, or paste a code you already generated
    elsewhere. Both devices need the same backend URL.</p>
    <label>Backend URL
      <input type="text" id="sync-url" placeholder="https://your-backend.example.com" value="${
        syncConfig.baseUrl || ""
      }">
    </label>
    <label>Sync code
      <div class="sync-code-row">
        <input type="text" id="sync-code" placeholder="Paste a code, or generate a new one">
        <button type="button" id="sync-generate">Generate</button>
      </div>
    </label>
    <div class="form-actions"><button type="button" id="sync-enable" class="primary">Enable sync</button></div>
    <p class="error hidden" id="sync-error"></p>
  `;

  card.querySelector("#sync-generate").addEventListener("click", () => {
    card.querySelector("#sync-code").value = generateSyncToken();
  });

  card.querySelector("#sync-enable").addEventListener("click", async () => {
    const baseUrl = card.querySelector("#sync-url").value.trim();
    const token = card.querySelector("#sync-code").value.trim();
    const errorEl = card.querySelector("#sync-error");
    errorEl.classList.add("hidden");
    if (!baseUrl || !token) {
      return showError(errorEl, "Backend URL and sync code are both required.");
    }
    try {
      await enableSync({ baseUrl, token });
      await refreshAndRender();
    } catch (err) {
      showError(errorEl, err.message);
    }
  });

  return card;
}

function buildSyncEnabledCard() {
  const card = document.createElement("div");
  card.className = "card";
  const lastSynced = syncConfig.lastSyncedAt ? formatDateTime(syncConfig.lastSyncedAt) : "Never";
  card.innerHTML = `
    <p class="sync-meta">${syncConfig.baseUrl}</p>
    <div class="sync-code-row">
      <input type="text" id="sync-code-display" value="${syncConfig.token}" readonly>
      <button type="button" id="sync-copy">Copy</button>
    </div>
    <p class="sync-meta">Last synced: ${lastSynced}</p>
    <div class="form-actions">
      <button type="button" id="sync-now">Sync now</button>
      <button type="button" id="sync-regenerate">Regenerate code</button>
      <button type="button" id="sync-disable" class="danger">Disable</button>
    </div>
  `;

  card.querySelector("#sync-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(syncConfig.token);
  });

  card.querySelector("#sync-now").addEventListener("click", async () => {
    await runSync();
    await refreshAndRender();
  });

  card.querySelector("#sync-regenerate").addEventListener("click", async () => {
    if (
      confirm(
        "Regenerate the sync code? The other device will need to be re-linked with the new code."
      )
    ) {
      await regenerateToken();
      await refreshAndRender();
    }
  });

  card.querySelector("#sync-disable").addEventListener("click", async () => {
    await disableSync();
    await refreshAndRender();
  });

  return card;
}

// ---------- Wiring & init ----------

function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

function wireStaticListeners() {
  document.getElementById("toggle-manual-form").addEventListener("click", () => {
    const form = document.getElementById("manual-form");
    const willShow = form.classList.contains("hidden");
    resetManualForm();
    form.classList.toggle("hidden", !willShow);
  });

  document.getElementById("manual-form").addEventListener("submit", onManualSubmit);

  document.getElementById("manual-cancel").addEventListener("click", () => {
    resetManualForm();
    document.getElementById("manual-form").classList.add("hidden");
  });
}

async function init() {
  await checkAndCompleteActiveSession();
  state = await getState();
  syncConfig = await getSyncConfig();
  render();
  wireStaticListeners();
  setInterval(tick, 1000);

  // One explicit pull+merge on open, so a session logged on the other
  // device shows up right away rather than waiting for the next mutation.
  if (syncConfig.enabled) {
    await runSync();
    await refreshAndRender();
  }
}

document.addEventListener("DOMContentLoaded", init);
