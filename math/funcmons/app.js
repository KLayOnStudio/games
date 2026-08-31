// FuncMons - game logic.
// Screens: #setup-screen -> #game-screen -> #win-screen

const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const winScreen = document.getElementById("win-screen");
const round2Screen = document.getElementById("round2-screen");
const battleResultScreen = document.getElementById("battle-result-screen");

const guestToggle = document.getElementById("guest-toggle");
const nonGuestFields = document.getElementById("non-guest-fields");
const schoolYearSelect = document.getElementById("school-year-select");
const campusSelect = document.getElementById("campus-select");
const classSelect = document.getElementById("class-select");
const weekSelect = document.getElementById("week-select");
const studentIdInput = document.getElementById("student-id");
const pairCountOptions = document.getElementById("pair-count-options");
const startBtn = document.getElementById("start-btn");
const startHint = document.getElementById("start-hint");

const battleToggle = document.getElementById("battle-toggle");
const recordFields = document.getElementById("record-fields");
const studentIdField = document.getElementById("student-id-field");
const battleFields = document.getElementById("battle-fields");
const battleP1NameInput = document.getElementById("battle-p1-name");
const battleP2NameInput = document.getElementById("battle-p2-name");
const battleP1ColorInput = document.getElementById("battle-p1-color");
const battleP2ColorInput = document.getElementById("battle-p2-color");

let selectedPairCount = null;

function populateSelect(select, options) {
  select.innerHTML = [`<option value="" disabled selected>Select...</option>`]
    .concat(options.map((opt) => `<option value="${opt}">${opt}</option>`))
    .join("");
}

populateSelect(schoolYearSelect, SCHOOL_YEARS);
populateSelect(campusSelect, CAMPUSES);
populateSelect(classSelect, CLASSES);

// The Week dropdown depends on which class is selected (each class has its
// own weekly curriculum, see curriculum.js) and defaults to today's
// auto-detected week — but can be overridden to study ahead or review.
function populateWeekOptions(className) {
  if (!className) {
    weekSelect.innerHTML = `<option value="" disabled selected>Select a class first</option>`;
    weekSelect.disabled = true;
    return;
  }

  const weeks = getAvailableWeeks(className);
  if (weeks.length === 0) {
    weekSelect.innerHTML = `<option value="" disabled selected>No content yet</option>`;
    weekSelect.disabled = true;
    return;
  }

  weekSelect.disabled = false;
  weekSelect.innerHTML = weeks.map((w) => `<option value="${w}">Week ${w}</option>`).join("");
  weekSelect.value = String(getCurrentWeekNumber(className));
}

// A persistent per-browser identity for guest/tester play, generated once
// so repeat guest sessions on the same device still build up the
// repetition bonus and show progress on the leaderboard.
const GUEST_ID_KEY = "funcmons.guestId";

function generateGuestId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `Guest-${suffix}`;
}

function getGuestId() {
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = generateGuestId();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch (err) {
    console.warn("Could not access localStorage for guest ID", err);
    return generateGuestId();
  }
}

// Guests skip every field except pair count: School Year/Campus/Class/Week
// all get hidden and auto-filled (Class -> GUEST_CLASS, which has its own
// curriculum.js entry, since content generation still needs some class to
// key off of even though nobody picked one).
function applyGuestMode(isGuest) {
  nonGuestFields.classList.toggle("hidden", isGuest);

  if (isGuest) {
    populateWeekOptions(GUEST_CLASS);
    studentIdInput.value = getGuestId();
  } else {
    populateWeekOptions(classSelect.value);
    if (studentIdInput.value === getGuestId()) studentIdInput.value = "";
  }
}

// Battle Mode (2 players, 1 shared device) keeps Class/Week — still needed
// to generate content — but drops School Year/Campus/Student ID entirely,
// since nothing about a battle gets recorded to any leaderboard. Not
// persisted across page loads (unlike the other setup fields) — a shared
// classroom device shouldn't default back into Battle Mode for the next
// solo student who picks it up.
function applyBattleMode(isBattle) {
  recordFields.classList.toggle("hidden", isBattle);
  studentIdField.classList.toggle("hidden", isBattle);
  battleFields.classList.toggle("hidden", !isBattle);
}

// Remember the last-used setup fields on this browser/device so returning
// students don't have to re-enter everything. On a shared computer this
// will also pre-fill the previous student's info; typing/reselecting
// simply overwrites it.
const SETUP_CACHE_KEY = "funcmons.setup.v1";

