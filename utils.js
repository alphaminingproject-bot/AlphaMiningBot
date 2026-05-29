/* ============================================================
   utils.js — ALPHA Platform · Shared Utilities
   Used by every module. Load before any other script.
   ============================================================ */

// ── Toast ─────────────────────────────────────────────────────
let _toastTimer = null;
const showToast = (msg, type = "") => {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast show${type ? ` ${type}` : ""}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = "toast"; }, 2800);
};

// ── Overlay helpers ───────────────────────────────────────────
const openOverlay  = (id) => document.getElementById(id)?.classList.add("show");
const closeOverlay = (id) => document.getElementById(id)?.classList.remove("show");
const showModal    = (id) => document.getElementById(id)?.classList.add("show");
const closeModal   = (id) => document.getElementById(id)?.classList.remove("show");
const openMoreMenu = ()   => showModal("more-menu");

// ── Section loader ────────────────────────────────────────────
// Shows spinner until content is ready, then fades in content
const showSection = (loaderEl, contentEl) => {
  if (loaderEl) loaderEl.style.display = "none";
  if (contentEl) { contentEl.style.display = "block"; contentEl.style.animation = "fadeUp 0.2s ease"; }
};

// ── Time helpers ──────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, "0");

const timeSince = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const formatDate = (ts) => new Date(ts).toLocaleString();

const msToHMS = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

// ── Number formatting ─────────────────────────────────────────
const fmtNum = (n) => {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + "B";
  if (n >= 1000000)    return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)       return (n / 1000).toFixed(1) + "K";
  return Math.floor(n).toLocaleString();
};

// ── Rank helper ───────────────────────────────────────────────
const getRank = (balance) => {
  const ranks = APP_CONFIG.RANKS;
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (balance >= ranks[i].min) return ranks[i];
  }
  return ranks[0];
};

const getRankClass = (wolf) => {
  const map = { omega: "rank-omega", beta: "rank-beta", alpha: "rank-alpha", aoa: "rank-aoa" };
  return map[wolf] || "rank-omega";
};

const getRankSymbol = (wolf) => {
  const map = { omega: "Ω", beta: "β", alpha: "α", aoa: "Α★" };
  return map[wolf] || "Ω";
};

