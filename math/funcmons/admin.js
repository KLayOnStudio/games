// Admin activity dashboard — talks to the same backend as the game, but
// through password-gated endpoints (see backend/main.py's /dashboard/* routes).
// The password itself lives in the database as a salted hash; this page
// never touches the database directly, only the API, same as every other
// page in this app.

const API_BASE_URL = "https://funcmons-app-exduaqezbqeydcet.centralus-01.azurewebsites.net";

const adminPasswordInput = document.getElementById("admin-password");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminHint = document.getElementById("admin-hint");
const adminLogin = document.getElementById("admin-login");
const adminResults = document.getElementById("admin-results");
const adminTableBody = document.getElementById("admin-table-body");
const adminRefreshBtn = document.getElementById("admin-refresh-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminCurrentPasswordInput = document.getElementById("admin-current-password");
const adminNewPasswordInput = document.getElementById("admin-new-password");
const adminChangeHint = document.getElementById("admin-change-hint");
const adminChangeBtn = document.getElementById("admin-change-btn");

// Kept only in memory for this page load — never written to localStorage,
// so it doesn't linger on a shared classroom/office computer.
let currentPassword = "";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
}

function renderRows(rows) {
  if (!rows.length) {
    adminTableBody.innerHTML = `<tr><td colspan="8">No activity recorded yet.</td></tr>`;
    return;
  }

  adminTableBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.schoolYear)}</td>
        <td>${escapeHtml(r.campus)}</td>
        <td>${escapeHtml(r.className)}</td>
        <td>${r.totalPlays}</td>
        <td>${r.uniqueStudents}</td>
        <td>${r.round1Plays}</td>
        <td>${r.round2Plays}</td>
        <td>${formatDate(r.lastPlayedAt)}</td>
      </tr>`
    )
    .join("");
}

async function loadActivity(password) {
  adminHint.textContent = "Loading…";
  adminLoginBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/activity`, {
      headers: { "X-Admin-Password": password },
    });

    if (response.status === 401) {
      adminHint.textContent = "Incorrect password.";
      return;
    }
    if (!response.ok) {
      adminHint.textContent = "Could not load activity — try again.";
      return;
    }

    const rows = await response.json();
    renderRows(rows);
    currentPassword = password;
    adminLogin.classList.add("hidden");
    adminResults.classList.remove("hidden");
    adminHint.textContent = "";
  } catch (err) {
    console.warn("Could not reach the admin API", err);
    adminHint.textContent = "Could not reach the server.";
  } finally {
    adminLoginBtn.disabled = false;
  }
}

adminLoginBtn.addEventListener("click", () => {
  const password = adminPasswordInput.value;
  if (!password) {
    adminHint.textContent = "Enter the admin password.";
    return;
  }
  loadActivity(password);
});

adminPasswordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") adminLoginBtn.click();
});

adminRefreshBtn.addEventListener("click", () => {
  if (currentPassword) loadActivity(currentPassword);
});

adminLogoutBtn.addEventListener("click", () => {
  currentPassword = "";
  adminPasswordInput.value = "";
  adminResults.classList.add("hidden");
  adminLogin.classList.remove("hidden");
  adminHint.textContent = "";
});

adminChangeBtn.addEventListener("click", async () => {
  const current = adminCurrentPasswordInput.value;
  const next = adminNewPasswordInput.value;

  if (!current || !next) {
    adminChangeHint.textContent = "Fill in both fields.";
    return;
  }
  if (next.length < 6) {
    adminChangeHint.textContent = "New password must be at least 6 characters.";
    return;
  }

  adminChangeHint.textContent = "Updating…";
  adminChangeBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    if (response.status === 401) {
      adminChangeHint.textContent = "Current password is incorrect.";
      return;
    }
    if (!response.ok) {
      adminChangeHint.textContent = "Could not update the password — try again.";
      return;
    }

    currentPassword = next;
    adminCurrentPasswordInput.value = "";
    adminNewPasswordInput.value = "";
    adminChangeHint.textContent = "Password updated.";
  } catch (err) {
    console.warn("Could not reach the admin API", err);
    adminChangeHint.textContent = "Could not reach the server.";
  } finally {
    adminChangeBtn.disabled = false;
  }
});