function loadSetupCache() {
  try {
    const raw = localStorage.getItem(SETUP_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Could not read cached setup fields", err);
    return {};
  }
}

function saveSetupCache() {
  try {
    localStorage.setItem(
      SETUP_CACHE_KEY,
      JSON.stringify({
        isGuest: guestToggle.checked,
        schoolYear: schoolYearSelect.value,
        campus: campusSelect.value,
        className: classSelect.value,
        studentId: studentIdInput.value.trim(),
        pairCount: selectedPairCount,
      })
    );
  } catch (err) {
    console.warn("Could not cache setup fields", err);
  }
}

const cachedSetup = loadSetupCache();

// Tracks the last Student ID this device actually started a game with, so
// a Start click with a DIFFERENT id can be flagged as a likely typo before
// it silently creates a brand-new, disconnected leaderboard identity. Only
// meaningful for non-guests, who type their own id (guests get one
// auto-generated). Starts from whatever was cached at page load; updated
// after each confirmed Start so it stays current within this session too.
let lastConfirmedStudentId = cachedSetup.studentId || "";

if (cachedSetup.isGuest) guestToggle.checked = true;
if (SCHOOL_YEARS.includes(cachedSetup.schoolYear)) schoolYearSelect.value = cachedSetup.schoolYear;
if (CAMPUSES.includes(cachedSetup.campus)) campusSelect.value = cachedSetup.campus;
if (CLASSES.includes(cachedSetup.className)) classSelect.value = cachedSetup.className;
if (cachedSetup.studentId) studentIdInput.value = cachedSetup.studentId;
if (cachedSetup.pairCount) {
  const pill = pairCountOptions.querySelector(`.pill[data-pairs="${cachedSetup.pairCount}"]`);
  if (pill) {
    pill.classList.add("selected");
    selectedPairCount = cachedSetup.pairCount;
  }
}
applyGuestMode(guestToggle.checked);
applyBattleMode(false); // never persisted, always starts off

// Guest mode and Battle Mode don't compose (a "guest" doesn't mean anything
// once there are two players sharing the device) — turning one on turns
// the other off.
guestToggle.addEventListener("change", () => {
  if (guestToggle.checked && battleToggle.checked) {
    battleToggle.checked = false;
    applyBattleMode(false);
  }
  applyGuestMode(guestToggle.checked);
  updateStartButton();
  saveSetupCache();
});

battleToggle.addEventListener("change", () => {
  if (battleToggle.checked && guestToggle.checked) {
    guestToggle.checked = false;
    applyGuestMode(false);
    saveSetupCache();
  }
  applyBattleMode(battleToggle.checked);
  updateStartButton();
});

[schoolYearSelect, campusSelect].forEach((select) => {
  select.addEventListener("change", () => {
    updateStartButton();
    saveSetupCache();
  });
});

classSelect.addEventListener("change", () => {
  populateWeekOptions(classSelect.value);
  updateStartButton();
  saveSetupCache();
});

weekSelect.addEventListener("change", updateStartButton);

const cardGrid = document.getElementById("card-grid");
const gameHeaderEl = document.getElementById("game-header");
const hudPlayer = document.getElementById("hud-player");
const hudMoves = document.getElementById("hud-moves");
const hudTime = document.getElementById("hud-time");
const hudTurn = document.getElementById("hud-turn");
const hudP1Label = document.getElementById("hud-p1-label");
const hudP1Matches = document.getElementById("hud-p1-matches");
const hudP2Label = document.getElementById("hud-p2-label");
const hudP2Matches = document.getElementById("hud-p2-matches");
const quitBtn = document.getElementById("quit-btn");
const itemCardEl = document.getElementById("item-card");
const ruleCardEl = document.getElementById("rule-card");

const battleResultTitle = document.getElementById("battle-result-title");
const battleResultSummary = document.getElementById("battle-result-summary");
const battleRound2Btn = document.getElementById("battle-round2-btn");
const battleAgainBtn = document.getElementById("battle-again-btn");
const battleBackBtn = document.getElementById("battle-back-btn");

const winSummary = document.getElementById("win-summary");
const leaderboardBody = document.getElementById("leaderboard-body");
const round2Btn = document.getElementById("round2-btn");
const playAgainBtn = document.getElementById("play-again-btn");
const changeSettingsBtn = document.getElementById("change-settings-btn");

const r2Play = document.getElementById("r2-play");
const r2Complete = document.getElementById("r2-complete");
const round2HeaderEl = document.getElementById("round2-header");
const r2HudPlayer = document.getElementById("r2-hud-player");
const r2HudSolved = document.getElementById("r2-hud-solved");
const r2HudMistakes = document.getElementById("r2-hud-mistakes");
const r2HudTurn = document.getElementById("r2-hud-turn");
const r2HudP1Label = document.getElementById("r2-hud-p1-label");
const r2HudP1Solved = document.getElementById("r2-hud-p1-solved");
const r2HudP2Label = document.getElementById("r2-hud-p2-label");
const r2HudP2Solved = document.getElementById("r2-hud-p2-solved");
const r2HudTime = document.getElementById("r2-hud-time");
const r2ProgressFill = document.getElementById("r2-progress-fill");
const r2QuitBtn = document.getElementById("r2-quit-btn");
const r2InstructionsNotation = document.getElementById("r2-instructions-notation");
const r2Equals = document.getElementById("r2-equals");
const r2Sides = document.querySelectorAll(".r2-side");
const r2Summary = document.getElementById("r2-summary");
const r2BackBtn = document.getElementById("r2-back-btn");

let state = null; // set by startGame()
let r2State = null; // set by startRound2()
let timerInterval = null;
let r2TimerInterval = null;

function showScreen(screen) {
  [setupScreen, gameScreen, winScreen, round2Screen, battleResultScreen].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
  // Refresh the hint so a stale message from a prior Start attempt (e.g. an
  // id-conflict note) doesn't linger once the student's back on this screen.
  if (screen === setupScreen) updateStartButton();
}

// ---------- Setup screen ----------

pairCountOptions.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill");
  if (!btn) return;
  [...pairCountOptions.children].forEach((c) => c.classList.remove("selected"));
  btn.classList.add("selected");
  selectedPairCount = Number(btn.dataset.pairs);
  updateStartButton();
  saveSetupCache();
});

studentIdInput.addEventListener("input", () => {
  updateStartButton();
  saveSetupCache();
});

