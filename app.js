/* ============================================================
   app.js — ALPHA Platform · Main Boot
   Initialises the app, sets up all real-time listeners,
   handles maintenance mode and onboarding.
   Each section is independently managed by its own module.
   ============================================================ */

// Global user state — all modules read from this
window._currentUser  = null;
window._globalStats  = { totalMined: 0 };
window._globalConfig = {};

// Telegram SDK
const tg = window.Telegram?.WebApp ?? null;
if (tg) { tg.ready(); tg.expand(); }

const TG_USER = tg?.initDataUnsafe?.user ?? {
  id: 100000001, first_name: "Demo", username: "demo_user",
};

// ── Onboarding state ──────────────────────────────────────────
let _obStep = 0;
const OB_STEPS = [
  { icon: "⚡", title: "Welcome to ALPHA", desc: "The premier crypto airdrop platform. Mine ALPHA tokens every 3 hours and build your balance." },
  { icon: "👥", title: "Refer & Earn",      desc: "Share your referral link. Earn 150 ALPHA for every verified friend you bring in." },
  { icon: "🎮", title: "Battle & Win",      desc: "Play Alpha World War. Defeat enemies and win ALPHA tokens in PvP arena battles." },
];

const nextOnboard = () => {
  _obStep++;
  if (_obStep >= OB_STEPS.length) {
    document.getElementById("onboarding").classList.remove("show");
    localStorage.setItem(`alpha_onboarded_${TG_USER.id}`, "1");
    return;
  }
  const s = OB_STEPS[_obStep];
  document.getElementById("ob-icon").textContent  = s.icon;
  document.getElementById("ob-title").textContent = s.title;
  document.getElementById("ob-desc").textContent  = s.desc;
  document.getElementById("ob-btn").textContent   = _obStep === OB_STEPS.length - 1 ? "GET STARTED ✓" : "NEXT →";
  // Update dots
  for (let i = 0; i < OB_STEPS.length; i++) {
    document.getElementById(`od${i}`)?.classList.toggle("active", i === _obStep);
  }
};

/* ============================================================
   BOOT
   ============================================================ */
window.onload = async () => {
  setMsg("CONNECTING...");

  // 1. Listen to config (maintenance mode)
  DB.listenConfig((config) => {
    window._globalConfig = config;
    const maintScreen = document.getElementById("maintenance-screen");
    if (config.maintenance) {
      maintScreen.classList.add("show");
    } else {
      maintScreen.classList.remove("show");
    }
  });

  // 2. Get referral param
  const startParam =
    tg?.initDataUnsafe?.start_param ??
    new URLSearchParams(window.location.search).get("tgWebAppStartParam") ??
    "";
  const referredBy = startParam.startsWith("ref_")
    ? startParam.replace("ref_", "")
    : null;

  // 3. Init user on backend
  setMsg("LOADING USER...");
  const deviceInfo = DEVICE.collect();
  const riskScore  = DEVICE.riskScore(deviceInfo);
  const result = await DB.api.initUser({
    userId:     String(TG_USER.id),
    name:       TG_USER.first_name || "User",
    username:   TG_USER.username   || "",
    referredBy: referredBy && referredBy !== String(TG_USER.id) ? referredBy : null,
    device: deviceInfo, riskScore,
  });

  if (!result.ok) {
    setMsg("CONNECTION FAILED. PLEASE REFRESH.");
    return;
  }

  window._currentUser = result.user;

  // 4. Attach real-time listeners
  setMsg("SYNCING DATA...");

  // User document — updates entire UI whenever user data changes
  DB.listenUser(String(TG_USER.id), (freshUser) => {
    window._currentUser = freshUser;
    updateHeaderUI();
    HOME.updateBalanceUI();
    MINING.updateMinerBanner();
    MINING.updateBoostUI();
    REFS.updateCount();
    updateNotifDot();
  });

  // Global stats
  DB.listenGlobalStats((stats) => {
    window._globalStats = stats;
    HOME.updateSupplyBar();
  });

  // Notifications
  DB.listenUserNotifications(String(TG_USER.id), (notifs) => {
    renderNotifications(notifs);
    updateNotifDot(notifs.length > 0);
  });

  // X-queue — admin approved/rejected task
  DB.listenUserXItems(String(TG_USER.id), (items) => {
    items.forEach(item => {
      if (item.notified) return;
      if (item.status === "verified") {
        showToast(`✅ Task "${item.taskName}" verified! +${item.reward} ALPHA`, "suc");
        if (NAV.current === "tasks") TASKS.load();
        DB._fs.collection("xQueue").doc(item.docId).update({ notified: true });
      } else if (item.status === "rejected") {
        showToast(`❌ "${item.taskName}" rejected — please complete it and retry.`, "err");
        if (NAV.current === "tasks") TASKS.load();
        DB._fs.collection("xQueue").doc(item.docId).update({ notified: true });
      }
    });
  });

  // NFT requests — admin marked as sent
  DB.listenUserNFTRequests(String(TG_USER.id), (reqs) => {
    reqs.filter(r => r.status === "sent" && !r.notified).forEach(req => {
      showToast("NFT transfer completed! ✅", "suc");
      DB._fs.collection("nftRequests").doc(req.reqId).update({ notified: true });
    });
  });

  // Withdrawals — admin approved
  DB.listenUserWithdrawals(String(TG_USER.id), (wds) => {
    wds.filter(w => (w.status === "approved" || w.status === "rejected") && !w.notified).forEach(wd => {
      const msg = wd.status === "approved"
        ? `✅ Withdrawal of ${wd.amount} ${wd.currency} approved!`
        : `❌ Withdrawal rejected. Contact support.`;
      showToast(msg, wd.status === "approved" ? "suc" : "err");
      DB._fs.collection("withdrawals").doc(wd.txId).update({ notified: true });
    });
  });

  // 5. Load home page
  setMsg("ALMOST READY...");
  await HOME.init();
  MINING.startCountdown();

  // 6. Show app
  document.getElementById("global-loading").style.display = "none";
  document.getElementById("app").style.display = "block";

  // 7. Check inactivity (30 days)
  checkInactivity();

  // 8. Show onboarding if first time
  const onboarded = localStorage.getItem(`alpha_onboarded_${TG_USER.id}`);
  if (!onboarded) {
    document.getElementById("onboarding").classList.add("show");
  }
};

