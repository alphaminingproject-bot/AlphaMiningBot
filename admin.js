/* ============================================================
   admin.js — ALPHA Platform · Admin Dashboard Logic
   All writes go through the secure backend API.
   Real-time listeners update every table automatically.
   ============================================================ */

const ADMIN_LOGIN_PASSWORD = "alpha2025admin"; // ← change this
// let   ADMIN_SECRET         = "";
let   API                  = null;
let   _allUsers            = [];

/* ============================================================
   LOGIN
   ============================================================ */
const doLogin = () => {
  const pw     = document.getElementById("pw-input").value;
  const secret = document.getElementById("secret-input").value.trim();

  if (pw !== ADMIN_LOGIN_PASSWORD) {
    document.getElementById("login-err").textContent = "Incorrect password";
    return;
  }
  if (!secret) {
    document.getElementById("login-err").textContent = "Admin secret key required";
    return;
  }

  ADMIN_SECRET = secret;
  API          = DB.adminApi(ADMIN_SECRET);

  document.getElementById("login-screen").style.display = "none";
  document.getElementById("dashboard").style.display    = "block";
  initDashboard();
};

document.getElementById("pw-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("secret-input").focus();
});
document.getElementById("secret-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

/* ============================================================
   INIT — attach all real-time listeners
   ============================================================ */
const initDashboard = () => {
  // All users — feeds overview, user table, leaderboard
  DB.listenAllUsers(users => {
    _allUsers = users;
    loadOverview();
    renderUsersTable(users);
    renderLeaderboardTable(users);
    updateBadgeDots();
  });

  DB.listenGlobalStats(stats => updateOverviewStats(stats));
  DB.listenXQueue(items   => { renderXQueueTable(items); updateBadgeDots(); });
  DB.listenRefQueue(items => { renderRefQueueTable(items); updateBadgeDots(); });
  DB.listenNFTRequests(reqs => { renderNFTRequestsTable(reqs); updateBadgeDots(); });
  DB.listenWithdrawQueue(wds => { renderWithdrawTable(wds); updateBadgeDots(); });
  DB.listenTasks(tasks   => renderTasksList(tasks));
  DB.listenEvents(events => renderEventsList(events));
  DB.listenAllNFTListings(listings => renderNFTListings(listings));
  DB.listenAirdropLog(log => renderAirdropLog(log));
  DB.listenAdminLog(log   => renderAdminLog(log));
  DB.listenCustomTokens(tokens => renderCustomTokens(tokens));
  DB.listenAllAds(ads => renderAdsQueue(ads));
};

/* ============================================================
   SECTION NAVIGATION
   ============================================================ */
const showSection = (name, el) => {
  document.querySelectorAll(".section").forEach(s  => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`section-${name}`)?.classList.add("active");
  el?.classList.add("active");

  if (name === "backup")     loadBackupStats();
  if (name === "maintenance") loadMaintenanceStatus();
};

/* ============================================================
   BADGE DOTS
   ============================================================ */
const updateBadgeDots = () => {
  const pendingX  = document.querySelectorAll("#x-queue-table tr.pending-row").length;
  const pendingR  = document.querySelectorAll("#ref-queue-table tr.pending-row").length;
  const pendingN  = document.querySelectorAll("#nft-req-table tr.pending-row").length;
  const pendingW  = document.querySelectorAll("#wd-table tr.pending-row").length;
  const pendingAd = document.querySelectorAll("#ads-queue-table tr.pending-row").length;

  toggleDot("dot-x",   pendingX   > 0);
  toggleDot("dot-ref", pendingR   > 0);
  toggleDot("dot-nft", pendingN   > 0);
  toggleDot("dot-wd",  pendingW   > 0);
  toggleDot("dot-ads", pendingAd  > 0);
};

const toggleDot = (id, show) => document.getElementById(id)?.classList.toggle("show", show);

/* ============================================================
   OVERVIEW
   ============================================================ */
const updateOverviewStats = (stats) => {
  const mined = stats.totalMined || 0;
  const left  = Math.max(0, DB.MAX_SUPPLY - mined);
  const pct   = (mined / DB.MAX_SUPPLY * 100).toFixed(4);
  document.getElementById("overview-stats").innerHTML = `
    <div class="stat-card"><div class="stat-label">TOTAL USERS</div><div class="stat-val" id="ov-users">0</div></div>
    <div class="stat-card green"><div class="stat-label">ONLINE NOW</div><div class="stat-val" id="ov-online">0</div></div>
    <div class="stat-card gold"><div class="stat-label">TOTAL MINED</div><div class="stat-val">${fmtNum(mined)}</div><div class="stat-sub">ALPHA</div></div>
    <div class="stat-card"><div class="stat-label">SUPPLY LEFT</div><div class="stat-val">${fmtNum(left)}</div><div class="stat-sub">${pct}% used</div></div>`;
};

const loadOverview = () => {
  const now    = Date.now();
  const online = _allUsers.filter(u => now - (u.lastSeen||0) < 2*60000).length;

  const usersEl  = document.getElementById("ov-users");
  const onlineEl = document.getElementById("ov-online");
  if (usersEl)  usersEl.textContent  = _allUsers.length;
  if (onlineEl) onlineEl.textContent = online;

  // Country breakdown
  const countryCounts = {};
  _allUsers.forEach(u => {
    const c = u.device?.countryGuess || "Unknown";
    countryCounts[c] = (countryCounts[c] || 0) + 1;
  });

  const sorted = [..._allUsers].sort((a,b) => (b.lastSeen||0) - (a.lastSeen||0));
  const tbody  = document.getElementById("overview-table");
  if (!tbody) return;

  tbody.innerHTML = sorted.slice(0, 50).map(u => {
    const isOnline   = now - (u.lastSeen||0) < 2*60000;
    const risk       = u.riskScore || 0;
    const riskClass  = risk >= 50 ? "risk-high" : risk >= 25 ? "risk-medium" : "risk-low";
    const riskLabel  = risk >= 50 ? "HIGH" : risk >= 25 ? "MED" : "LOW";
    const device     = u.device || {};

    return `<tr>
      <td>${isOnline ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 4px var(--green);display:inline-block;margin-right:5px;vertical-align:middle;"></span>' : ""}${u.name}${u.flagged ? ' <span class="badge red">FLAGGED</span>' : ""}</td>
      <td style="color:var(--gray);">${device.countryGuess || "Unknown"}</td>
      <td style="color:var(--gray);">${device.deviceType || "Unknown"}</td>
      <td style="color:var(--gray);">${device.platform || "Unknown"} ${device.os || ""}</td>
      <td><span class="risk-badge ${riskClass}">${riskLabel} ${risk}</span></td>
      <td style="color:var(--gold);font-weight:bold;">${fmtNum(u.balance||0)}</td>
      <td>${u.sessions||0}</td>
      <td>${isOnline ? '<span class="badge green">ONLINE</span>' : '<span class="badge gray">OFFLINE</span>'}</td>
      <td style="color:var(--gray);font-size:10px;">${timeSince(u.lastSeen||0)}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:20px;">No users yet</td></tr>';
};

/* ============================================================
   ALL USERS TABLE
   ============================================================ */
const renderUsersTable = (users) => {
  const search  = document.getElementById("users-search")?.value.toLowerCase() || "";
  const filter  = document.getElementById("users-filter")?.value || "all";
  const badge   = document.getElementById("users-count");

  let filtered = users.filter(u => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search) ||
      String(u.id).includes(search) ||
      (u.username||"").toLowerCase().includes(search) ||
      (u.device?.countryGuess||"").toLowerCase().includes(search);

    const matchFilter =
      filter === "all"      ? true :
      filter === "flagged"  ? u.flagged :
      filter === "high-risk"? (u.riskScore||0) >= 50 :
      filter === "android"  ? u.device?.platform === "Android" :
      filter === "ios"      ? u.device?.platform === "iOS" :
      true;

    return matchSearch && matchFilter;
  }).sort((a,b) => (b.balance||0) - (a.balance||0));

  if (badge) badge.textContent = `${filtered.length} users`;

  const tbody = document.getElementById("users-table");
  if (!tbody) return;

  tbody.innerHTML = filtered.map(u => {
    const risk      = u.riskScore || 0;
    const riskClass = risk >= 50 ? "risk-high" : risk >= 25 ? "risk-medium" : "risk-low";
    return `<tr>
      <td>${u.name}${u.flagged ? ' <span class="badge red">⚑</span>' : ""}</td>
      <td style="color:var(--gray);font-size:10px;">${u.id}</td>
      <td>${u.device?.countryGuess || "Unknown"}</td>
      <td style="font-size:10px;color:var(--gray);">${u.device?.deviceType||""} ${u.device?.platform||""}</td>
      <td><span class="risk-badge ${riskClass}">${risk}</span></td>
      <td style="color:var(--gold);font-weight:bold;">${fmtNum(u.balance||0)}</td>
      <td>${u.refs?.length||0}</td>
      <td>${u.vault ? '<span class="badge green">🔓</span>' : '<span class="badge gray">🔒</span>'}</td>
      <td>${u.flagged ? '<span class="badge red">YES</span>' : '<span class="badge gray">NO</span>'}</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(u.createdAt||0).toLocaleDateString()}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="10" style="text-align:center;color:var(--gray);padding:20px;">No users found</td></tr>';
};

const filterUsersTable = () => renderUsersTable(_allUsers);

/* ============================================================
   USER LOOKUP
   ============================================================ */
const doUserLookup = async () => {
  const query  = document.getElementById("lookup-input").value.trim();
  const result = document.getElementById("lookup-result");
  if (!query) return;

  result.innerHTML = '<div style="color:var(--gray);font-size:11px;padding:10px;">Searching...</div>';

  // Try by ID first, then by username
  let u = await DB.getUser(query);
  if (!u) {
    u = _allUsers.find(x =>
      (x.username || "").toLowerCase() === query.toLowerCase().replace("@","") ||
      x.name.toLowerCase() === query.toLowerCase()
    );
  }

  if (!u) {
    result.innerHTML = `<div style="color:var(--red);font-size:11px;padding:10px;">User not found: ${query}</div>`;
    return;
  }

  const risk      = u.riskScore || 0;
  const riskClass = risk >= 50 ? "risk-high" : risk >= 25 ? "risk-medium" : "risk-low";
  const d         = u.device || {};

  // Task completion list
  const taskStates = u.taskStates || {};
  const tasksDone  = Object.entries(taskStates).filter(([,v]) => v === "done").length;
  const tasksPend  = Object.entries(taskStates).filter(([,v]) => v === "pending").length;

  // History
  const histHtml = (u.history||[]).slice(0,30).map(h => {
    const pos = h.amount > 0;
    return `<tr>
      <td style="font-size:9px;color:var(--gray);">${h.id}</td>
      <td>${h.type}</td>
      <td>${h.desc}</td>
      <td style="color:${pos?"var(--green)":"var(--red)"};font-weight:bold;">${pos?"+":""}${h.amount.toFixed(1)}</td>
      <td>${fmtNum(h.balanceAfter)}</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(h.ts).toLocaleString()}</td>
    </tr>`;
  }).join("") || '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:10px;">No history</td></tr>';

  result.innerHTML = `
    <div class="ud-card">
      <div class="ud-name">${u.name}${u.username ? ` (@${u.username})` : ""}${u.flagged ? ' <span class="badge red">FLAGGED</span>' : ""}</div>
      <div class="ud-meta">
        ID: <strong>${u.id}</strong> &nbsp;·&nbsp;
        Joined: <strong>${new Date(u.createdAt||0).toLocaleDateString()}</strong> &nbsp;·&nbsp;
        Last seen: <strong>${timeSince(u.lastSeen||0)}</strong> &nbsp;·&nbsp;
        Referred by: <strong>${u.referredBy||"None"}</strong>
      </div>

      <div class="ud-grid">
        <div class="ud-stat"><div class="ud-sv">${fmtNum(u.balance||0)}</div><div class="ud-sl">ALPHA</div></div>
        <div class="ud-stat"><div class="ud-sv">${u.sessions||0}</div><div class="ud-sl">SESSIONS</div></div>
        <div class="ud-stat"><div class="ud-sv">${(u.refs||[]).filter(r=>r.status==="verified").length}</div><div class="ud-sl">VERIFIED REFS</div></div>
        <div class="ud-stat"><div class="ud-sv">${(u.refs||[]).filter(r=>r.status==="pending").length}</div><div class="ud-sl">PENDING REFS</div></div>
        <div class="ud-stat"><div class="ud-sv">${tasksDone}</div><div class="ud-sl">TASKS DONE</div></div>
        <div class="ud-stat"><div class="ud-sv">${tasksPend}</div><div class="ud-sl">TASKS PENDING</div></div>
        <div class="ud-stat"><div class="ud-sv">${u.streak?.count||0}</div><div class="ud-sl">LOGIN STREAK</div></div>
        <div class="ud-stat"><div class="ud-sv">${u.bullets||0}</div><div class="ud-sl">BULLETS</div></div>
      </div>

      <!-- Device / Anti-fraud info -->
      <div class="device-block">
        <div class="device-block-title">DEVICE & FRAUD ANALYSIS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            ${_deviceRow("Country",   d.countryGuess || "Unknown")}
            ${_deviceRow("Platform",  d.platform || "Unknown")}
            ${_deviceRow("Device",    d.deviceType || "Unknown")}
            ${_deviceRow("OS",        `${d.os||""} ${d.browser||""}`)}
            ${_deviceRow("Timezone",  d.timezone || "Unknown")}
            ${_deviceRow("Language",  d.language || "Unknown")}
          </div>
          <div>
            ${_deviceRow("Screen",    `${d.screenW||0}×${d.screenH||0} @${d.pixelRatio||1}x`)}
            ${_deviceRow("Memory",    `${d.deviceMemory||0}GB RAM`)}
            ${_deviceRow("CPU Cores", `${d.hardwareConcurrency||0} cores`)}
            ${_deviceRow("Touch",     `${d.touchPoints||0} points`)}
            ${_deviceRow("Network",   d.connectionType || "unknown")}
            ${_deviceRow("TG App",    `${d.tgPlatform||""} v${d.tgVersion||""}`)}
          </div>
        </div>
        <div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:var(--gray);">FRAUD RISK SCORE</span>
          <span class="risk-badge ${risk>=50?"risk-high":risk>=25?"risk-medium":"risk-low"}" style="font-size:11px;padding:4px 12px;">${risk}/100 — ${risk>=50?"HIGH RISK":risk>=25?"MEDIUM RISK":"LOW RISK"}</span>
        </div>
        ${u.flagged ? `<div style="margin-top:8px;padding:10px;background:var(--redfade);border:1px solid var(--red);border-radius:6px;font-size:10px;color:var(--red);">
          ⚑ FLAGGED: ${u.flagReason||""}<br>Reference: ${u.flagTxId||""}
        </div>` : ""}
      </div>

      <!-- Miner status -->
      <div style="font-size:10px;color:var(--gray);margin-bottom:10px;">
        Miner: <span style="color:var(--white);">${_minerLabel(u)}</span> &nbsp;·&nbsp;
        Vault: <span style="color:${u.vault?"var(--green)":"var(--red)"};">${u.vault?"Unlocked":"Locked"}</span> &nbsp;·&nbsp;
        Vehicles: <span style="color:var(--white);">${(u.vehicles||[]).join(", ")}</span>
      </div>

      <!-- Quick actions -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        <button class="btn primary sm" onclick="quickAirdrop('${u.id}','${u.name}')">🪂 Airdrop</button>
        <button class="btn warning sm" onclick="quickGift('${u.id}')">🎁 Gift</button>
        <button class="btn danger sm"  onclick="quickFlag('${u.id}','${u.name}')">🚩 Flag</button>
        <button class="btn ghost sm"   onclick="quickBotMsg('${u.id}')">💬 Bot Msg</button>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="tbl-card">
      <div class="tbl-head"><span class="tbl-title">TRANSACTION HISTORY</span></div>
      <div class="tbl-body"><table>
        <thead><tr><th>TX ID</th><th>TYPE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>BAL AFTER</th><th>DATE</th></tr></thead>
        <tbody>${histHtml}</tbody>
      </table></div>
    </div>`;
};

const _deviceRow = (key, val) => `
  <div class="device-row">
    <span class="device-key">${key}</span>
    <span class="device-val">${val}</span>
  </div>`;

const _minerLabel = (u) => {
  if (!u.miner) return "None";
  const m = u.miner;
  if (m.expired)    return `${m.type} (Expired)`;
  if (m.claimedAt)  return `${m.type} (Claimed)`;
  return `${m.type} — expires ${new Date(m.expiresAt).toLocaleString()}`;
};

/* Quick action helpers */
const quickAirdrop = (uid, name) => {
  showSection("airdrop", document.querySelector('.nav-item[onclick*="airdrop"]'));
  document.getElementById("drop-id").value   = uid;
  document.getElementById("drop-note").value = `Gift to ${name}`;
};
const quickGift = (uid) => {
  showSection("gift", document.querySelector('.nav-item[onclick*="gift"]'));
  document.getElementById("gift-uid").value = uid;
};
const quickFlag = async (uid, name) => {
  const reason = prompt(`Reason for flagging ${name}:`);
  if (!reason) return;
  const r = await API.flagUser({ userId: uid, reason });
  showToast(r.ok ? r.message : r.error, r.ok ? "suc" : "err");
};
const quickBotMsg = (uid) => {
  showSection("bot-msg", document.querySelector('.nav-item[onclick*="bot-msg"]'));
  document.getElementById("bot-uid").value = uid;
};

/* ============================================================
   REF QUEUE
   ============================================================ */
const renderRefQueueTable = (items) => {
  document.getElementById("ref-queue-table").innerHTML = items.map((r, i) => {
    const isPending = r.status === "pending";
    const actionHtml = isPending
      ? `<button class="btn success sm" onclick="approveRef('${r.docId}','${r.referrerId}','${r.refereeId}','${r.refereeName}')">APPROVE</button>
         <button class="btn danger sm"  onclick="rejectRef('${r.docId}')">REJECT</button>`
      : `<span class="badge ${r.status==="verified"?"green":"red"}">${r.status.toUpperCase()}</span>`;
    return `<tr${isPending?' class="pending-row"':""}>
      <td>${r.referrerName}</td><td style="color:var(--gray);font-size:10px;">${r.referrerId}</td>
      <td>${r.refereeName}</td><td style="color:var(--gray);font-size:10px;">${r.refereeId}</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(r.ts).toLocaleDateString()}</td>
      <td><span class="badge ${r.status==="pending"?"gold":r.status==="verified"?"green":"red"}">${r.status.toUpperCase()}</span></td>
      <td>${actionHtml}</td>
    </tr>`;
  }).join("") || _empty(7, "No pending referrals");
};

const approveRef = async (docId, referrerId, refereeId, refereeName) => {
  const r = await API.approveRef({ docId, referrerId, refereeId, refereeName });
  showToast(r.ok ? r.message : r.error, r.ok ? "suc" : "err");
};
const rejectRef = async (docId) => {
  const r = await API.rejectRef({ docId });
  showToast(r.ok ? "Referral rejected." : r.error, r.ok ? "" : "err");
};

/* ============================================================
   X QUEUE
   ============================================================ */
const renderXQueueTable = (items) => {
  document.getElementById("x-queue-table").innerHTML = items.map(x => {
    const isPending = x.status === "pending";
    const actionHtml = isPending
      ? `<button class="btn success sm" onclick="approveX('${x.docId}','${x.userId}','${x.taskId}',${x.reward},'${x.taskName}','${x.handle}')">VERIFIED</button>
         <button class="btn danger sm"  onclick="rejectX('${x.docId}','${x.userId}','${x.taskId}')">REJECT</button>`
      : `<span class="badge ${x.status==="verified"?"green":"red"}">${x.status.toUpperCase()}</span>`;
    return `<tr${isPending?' class="pending-row"':""}>
      <td>${x.userName} <span style="color:var(--gray);font-size:9px;">(${x.userId})</span></td>
      <td>${x.taskName||x.taskId}</td>
      <td style="color:var(--blue);">@${x.handle}</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(x.ts).toLocaleDateString()}</td>
      <td><span class="badge ${x.status==="pending"?"gold":x.status==="verified"?"green":"red"}">${x.status.toUpperCase()}</span></td>
      <td>${actionHtml}</td>
    </tr>`;
  }).join("") || _empty(6, "No submissions");
};

const approveX = async (docId, userId, taskId, reward, taskName, handle) => {
  const r = await API.approveXTask({ docId, userId, taskId, reward: Number(reward), taskName, handle });
  showToast(r.ok ? r.message : r.error, r.ok ? "suc" : "err");
};
const rejectX = async (docId, userId, taskId) => {
  const r = await API.rejectXTask({ docId, userId, taskId });
  showToast(r.ok ? "X task rejected. User notified." : r.error, r.ok ? "" : "err");
};

/* ============================================================
   ADS QUEUE
   ============================================================ */
const renderAdsQueue = (ads) => {
  const pending = ads.filter(a => a.status === "pending");
  const tbody   = document.getElementById("ads-queue-table");
  if (!tbody) return;

  tbody.innerHTML = ads.map(a => {
    const isPending = a.status === "pending";
    const actionHtml = isPending
      ? `<button class="btn success sm" onclick="approveAd('${a.id}')">APPROVE</button>
         <button class="btn danger sm"  onclick="rejectAd('${a.id}')">REJECT</button>`
      : `<span class="badge ${a.status==="live"?"green":a.status==="rejected"?"red":"gray"}">${a.status.toUpperCase()}</span>`;
    return `<tr${isPending?' class="pending-row"':""}>
      <td>${a.userName} <span style="color:var(--gray);font-size:9px;">(${a.userId})</span></td>
      <td>${a.name}</td>
      <td style="color:var(--gray);">${a.type}</td>
      <td style="color:var(--blue);font-size:10px;max-width:120px;overflow:hidden;text-overflow:ellipsis;">${a.target}</td>
      <td>${(a.clicksTotal||0).toLocaleString()}</td>
      <td style="color:var(--gold);">${(a.cost||0).toLocaleString()} α</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(a.createdAt||0).toLocaleDateString()}</td>
      <td><span class="badge ${a.status==="live"?"green":a.status==="pending"?"gold":"red"}">${a.status.toUpperCase()}</span></td>
      <td>${actionHtml}</td>
    </tr>`;
  }).join("") || _empty(9, "No ad submissions");
};

const approveAd = async (adId) => {
  const r = await API.approveAd({ adId });
  showToast(r.ok ? r.message : r.error, r.ok ? "suc" : "err");
};
const rejectAd = async (adId) => {
  const reason = prompt("Reason for rejection (shown to user):");
  const r = await API.rejectAd({ adId, reason: reason||"Does not meet guidelines" });
  showToast(r.ok ? r.message : r.error, r.ok ? "" : "err");
};

const loadAdsQueue = () => { /* handled by real-time listener */ };
const loadRefQueue = () => {};
const loadXQueue   = () => {};
const loadNFTRequests = () => {};
const loadWithdrawals = () => {};

/* ============================================================
   NFT REQUESTS
   ============================================================ */
const renderNFTRequestsTable = (reqs) => {
  document.getElementById("nft-req-table").innerHTML = reqs.map(r => {
    const isPending = r.status === "pending";
    const action = isPending
      ? `<button class="btn success sm" onclick="markNFTSent('${r.reqId}')">MARK SENT</button>`
      : `<span class="badge green">SENT</span>`;
    return `<tr${isPending?' class="pending-row"':""}>
      <td>${r.userName} <span style="color:var(--gray);font-size:9px;">(${r.userId})</span></td>
      <td>${r.nftName}</td>
      <td style="font-size:10px;color:var(--gray);max-width:160px;word-break:break-all;">${r.address}</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(r.ts).toLocaleDateString()}</td>
      <td><span class="badge ${isPending?"gold":"green"}">${r.status.toUpperCase()}</span></td>
      <td>${action}</td>
    </tr>`;
  }).join("") || _empty(6, "No pending NFT requests");
};

const markNFTSent = async (reqId) => {
  const r = await API.markNFTSent({ reqId });
  showToast(r.ok ? "NFT marked as sent!" : r.error, r.ok ? "suc" : "err");
};

/* ============================================================
   WITHDRAWALS
   ============================================================ */
const renderWithdrawTable = (wds) => {
  document.getElementById("wd-table").innerHTML = wds.map(w => {
    const isPending = w.status === "pending";
    const action = isPending
      ? `<div style="display:flex;flex-direction:column;gap:4px;">
           <input id="txlink_${w.txId}" class="form-input" style="padding:4px 8px;font-size:9px;" placeholder="TX link (optional)"/>
           <div style="display:flex;gap:4px;">
             <button class="btn success sm" onclick="approveWd('${w.txId}')">APPROVE</button>
             <button class="btn danger sm"  onclick="rejectWd('${w.txId}')">REJECT</button>
           </div>
         </div>`
      : `<span class="badge ${w.status==="approved"?"green":"red"}">${w.status.toUpperCase()}</span>`;
    return `<tr${isPending?' class="pending-row"':""}>
      <td>${w.userName} <span style="color:var(--gray);font-size:9px;">(${w.userId})</span></td>
      <td style="color:var(--gold);">${w.currency}</td>
      <td style="font-weight:bold;">${w.amount}</td>
      <td style="font-size:10px;color:var(--gray);max-width:120px;word-break:break-all;">${w.address}</td>
      <td style="color:var(--gray);">${w.chain||"TON"}</td>
      <td style="font-size:9px;color:var(--blue);cursor:pointer;" onclick="copyTx('${w.txId}')">${w.txId}</td>
      <td style="font-size:10px;color:var(--gray);">${new Date(w.ts).toLocaleDateString()}</td>
      <td><span class="badge ${isPending?"gold":w.status==="approved"?"green":"red"}">${w.status.toUpperCase()}</span></td>
      <td>${action}</td>
    </tr>`;
  }).join("") || _empty(9, "No pending withdrawals");
};

const approveWd = async (txId) => {
  const txnLink = document.getElementById(`txlink_${txId}`)?.value.trim() || "";
  const r = await API.approveWithdraw({ txId, txnLink });
  showToast(r.ok ? "Withdrawal approved!" : r.error, r.ok ? "suc" : "err");
};
const rejectWd = async (txId) => {
  const reason = prompt("Reason for rejection:");
  const r = await API.rejectWithdraw({ txId, reason: reason||"Contact support" });
  showToast(r.ok ? "Withdrawal rejected and refunded." : r.error, r.ok ? "" : "err");
};
const copyTx = (txId) => {
  navigator.clipboard?.writeText(txId).catch(()=>{});
  showToast("TX ID copied!", "suc");
};

/* ============================================================
   FLAG LOG
   ============================================================ */
const loadFlagLog = async () => {
  const snap = await DB._supa.from("flag_log").orderBy("ts","desc").get();
  const rows = snap.docs.map(d => d.data());
  document.getElementById("flag-table").innerHTML = rows.map(r => `<tr>
    <td>${r.userName}</td>
    <td style="color:var(--gray);font-size:10px;">${r.userId}</td>
    <td style="color:var(--blue);font-size:9px;cursor:pointer;" onclick="copyTx('${r.txId}')">${r.txId}</td>
    <td style="color:var(--red);">-${fmtNum(r.balanceReset||0)} ALPHA</td>
    <td style="font-size:10px;max-width:200px;">${r.proof||""}</td>
    <td>${r.manual ? '<span class="badge red">MANUAL</span>' : '<span class="badge blue">AUTO</span>'}</td>
    <td style="font-size:10px;color:var(--gray);">${new Date(r.ts).toLocaleString()}</td>
  </tr>`).join("") || _empty(7, "No flags recorded");
};

/* ============================================================
   TX LOOKUP
   ============================================================ */
const doTxnLookup = async () => {
  const txId  = document.getElementById("txn-lookup-input").value.trim();
  const cont  = document.getElementById("txn-lookup-result");
  if (!txId) return;
  cont.innerHTML = '<div style="color:var(--gray);font-size:11px;padding:10px;">Searching...</div>';
  const r = await API.lookupTxn({ txId });
  if (!r.ok || !r.found) {
    cont.innerHTML = `<div style="color:var(--red);font-size:11px;padding:10px;">Transaction not found: ${txId}</div>`;
    return;
  }
  const d = r.data;
  cont.innerHTML = `
    <div class="ud-card">
      <div style="font-size:12px;font-weight:bold;color:var(--blue);margin-bottom:12px;">TX TYPE: ${r.type.toUpperCase()}</div>
      ${Object.entries(d).map(([k,v]) => `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(26,111,255,0.05);">
          <span style="font-size:10px;color:var(--gray);">${k}</span>
          <span style="font-size:10px;color:var(--white);max-width:60%;word-break:break-all;text-align:right;">${JSON.stringify(v)}</span>
        </div>`).join("")}
    </div>`;
};

/* ============================================================
   TASK MANAGEMENT
   ============================================================ */
const onTaskTypeChange = () => {
  const type  = document.getElementById("t-type").value;
  const label = document.getElementById("t-target-label");
  const hints = { telegram:"CHANNEL (@handle) *", x_follow:"PROFILE URL *", link:"URL *" };
  if (label) label.textContent = hints[type] || "TARGET *";
};

const submitAddTask = async () => {
  const name    = document.getElementById("t-name").value.trim();
  const reward  = parseInt(document.getElementById("t-reward").value, 10);
  const type    = document.getElementById("t-type").value;
  const cat     = document.getElementById("t-cat").value;
  const icon    = document.getElementById("t-icon").value.trim() || "🎯";
  const target  = document.getElementById("t-target").value.trim();
  const desc    = document.getElementById("t-desc").value.trim();
  const ton     = parseFloat(document.getElementById("t-ton").value) || 0;
  const exCur   = document.getElementById("t-extra-currency").value;
  const exRew   = parseFloat(document.getElementById("t-extra-reward").value) || 0;
  const reqInp  = document.getElementById("t-requires-input").value === "true";
  const inpPh   = document.getElementById("t-input-placeholder").value.trim();

  if (!name)             { showToast("Task name required", "err"); return; }
  if (!reward || reward < 1) { showToast("Reward required", "err"); return; }
  if (!target)           { showToast("Target required", "err"); return; }

  const r = await API.addTask({ task: {
    id: `task_${Date.now()}`, name, reward, type, category: cat, icon, target, desc,
    tonReward: ton, extraCurrency: exCur||null, extraReward: exRew||null,
    xFollow: type === "x_follow", requiresInput: reqInp, inputPlaceholder: inpPh||null,
  }});
  if (!r.ok) { showToast(r.error, "err"); return; }
  clearTaskForm();
  showToast(`Task "${name}" added! ✅`, "suc");
};

const clearTaskForm = () => {
  ["t-name","t-reward","t-icon","t-target","t-desc","t-ton","t-extra-reward","t-input-placeholder"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
};

const removeTask = async (id) => {
  if (!confirm("Delete this task?")) return;
  const r = await API.deleteTask(id);
  showToast(r.ok ? "Task deleted" : r.error, r.ok ? "" : "err");
};

const renderTasksList = (tasks) => {
  const badge = document.getElementById("tasks-badge");
  if (badge) badge.textContent = `${tasks.length} tasks`;
  const cont = document.getElementById("tasks-admin-list");
  if (!cont) return;
  cont.innerHTML = tasks.length ? tasks.map(t => `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <span style="font-size:22px;">${t.icon||"🎯"}</span>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:bold;color:var(--white);">${t.name}</div>
        <div style="font-size:9px;color:var(--gray);margin-top:2px;">${t.type} · ${t.category||"social"} · ${t.target||""}</div>
        <div style="font-size:9px;color:var(--gray);">${t.desc||""}</div>
      </div>
      <div style="font-size:12px;font-weight:bold;color:var(--gold);">+${t.reward} ALPHA${t.tonReward?` + ${t.tonReward} TON`:""}</div>
      <button class="btn danger sm" onclick="removeTask('${t.id}')">DELETE</button>
    </div>`).join("")
  : '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No tasks yet</div>';
};

/* ============================================================
   EVENTS
   ============================================================ */
const createEvent = async () => {
  const name    = document.getElementById("ev-name").value.trim();
  const icon    = document.getElementById("ev-icon").value.trim()   || "📣";
  const desc    = document.getElementById("ev-desc").value.trim();
  const tName   = document.getElementById("ev-t-name").value.trim();
  const tRew    = parseInt(document.getElementById("ev-t-reward").value, 10);
  const tType   = document.getElementById("ev-t-type").value;
  const tIcon   = document.getElementById("ev-t-icon").value.trim() || "🎯";
  const tTarget = document.getElementById("ev-t-target").value.trim();

  if (!name || !tName || !tRew) { showToast("Fill all required fields", "err"); return; }

  const r = await API.addEvent({ event: {
    id: `ev_${Date.now()}`, name, icon, desc,
    tasks: [{ id:`ev_t_${Date.now()}`, name:tName, reward:tRew, type:tType, icon:tIcon, target:tTarget, xFollow:tType==="x_follow", desc }],
  }});
  if (!r.ok) { showToast(r.error, "err"); return; }
  ["ev-name","ev-icon","ev-desc","ev-t-name","ev-t-reward","ev-t-icon","ev-t-target"].forEach(id => { document.getElementById(id).value = ""; });
  showToast("Event created! Live on all user screens instantly.", "suc");
};

const removeEvent = async (id) => {
  if (!confirm("Delete event?")) return;
  const r = await API.deleteEvent(id);
  showToast(r.ok ? "Event deleted" : r.error, r.ok ? "" : "err");
};

const renderEventsList = (events) => {
  const cont = document.getElementById("events-list");
  if (!cont) return;
  cont.innerHTML = events.length ? events.map(ev => `
    <div style="background:linear-gradient(135deg,rgba(240,180,41,0.06),rgba(0,0,0,0.5));border:1px solid rgba(240,180,41,0.3);border-radius:10px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="font-size:20px;">${ev.icon}</span>
        <span style="font-size:13px;font-weight:bold;color:var(--gold);">${ev.name}</span>
        <button class="btn danger sm" style="margin-left:auto;" onclick="removeEvent('${ev.id}')">DELETE</button>
      </div>
      ${(ev.tasks||[]).map(t => `<div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:8px;font-size:10px;color:var(--white);">
        ${t.icon||""} ${t.name} · <span style="color:var(--gold);">+${t.reward} ALPHA</span>
      </div>`).join("")}
    </div>`)
  .join("") : '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No events</div>';
};

/* ============================================================
   NFT MARKET
   ============================================================ */
let _pendingNFTImg = "";
const previewNFTImg = () => {
  const file = document.getElementById("nft-img-file").files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    _pendingNFTImg = e.target.result;
    document.getElementById("nft-img-preview").innerHTML = `<img src="${_pendingNFTImg}"/>`;
  };
  r.readAsDataURL(file);
};

const submitAddNFT = async () => {
  const name  = document.getElementById("nft-name").value.trim();
  const price = parseInt(document.getElementById("nft-price").value, 10);
  if (!name)              { showToast("NFT name required", "err"); return; }
  if (!price || price<1) { showToast("Price required", "err"); return; }
  if (!_pendingNFTImg)    { showToast("Please select an image", "err"); return; }
  const r = await API.addNFTListing({ listing:{ id:`nft_${Date.now()}`, name, price, img:_pendingNFTImg, available:true }});
  if (!r.ok) { showToast(r.error,"err"); return; }
  _pendingNFTImg = "";
  document.getElementById("nft-name").value  = "";
  document.getElementById("nft-price").value = "";
  document.getElementById("nft-img-file").value = "";
  document.getElementById("nft-img-preview").innerHTML = "No image selected";
  showToast("NFT listing added! Visible to users instantly.", "suc");
};

const toggleNFT = async (id, current) => {
  const r = await API.updateNFTListing({ id, updates:{ available: !current }});
  showToast(r.ok ? (!current?"NFT now visible":"NFT hidden") : r.error, r.ok?"suc":"err");
};
const deleteNFT = async (id) => {
  if (!confirm("Delete NFT listing?")) return;
  const r = await API.deleteNFTListing(id);
  showToast(r.ok ? "NFT deleted" : r.error, r.ok?"":"err");
};

const renderNFTListings = (listings) => {
  const cont = document.getElementById("nft-listings-list");
  if (!cont) return;
  cont.innerHTML = listings.length ? listings.map(n => `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <img src="${n.img}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:bold;color:var(--white);">${n.name}</div>
        <div style="font-size:10px;color:var(--gold);">${n.price?.toLocaleString()} ALPHA</div>
        <span class="badge ${n.available?"green":"gray"}" style="margin-top:4px;display:inline-block;">${n.available?"VISIBLE":"HIDDEN"}</span>
      </div>
      <button class="btn warning sm" onclick="toggleNFT('${n.id}',${n.available})">${n.available?"HIDE":"SHOW"}</button>
      <button class="btn danger sm"  onclick="deleteNFT('${n.id}')">DELETE</button>
    </div>`)
  .join("") : '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No listings</div>';
};

/* ============================================================
   CUSTOM TOKENS
   ============================================================ */
let _pendingCTImg = "";
const previewCTImg = () => {
  const file = document.getElementById("ct-img-file").files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    _pendingCTImg = e.target.result;
    document.getElementById("ct-img-preview").innerHTML = `<img src="${_pendingCTImg}"/>`;
  };
  r.readAsDataURL(file);
};

const submitAddToken = async () => {
  const name   = document.getElementById("ct-name").value.trim();
  const symbol = document.getElementById("ct-symbol").value.trim();
  if (!name || !symbol) { showToast("Name and symbol required","err"); return; }
  const r = await API.addCustomToken({ token:{ id:`ct_${Date.now()}`, name, symbol, img:_pendingCTImg||null }});
  if (!r.ok) { showToast(r.error,"err"); return; }
  _pendingCTImg = "";
  document.getElementById("ct-name").value   = "";
  document.getElementById("ct-symbol").value = "";
  document.getElementById("ct-img-file").value = "";
  document.getElementById("ct-img-preview").innerHTML = "No image selected";
  showToast(`Token ${symbol} added!`, "suc");
};

const deleteToken = async (id) => {
  if (!confirm("Delete this token?")) return;
  const r = await API.deleteCustomToken(id);
  showToast(r.ok?"Token deleted":r.error, r.ok?"":"err");
};

const renderCustomTokens = (tokens) => {
  const cont = document.getElementById("custom-tokens-list");
  if (!cont) return;
  cont.innerHTML = tokens.length ? tokens.map(t => `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--goldfade);border:1px solid rgba(240,180,41,0.3);display:flex;align-items:center;justify-content:center;overflow:hidden;">
        ${t.img ? `<img src="${t.img}" style="width:100%;height:100%;object-fit:cover;"/>` : "🪙"}
      </div>
      <div style="flex:1;"><div style="font-size:12px;font-weight:bold;color:var(--white);">${t.name}</div><div style="font-size:10px;color:var(--gold);">${t.symbol}</div></div>
      <button class="btn danger sm" onclick="deleteToken('${t.id}')">DELETE</button>
    </div>`)
  .join("") : '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No custom tokens</div>';
};

/* ============================================================
   AIRDROP
   ============================================================ */
const doAirdrop = async () => {
  const uid    = document.getElementById("drop-id").value.trim();
  const amount = parseInt(document.getElementById("drop-amount").value, 10);
  const note   = document.getElementById("drop-note").value.trim();
  if (!uid || !amount || amount<1) { showToast("User ID and amount required","err"); return; }
  const r = await API.airdrop({ userId:uid, amount, note });
  if (!r.ok) { showToast(r.error,"err"); return; }
  document.getElementById("drop-id").value     = "";
  document.getElementById("drop-amount").value = "";
  document.getElementById("drop-note").value   = "";
  showToast(r.message, "suc");
};

const renderAirdropLog = (log) => {
  const tbody = document.getElementById("airdrop-log-table");
  if (!tbody) return;
  tbody.innerHTML = log.map(a => `<tr>
    <td style="color:var(--gray);font-size:10px;">${a.userId}</td>
    <td>${a.userName}</td>
    <td style="color:var(--gold);font-weight:bold;">+${a.amount?.toLocaleString()}</td>
    <td style="color:var(--gray);">${a.note||"—"}</td>
    <td style="font-size:10px;color:var(--gray);">${new Date(a.ts).toLocaleString()}</td>
  </tr>`).join("") || _empty(5,"No airdrops yet");
};

/* ============================================================
   GIFT
   ============================================================ */
const onGiftTypeChange = () => {
  const type  = document.getElementById("gift-type").value;
  const label = document.getElementById("gift-value-label");
  const hints = {
    alpha:"AMOUNT (ALPHA) *", ton:"AMOUNT (TON) *", usdt:"AMOUNT (USDT) *", usdc:"AMOUNT (USDC) *",
    vehicle:"VEHICLE ID (v0–v7) *", nft:"NFT LISTING ID *", miner:"MINER TYPE (beta/alphaminer) *", bullets:"NUMBER OF BULLETS *",
  };
  if (label) label.textContent = hints[type] || "VALUE *";
};

const doGift = async () => {
  const uid   = document.getElementById("gift-uid").value.trim();
  const type  = document.getElementById("gift-type").value;
  const val   = document.getElementById("gift-value").value.trim();
  const note  = document.getElementById("gift-note").value.trim();
  if (!uid || !val) { showToast("User ID and value required","err"); return; }
  const r = await API.giftUser({ userId:uid, giftType:type, giftValue:val, note });
  if (!r.ok) { showToast(r.error,"err"); return; }
  document.getElementById("gift-uid").value   = "";
  document.getElementById("gift-value").value = "";
  document.getElementById("gift-note").value  = "";
  showToast(r.message, "suc");
};

/* ============================================================
   BOT MESSAGE
   ============================================================ */
const sendBotMsg = async () => {
  const chatId  = document.getElementById("bot-uid").value.trim();
  const message = document.getElementById("bot-message").value.trim();
  if (!chatId || !message) { showToast("Chat ID and message required","err"); return; }
  const r = await API.sendBotMessage({ chatId, message });
  if (!r.ok) { showToast(r.error,"err"); return; }
  document.getElementById("bot-uid").value      = "";
  document.getElementById("bot-message").value  = "";
  showToast("Message sent!", "suc");
};

/* ============================================================
   LEADERBOARD
   ============================================================ */
const renderLeaderboardTable = (users) => {
  const sorted = [...users].sort((a,b) => (b.balance||0) - (a.balance||0));
  const tbody  = document.getElementById("lb-admin-table");
  if (!tbody) return;
  tbody.innerHTML = sorted.map((u,i) => {
    const rank = i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`;
    return `<tr>
      <td style="font-weight:bold;color:var(--gold);">${rank}</td>
      <td>${u.name}${u.flagged?' <span class="badge red">⚑</span>':""}</td>
      <td>${u.device?.countryGuess||"Unknown"}</td>
      <td style="color:var(--gray);font-size:10px;">${u.device?.deviceType||""} ${u.device?.platform||""}</td>
      <td style="font-weight:bold;color:var(--blue);">${fmtNum(u.balance||0)}</td>
      <td>${u.sessions||0}</td>
      <td>${u.refs?.length||0}</td>
    </tr>`;
  }).join("") || _empty(7,"No users yet");
};

const loadLeaderboard = () => { renderLeaderboardTable(_allUsers); };

/* ============================================================
   ADMIN LOG
   ============================================================ */
const renderAdminLog = (log) => {
  const tbody = document.getElementById("admin-log-table");
  if (!tbody) return;
  tbody.innerHTML = log.map(l => `<tr>
    <td style="color:var(--blue);">${l.action}</td>
    <td style="font-size:10px;color:var(--gray);max-width:300px;">${JSON.stringify(l.details||{})}</td>
    <td style="font-size:10px;color:var(--gray);">${new Date(l.ts).toLocaleString()}</td>
  </tr>`).join("") || _empty(3,"No admin actions yet");
};

const loadAdminLog = () => {};

/* ============================================================
   MAINTENANCE
   ============================================================ */
const loadMaintenanceStatus = async () => {
  const snap = await DB._supa.from("global_stats").select("maintenance").eq("id","main").single().get();
  const on   = snap.exists ? snap.data().maintenance : false;
  const el   = document.getElementById("maint-status");
  if (el) el.innerHTML = `Status: <strong style="color:${on?"var(--red)":"var(--green)"};">${on?"🔴 MAINTENANCE ON":"🟢 PLATFORM LIVE"}</strong>`;
};

const setMaintenance = async (enable) => {
  const key = document.getElementById("maint-key").value.trim();
  const r   = await API.setMaintenance({ maintenance: enable, key: enable ? key : "skip" });
  if (!r.ok) { showToast(r.error,"err"); return; }
  showToast(r.message, enable ? "warn" : "suc");
  loadMaintenanceStatus();
};

/* ============================================================
   BACKUP
   ============================================================ */
const loadBackupStats = async () => {
  const [stats] = await Promise.all([DB.getGlobalStats()]);
  const cont    = document.getElementById("backup-stats");
  if (!cont) return;
  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      <div class="ud-stat"><div class="ud-sv">${_allUsers.length}</div><div class="ud-sl">TOTAL USERS</div></div>
      <div class="ud-stat"><div class="ud-sv">${fmtNum(stats.totalMined||0)}</div><div class="ud-sl">TOTAL MINED</div></div>
      <div class="ud-stat"><div class="ud-sv">${((stats.totalMined||0)/DB.MAX_SUPPLY*100).toFixed(4)}%</div><div class="ud-sl">SUPPLY USED</div></div>
    </div>`;
};

const downloadBackup = async () => {
  showToast("Preparing backup...","");
  const data = await DB.exportAll();
  const blob = new Blob([JSON.stringify(data,null,2)], { type:"application/json" });
  const url  = URL.createObjectURL(blob);
  const fn   = `alpha_backup_${new Date().toISOString().slice(0,10)}.json`;
  const a    = Object.assign(document.createElement("a"), { href:url, download:fn });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Backup downloaded: ${fn}`, "suc");
};

/* ============================================================
   HELPERS
   ============================================================ */
const _empty = (cols, msg) =>
  `<tr><td colspan="${cols}" style="text-align:center;color:var(--gray);padding:20px;">${msg}</td></tr>`;

const fmtNum = (n) => {
  if (n >= 1000000000) return (n/1000000000).toFixed(1)+"B";
  if (n >= 1000000)    return (n/1000000).toFixed(1)+"M";
  if (n >= 1000)       return (n/1000).toFixed(1)+"K";
  return Math.floor(n).toLocaleString();
};

const timeSince = (ts) => {
  const s = Math.floor((Date.now()-ts)/1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

let _toastTimer = null;
const showToast = (msg, type="") => {
  const t = document.getElementById("admin-toast");
  if (!t) return;
  t.textContent = msg;
  t.className   = `toast show${type?" "+type:""}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{ t.className="toast"; }, 3000);
};