function updateStartButton() {
  // Class/Week/pair-count are hard requirements — without them there's no
  // content to generate at all. Guests get Class filled in automatically
  // (GUEST_CLASS), so that check only applies to non-guests.
  const hardRequirementsMissing = [];
  if (!guestToggle.checked && !classSelect.value) hardRequirementsMissing.push("Class");
  if (!weekSelect.value) hardRequirementsMissing.push("Week");
  if (!selectedPairCount) hardRequirementsMissing.push("Number of pairs");

  startBtn.disabled = hardRequirementsMissing.length > 0;

  if (hardRequirementsMissing.length) {
    startHint.textContent = `Still needed: ${hardRequirementsMissing.join(", ")}`;
    return;
  }

  if (battleToggle.checked) {
    startHint.textContent = "Battle Mode — 2 players, 1 device. Not recorded to any leaderboard.";
    return;
  }

  // School Year/Campus/Student ID are only needed for the result to count
  // toward the student's record — the game is still playable without them.
  const missingForRecord = [];
  if (!guestToggle.checked) {
    if (!schoolYearSelect.value) missingForRecord.push("School Year");
    if (!campusSelect.value) missingForRecord.push("Campus");
  }
  if (!studentIdInput.value.trim()) missingForRecord.push("Student ID");

  startHint.textContent = missingForRecord.length
    ? `Playing without: ${missingForRecord.join(", ")} — this game won't count toward your record.`
    : "";
}

updateStartButton();

startBtn.addEventListener("click", async () => {
  const className = guestToggle.checked ? GUEST_CLASS : classSelect.value;

  // Battle Mode skips student-id/claim handling entirely — there's no
  // single student to identify and nothing gets recorded.
  if (battleToggle.checked) {
    startBattle({
      className,
      weekNumber: Number(weekSelect.value),
      pairCount: selectedPairCount,
      players: [
        { name: battleP1NameInput.value.trim() || "Player 1", color: battleP1ColorInput.value },
        { name: battleP2NameInput.value.trim() || "Player 2", color: battleP2ColorInput.value },
      ],
    });
    return;
  }

  const studentId = studentIdInput.value.trim();

  // Catch likely typos before they silently fragment a student's record: if
  // this device has started a game as a different id before, make sure the
  // change is intentional rather than a mistyped id nobody notices.
  if (!guestToggle.checked && studentId && lastConfirmedStudentId && studentId !== lastConfirmedStudentId) {
    const proceed = confirm(
      `Last time you played as "${lastConfirmedStudentId}" on this device — start this game as "${studentId}" instead?`
    );
    if (!proceed) return;
  }

  // Still attempt the claim so a returning student's own device stays
  // recognized as such, but a conflict (someone else already used this id)
  // no longer blocks play — impersonation isn't a real concern here, only
  // accidental typos are, and that's handled by the confirm above instead.
  if (studentId) {
    startBtn.disabled = true;
    const claim = await claimStudentId({ className, studentId });
    startBtn.disabled = false;
    if (!claim.ok) {
      startHint.textContent = claim.message;
    }
  }

  if (!guestToggle.checked && studentId) lastConfirmedStudentId = studentId;

  startGame({
    studentId,
    schoolYear: guestToggle.checked ? "Guest/Alumni" : schoolYearSelect.value,
    campus: guestToggle.checked ? GUEST_CAMPUS : campusSelect.value,
    className,
    weekNumber: Number(weekSelect.value),
    pairCount: selectedPairCount,
  });
});

changeSettingsBtn.addEventListener("click", () => {
  showScreen(setupScreen);
});

quitBtn.addEventListener("click", () => {
  stopTimer();
  stopItemSpawns();
  showScreen(setupScreen);
});

// ---------- Game setup ----------

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(className, weekNumber, pairCount) {
  const sessionPairs = generateSessionPairs(className, weekNumber, pairCount);
  const cards = sessionPairs.flatMap((pair) => [
    { pairId: pair.id, type: "function", latex: pair.func },
    { pairId: pair.id, type: "derivative", latex: pair.deriv },
  ]);
  return { deck: shuffle(cards).map((card, index) => ({ ...card, cardIndex: index })), sessionPairs };
}

function startGame({ studentId, schoolYear, campus, className, weekNumber, pairCount }) {
  const { deck, sessionPairs } = buildDeck(className, weekNumber, pairCount);

  state = {
    mode: "solo",
    studentId,
    schoolYear,
    campus,
    className,
    weekNumber,
    pairCount,
    deck,
    sessionPairs,
    flipped: [],
    matchedPairIds: new Set(),
    matchCount: 0,
    moves: 0,
    seconds: 0,
    locked: false,
    timerFrozenUntil: 0,
  };

  gameHeaderEl.classList.remove("battle-mode");
  gameScreen.classList.remove("battle-turn-1", "battle-turn-2");
  hudPlayer.textContent = studentId || "Guest";
  hudMoves.textContent = "0";
  hudTime.textContent = "0:00";

  renderGrid();
  showScreen(gameScreen);
  sizeCardGrid();
  startTimer();
  stopItemSpawns(); // clear anything left over from a previous game first
  scheduleNextItemSpawn();
}

// ---------- Battle Mode (2 players, 1 device) ----------
// Reuses the same card-grid/flip/power-up machinery as solo Round 1 —
// onCardClick and checkWin both branch on state.mode === "battle" rather
// than duplicating the matching logic. No timer (nothing is scored) and no
// leaderboard recording at all, per the user's explicit scope decision.

