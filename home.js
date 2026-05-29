/* ============================================================
   home.js — ALPHA Platform · Home Page Module
   Handles: balance display, mining, boost, streak, supply bar
   Independent: errors here don't affect other modules
   ============================================================ */

const HOME = (() => {

  let _loaded = false;

  // ── Init (called once on boot) ────────────────────────────
  const init = async () => {
    updateBalanceUI();
    updateSupplyBar();
    renderStreak();
    updateBoostUI();
    showSection(
      document.getElementById("loader-home"),
      document.getElementById("home-content")
    );
    _loaded = true;
  };

  const refresh = () => {
    if (!_loaded) { init(); return; }
    updateBalanceUI();
    updateSupplyBar();
    renderStreak();
    updateBoostUI();
  };

  // ── Balance ring ──────────────────────────────────────────
  const updateBalanceUI = () => {
    const u = window._currentUser;
    if (!u) return;

    const bal  = u.balance || 0;
    const rank = getRank(bal);

    document.getElementById("bal-num").textContent  = fmtNum(bal);
    document.getElementById("bal-rank").textContent = rank.title;

    // Arc fills relative to rank threshold
    const arcPct = Math.min((u.sessions || 0) / 200, 1);
    document.getElementById("bal-arc").style.strokeDashoffset = 478 - 478 * arcPct;

    document.getElementById("stat-sessions").textContent = u.sessions || 0;
    document.getElementById("stat-refs").textContent     = u.refs?.length ?? 0;
  };

  // ── Supply bar ────────────────────────────────────────────
  const updateSupplyBar = () => {
    const mined    = window._globalStats?.totalMined || 0;
    const pct      = Math.min((mined / APP_CONFIG.MAX_SUPPLY) * 100, 100);

    document.getElementById("supply-bar").style.width   = `${pct}%`;
    document.getElementById("supply-pct").textContent   = `${pct.toFixed(6)}%`;
    document.getElementById("supply-mined").textContent = `${fmtNum(mined)} mined`;
  };

  // ── Streak ────────────────────────────────────────────────
  const renderStreak = () => {
    const u = window._currentUser;
    if (!u) return;

    const streak     = u.streak || { count: 0, lastClaim: 0 };
    const today      = new Date().toDateString();
    const lastDay    = new Date(streak.lastClaim || 0).toDateString();
    const alreadyDid = lastDay === today;

    document.getElementById("streak-info").textContent =
      `Current streak: ${streak.count || 0} days 🔥`;

    const btn = document.getElementById("streak-btn");
    const reward = APP_CONFIG.STREAK_REWARDS[streak.count + 1] || APP_CONFIG.STREAK_REWARDS.default;
    btn.textContent = alreadyDid ? "✅ CLAIMED TODAY" : `CLAIM +${reward} ALPHA`;
    btn.disabled    = alreadyDid;

    // Show last 7 days
    const days = document.getElementById("streak-days");
    days.innerHTML = "";
    for (let i = 1; i <= 7; i++) {
      const div = document.createElement("div");
      div.className = "streak-day";
      div.textContent = i;
      if (i < (streak.count % 7 || 7)) div.classList.add("done");
      if (i === ((streak.count % 7) + 1) || (streak.count % 7 === 0 && i === 1)) {
        div.classList.add(alreadyDid ? "done" : "today");
      }
      days.appendChild(div);
    }
  };

  return { init, refresh, updateBalanceUI, updateSupplyBar, renderStreak };

})();

/* ============================================================
   MINING MODULE
   Handles: 3h mine, boost, miner banner, countdown
   ============================================================ */
