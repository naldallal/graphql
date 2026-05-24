/**
 * profile.js
 * Orchestrates data fetching and UI population for profile.html.
 * Depends on: auth.js, api.js, charts.js
 */

/* ── Guard: redirect if not logged in ── */
requireAuth();

/* ── Logout button ── */
document.getElementById("logoutBtn")?.addEventListener("click", logout);

/* ── Helpers ── */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function formatXPLabel(xp) {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)} MB`;
  if (xp >= 1_000)     return `${Math.round(xp / 1_000)} kB`;
  return `${xp} B`;
}

/* ── Populate hero section ── */
function renderHero(user) {
  if (!user) return;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.login;
  const initials = fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  setText("heroName",      fullName);
  setText("heroLogin",     `@${user.login}`);
  setText("heroCampus",    user.campus || "Reboot01");
  setText("navUsername",   user.login);

  const avatarEl = document.getElementById("userAvatar");
  if (avatarEl) avatarEl.textContent = initials;

  // XP from transactions will be filled after xp fetch; level from user
  const level = user.transactions?.[0]?.amount ?? "—";
  setText("statLevel", level);

  const ratio = user.auditRatio != null ? Number(user.auditRatio).toFixed(2) : "—";
  setText("statAuditRatio", ratio);
}

/* ── Populate recent projects list ── */
function renderProjects(results) {
  const list = document.getElementById("recentProjects");
  if (!list) return;
  list.innerHTML = "";

  if (!results.length) {
    list.innerHTML = `<li style="color:#64748b;font-size:.85rem;padding:.5rem 0">No project results found.</li>`;
    return;
  }

  results.forEach((r) => {
    const li = document.createElement("li");
    li.className = "project-item";
    const pass = Number(r.grade) >= 1;
    const date = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "";
    li.innerHTML = `
      <span class="project-name">${r.object?.name ?? "Unknown"}</span>
      <span style="display:flex;gap:.5rem;align-items:center;">
        <span class="badge ${pass ? "badge-pass" : "badge-fail"}">${pass ? "PASS" : "FAIL"}</span>
        <span style="font-size:.75rem;color:#64748b">${date}</span>
      </span>
    `;
    list.appendChild(li);
  });
}

/* ── Populate skills section ── */
function renderSkills(skills) {
  const container = document.getElementById("skillsList");
  if (!container) return;
  container.innerHTML = "";

  if (!skills.length) {
    container.innerHTML = `<p style="color:#64748b;font-size:.85rem">No skill data found.</p>`;
    return;
  }

  const maxAmount = Math.max(...skills.map((s) => s.amount), 1);

  skills.forEach((s) => {
    const pct = Math.round((s.amount / maxAmount) * 100);
    const div = document.createElement("div");
    div.className = "skill-row";
    div.innerHTML = `
      <div class="skill-header">
        <span class="skill-name">${capitalize(s.name)}</span>
        <span class="skill-val">${s.amount}%</span>
      </div>
      <div class="skill-bar-bg">
        <div class="skill-bar-fill" style="width:0%" data-pct="${pct}"></div>
      </div>
    `;
    container.appendChild(div);
  });

  // Animate bars after insert
  requestAnimationFrame(() => {
    container.querySelectorAll(".skill-bar-fill").forEach((bar) => {
      bar.style.width = `${bar.dataset.pct}%`;
    });
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ── Main: fetch everything in parallel ── */
async function loadProfile() {
  try {
    const [user, xpTxs, projectResults, auditCounts, piscineData, skills, recentProjects] =
      await Promise.all([
        fetchUserInfo(),
        fetchXPTransactions(),
        fetchProjectResults(),
        fetchAuditCounts(),
        fetchPiscineAttempts(),
        fetchSkills(),
        fetchRecentProjects(),
      ]);

    // --- Hero ---
    renderHero(user);

    // --- XP total ---
    const totalXP = xpTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    setText("statXP", formatXPLabel(totalXP));

    // --- Charts ---
    drawXPTimeline(xpTxs);
    drawPassFailChart(projectResults);
    drawAuditBarChart(auditCounts.upCount, auditCounts.downCount);
    // drawPiscineAttemptsBarChart(piscineData);

    // --- Lists ---
    renderProjects(recentProjects);
    renderSkills(skills);

  } catch (err) {
    console.error("[profile] load error:", err);
    // If auth error, requireAuth/logout already redirect;
    // for other errors show a gentle banner.
    if (err.message && !err.message.includes("JWT")) {
      const banner = document.createElement("div");
      banner.style.cssText = `
        position:fixed; bottom:1.5rem; right:1.5rem; z-index:999;
        background:#1e293b; border:1px solid #ef4444; color:#ef4444;
        padding:.75rem 1.25rem; border-radius:12px; font-size:.85rem;
        font-family:DM Sans,sans-serif;
      `;
      banner.textContent = `Failed to load some data: ${err.message}`;
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 6000);
    }
  }
}

loadProfile();
