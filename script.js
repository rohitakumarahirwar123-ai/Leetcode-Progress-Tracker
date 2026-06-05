const STORAGE_KEY = "leetcode-progress-tracker:v1";

let problems = loadProblems();

const form = document.querySelector("#problemForm");
const titleInput = document.querySelector("#titleInput");
const topicInput = document.querySelector("#topicInput");
const difficultyInput = document.querySelector("#difficultyInput");
const statusInput = document.querySelector("#statusInput");
const dateInput = document.querySelector("#dateInput");
const confidenceInput = document.querySelector("#confidenceInput");
const notesInput = document.querySelector("#notesInput");

dateInput.value = offsetDate(0);
document.querySelector("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "short",
  day: "numeric"
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  problems.unshift({
    id: createId(),
    title: titleInput.value.trim(),
    topic: topicInput.value,
    difficulty: difficultyInput.value,
    status: statusInput.value,
    date: dateInput.value,
    confidence: clampConfidence(confidenceInput.value),
    notes: notesInput.value.trim()
  });

  saveProblems();
  form.reset();
  dateInput.value = offsetDate(0);
  confidenceInput.value = 5;
  render();
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  if (!confirm("Reset all tracked problems?")) return;
  problems = [];
  saveProblems();
  render();
});

function loadProblems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveProblems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
}

function render() {
  renderStats();
  renderDifficulty();
  renderTable();
}

function renderStats() {
  const solved = problems.filter((problem) => problem.status === "Solved");
  const revision = getRevisionProblems();

  document.querySelector("#totalSolved").textContent = solved.length;
  document.querySelector("#totalSubtext").textContent = solved.length
    ? `${uniqueCount(solved.map((problem) => problem.topic))} topics covered`
    : "No solved problems yet";
  document.querySelector("#currentStreak").textContent = getCurrentStreak(solved);
  document.querySelector("#revisionCount").textContent = revision.length;
}

function renderDifficulty() {
  const solved = problems.filter((problem) => problem.status === "Solved");
  const counts = {
    Easy: solved.filter((problem) => problem.difficulty === "Easy").length,
    Medium: solved.filter((problem) => problem.difficulty === "Medium").length,
    Hard: solved.filter((problem) => problem.difficulty === "Hard").length
  };
  const max = Math.max(1, counts.Easy, counts.Medium, counts.Hard);

  setCountAndBar("easy", counts.Easy, max);
  setCountAndBar("medium", counts.Medium, max);
  setCountAndBar("hard", counts.Hard, max);
}

function setCountAndBar(key, count, max) {
  document.querySelector(`#${key}Count`).textContent = count;
  document.querySelector(`#${key}Bar`).style.width = `${(count / max) * 100}%`;
}

function renderTable() {
  const table = document.querySelector("#problemTable");
  const visible = problems;

  if (!visible.length) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="empty-row">No problems added yet.</td>
      </tr>
    `;
    return;
  }

  table.innerHTML = visible
    .map((problem) => `
      <tr>
        <td>
          <span class="problem-title">${escapeHtml(problem.title)}</span>
          ${problem.notes ? `<span class="notes">${escapeHtml(problem.notes)}</span>` : ""}
        </td>
        <td>${escapeHtml(problem.topic)}</td>
        <td><span class="pill ${problem.difficulty.toLowerCase()}">${problem.difficulty}</span></td>
        <td>${problem.status}</td>
        <td>${formatDate(problem.date)}</td>
        <td>${problem.confidence}/10</td>
        <td><button class="delete-btn" type="button" aria-label="Delete ${escapeHtml(problem.title)}" data-id="${problem.id}">x</button></td>
      </tr>
    `)
    .join("");

  table.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", () => {
      problems = problems.filter((problem) => problem.id !== button.dataset.id);
      saveProblems();
      render();
    });
  });
}

function getTopicStats() {
  const grouped = new Map();

  problems.forEach((problem) => {
    const current = grouped.get(problem.topic) ?? {
      topic: problem.topic,
      total: 0,
      solved: 0,
      revisit: 0,
      confidence: 0
    };

    current.total += 1;
    current.confidence += problem.confidence;
    if (problem.status === "Solved") current.solved += 1;
    if (problem.status === "Revisit" || problem.confidence <= 4) current.revisit += 1;
    grouped.set(problem.topic, current);
  });

  return [...grouped.values()].map((topic) => {
    const avgConfidence = topic.confidence / topic.total;
    const score = Math.min(100, Math.round((topic.solved * 18) + (avgConfidence * 10) - (topic.revisit * 10)));
    return {
      ...topic,
      avgConfidence,
      score: Math.max(8, score),
      label: score >= 75 ? "Strong" : score >= 45 ? "Building" : "Needs work"
    };
  });
}

function getRevisionProblems() {
  return problems
    .filter((problem) => {
      const oldSolved = problem.status === "Solved" && daysBetween(problem.date, offsetDate(0)) >= 7;
      return problem.status === "Revisit" || problem.confidence <= 4 || oldSolved;
    })
    .sort((a, b) => a.confidence - b.confidence || new Date(a.date) - new Date(b.date));
}

function getCurrentStreak(solvedProblems) {
  const solvedDates = new Set(solvedProblems.map((problem) => problem.date));
  let streak = 0;
  let cursor = new Date(offsetDate(0));

  while (solvedDates.has(toDateInputValue(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function offsetDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateInputValue(date);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function daysAgo(value) {
  const days = daysBetween(value, offsetDate(0));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function daysBetween(start, end) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.floor((endTime - startTime) / 86400000);
}

function uniqueCount(values) {
  return new Set(values).size;
}

function clampConfidence(value) {
  const confidence = Number(value);
  if (Number.isNaN(confidence)) return 5;
  return Math.min(10, Math.max(1, confidence));
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