const MINING = (() => {

  let _countdownId = null;

  // ── 3-hour mine ───────────────────────────────────────────
  const handleMine = async () => {
    const btn = document.getElementById("mine-btn");
    btn.disabled    = true;
    btn.textContent = "⏳ CLAIMING...";

    const result = await DB.api.mine(String(TG_USER.id));

    if (!result.ok) {
      showToast(result.error, "err");
    } else {
      showToast(`+${result.reward} ALPHA mined! ⚡`, "suc");
    }
    // UI updates via real-time listener
  };

  // ── Daily streak claim ────────────────────────────────────
  const claimStreak = async () => {
    const btn    = document.getElementById("streak-btn");
    btn.disabled = true;

    const result = await DB.api.claimStreak(String(TG_USER.id));

    if (!result.ok) {
      showToast(result.error, "err");
      btn.disabled = false;
    } else {
      showToast(`+${result.reward} ALPHA streak bonus! 🔥`, "suc");
    }
  };

  // ── Boost ─────────────────────────────────────────────────
  const buyBoost = async () => {
    const btn    = document.getElementById("boost-btn");
    btn.disabled = true;

    const result = await DB.api.buyBoost(String(TG_USER.id));

    if (!result.ok) {
      showToast(result.error, "err");
      btn.disabled = false;
    } else {
      showToast("2x boost activated for 24 hours! ⚡", "suc");
    }
  };

  const updateBoostUI = () => {
    const u     = window._currentUser;
    const boost = u?.boost;
    const btn   = document.getElementById("boost-btn");
    const info  = document.getElementById("boost-info");
    if (!btn) return;

    if (boost && boost.expiresAt > Date.now()) {
      const rem = boost.expiresAt - Date.now();
      info.textContent = `⚡ ACTIVE — ${msToHMS(rem)} remaining`;
      btn.disabled     = true;
      btn.textContent  = "BOOST ACTIVE";
    } else {
      info.textContent = "2x mining reward for 24 hours";
      btn.disabled     = false;
      btn.textContent  = `ACTIVATE BOOST — ${APP_CONFIG.BOOST_COST.toLocaleString()} ALPHA`;
    }
  };

  // ── Miner banner ──────────────────────────────────────────
  const updateMinerBanner = () => {
    const banner = document.getElementById("miner-banner");
    const u      = window._currentUser;
    const miner  = u?.miner;

    if (!miner || miner.expired) { banner.classList.remove("show"); return; }

    banner.classList.add("show");
    const label  = miner.type === "beta" ? "BETA MINER (12h)" : "ALPHA MINER (24h)";
    const reward = miner.type === "beta" ? APP_CONFIG.MINER_BETA_REWARD : APP_CONFIG.MINER_ALPHA_REWARD;
    const now    = Date.now();
    const canClaim = now >= miner.claimableAt && !miner.claimedAt;

    document.getElementById("miner-title").textContent = `⚡ ${label} ACTIVE`;
    document.getElementById("miner-info").textContent  = `Expires: ${new Date(miner.expiresAt).toLocaleString()}`;

    const claimBtn = document.getElementById("miner-claim-btn");
    if (miner.claimedAt) {
      document.getElementById("miner-sub").textContent = "✅ Reward claimed";
      claimBtn.disabled = true; claimBtn.textContent = "REWARD CLAIMED";
    } else if (canClaim) {
      document.getElementById("miner-sub").textContent = "Ready to claim!";
      claimBtn.disabled = false; claimBtn.textContent = `CLAIM +${reward} ALPHA`;
    } else {
      const rem = miner.claimableAt - now;
      const h   = Math.floor(rem / 3600000);
      const m   = Math.floor((rem % 3600000) / 60000);
      document.getElementById("miner-sub").textContent = `Claimable in ${h}h ${m}m`;
      claimBtn.disabled = true; claimBtn.textContent = "NOT YET CLAIMABLE";
    }
  };

  const claimReward = async () => {
    const btn    = document.getElementById("miner-claim-btn");
    btn.disabled = true; btn.textContent = "CLAIMING...";
    const result = await DB.api.claimMiner(String(TG_USER.id));
    if (!result.ok) {
      showToast(result.error, "err");
      updateMinerBanner();
    } else {
      showToast(`+${result.reward} ALPHA claimed from miner! 🎉`, "suc");
    }
  };

  // ── Countdown ─────────────────────────────────────────────
  const startCountdown = () => {
    if (_countdownId) clearInterval(_countdownId);
    _countdownId = setInterval(_tick, 1000);
    _tick();
  };

  const _tick = () => {
    const btn    = document.getElementById("mine-btn");
    const timer  = document.getElementById("mine-timer");
    const u      = window._currentUser;
    if (!btn || !u) return;

    // Hide normal mine button if active miner is running
    const { miner } = u;
    if (miner && !miner.expired && !miner.claimedAt) {
      btn.style.display   = "none";
      timer.style.display = "none";
      updateMinerBanner();
      return;
    }
    btn.style.display = "block";

    const elapsed = Date.now() - (u.lastMine || 0);
    const ready   = u.lastMine === 0 || elapsed >= APP_CONFIG.MINE_INTERVAL;

    if (ready) {
      btn.disabled    = false;
      btn.textContent = "⚡ COLLECT MINING REWARD";
      timer.style.display = "none";
    } else {
      btn.disabled    = true;
      btn.textContent = "⏳ MINING IN PROGRESS...";
      const rem = APP_CONFIG.MINE_INTERVAL - elapsed;
      timer.style.display  = "block";
      timer.innerHTML = `Next claim in <span>${msToHMS(rem)}</span>`;
    }

    updateBoostUI();
  };

  return { handleMine, claimStreak, buyBoost, updateBoostUI, updateMinerBanner, claimReward, startCountdown };

})();