function startBattle({ className, weekNumber, pairCount, players }) {
  const { deck, sessionPairs } = buildDeck(className, weekNumber, pairCount);

  state = {
    mode: "battle",
    className,
    weekNumber,
    pairCount,
    deck,
    sessionPairs,
    flipped: [],
    matchedPairIds: new Set(),
    matchCount: 0,
    moves: 0,
    locked: false,
    players: players.map(({ name, color }) => ({ name, color, matches: 0 })),
    currentPlayerIndex: 0,
  };

  // Colors are per-battle, applied as custom-property overrides on the
  // root — every CSS rule that already reads var(--player1-color) /
  // var(--player2-color) (HUD labels, the turn-tint background) just
  // picks up whatever was chosen, defaulting to the company colors set
  // as the pickers' HTML defaults if nobody changes them.
  document.documentElement.style.setProperty("--player1-color", state.players[0].color);
  document.documentElement.style.setProperty("--player2-color", state.players[1].color);

  gameHeaderEl.classList.add("battle-mode");
  updateBattleHud();

  renderGrid();
  showScreen(gameScreen);
  sizeCardGrid();
  stopItemSpawns(); // clear anything left over from a previous game first
  scheduleNextItemSpawn();
}

function updateBattleHud() {
  hudP1Label.textContent = state.players[0].name;
  hudP2Label.textContent = state.players[1].name;
  hudP1Matches.textContent = String(state.players[0].matches);
  hudP2Matches.textContent = String(state.players[1].matches);
  hudTurn.textContent = state.players[state.currentPlayerIndex].name;

  const isPlayer1Turn = state.currentPlayerIndex === 0;
  gameScreen.classList.toggle("battle-turn-1", isPlayer1Turn);
  gameScreen.classList.toggle("battle-turn-2", !isPlayer1Turn);
  hudTurn.style.color = isPlayer1Turn ? "var(--player1-color)" : "var(--player2-color)";
}

function finishBattle() {
  const [p1, p2] = state.players;
  if (p1.matches === p2.matches) {
    battleResultTitle.textContent = "It's a tie!";
    battleResultSummary.textContent = `${p1.name} and ${p2.name} both matched ${p1.matches} pairs.`;
  } else {
    const winner = p1.matches > p2.matches ? p1 : p2;
    const loser = p1.matches > p2.matches ? p2 : p1;
    battleResultTitle.textContent = `${winner.name} wins!`;
    battleResultSummary.textContent = `${winner.name} matched ${winner.matches} pairs to ${loser.name}'s ${loser.matches}.`;
  }
  battleRound2Btn.classList.remove("hidden");
  showScreen(battleResultScreen);
}

function finishBattleRound2() {
  const [p1, p2] = r2State.players;
  if (p1.solved === p2.solved) {
    battleResultTitle.textContent = "Round 2: it's a tie!";
    battleResultSummary.textContent = `${p1.name} and ${p2.name} both solved ${p1.solved} pairs in ${formatTime(r2State.seconds)}.`;
  } else {
    const winner = p1.solved > p2.solved ? p1 : p2;
    const loser = p1.solved > p2.solved ? p2 : p1;
    battleResultTitle.textContent = `${winner.name} wins Round 2!`;
    battleResultSummary.textContent = `${winner.name} solved ${winner.solved} pairs to ${loser.name}'s ${loser.solved}, in ${formatTime(r2State.seconds)}.`;
  }
  battleRound2Btn.classList.add("hidden");
  showScreen(battleResultScreen);
}

battleAgainBtn.addEventListener("click", () => {
  startBattle({
    className: state.className,
    weekNumber: state.weekNumber,
    pairCount: state.pairCount,
    players: state.players.map((p) => ({ name: p.name, color: p.color })),
  });
});

battleBackBtn.addEventListener("click", () => {
  showScreen(setupScreen);
});

// ---------- Fit-to-screen card sizing ----------
// Cards are sized in px (not left to CSS auto-fit) so the whole grid — up
// to a 4x6 board for 12 pairs — always fits the viewport without scrolling,
// which matters most on the phones students are expected to play on.

const CARD_GAP = 12;
const CARD_ASPECT = 3 / 4; // width / height

function sizeCardGrid() {
  if (!state || gameScreen.classList.contains("hidden")) return;

  const cols = 4;
  const rows = Math.ceil(state.deck.length / cols);

  const gridRect = cardGrid.getBoundingClientRect();
  const availableWidth = gridRect.width;
  const availableHeight = window.innerHeight - gridRect.top - 16;

  const widthPerCol = (availableWidth - CARD_GAP * (cols - 1)) / cols;
  const heightPerRow = (availableHeight - CARD_GAP * (rows - 1)) / rows;

  const cardWidth = Math.max(60, Math.min(widthPerCol, heightPerRow * CARD_ASPECT));
  const cardHeight = cardWidth / CARD_ASPECT;

  cardGrid.style.gridTemplateColumns = `repeat(${cols}, ${cardWidth}px)`;
  cardGrid.style.gridTemplateRows = `repeat(${rows}, ${cardHeight}px)`;
}

window.addEventListener("resize", sizeCardGrid);
window.addEventListener("orientationchange", sizeCardGrid);

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    // The "freeze" power-up pauses the clock without pausing the game.
    if (state.timerFrozenUntil && Date.now() < state.timerFrozenUntil) return;
    state.seconds += 1;
    hudTime.textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------- Round 1 power-up items ----------