// ── Wolf SVG avatars ──────────────────────────────────────────
// Stylized SVG wolves for each rank — replace with real images later
const WOLF_SVG = {
  omega: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#1a1a2e" stroke="#555" stroke-width="2"/>
    <ellipse cx="40" cy="48" rx="20" ry="16" fill="#444"/>
    <ellipse cx="40" cy="32" rx="16" ry="14" fill="#555"/>
    <polygon points="28,22 24,10 34,20" fill="#555"/>
    <polygon points="52,22 56,10 46,20" fill="#555"/>
    <ellipse cx="34" cy="30" rx="4" ry="4" fill="#1a1a2e"/>
    <ellipse cx="46" cy="30" rx="4" ry="4" fill="#1a1a2e"/>
    <circle cx="34" cy="30" r="2" fill="#aaa"/>
    <circle cx="46" cy="30" r="2" fill="#aaa"/>
    <ellipse cx="40" cy="37" rx="5" ry="3" fill="#333"/>
    <text x="40" y="65" text-anchor="middle" fill="#777" font-size="8" font-family="monospace">OMEGA</text>
  </svg>`,

  beta: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#1a0e05" stroke="#8b5a2b" stroke-width="2"/>
    <ellipse cx="40" cy="48" rx="22" ry="17" fill="#6b3a1f"/>
    <ellipse cx="40" cy="31" rx="17" ry="15" fill="#8b5a2b"/>
    <polygon points="27,21 22,8 35,19" fill="#8b5a2b"/>
    <polygon points="53,21 58,8 45,19" fill="#8b5a2b"/>
    <ellipse cx="34" cy="29" rx="4" ry="4" fill="#1a0e05"/>
    <ellipse cx="46" cy="29" rx="4" ry="4" fill="#1a0e05"/>
    <circle cx="34" cy="29" r="2" fill="#cd7f32"/>
    <circle cx="46" cy="29" r="2" fill="#cd7f32"/>
    <ellipse cx="40" cy="36" rx="6" ry="3" fill="#5a2e0e"/>
    <path d="M35 40 Q40 44 45 40" stroke="#cd7f32" stroke-width="1.5" fill="none"/>
    <text x="40" y="65" text-anchor="middle" fill="#cd7f32" font-size="8" font-family="monospace">BETA</text>
  </svg>`,

  alpha: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="40" cy="40" r="38" fill="#0a0a1a" stroke="#aaa" stroke-width="2"/>
    <ellipse cx="40" cy="48" rx="22" ry="17" fill="#888"/>
    <ellipse cx="40" cy="30" rx="18" ry="16" fill="#bbb"/>
    <polygon points="26,20 21,6 36,18" fill="#bbb"/>
    <polygon points="54,20 59,6 44,18" fill="#bbb"/>
    <ellipse cx="33" cy="28" rx="5" ry="5" fill="#0a0a1a"/>
    <ellipse cx="47" cy="28" rx="5" ry="5" fill="#0a0a1a"/>
    <circle cx="33" cy="28" r="2.5" fill="#e0e0ff"/>
    <circle cx="47" cy="28" r="2.5" fill="#e0e0ff"/>
    <ellipse cx="40" cy="35" rx="6" ry="3" fill="#777"/>
    <path d="M34 39 Q40 44 46 39" stroke="#ddd" stroke-width="1.5" fill="none"/>
    <line x1="28" y1="34" x2="18" y2="32" stroke="#999" stroke-width="1"/>
    <line x1="52" y1="34" x2="62" y2="32" stroke="#999" stroke-width="1"/>
    <text x="40" y="65" text-anchor="middle" fill="#ccc" font-size="8" font-family="monospace">ALPHA</text>
  </svg>`,

  aoa: `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="aoa-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f0b429" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="40" cy="40" r="38" fill="#050208" stroke="#f0b429" stroke-width="2"/>
    <circle cx="40" cy="40" r="38" fill="url(#aoa-glow)"/>
    <!-- Crown -->
    <polygon points="22,18 27,8 32,15 40,5 48,15 53,8 58,18" fill="#f0b429" opacity="0.9"/>
    <ellipse cx="40" cy="50" rx="22" ry="17" fill="#1a1a2e"/>
    <ellipse cx="40" cy="32" rx="18" ry="16" fill="#111122"/>
    <polygon points="26,22 21,8 36,20" fill="#111122"/>
    <polygon points="54,22 59,8 44,20" fill="#111122"/>
    <ellipse cx="33" cy="30" rx="5" ry="5" fill="#000"/>
    <ellipse cx="47" cy="30" rx="5" ry="5" fill="#000"/>
    <circle cx="33" cy="30" r="3" fill="#f0b429" opacity="0.9"/>
    <circle cx="47" cy="30" r="3" fill="#f0b429" opacity="0.9"/>
    <ellipse cx="40" cy="37" rx="6" ry="3" fill="#0a0a15"/>
    <path d="M34 41 Q40 47 46 41" stroke="#f0b429" stroke-width="2" fill="none"/>
    <line x1="27" y1="35" x2="16" y2="32" stroke="#f0b429" stroke-width="1.5" opacity="0.7"/>
    <line x1="53" y1="35" x2="64" y2="32" stroke="#f0b429" stroke-width="1.5" opacity="0.7"/>
    <circle cx="27" cy="18" r="2" fill="#f0b429"/>
    <circle cx="40" cy="13" r="2.5" fill="#f0b429"/>
    <circle cx="53" cy="18" r="2" fill="#f0b429"/>
    <text x="40" y="66" text-anchor="middle" fill="#f0b429" font-size="7" font-family="monospace" font-weight="bold">ALPHA OF ALPHAS</text>
  </svg>`,
};

// ── Unique ID generator ───────────────────────────────────────
const genTxId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "TX";
  for (let i = 0; i < 10; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const genMatchCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

// ── Copy to clipboard ─────────────────────────────────────────
const copyText = (text) => {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  const el = document.createElement("textarea");
  el.value = text; document.body.appendChild(el); el.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(el);
};

// ── Navigation ────────────────────────────────────────────────
const NAV = {
  current: "home",

  go(pageName, btn) {
    // Hide all pages
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

    document.getElementById(`page-${pageName}`)?.classList.add("active");
    if (btn) btn.classList.add("active");

    this.current = pageName;

    // Trigger page-specific load
    const loaders = {
      home:     () => HOME.refresh(),
      tasks:    () => TASKS.load(),
      shop:     () => SHOP.load(),
      game:     () => GAME.load(),
      lb:       () => LB.load(),
      ref:      () => REFS.load(),
      ads:      () => ADS.load(),
      transfer: () => TRANSFER.load(),
      wallet:   () => WALLET.load(),
    };
    loaders[pageName]?.();
  },
};

// ── History overlay ───────────────────────────────────────────
const openHistory = () => {
  const user = window._currentUser;
  if (!user) return;
  const hist = user.history || [];
  const body = document.getElementById("history-body");

  body.innerHTML = hist.length
    ? hist.map(h => `
        <div class="txn-item">
          <div class="txn-row1">
            <span class="txn-type">${h.type.toUpperCase()}</span>
            <span class="txn-amt ${h.amount > 0 ? "pos" : "neg"}">${h.amount > 0 ? "+" : ""}${h.amount.toFixed(1)} ALPHA</span>
          </div>
          <div class="txn-desc">${h.desc}</div>
          <div class="txn-id" onclick="copyText('${h.id}');showToast('ID copied ✅','suc')">📋 ${h.id}</div>
          <div class="txn-ts">${formatDate(h.ts)} · Balance after: ${fmtNum(h.balanceAfter)} ALPHA</div>
        </div>`).join("")
    : '<div class="empty-state">No transactions yet</div>';

  openOverlay("overlay-history");
};

// ── Notifications overlay ─────────────────────────────────────
const openNotifications = () => {
  openOverlay("overlay-notifications");
  // Content is populated by profile.js listener
};

// ── Profile overlay ───────────────────────────────────────────
const openProfile = () => {
  PROFILE.open();
};
