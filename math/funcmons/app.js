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
const hintRevealEl = document.getElementById("hint-reveal");
const hintKindEl = document.getElementById("hint-kind");
const hintContentEl = document.getElementById("hint-content");

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
const r2Feedback = document.getElementById("r2-feedback");
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
  stopHintSystem();
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
  stopHintSystem(); // clear anything left over from a previous game first
  startHintSystem();
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
    round1Winner: null, // set by finishBattle() once Round 1 ends — read by finishBattleRound2()
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
  stopHintSystem(); // clear anything left over from a previous game first
  startHintSystem();
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
    state.round1Winner = null;
    battleResultTitle.textContent = "It's a tie!";
    battleResultSummary.textContent = `${p1.name} and ${p2.name} both matched ${p1.matches} pairs.`;
  } else {
    const winner = p1.matches > p2.matches ? p1 : p2;
    const loser = p1.matches > p2.matches ? p2 : p1;
    state.round1Winner = winner.name;
    battleResultTitle.textContent = `${winner.name} wins!`;
    battleResultSummary.textContent = `${winner.name} matched ${winner.matches} pairs to ${loser.name}'s ${loser.matches}.`;
  }
  battleRound2Btn.classList.remove("hidden");
  showScreen(battleResultScreen);
}

// Shows the FINAL result once both rounds are done — who won which round,
// plus an overall verdict. Round 3 (a tiebreaker for a 1-1 split) is a
// planned future addition, not built yet — a split result says so instead
// of declaring a winner.
function finishBattleRound2() {
  const [p1, p2] = r2State.players;
  const round1WinnerName = state.round1Winner; // set by finishBattle(); null if Round 1 tied

  let round2WinnerName = null;
  let round2Text;
  if (p1.points === p2.points) {
    round2Text = `Round 2: tied at ${p1.points} points each.`;
  } else {
    const winner = p1.points > p2.points ? p1 : p2;
    const loser = p1.points > p2.points ? p2 : p1;
    round2WinnerName = winner.name;
    round2Text = `Round 2: ${winner.name} won, ${winner.points} points to ${loser.name}'s ${loser.points}.`;
  }

  const round1Text = round1WinnerName ? `Round 1: ${round1WinnerName} won.` : "Round 1: tied.";
  const overallWinner = round1WinnerName && round1WinnerName === round2WinnerName ? round1WinnerName : null;

  battleResultTitle.textContent = overallWinner ? `${overallWinner} wins the battle!` : "Battle tied!";
  battleResultSummary.textContent = overallWinner
    ? `${round1Text} ${round2Text}`
    : `${round1Text} ${round2Text} A Round 3 tiebreaker is coming soon.`;

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
    // The "freeze" hint pauses the clock without pausing the game — the
    // frozen class gives it a visible highlight (bigger, gold, glowing)
    // instead of the clock just silently not moving.
    const frozen = state.timerFrozenUntil && Date.now() < state.timerFrozenUntil;
    hudTime.classList.toggle("frozen", Boolean(frozen));
    if (frozen) return;
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

// ---------- Round 1 hint card ----------
// The hint IS a card — same shape as every real card in the grid, gold
// instead of blue, "!" instead of "?" — riding on top of one real card's
// back and hopping to a neighbor every ~1.6s. Always present and hopping
// from the moment Round 1 starts (no random spawn delay — the old design
// had one and it made the hint too easy to never notice at all). Tap it
// correctly and it flies out to #hint-reveal ("the side of the board")
// with a spin, showing what it was — one of three, picked at random each
// time, never player-chosen:
//   rule   — the power/sum/product rule, shown as text
//   freeze — pauses the elapsed-time clock, highlighted directly on the
//            HUD's Time stat rather than only on the reveal card
//   xray   — a short window where tapping ANY card ghosts its content
//            through the back at half opacity — no flip, no move spent,
//            nothing auto-matched, purely a memorization aid
// Tap the cell the hint just left and you flip a real card instead —
// that's the risk. Battle Mode reuses this same system for its turns,
// minus "freeze" (nothing to pause without a solo clock).

const HINT_HOP_MS = 1600;
const HINT_FREEZE_SECONDS = 5;
const HINT_XRAY_WINDOW_MS = 3000;
const HINT_REVEAL_MS = {
  rule: 4500,
  freeze: HINT_FREEZE_SECONDS * 1000,
  xray: HINT_XRAY_WINDOW_MS,
};
const HINT_FLY_MS = 550;

const RULES = [
  { name: "POWER RULE", latex: "\\frac{d}{dx}\\left[x^n\\right] = nx^{n-1}" },
  { name: "SUM RULE", latex: "\\frac{d}{dx}\\left[f+g\\right] = f'+g'" },
  { name: "PRODUCT RULE", latex: "\\frac{d}{dx}\\left[f \\cdot g\\right] = f'g+fg'" },
];

let hintHopTimer = null;
let hintRevealTimer = null;
let hintCardIndex = -1;
let hintActive = false;
let xrayWindowOpen = false;
let currentHintType = null;

// Which cards a hint may currently sit on / hop to — excludes matched
// pairs (nothing left to guard there) and whatever's mid-flip.
function eligibleHintIndices() {
  if (!state) return [];
  return state.deck
    .map((card, i) => i)
    .filter((i) => !isMatched(state.deck[i]) && !state.flipped.some((c) => c.cardIndex === i));
}

function hintNeighbors(index) {
  const cols = 4;
  const total = state.deck.length;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const rows = Math.ceil(total / cols);
  const out = [];
  if (col > 0) out.push(index - 1);
  if (col < cols - 1 && index + 1 < total) out.push(index + 1);
  if (row > 0) out.push(index - cols);
  if (row < rows - 1 && index + cols < total) out.push(index + cols);
  return out.filter((i) => !isMatched(state.deck[i]) && !state.flipped.some((c) => c.cardIndex === i));
}

function randomHintType() {
  const pool = state.mode === "battle" ? ["rule", "xray"] : ["rule", "freeze", "xray"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function paintHintOverlay() {
  cardGrid.querySelectorAll(".card").forEach((el) => {
    el.classList.remove("is-hint");
    const qmark = el.querySelector(".qmark");
    const symbol = el.querySelector(".hint-symbol");
    if (qmark) qmark.hidden = false;
    if (symbol) symbol.hidden = true;
  });
  if (!hintActive) return;
  const el = cardElByIndex(hintCardIndex);
  if (!el) return;
  el.classList.add("is-hint");
  const qmark = el.querySelector(".qmark");
  const symbol = el.querySelector(".hint-symbol");
  if (qmark) qmark.hidden = true;
  if (symbol) symbol.hidden = false;
}

function scheduleHintHop() {
  clearTimeout(hintHopTimer);
  hintHopTimer = setTimeout(() => {
    if (hintActive) {
      const options = hintNeighbors(hintCardIndex);
      const pool = options.length ? options : eligibleHintIndices().filter((i) => i !== hintCardIndex);
      if (pool.length) {
        hintCardIndex = pool[Math.floor(Math.random() * pool.length)];
        paintHintOverlay();
      }
    }
    scheduleHintHop();
  }, HINT_HOP_MS);
}

// Called once per Round 1 (solo or Battle) game start — the hint is
// visible and hopping immediately, no spawn-delay lottery.
function startHintSystem() {
  const pool = eligibleHintIndices();
  if (!pool.length) return;
  hintCardIndex = pool[Math.floor(Math.random() * pool.length)];
  currentHintType = randomHintType();
  hintActive = true;
  paintHintOverlay();
  scheduleHintHop();
}

// Called whenever Round 1 (or a Battle Mode turn) ends, so nothing lingers
// into a screen it doesn't belong on.
function stopHintSystem() {
  clearTimeout(hintHopTimer);
  clearTimeout(hintRevealTimer);
  hintActive = false;
  xrayWindowOpen = false;
  hintCardIndex = -1;
  paintHintOverlay();
  hideHintReveal();
  cardGrid.querySelectorAll(".card.xray-peeked").forEach((el) => el.classList.remove("xray-peeked"));
  if (hudTime) hudTime.classList.remove("frozen");
}

function flyHintRevealTo(kindLabel, contentHtml) {
  // "hidden" (display:none) has to come off BEFORE the reflow trick below —
  // a display:none element has no box to reflow, so restarting the
  // animation on a second activation wouldn't reliably work otherwise.
  hintRevealEl.classList.remove("hidden", "flying", "showing", "content-shown");
  void hintRevealEl.offsetWidth; // restart the CSS animation
  hintRevealEl.classList.add("flying", "showing");

  setTimeout(() => {
    hintKindEl.textContent = kindLabel;
    hintContentEl.innerHTML = contentHtml;
    hintRevealEl.classList.add("content-shown");
  }, HINT_FLY_MS);
}

function hideHintReveal() {
  hintRevealEl.classList.remove("showing", "flying", "content-shown");
  hintRevealEl.classList.add("hidden");
}

function handleXrayPeek(cardIndex) {
  const el = cardElByIndex(cardIndex);
  if (!el || el.classList.contains("flipped") || el.classList.contains("matched")) return;
  el.classList.add("xray-peeked");
}

// Called from onCardClick when the tap lands on the hint's current card.
function activateHint() {
  hintActive = false;
  paintHintOverlay();

  const type = currentHintType;

  if (type === "rule") {
    const rule = RULES[Math.floor(Math.random() * RULES.length)];
    flyHintRevealTo(rule.name, katex.renderToString(rule.latex, { throwOnError: false }));
  } else if (type === "freeze") {
    state.timerFrozenUntil = Date.now() + HINT_FREEZE_SECONDS * 1000;
    flyHintRevealTo("TIMER FREEZE", `&#10052;&#65039; ${HINT_FREEZE_SECONDS} seconds`);
  } else if (type === "xray") {
    xrayWindowOpen = true;
    flyHintRevealTo("X-RAY VISION", "&#128065;&#65039; peek any card");
  }

  clearTimeout(hintRevealTimer);
  hintRevealTimer = setTimeout(() => {
    if (type === "xray") {
      xrayWindowOpen = false;
      cardGrid.querySelectorAll(".card.xray-peeked").forEach((el) => el.classList.remove("xray-peeked"));
    }
    hideHintReveal();
    startHintSystem();
  }, HINT_REVEAL_MS[type]);
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
        <div class="card-face card-back">
          <span class="qmark">?</span>
          <span class="hint-symbol" hidden>!</span>
          <span class="xray-overlay"></span>
        </div>
        <div class="card-face card-front"></div>
      </div>
    `;

    const rendered = katex.renderToString(card.latex, { throwOnError: false });
    el.querySelector(".card-front").innerHTML = rendered;
    el.querySelector(".xray-overlay").innerHTML = rendered;

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

  // X-ray vision: while the window's open, every tap is a peek — no real
  // flip happens, no move is spent, regardless of what's under the card.
  if (xrayWindowOpen) {
    handleXrayPeek(cardIndex);
    return;
  }

  // The hint card intercepts a tap unconditionally — even if this card
  // would otherwise be a legal move, tapping it uses the hint instead.
  if (hintActive && cardIndex === hintCardIndex) {
    activateHint();
    return;
  }

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
      }, 900);
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

  stopHintSystem();

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
// passes) exactly like a wrong tap. Win condition is points, not pairs
// solved (see onR2SideClick/handleR2Timeout).
//
// Each player has their OWN time limit (not a shared/combined schedule):
// starts at 8 seconds and drops by 1 every OTHER correct answer THAT
// player gets (wrong taps, timeouts, and every odd-numbered correct don't
// shrink it), floored at 3 seconds. Tracked directly as player.timeLimit,
// mutated in onR2SideClick's correct branch based on player.correctCount.
const BATTLE_TURN_TIME_LIMIT_START = 8;
const BATTLE_TURN_TIME_LIMIT_FLOOR = 3;

function startBattleRound2() {
  const usedPairIds = [...new Set(state.deck.map((c) => c.pairId))];
  const pairs = usedPairIds.map((id) => state.sessionPairs.find((p) => p.id === id));

  r2State = {
    mode: "battle",
    queue: shuffle(pairs),
    total: pairs.length,
    cleared: 0, // pairs answered correctly at least once — drives the progress bar, separate from points
    mistakes: 0,
    seconds: 0,
    turnRemaining: 0,
    current: null,
    locked: false,
    players: state.players.map((p) => ({
      name: p.name,
      color: p.color,
      points: 0,
      timeLimit: BATTLE_TURN_TIME_LIMIT_START,
      correctCount: 0, // drives the every-other-correct-answer time decrease below
    })),
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
  r2HudP1Solved.textContent = String(r2State.players[0].points);
  r2HudP2Solved.textContent = String(r2State.players[1].points);
  r2HudTurn.textContent = r2State.players[r2State.currentPlayerIndex].name;

  r2ProgressFill.style.width = `${(r2State.cleared / r2State.total) * 100}%`;

  const isPlayer1Turn = r2State.currentPlayerIndex === 0;
  round2Screen.classList.toggle("battle-turn-1", isPlayer1Turn);
  round2Screen.classList.toggle("battle-turn-2", !isPlayer1Turn);
  r2HudTurn.style.color = isPlayer1Turn ? "var(--player1-color)" : "var(--player2-color)";
}

function showR2Feedback(text, kind) {
  r2Feedback.textContent = text;
  r2Feedback.className = `r2-feedback ${kind}`;
}

function clearR2Feedback() {
  r2Feedback.textContent = "";
  r2Feedback.className = "r2-feedback";
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

  // Battle Mode: start this turn's countdown fresh, using whichever
  // player is up next's own current time limit.
  if (r2State.mode === "battle") {
    r2State.turnRemaining = r2State.players[r2State.currentPlayerIndex].timeLimit;
    r2HudTime.textContent = formatTime(r2State.turnRemaining);
    clearR2Feedback();
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
    // correct tap still scores, it just doesn't keep the turn. Points:
    // +1 correct, -1 wrong, +0 timeout (the user's explicit scoring).
    if (r2State.mode === "battle") {
      const answeringPlayer = r2State.players[r2State.currentPlayerIndex];
      answeringPlayer.points += 1;
      answeringPlayer.correctCount += 1;
      if (answeringPlayer.correctCount % 2 === 0) {
        answeringPlayer.timeLimit = Math.max(BATTLE_TURN_TIME_LIMIT_FLOOR, answeringPlayer.timeLimit - 1);
      }
      r2State.cleared += 1;
      showR2Feedback(`${answeringPlayer.name}: +1`, "correct");
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
      const answeringPlayer = r2State.players[r2State.currentPlayerIndex];
      answeringPlayer.points -= 1;
      showR2Feedback(`${answeringPlayer.name}: -1`, "incorrect");
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

  const answeringPlayer = r2State.players[r2State.currentPlayerIndex];
  showR2Feedback(`${answeringPlayer.name}: Time's up! +0`, "timeout");
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