// Floating cards that spawn at random moments during Round 1 (never during
// Round 2 — its pacing/scoring is different, per the user's scope
// decision) and, when tapped, apply a small temporary boost:
//   freeze — pauses the elapsed-time clock for a few seconds
//   rule   — shows the general differentiation rule as a reference card
//   delay  — the next mismatched pair stays face-up longer before hiding
// Battle Mode reuses this same spawn/activate system for its own turns.

const ITEM_TYPES = {
  freeze: { icon: "❄️", label: "Timer freeze", freezeSeconds: 5 },
  rule: { icon: "📖", label: "Show the rule" },
  delay: { icon: "⏳", label: "Extra look" },
};

const ITEM_MIN_SPAWN_MS = 8000;
const ITEM_MAX_SPAWN_MS = 16000;
const ITEM_VISIBLE_MS = 6000;
const RULE_CARD_VISIBLE_MS = 4000;
const EXTRA_LOOK_MS = 3000;

let itemSpawnTimer = null;
let itemHideTimer = null;
let ruleCardHideTimer = null;
let activeItemKey = null;
let extraLookActive = false; // one-shot: applies to the next mismatch only

function scheduleNextItemSpawn() {
  clearTimeout(itemSpawnTimer);
  const delay = ITEM_MIN_SPAWN_MS + Math.random() * (ITEM_MAX_SPAWN_MS - ITEM_MIN_SPAWN_MS);
  itemSpawnTimer = setTimeout(spawnItem, delay);
}

function spawnItem() {
  if (!state || gameScreen.classList.contains("hidden")) return;

  // "freeze" has nothing to pause in Battle Mode — there's no timer/score,
  // so it's excluded from the pool there rather than being a no-op tap.
  const keys =
    state.mode === "battle" ? Object.keys(ITEM_TYPES).filter((k) => k !== "freeze") : Object.keys(ITEM_TYPES);
  activeItemKey = keys[Math.floor(Math.random() * keys.length)];
  itemCardEl.textContent = ITEM_TYPES[activeItemKey].icon;
  itemCardEl.setAttribute("aria-label", ITEM_TYPES[activeItemKey].label);
  itemCardEl.classList.remove("hidden");

  clearTimeout(itemHideTimer);
  itemHideTimer = setTimeout(hideItem, ITEM_VISIBLE_MS);
}

function hideItem() {
  clearTimeout(itemHideTimer);
  itemCardEl.classList.add("hidden");
  activeItemKey = null;
  scheduleNextItemSpawn();
}

// Called whenever Round 1 (or a Battle Mode turn) ends, so a floating item
// never lingers into a screen it doesn't belong on — fixed positioning
// means it'd otherwise stay visible over the win screen, setup, etc.
function stopItemSpawns() {
  clearTimeout(itemSpawnTimer);
  clearTimeout(itemHideTimer);
  clearTimeout(ruleCardHideTimer);
  itemCardEl.classList.add("hidden");
  ruleCardEl.classList.add("hidden");
  activeItemKey = null;
  extraLookActive = false;
}

itemCardEl.addEventListener("click", () => {
  if (!activeItemKey) return;
  activateItem(activeItemKey);
  hideItem();
});

function activateItem(key) {
  if (key === "freeze") {
    state.timerFrozenUntil = Date.now() + ITEM_TYPES.freeze.freezeSeconds * 1000;
  } else if (key === "rule") {
    showRuleCard();
  } else if (key === "delay") {
    extraLookActive = true;
  }
}

function showRuleCard() {
  ruleCardEl.innerHTML =
    "Power rule: " +
    katex.renderToString("\\frac{d}{dx}\\left[x^n\\right] = nx^{n-1}", { throwOnError: false }) +
    " &nbsp;&nbsp; " +
    katex.renderToString("\\frac{d}{dx}\\left[e^x\\right] = e^x", { throwOnError: false });
  ruleCardEl.classList.remove("hidden");
  clearTimeout(ruleCardHideTimer);
  ruleCardHideTimer = setTimeout(() => ruleCardEl.classList.add("hidden"), RULE_CARD_VISIBLE_MS);
}

// ---------- Rendering ----------