const setMsg = (msg) => {
  const el = document.getElementById("loading-msg");
  if (el) el.textContent = msg;
};

/* ============================================================
   HEADER UI
   ============================================================ */
const updateHeaderUI = () => {
  const u = window._currentUser;
  if (!u) return;

  document.getElementById("hdr-name").textContent = u.name;
  document.getElementById("hdr-id").textContent   = `ID: ${u.id}`;
  document.getElementById("hdr-bal").textContent  = fmtNum(u.balance || 0);
  document.getElementById("avatar-btn").firstChild.textContent = (u.name[0] || "A").toUpperCase();

  // Rank badge
  const rank   = getRank(u.balance || 0);
  const badge  = document.getElementById("rank-badge");
  badge.textContent = getRankSymbol(rank.wolf);
  badge.className   = `hdr-rank-badge ${getRankClass(rank.wolf)}`;
};

const updateNotifDot = (hasUnread) => {
  const dot = document.getElementById("notif-dot");
  if (dot) dot.classList.toggle("show", !!hasUnread);
};

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
const renderNotifications = (notifs) => {
  const body = document.getElementById("notif-body");
  if (!body) return;
  body.innerHTML = notifs.length
    ? notifs.map(n => `
        <div class="notif-item unread" onclick="markNotifRead('${n.docId}')">
          <div class="notif-type">${(n.type || "INFO").toUpperCase()}</div>
          <div class="notif-msg">${n.message}</div>
          <div class="notif-ts">${timeSince(n.ts)}</div>
        </div>`).join("")
    : '<div class="empty-state">No new notifications</div>';
};

const markNotifRead = async (docId) => {
  await DB.api.markNotifRead(String(TG_USER.id), docId);
};

/* ============================================================
   INACTIVITY CHECK
   ============================================================ */
const checkInactivity = () => {
  const u = window._currentUser;
  if (!u) return;
  const lastSeen = u.lastSeen || 0;
  const days     = (Date.now() - lastSeen) / 86400000;
  if (days > APP_CONFIG.INACTIVITY_DAYS) {
    showToast(`⚠️ Welcome back! You were inactive for ${Math.floor(days)} days.`, "warn");
  }
};