function renderGrid() {
  cardGrid.innerHTML = "";
  state.deck.forEach((card) => {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.cardIndex = card.cardIndex;

    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">?</div>
        <div class="card-face card-front"></div>
      </div>
    `;

    el.querySelector(".card-front").innerHTML = katex.renderToString(card.latex, {
      throwOnError: false,
    });

    el.addEventListener("click", () => onCardClick(card.cardIndex));
    cardGrid.appendChild(el);
  });
}

function cardElByIndex(index) {
  return cardGrid.querySelector(`.card[data-card-index="${index}"]`);
}

// ---------- Game logic ----------

function onCardClick(cardIndex) {
  if (state.locked) return;

  const card = state.deck[cardIndex];
  if (state.matchedPairIds.has(`${card.pairId}-${card.type}-open`)) return;
  if (state.flipped.some((c) => c.cardIndex === cardIndex)) return;
  if (isMatched(card)) return;

  flipCard(cardIndex);
  state.flipped.push(card);

  if (state.flipped.length === 2) {
    state.moves += 1;
    hudMoves.textContent = String(state.moves);
    state.locked = true;

    const [a, b] = state.flipped;
    const isMatch = a.pairId === b.pairId && a.type !== b.type;

    if (isMatch) {
      setTimeout(() => {
        state.matchCount += 1;
        markMatched(a, state.matchCount);
        markMatched(b, state.matchCount);
        state.flipped = [];
        state.locked = false;
        // A match keeps the same player's turn — classic memory-game rules.
        if (state.mode === "battle") {
          state.players[state.currentPlayerIndex].matches += 1;
          updateBattleHud();
        }
        checkWin();
      }, 400);
    } else {
      // The "delay" power-up extends this one mismatch's face-up time,
      // then reverts to normal for every mismatch after it.
      const mismatchDelay = extraLookActive ? EXTRA_LOOK_MS : 900;
      extraLookActive = false;
      setTimeout(() => {
        unflipCard(a.cardIndex);
        unflipCard(b.cardIndex);
        state.flipped = [];
        state.locked = false;
        // A miss passes the device — the other player's turn.
        if (state.mode === "battle") {
          state.currentPlayerIndex = 1 - state.currentPlayerIndex;
          updateBattleHud();
        }
      }, mismatchDelay);
    }
  }
}

function isMatched(card) {
  return state.matchedPairIds.has(card.pairId);
}

function flipCard(index) {
  cardElByIndex(index).classList.add("flipped");
}

function unflipCard(index) {
  cardElByIndex(index).classList.remove("flipped");
}

const PAIR_COLOR_COUNT = 8;

function markMatched(card, matchNumber) {
  state.matchedPairIds.add(card.pairId);

  const el = cardElByIndex(card.cardIndex);
  const colorSlot = ((matchNumber - 1) % PAIR_COLOR_COUNT) + 1;
  el.style.setProperty("--pair-color", `var(--pair-color-${colorSlot})`);

  const badge = document.createElement("span");
  badge.className = "pair-badge";
  badge.textContent = matchNumber;
  el.querySelector(".card-front").appendChild(badge);

  el.classList.add("matched", "match-pop");
}

async function checkWin() {
  if (state.matchedPairIds.size < state.pairCount) return;

  stopItemSpawns();

  if (state.mode === "battle") {
    finishBattle();
    return;
  }

  stopTimer();

  const isIdentified = state.studentId && state.schoolYear && state.campus && state.className;

  state.round1Score = computeRound1Score(state.moves, state.seconds);

  if (isIdentified) {
    await submitResult({
      studentId: state.studentId,
      schoolYear: state.schoolYear,
      campus: state.campus,
      className: state.className,
      pairs: state.pairCount,
      round: 1,
      moves: state.moves,
      seconds: state.seconds,
    });
  }

  const who = state.studentId || "You";
  winSummary.textContent = `${who} matched all ${state.pairCount} pairs in ${state.moves} moves and ${formatTime(state.seconds)}.`;
  if (!isIdentified) {
    winSummary.textContent += " (Not recorded — School Year, Campus, Class, and Student ID were missing.)";
  }

  await renderLeaderboard("week");
  showScreen(winScreen);
}

// ---------- Win screen / leaderboard ----------

document.querySelectorAll("#round1-tab-group .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#round1-tab-group .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    renderLeaderboard(tab.dataset.range);
  });
});

async function renderLeaderboard(range) {
  const rows = await getLeaderboard({
    pairs: state.pairCount,
    round: 1,
    range,
    schoolYear: state.schoolYear,
    campus: state.campus,
    className: state.className,
  });

  leaderboardBody.innerHTML = rows
    .map(
      (row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(row.studentId)}</td>
          <td>${formatTime(row.seconds)}</td>
          <td>${row.moves}</td>
        </tr>
      `
    )
    .join("");

  if (rows.length === 0) {
    leaderboardBody.innerHTML = `<tr><td colspan="4">No results yet.</td></tr>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

playAgainBtn.addEventListener("click", () => {
  startGame({
    studentId: state.studentId,
    schoolYear: state.schoolYear,
    campus: state.campus,
    className: state.className,
    weekNumber: state.weekNumber,
    pairCount: state.pairCount,
  });
});

// ---------- Round 2: which side needs d/d? ----------
// Reuses the pairs from the Round 1 game just won. Each pair is shown as
// "[left] = [right]" (sides randomized) and the student taps whichever side
// is the original function — the one that needs the d/d? prefix to make the
// equation true. Wrong taps send the pair to the back of the queue instead
// of dropping it, so a missed pair has to be recognized again later rather
// than just retried immediately.

function diffNotation(variable) {
  return `\\dfrac{d}{d${variable}}`;
}

function wrapWithNotation(latex, variable) {
  return `${diffNotation(variable)}\\left(${latex}\\right)`;
}

// Vibration API has no effect (and no error) on browsers that don't support
// it — notably iOS Safari, which has never implemented it. Feature-checked
// so this is always safe to call.
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

round2Btn.addEventListener("click", startRound2);

function startRound2() {
  const usedPairIds = [...new Set(state.deck.map((c) => c.pairId))];
  const pairs = usedPairIds.map((id) => state.sessionPairs.find((p) => p.id === id));

  r2State = {
    mode: "solo",
    studentId: state.studentId,
    queue: shuffle(pairs),
    total: pairs.length,
    solved: 0,
    mistakes: 0,
    seconds: 0,
    current: null,
    locked: false,
  };

  round2HeaderEl.classList.remove("battle-mode");
  round2Screen.classList.remove("battle-turn-1", "battle-turn-2");
  r2HudPlayer.textContent = state.studentId || "Guest";
  r2HudTime.textContent = "0:00";
  updateR2Hud();
  r2Complete.classList.add("hidden");
  r2Play.classList.remove("hidden");

  showScreen(round2Screen);
  startR2Timer();
  renderNextR2Item();
}

// Battle Mode's Round 2 — reuses the same pairs as the Round 1 battle just
// played (state.deck/state.sessionPairs, set by startBattle). Unlike
// Round 1's "correct keeps your turn" rule, Round 2 always alternates
// turns every equation regardless of right/wrong — including a timeout,
// which counts as a miss (pair recycled to the back of the queue, turn
// passes) exactly like a wrong tap. Most pairs solved when the queue
// clears wins. Each turn has a shrinking time limit — 5 seconds for the
// first two turns, then one second less each turn after that down to a
// 1-second floor — via getBattleTurnTimeLimit below.
const BATTLE_TURN_TIME_LIMIT_START = 5;
const BATTLE_TURN_TIME_LIMIT_FLOOR = 1;

function getBattleTurnTimeLimit(turnNumber) {
  const decreaseFrom = Math.max(0, turnNumber - 2);
  return Math.max(BATTLE_TURN_TIME_LIMIT_FLOOR, BATTLE_TURN_TIME_LIMIT_START - decreaseFrom);
}

function startBattleRound2() {
  const usedPairIds = [...new Set(state.deck.map((c) => c.pairId))];
  const pairs = usedPairIds.map((id) => state.sessionPairs.find((p) => p.id === id));

  r2State = {
    mode: "battle",
    queue: shuffle(pairs),
    total: pairs.length,
    mistakes: 0,
    seconds: 0,
    turnNumber: 0,
    turnRemaining: 0,
    current: null,
    locked: false,
    players: state.players.map((p) => ({ name: p.name, color: p.color, solved: 0 })),
    currentPlayerIndex: 0,
  };

  round2HeaderEl.classList.add("battle-mode");
  r2HudTime.textContent = "0:00";
  updateBattleR2Hud();
  r2Complete.classList.add("hidden");
  r2Play.classList.remove("hidden");

  showScreen(round2Screen);
  startR2Timer();
  renderNextR2Item();
}

battleRound2Btn.addEventListener("click", startBattleRound2);

function startR2Timer() {
  stopR2Timer();
  r2TimerInterval = setInterval(() => {
    // r2State.seconds keeps accumulating for the whole round regardless of
    // mode (solo's scoring formula needs the round total, and Battle's
    // end-of-round summary reports it too). Battle Mode's HUD shows a
    // per-turn countdown instead (turnRemaining, reset by
    // renderNextR2Item on every new turn) — running out costs the turn,
    // same as a wrong tap.
    r2State.seconds += 1;
    if (r2State.mode === "battle") {
      r2State.turnRemaining -= 1;
      r2HudTime.textContent = formatTime(Math.max(0, r2State.turnRemaining));
      if (r2State.turnRemaining <= 0) handleR2Timeout();
    } else {
      r2HudTime.textContent = formatTime(r2State.seconds);
    }
  }, 1000);
}

function stopR2Timer() {
  if (r2TimerInterval) clearInterval(r2TimerInterval);
  r2TimerInterval = null;
}

function updateR2Hud() {
  r2HudSolved.textContent = `${r2State.solved}/${r2State.total}`;
  r2HudMistakes.textContent = String(r2State.mistakes);
  r2ProgressFill.style.width = `${(r2State.solved / r2State.total) * 100}%`;
}

function updateBattleR2Hud() {
  r2HudP1Label.textContent = r2State.players[0].name;
  r2HudP2Label.textContent = r2State.players[1].name;
  r2HudP1Solved.textContent = String(r2State.players[0].solved);
  r2HudP2Solved.textContent = String(r2State.players[1].solved);
  r2HudTurn.textContent = r2State.players[r2State.currentPlayerIndex].name;

  const totalSolved = r2State.players[0].solved + r2State.players[1].solved;
  r2ProgressFill.style.width = `${(totalSolved / r2State.total) * 100}%`;

  const isPlayer1Turn = r2State.currentPlayerIndex === 0;
  round2Screen.classList.toggle("battle-turn-1", isPlayer1Turn);
  round2Screen.classList.toggle("battle-turn-2", !isPlayer1Turn);
  r2HudTurn.style.color = isPlayer1Turn ? "var(--player1-color)" : "var(--player2-color)";
}

async function renderNextR2Item() {
  if (r2State.queue.length === 0) {
    stopR2Timer();

    if (r2State.mode === "battle") {
      finishBattleRound2();
      return;
    }

    r2Play.classList.add("hidden");
    r2Complete.classList.remove("hidden");

    const round2Score = computeRound2Score(r2State.seconds, r2State.mistakes);
    const overallScore = state.round1Score + round2Score;
    const isIdentified = state.studentId && state.schoolYear && state.campus && state.className;

    if (isIdentified) {
      await submitResult({
        studentId: state.studentId,
        schoolYear: state.schoolYear,
        campus: state.campus,
        className: state.className,
        pairs: state.pairCount,
        round: 2,
        mistakes: r2State.mistakes,
        seconds: r2State.seconds,
        overallScore,
      });
    }

    const who = r2State.studentId || "You";
    const tries = r2State.mistakes === 1 ? "1 miss" : `${r2State.mistakes} misses`;
    r2Summary.textContent = `${who} sorted every pair correctly in ${formatTime(r2State.seconds)} (${tries} along the way). Overall score: ${overallScore}.`;
    if (!isIdentified) {
      r2Summary.textContent += " (Not recorded — School Year, Campus, Class, and Student ID were missing.)";
    }

    await renderR2Leaderboard("week");
    return;
  }

  const pair = r2State.queue.shift();
  const functionOnLeft = Math.random() < 0.5;

  r2State.current = { pair, functionSide: functionOnLeft ? "left" : "right" };
  r2State.locked = false;

  // Battle Mode: start this turn's countdown fresh — the time limit
  // shrinks as the round goes on (getBattleTurnTimeLimit), regardless of
  // how the previous turn ended (correct, wrong, or timed out all pass
  // the turn under always-alternate).
  if (r2State.mode === "battle") {
    r2State.turnNumber += 1;
    r2State.turnRemaining = getBattleTurnTimeLimit(r2State.turnNumber);
    r2HudTime.textContent = formatTime(r2State.turnRemaining);
  }

  r2InstructionsNotation.innerHTML = katex.renderToString(diffNotation(pair.variable), {
    throwOnError: false,
  });

  r2Equals.textContent = "=";
  r2Equals.classList.remove("correct", "incorrect");

  r2Sides.forEach((sideEl) => {
    const isFunctionSide = sideEl.dataset.side === r2State.current.functionSide;
    const latex = isFunctionSide ? pair.func : pair.deriv;
    sideEl.innerHTML = katex.renderToString(latex, { throwOnError: false });
    sideEl.classList.remove("correct", "incorrect");
    sideEl.disabled = false;
  });
}

r2Sides.forEach((sideEl) => {
  sideEl.addEventListener("click", () => onR2SideClick(sideEl));
});

function onR2SideClick(sideEl) {
  if (r2State.locked) return;
  r2State.locked = true;
  r2Sides.forEach((s) => (s.disabled = true));

  const { pair, functionSide } = r2State.current;
  // A self-derivative pair (e.g. e^x) shows identical text on both sides —
  // there's no real "wrong" side to tap, so either counts as correct.
  const isSelfDerivative = pair.func === pair.deriv;
  const isCorrect = isSelfDerivative || sideEl.dataset.side === functionSide;

  if (isCorrect) {
    sideEl.classList.add("correct");
    sideEl.innerHTML = katex.renderToString(wrapWithNotation(pair.func, pair.variable), {
      throwOnError: false,
    });
    r2Equals.classList.add("correct");
    // Battle Mode: unlike Round 1's card matching, Round 2 always
    // alternates turns every equation regardless of right/wrong — a
    // correct tap still scores, it just doesn't keep the turn.
    if (r2State.mode === "battle") {
      r2State.players[r2State.currentPlayerIndex].solved += 1;
      r2State.currentPlayerIndex = 1 - r2State.currentPlayerIndex;
      updateBattleR2Hud();
    } else {
      r2State.solved += 1;
      updateR2Hud();
    }
    setTimeout(renderNextR2Item, 700);
  } else {
    sideEl.classList.add("incorrect");
    sideEl.innerHTML = katex.renderToString(wrapWithNotation(pair.deriv, pair.variable), {
      throwOnError: false,
    });
    r2Equals.textContent = "≠";
    vibrate(200);
    r2Equals.classList.add("incorrect");
    r2State.mistakes += 1;
    r2State.queue.push(pair);
    if (r2State.mode === "battle") {
      r2State.currentPlayerIndex = 1 - r2State.currentPlayerIndex;
      updateBattleR2Hud();
    } else {
      updateR2Hud();
    }
    setTimeout(renderNextR2Item, 900);
  }
}

// Battle Mode only: the current turn's countdown hit zero before either
// side was tapped. Treated exactly like a wrong tap — pair recycled to
// the back of the queue, turn passes — just with no specific side to
// blame, so neither gets the "incorrect" styling, only the equals sign
// and a vibration signal it.
function handleR2Timeout() {
  if (r2State.locked) return;
  r2State.locked = true;
  r2Sides.forEach((s) => (s.disabled = true));

  const { pair } = r2State.current;
  r2Equals.textContent = "≠";
  r2Equals.classList.add("incorrect");
  vibrate(200);
  r2State.mistakes += 1;
  r2State.queue.push(pair);
  r2State.currentPlayerIndex = 1 - r2State.currentPlayerIndex;
  updateBattleR2Hud();
  setTimeout(renderNextR2Item, 900);
}

r2QuitBtn.addEventListener("click", () => {
  stopR2Timer();
  showScreen(setupScreen);
});

r2BackBtn.addEventListener("click", () => {
  showScreen(setupScreen);
});

const r2LeaderboardBody = document.getElementById("r2-leaderboard-body");

document.querySelectorAll("#round2-tab-group .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#round2-tab-group .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    renderR2Leaderboard(tab.dataset.range);
  });
});

async function renderR2Leaderboard(range) {
  const rows = await getOverallLeaderboard({
    pairs: state.pairCount,
    range,
    schoolYear: state.schoolYear,
    campus: state.campus,
    className: state.className,
  });

  r2LeaderboardBody.innerHTML = rows
    .map(
      (row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(row.studentId)}</td>
          <td>${row.score}</td>
          <td>${row.sessions}</td>
        </tr>
      `
    )
    .join("");

  if (rows.length === 0) {
    r2LeaderboardBody.innerHTML = `<tr><td colspan="4">No results yet.</td></tr>`;
  }
}
