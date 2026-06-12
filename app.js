/* ============================================================
   app.js  —  ALPHA Token Mini App Logic
   No external APIs. All data via data.js (DB object).
   ============================================================ */

/* ── CONFIG ── */
var CFG = {
  BOT_USERNAME:    'YourALPHABot',      // ← replace with your bot username
  MINE_REWARD:     69.6,                // ALPHA per 3-hour session
  MINE_INTERVAL:   3 * 60 * 60 * 1000, // 3 hours in ms
  REF_BONUS:       100,                 // ALPHA to referrer when referee reaches 100 ALPHA
  REF_THRESHOLD:   100,                 // referee must earn this before referral is confirmed
  MINER_BETA_COST: 300,
  MINER_BETA_HOURS: 12,
  MINER_BETA_REWARD: 400,              // reward for 12hr beta mine
  MINER_BETA_VALID_DAYS: 3,
  MINER_ALPHA_COST: 500,
  MINER_ALPHA_HOURS: 24,
  MINER_ALPHA_REWARD: 850,             // reward for 24hr alpha mine
  MINER_ALPHA_VALID_DAYS: 3
};

/* ── GLOBALS ── */
var currentUser  = null;
var currentNFTId = null;   // for send-NFT modal
var timerHandle  = null;

/* ── TELEGRAM INIT ── */
var tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
if (tg) { tg.ready(); tg.expand(); }

var TG_USER = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user)
  ? tg.initDataUnsafe.user
  : { id: 100000001, first_name: 'Demo', username: 'demo_user' };

/* ════════════════════════════════════════════
   BOOT
════════════════════════════════════════════ */
window.onload = function () {
  /* load or create user */
  currentUser = DB.getUser(String(TG_USER.id));
  if (!currentUser) {
    currentUser = DB.createUser(TG_USER);
  } else {
    currentUser.name     = TG_USER.first_name || currentUser.name;
    currentUser.username = TG_USER.username   || currentUser.username;
  }

  /* handle referral param */
  handleReferralParam();

  /* save, update UI */
  DB.saveUser(currentUser);
  updateAll();
  startCountdown();

  /* check pending notifications for user */
  checkUserNotifications();
};

/* ════════════════════════════════════════════
   REFERRAL PARAM
════════════════════════════════════════════ */
function handleReferralParam() {
  var startParam = '';
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
    startParam = tg.initDataUnsafe.start_param;
  } else {
    var urlParams = new URLSearchParams(window.location.search);
    startParam = urlParams.get('tgWebAppStartParam') || '';
  }

  if (startParam.indexOf('ref_') === 0) {
    var referrerId = startParam.replace('ref_', '');
    if (referrerId && referrerId !== String(currentUser.id) && !currentUser.referredBy) {
      currentUser.referredBy = referrerId;
      /* add to referrer's pending list */
      var referrer = DB.getUser(referrerId);
      if (referrer) {
        var alreadyListed = false;
        for (var i = 0; i < referrer.refs.length; i++) {
          if (referrer.refs[i].refereeId === String(currentUser.id)) { alreadyListed = true; break; }
        }
        if (!alreadyListed) {
          referrer.refs.push({
            refereeId:   String(currentUser.id),
            refereeName: currentUser.name,
            status:      'pending',
            earnedAlpha: 0
          });
          DB.saveUser(referrer);
        }
      }
    }
  }
}

/* ════════════════════════════════════════════
   CHECK IF USER'S REFERRER SHOULD BE CREDITED
   (called whenever balance changes)
════════════════════════════════════════════ */
function checkRefThreshold() {
  if (!currentUser.referredBy) return;
  if (currentUser.balance < CFG.REF_THRESHOLD) return;

  var referrer = DB.getUser(currentUser.referredBy);
  if (!referrer) return;

  for (var i = 0; i < referrer.refs.length; i++) {
    var r = referrer.refs[i];
    if (r.refereeId === String(currentUser.id) && r.status === 'pending') {
      r.earnedAlpha = currentUser.balance;
      /* push to admin ref queue if not already there */
      var q = DB.getRefQueue();
      var already = false;
      for (var j = 0; j < q.length; j++) {
        if (q[j].refereeId === String(currentUser.id) && q[j].referrerId === String(referrer.id)) {
          already = true; break;
        }
      }
      if (!already) {
        q.push({
          referrerId:   String(referrer.id),
          referrerName: referrer.name,
          refereeId:    String(currentUser.id),
          refereeName:  currentUser.name,
          ts:           Date.now(),
          status:       'pending'
        });
        DB.saveRefQueue(q);
      }
      DB.saveUser(referrer);
      break;
    }
  }
}

/* ════════════════════════════════════════════
   CHECK AUTO-REF TASKS
════════════════════════════════════════════ */
function checkAutoRefTasks() {
  var verifiedRefs = 0;
  for (var i = 0; i < currentUser.refs.length; i++) {
    if (currentUser.refs[i].status === 'verified') verifiedRefs++;
  }

  var tasks = DB.getTasks();
  for (var t = 0; t < tasks.length; t++) {
    var task = tasks[t];
    if (task.type === 'auto_ref' && task.autoRef) {
      var stateKey = task.id;
      if (currentUser.taskStates[stateKey] === 'done') continue;
      if (verifiedRefs >= task.autoRef) {
        currentUser.taskStates[stateKey] = 'done';
        currentUser.balance += task.reward;
        DB.addHistory(currentUser, 'task', 'Auto-ref task: ' + task.name, task.reward);
        DB.addToTotalMined(task.reward);
        showToast('+' + task.reward + ' ALPHA! ' + task.name, 'suc');
      }
    }
  }
}

/* ════════════════════════════════════════════
   NOTIFICATIONS CHECK
════════════════════════════════════════════ */
function checkUserNotifications() {
  /* Check X-queue for rejections/verifications for this user */
  var xq = DB.getXQueue();
  for (var i = 0; i < xq.length; i++) {
    var item = xq[i];
    if (item.userId !== String(currentUser.id)) continue;
    if (item.notified) continue;
    if (item.status === 'verified') {
      showToast('✅ Task "' + item.taskName + '" verified! +' + item.reward + ' ALPHA', 'suc');
      item.notified = true;
    } else if (item.status === 'rejected') {
      showToast('❌ Task "' + item.taskName + '" rejected. Please redo and retry.', 'err');
      item.notified = true;
    }
  }
  DB.saveXQueue(xq);

  /* Check NFT send requests */
  var nftReqs = DB.getNFTRequests();
  for (var j = 0; j < nftReqs.length; j++) {
    var req = nftReqs[j];
    if (req.userId !== String(currentUser.id)) continue;
    if (req.notified) continue;
    if (req.status === 'sent') {
      /* Remove NFT from user gallery */
      currentUser.nfts = currentUser.nfts.filter(function(n){ return n.nftId !== req.nftId; });
      DB.saveUser(currentUser);
      showToast('NFT sent successfully! ✅', 'suc');
      req.notified = true;
    }
  }
  DB.saveNFTRequests(nftReqs);
}

/* ════════════════════════════════════════════
   FULL UI UPDATE
════════════════════════════════════════════ */
function updateAll() {
  var u = currentUser;

  /* header */
  document.getElementById('hdr-name').textContent = u.name;
  document.getElementById('hdr-id').textContent   = 'ID: ' + u.id;
  document.getElementById('hdr-bal').textContent  = Math.floor(u.balance);
  document.getElementById('avatar-btn').textContent = (u.name[0] || 'A').toUpperCase();

  /* balance ring */
  document.getElementById('bal-num').textContent = Math.floor(u.balance);
  /* arc shows sessions progress up to 100 sessions */
  var arc = Math.min(u.sessions / 100, 1);
  document.getElementById('bal-arc').style.strokeDashoffset = 452 - (452 * arc);

  /* supply bar */
  var gs = DB.getGlobalStats();
  var mined = gs.totalMined || 0;
  var supplyPct = Math.min(mined / DB.MAX_SUPPLY * 100, 100);
  document.getElementById('supply-bar').style.width  = supplyPct + '%';
  document.getElementById('supply-pct').textContent  = supplyPct.toFixed(4) + '%';
  document.getElementById('supply-mined').textContent = Math.floor(mined).toLocaleString() + ' mined';

  if (DB.isMaxSupplyReached()) {
    document.getElementById('supply-reached-banner').style.display = 'block';
  }

  /* stats */
  document.getElementById('stat-sessions').textContent = u.sessions;
  document.getElementById('stat-refs').textContent     = u.refs.length;

  /* miner banner */
  updateMinerBanner();

  /* save */
  DB.saveUser(u);
}

/* ════════════════════════════════════════════
   MINER BANNER
════════════════════════════════════════════ */
function updateMinerBanner() {
  var u = currentUser;
  var banner = document.getElementById('miner-banner');
  if (!u.miner) { banner.classList.remove('show'); return; }

  var now = Date.now();
  var m   = u.miner;

  /* check expiry */
  if (now > m.expiresAt && !m.claimedAt) {
    /* expired without claim — mark expired, return to normal mining */
    m.expired = true;
    DB.saveUser(u);
  }

  if (m.expired) { banner.classList.remove('show'); return; }

  banner.classList.add('show');
  var typeLabel = (m.type === 'beta') ? 'BETA MINER (12h)' : 'ALPHA MINER (24h)';
  document.getElementById('miner-banner-title').textContent = '⚡ ' + typeLabel + ' ACTIVE';

  var expiryStr = new Date(m.expiresAt).toLocaleString();
  document.getElementById('miner-banner-info').textContent = 'Expires: ' + expiryStr;

  var claimBtn = document.getElementById('miner-claim-btn');
  var canClaim = now >= m.claimableAt && !m.claimedAt;

  if (m.claimedAt) {
    document.getElementById('miner-banner-sub').textContent = '✅ Reward claimed';
    claimBtn.disabled = true;
    claimBtn.textContent = 'REWARD CLAIMED';
  } else if (canClaim) {
    var reward = (m.type === 'beta') ? CFG.MINER_BETA_REWARD : CFG.MINER_ALPHA_REWARD;
    document.getElementById('miner-banner-sub').textContent = 'Ready to claim!';
    claimBtn.disabled = false;
    claimBtn.textContent = 'CLAIM +' + reward + ' ALPHA';
  } else {
    var remaining = m.claimableAt - now;
    var h = Math.floor(remaining / 3600000);
    var mn = Math.floor((remaining % 3600000) / 60000);
    document.getElementById('miner-banner-sub').textContent = 'Claimable in ' + h + 'h ' + mn + 'm';
    claimBtn.disabled = true;
    claimBtn.textContent = 'NOT YET CLAIMABLE';
  }
}

/* ════════════════════════════════════════════
   MINING (3-hour claim)
════════════════════════════════════════════ */
function handleMine() {
  if (DB.isMaxSupplyReached()) { showToast('Max supply reached!', 'err'); return; }

  var now     = Date.now();
  var elapsed = now - (currentUser.lastMine || 0);

  if (elapsed < CFG.MINE_INTERVAL && currentUser.lastMine !== 0) {
    showToast('Not ready yet!', 'err'); return;
  }

  currentUser.balance  += CFG.MINE_REWARD;
  currentUser.sessions += 1;
  currentUser.lastMine  = now;

  DB.addHistory(currentUser, 'mine', '3-hour mining claim', CFG.MINE_REWARD);
  DB.addToTotalMined(CFG.MINE_REWARD);

  checkRefThreshold();
  checkAutoRefTasks();
  updateAll();
  showToast('+' + CFG.MINE_REWARD + ' ALPHA mined! ⚡', 'suc');
}

function startCountdown() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(tickCountdown, 1000);
  tickCountdown();
}

function tickCountdown() {
  var btn    = document.getElementById('mine-btn');
  var timer  = document.getElementById('mine-timer');
  var now    = Date.now();
  var elapsed = now - (currentUser.lastMine || 0);

  if (DB.isMaxSupplyReached()) {
    btn.disabled = true;
    btn.textContent = '⛔ MINING ENDED';
    timer.style.display = 'none';
    return;
  }

  /* if active miner is running, normal mine btn is hidden */
  if (currentUser.miner && !currentUser.miner.expired && !currentUser.miner.claimedAt) {
    btn.style.display   = 'none';
    timer.style.display = 'none';
    updateMinerBanner();
    return;
  } else {
    btn.style.display = 'block';
  }

  var ready = (elapsed >= CFG.MINE_INTERVAL || currentUser.lastMine === 0);
  if (ready) {
    btn.disabled = false;
    btn.textContent = '⚡ COLLECT MINING REWARD';
    timer.style.display = 'none';
  } else {
    btn.disabled = true;
    btn.textContent = '⏳ MINING IN PROGRESS...';
    var rem = CFG.MINE_INTERVAL - elapsed;
    var h   = Math.floor(rem / 3600000);
    var m   = Math.floor((rem % 3600000) / 60000);
    var s   = Math.floor((rem % 60000) / 1000);
    timer.style.display = 'block';
    timer.innerHTML = 'Next claim in <span>' + pad(h) + ':' + pad(m) + ':' + pad(s) + '</span>';
  }
}

function pad(n) { return String(n).length === 1 ? '0' + n : String(n); }

/* ════════════════════════════════════════════
   AUTO MINER CLAIM
════════════════════════════════════════════ */
function claimMinerReward() {
  var u = currentUser;
  if (!u.miner || u.miner.claimedAt) { showToast('Nothing to claim', 'err'); return; }
  if (Date.now() < u.miner.claimableAt) { showToast('Not claimable yet', 'err'); return; }

  var reward = (u.miner.type === 'beta') ? CFG.MINER_BETA_REWARD : CFG.MINER_ALPHA_REWARD;

  if (DB.isMaxSupplyReached()) { showToast('Max supply reached!', 'err'); return; }

  u.balance += reward;
  u.miner.claimedAt = Date.now();

  DB.addHistory(u, 'claim_miner', 'Auto miner reward: ' + u.miner.type, reward);
  DB.addToTotalMined(reward);

  checkRefThreshold();
  checkAutoRefTasks();
  updateAll();
  showToast('+' + reward + ' ALPHA claimed from miner! 🎉', 'suc');
}

/* ════════════════════════════════════════════
   BUY MINER
════════════════════════════════════════════ */
function buyMiner(type) {
  var u    = currentUser;
  var cost = (type === 'beta') ? CFG.MINER_BETA_COST : CFG.MINER_ALPHA_COST;

  /* can't have two miners at once */
  if (u.miner && !u.miner.expired && !u.miner.claimedAt) {
    showToast('You already have an active miner!', 'err'); return;
  }
  if (u.balance < cost) {
    showToast('Not enough Alpha! Need ' + cost + ' ALPHA', 'err'); return;
  }

  u.balance -= cost;

  var now     = Date.now();
  var hours   = (type === 'beta') ? CFG.MINER_BETA_HOURS : CFG.MINER_ALPHA_HOURS;
  var validDays = (type === 'beta') ? CFG.MINER_BETA_VALID_DAYS : CFG.MINER_ALPHA_VALID_DAYS;

  u.miner = {
    type:        type,
    boughtAt:    now,
    claimableAt: now + hours * 3600000,
    expiresAt:   now + validDays * 86400000,
    claimedAt:   null,
    expired:     false
  };

  DB.addHistory(u, 'shop', 'Bought ' + type + ' miner', -cost);
  updateAll();
  showToast('Miner activated! Claim in ' + hours + 'h ⚙️', 'suc');
}

/* ════════════════════════════════════════════
   TASKS
════════════════════════════════════════════ */
function renderTasks() {
  var tasks   = DB.getTasks();
  var events  = DB.getEvents();
  var list    = document.getElementById('tasks-list');
  list.innerHTML = '';

  /* Event tasks first (pinned, gold style) */
  for (var e = 0; e < events.length; e++) {
    var ev = events[e];
    for (var et = 0; et < ev.tasks.length; et++) {
      var etask = ev.tasks[et];
      var card = buildTaskCard(etask, true, ev.name);
      list.appendChild(card);
    }
  }

  /* Normal tasks */
  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i];
    /* skip auto_ref tasks – they complete automatically */
    if (task.type === 'auto_ref') {
      var card2 = buildTaskCard(task, false, null);
      list.appendChild(card2);
      continue;
    }
    list.appendChild(buildTaskCard(task, false, null));
  }

  if (list.children.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--gray);padding:30px;font-size:11px;">No tasks available</div>';
  }
}

function buildTaskCard(task, isEvent, eventName) {
  var u        = currentUser;
  var stateKey = task.id;
  var state    = u.taskStates[stateKey] || 'go';

  var card = document.createElement('div');
  card.className = 'task-card' + (isEvent ? ' event-task' : '');
  card.setAttribute('data-task-id', task.id);

  var badgeHtml = isEvent
    ? '<div class="task-event-badge">📣 ' + (eventName || 'EVENT') + '</div>'
    : '';

  var btnHtml = '';
  if (task.type === 'auto_ref') {
    /* auto ref tasks – read only */
    if (state === 'done') {
      btnHtml = '<button class="task-btn done">✓ DONE</button>';
    } else {
      btnHtml = '<button class="task-btn verify" style="cursor:default;">AUTO</button>';
    }
  } else if (state === 'done') {
    btnHtml = '<button class="task-btn done">✓ DONE</button>';
  } else if (state === 'pending') {
    btnHtml = '<button class="task-btn pending">PENDING</button>';
  } else if (state === 'rejected') {
    btnHtml = '<button class="task-btn rejected" onclick="retryTask(\'' + task.id + '\')">RETRY</button>';
  } else if (state === 'verify') {
    if (task.xFollow || task.type === 'x_follow') {
      btnHtml = '<button class="task-btn verify" onclick="showXInput(\'' + task.id + '\')">VERIFY</button>';
    } else {
      btnHtml = '<button class="task-btn verify" onclick="verifyTask(\'' + task.id + '\',' + task.reward + ')">VERIFY</button>';
    }
  } else {
    /* go state */
    btnHtml = '<button class="task-btn go" onclick="goTask(\'' + task.id + '\',\'' + (task.type||'') + '\',\'' + (task.target||'') + '\')">GO →</button>';
  }

  var xWrapId = 'xwrap_' + task.id;
  var xWrapHtml = '';
  if (task.xFollow || task.type === 'x_follow') {
    xWrapHtml = '<div class="x-input-wrap" id="' + xWrapId + '">'
      + '<input class="x-input" id="xinput_' + task.id + '" placeholder="@yourhandle"/>'
      + '<button class="x-submit-btn" onclick="submitXHandle(\'' + task.id + '\',' + task.reward + ',\'' + task.name + '\')">SUBMIT</button>'
      + '</div>';
  }

  card.innerHTML =
    '<div class="task-icon">' + (task.icon || '🎯') + '</div>'
    + '<div class="task-info">'
    +   badgeHtml
    +   '<div class="task-name">' + task.name + '</div>'
    +   '<div class="task-desc">' + (task.desc || '') + '</div>'
    +   '<div class="task-reward">+' + task.reward + ' ALPHA</div>'
    +   xWrapHtml
    + '</div>'
    + btnHtml;

  return card;
}

function goTask(id, type, target) {
  currentUser.taskStates[id] = 'verify';
  DB.saveUser(currentUser);

  if (type === 'telegram') {
    var ch = target.replace('@', '');
    if (tg) { tg.openTelegramLink('https://t.me/' + ch); }
    else { window.open('https://t.me/' + ch, '_blank'); }
  } else if (type === 'x_follow') {
    if (tg) { tg.openLink(target); }
    else { window.open(target, '_blank'); }
  } else {
    if (tg) { tg.openLink(target); }
    else { window.open(target, '_blank'); }
  }

  setTimeout(renderTasks, 400);
}

function verifyTask(id, reward) {
  /* For non-X tasks: auto verify */
  if (DB.isMaxSupplyReached()) { showToast('Max supply reached!', 'err'); return; }
  currentUser.taskStates[id] = 'done';
  currentUser.balance += reward;
  DB.addHistory(currentUser, 'task', 'Task completed: ' + id, reward);
  DB.addToTotalMined(reward);
  checkRefThreshold();
  checkAutoRefTasks();
  updateAll();
  renderTasks();
  showToast('+' + reward + ' ALPHA! Task complete ✅', 'suc');
}

function retryTask(id) {
  currentUser.taskStates[id] = 'go';
  DB.saveUser(currentUser);
  renderTasks();
}

function showXInput(id) {
  var wrap = document.getElementById('xwrap_' + id);
  if (wrap) { wrap.classList.toggle('show'); }
}

function submitXHandle(id, reward, taskName) {
  var input = document.getElementById('xinput_' + id);
  var handle = input ? input.value.trim() : '';
  if (!handle) { showToast('Please enter your @handle', 'err'); return; }

  currentUser.taskStates[id]  = 'pending';
  currentUser.taskHandles[id] = handle;
  DB.saveUser(currentUser);

  /* push to admin X queue */
  var q = DB.getXQueue();
  q.push({
    userId:   String(currentUser.id),
    userName: currentUser.name,
    taskId:   id,
    taskName: taskName,
    reward:   reward,
    handle:   handle,
    ts:       Date.now(),
    status:   'pending',
    notified: false
  });
  DB.saveXQueue(q);

  renderTasks();
  updateAll();
  showToast('Submitted! Awaiting admin verification.', 'suc');
}

/* ════════════════════════════════════════════
   SHOP — SUB TABS
════════════════════════════════════════════ */
function switchSubTab(name, btn) {
  var subPages = document.querySelectorAll('.sub-page');
  for (var i = 0; i < subPages.length; i++) subPages[i].classList.remove('active');

  var subTabs = document.querySelectorAll('.sub-tab');
  for (var j = 0; j < subTabs.length; j++) subTabs[j].classList.remove('active');

  document.getElementById('sub-' + name).classList.add('active');
  btn.classList.add('active');

  if (name === 'market') renderNFTMarket();
}

/* ════════════════════════════════════════════
   NFT MARKET
════════════════════════════════════════════ */
function renderNFTMarket() {
  var listings = DB.getNFTListings();
  var cont = document.getElementById('nft-market-list');
  cont.innerHTML = '';

  var available = listings.filter(function(l){ return l.available; });

  if (!available.length) {
    cont.innerHTML = '<div style="text-align:center;color:var(--gray);padding:30px;font-size:11px;">No NFTs available right now</div>';
    return;
  }

  for (var i = 0; i < available.length; i++) {
    var nft = available[i];
    var card = document.createElement('div');
    card.className = 'miner-card';
    card.innerHTML =
      '<img class="miner-img" src="' + (nft.img || '') + '" alt="' + nft.name + '" onerror="this.style.display=\'none\'">'
      + '<div class="miner-body">'
      +   '<div class="miner-name">' + nft.name + '</div>'
      +   '<div class="miner-detail">Price: <span style="color:var(--gold)">' + nft.price + ' ALPHA</span></div>'
      +   '<button class="miner-buy-btn" onclick="buyNFT(\'' + nft.id + '\')">BUY — ' + nft.price + ' ALPHA</button>'
      + '</div>';
    cont.appendChild(card);
  }
}

function buyNFT(nftId) {
  var listings = DB.getNFTListings();
  var nft = null;
  for (var i = 0; i < listings.length; i++) {
    if (listings[i].id === nftId) { nft = listings[i]; break; }
  }
  if (!nft) { showToast('NFT not found', 'err'); return; }
  if (!nft.available) { showToast('NFT no longer available', 'err'); return; }
  if (currentUser.balance < nft.price) { showToast('Not enough Alpha! Need ' + nft.price + ' ALPHA', 'err'); return; }

  currentUser.balance -= nft.price;
  currentUser.nfts.push({ nftId: nft.id, name: nft.name, img: nft.img, price: nft.price, boughtAt: Date.now(), sendRequest: null });

  DB.addHistory(currentUser, 'nft', 'Bought NFT: ' + nft.name, -nft.price);
  DB.saveUser(currentUser);
  updateAll();
  showToast('NFT "' + nft.name + '" purchased! 🎉', 'suc');
}

/* ════════════════════════════════════════════
   LEADERBOARD
════════════════════════════════════════════ */
function renderLeaderboard() {
  var allUsers = DB.getAllUsers();

  /* upsert current user */
  var found = false;
  for (var i = 0; i < allUsers.length; i++) {
    if (allUsers[i].id === String(currentUser.id)) { allUsers[i] = currentUser; found = true; break; }
  }
  if (!found) allUsers.push(currentUser);

  allUsers.sort(function(a, b) { return b.balance - a.balance; });

  var top3 = allUsers.slice(0, 3);
  var rest  = allUsers.slice(3, 50);

  /* podium — order: 2nd, 1st, 3rd */
  var podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  var rkClass  = ['r2','r1','r3'];
  var rkBClass = ['b2','b1','b3'];
  var medals   = ['🥈','🥇','🥉'];
  var rkNums   = [2,1,3];

  var podiumHtml = '';
  for (var p = 0; p < podiumOrder.length; p++) {
    var u = podiumOrder[p];
    podiumHtml +=
      '<div class="podium-item">'
      + '<div class="podium-av ' + rkClass[p] + '">' + medals[p] + '<div class="podium-badge">' + rkNums[p] + '</div></div>'
      + '<div class="podium-name">' + u.name + '</div>'
      + '<div class="podium-score">' + Math.floor(u.balance) + '</div>'
      + '<div class="podium-block ' + rkBClass[p] + '"></div>'
      + '</div>';
  }
  document.getElementById('lb-podium').innerHTML = podiumHtml;

  var listHtml = '';
  for (var r = 0; r < rest.length; r++) {
    var isMe = rest[r].id === String(currentUser.id);
    listHtml +=
      '<div class="lb-row' + (isMe ? ' me' : '') + '">'
      + '<div class="lb-pos">#' + (r + 4) + '</div>'
      + '<div class="lb-name">' + rest[r].name + (isMe ? ' (you)' : '') + '</div>'
      + '<div class="lb-score">' + Math.floor(rest[r].balance) + '</div>'
      + '</div>';
  }
  document.getElementById('lb-list').innerHTML = listHtml || '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No other users yet</div>';
}

/* ════════════════════════════════════════════
   REFERRALS PAGE
════════════════════════════════════════════ */
function renderRefs() {
  var u = currentUser;
  var verifiedCount = 0;
  for (var i = 0; i < u.refs.length; i++) {
    if (u.refs[i].status === 'verified') verifiedCount++;
  }

  document.getElementById('ref-count').textContent  = u.refs.length;
  document.getElementById('ref-earned').textContent = '+' + (verifiedCount * CFG.REF_BONUS) + ' ALPHA earned from verified refs';

  var botName = CFG.BOT_USERNAME;
  var link    = 'https://t.me/' + botName + '/app?startapp=ref_' + u.id;
  document.getElementById('ref-link-box').textContent = link;

  var listHtml = '';
  for (var j = 0; j < u.refs.length; j++) {
    var ref = u.refs[j];
    listHtml +=
      '<div class="ref-item">'
      + '<div class="ref-av">👤</div>'
      + '<div class="ref-user">'
      +   '<div class="ref-uname">' + ref.refereeName + '</div>'
      +   '<div class="ref-ustat ' + ref.status + '">' + (ref.status === 'verified' ? '✅ Verified' : '⏳ Pending (needs 100 ALPHA)') + '</div>'
      + '</div>'
      + '<div class="ref-bonus">' + (ref.status === 'verified' ? '+' + CFG.REF_BONUS : '---') + '</div>'
      + '</div>';
  }
  document.getElementById('ref-list').innerHTML = listHtml || '<div style="text-align:center;color:var(--gray);padding:30px;font-size:11px;">No referrals yet.<br>Share your link to earn!</div>';
}

function copyRefLink() {
  var link = document.getElementById('ref-link-box').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).catch(function(){});
  }
  /* fallback */
  var el = document.createElement('textarea');
  el.value = link;
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); } catch(e){}
  document.body.removeChild(el);
  showToast('Link copied! ✅', 'suc');
}

function shareRefLink() {
  var link = document.getElementById('ref-link-box').textContent;
  var text = '🚀 Join ALPHA Token Airdrop and start mining!\n\nUse my referral link:\n' + link;
  var shareUrl = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text);
  if (tg) { tg.openTelegramLink(shareUrl); }
  else { window.open(shareUrl, '_blank'); }
}

/* ════════════════════════════════════════════
   HISTORY OVERLAY
════════════════════════════════════════════ */
function openHistory() {
  var hist  = currentUser.history;
  var body  = document.getElementById('history-body');
  var html  = '';

  if (!hist || !hist.length) {
    body.innerHTML = '<div style="text-align:center;color:var(--gray);padding:30px;font-size:11px;">No transactions yet</div>';
  } else {
    for (var i = 0; i < hist.length; i++) {
      var h   = hist[i];
      var pos = h.amount > 0;
      var amtStr = (pos ? '+' : '') + h.amount.toFixed(1) + ' ALPHA';
      var date   = new Date(h.ts).toLocaleString();
      html +=
        '<div class="hist-item">'
        + '<div class="hist-row1">'
        +   '<span class="hist-type">' + h.type.toUpperCase() + '</span>'
        +   '<span class="hist-amt ' + (pos ? 'pos' : 'neg') + '">' + amtStr + '</span>'
        + '</div>'
        + '<div class="hist-desc">' + h.desc + '</div>'
        + '<div class="hist-id">ID: ' + h.id + '</div>'
        + '<div class="hist-ts">' + date + ' · Balance after: ' + Math.floor(h.balanceAfter) + ' ALPHA</div>'
        + '</div>';
    }
    body.innerHTML = html;
  }

  openOverlay('overlay-history');
}

/* ════════════════════════════════════════════
   PROFILE OVERLAY
════════════════════════════════════════════ */
function openProfile() {
  var u    = currentUser;
  var body = document.getElementById('profile-body');

  var nftsHtml = '';
  if (!u.nfts || !u.nfts.length) {
    nftsHtml = '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No NFTs owned yet</div>';
  } else {
    nftsHtml = '<div class="nft-grid">';
    for (var i = 0; i < u.nfts.length; i++) {
      var nft = u.nfts[i];
      var sendStatus = '';
      if (nft.sendRequest) {
        sendStatus = '<div class="nft-send-status">📬 Sent for transfer (' + nft.sendRequest.status + ')</div>';
      }
      nftsHtml +=
        '<div class="nft-item">'
        + '<img src="' + (nft.img || '') + '" alt="' + nft.name + '" onerror="this.style.display=\'none\'">'
        + '<div class="nft-item-body">'
        +   '<div class="nft-item-name">' + nft.name + '</div>'
        +   (nft.sendRequest ? sendStatus : '<button class="nft-send-btn" onclick="openSendNFT(\'' + nft.nftId + '\')">SEND ↗</button>')
        + '</div>'
        + '</div>';
    }
    nftsHtml += '</div>';
  }

  body.innerHTML =
    '<div class="profile-name">' + u.name + '</div>'
    + '<div class="profile-id">ID: ' + u.id + '</div>'
    + '<div class="profile-tabs">'
    +   '<button class="profile-tab active" onclick="switchProfileTab(\'info\',this)">INFO</button>'
    +   '<button class="profile-tab" onclick="switchProfileTab(\'gallery\',this)">GALLERY</button>'
    + '</div>'
    + '<div class="profile-sub-page active" id="ptab-info">'
    +   '<div class="stat-card" style="margin-bottom:8px;"><div class="stat-v">' + Math.floor(u.balance) + '</div><div class="stat-l">ALPHA BALANCE</div></div>'
    +   '<div class="stat-card" style="margin-bottom:8px;"><div class="stat-v">' + u.sessions + '</div><div class="stat-l">MINING SESSIONS</div></div>'
    +   '<div class="stat-card" style="margin-bottom:8px;"><div class="stat-v">' + u.refs.length + '</div><div class="stat-l">REFERRALS</div></div>'
    + '</div>'
    + '<div class="profile-sub-page" id="ptab-gallery">' + nftsHtml + '</div>';

  openOverlay('overlay-profile');
}

function switchProfileTab(name, btn) {
  var tabs = document.querySelectorAll('.profile-tab');
  var pages = document.querySelectorAll('.profile-sub-page');
  for (var i = 0; i < tabs.length; i++)  tabs[i].classList.remove('active');
  for (var j = 0; j < pages.length; j++) pages[j].classList.remove('active');
  btn.classList.add('active');
  var pg = document.getElementById('ptab-' + name);
  if (pg) pg.classList.add('active');
}

/* ════════════════════════════════════════════
   NFT SEND
════════════════════════════════════════════ */
function openSendNFT(nftId) {
  currentNFTId = nftId;
  document.getElementById('send-address-input').value = '';
  showModal('modal-send');
}

function confirmSendNFT() {
  var address = document.getElementById('send-address-input').value.trim();
  if (!address) { showToast('Enter a wallet address', 'err'); return; }

  /* update NFT in user object */
  for (var i = 0; i < currentUser.nfts.length; i++) {
    if (currentUser.nfts[i].nftId === currentNFTId) {
      currentUser.nfts[i].sendRequest = { address: address, status: 'pending' };
      break;
    }
  }
  DB.saveUser(currentUser);

  /* push to admin queue */
  var nft = null;
  for (var j = 0; j < currentUser.nfts.length; j++) {
    if (currentUser.nfts[j].nftId === currentNFTId) { nft = currentUser.nfts[j]; break; }
  }
  var reqs = DB.getNFTRequests();
  reqs.push({
    reqId:    'NFT' + Date.now(),
    userId:   String(currentUser.id),
    userName: currentUser.name,
    nftId:    currentNFTId,
    nftName:  nft ? nft.name : '',
    nftImg:   nft ? nft.img  : '',
    address:  address,
    ts:       Date.now(),
    status:   'pending',
    notified: false
  });
  DB.saveNFTRequests(reqs);

  closeModal('modal-send');
  showToast('Send request submitted! ✅', 'suc');
  openProfile(); /* refresh profile */
}

/* ════════════════════════════════════════════
   PAGE / OVERLAY / MODAL HELPERS
════════════════════════════════════════════ */
function switchPage(name, btn) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');

  var navBtns = document.querySelectorAll('.nav-btn');
  for (var j = 0; j < navBtns.length; j++) navBtns[j].classList.remove('active');

  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');

  if (name === 'tasks')  renderTasks();
  if (name === 'lb')     renderLeaderboard();
  if (name === 'ref')    renderRefs();
  if (name === 'shop')   renderNFTMarket();
}

function openOverlay(id) {
  document.getElementById(id).classList.add('show');
}

function closeOverlay(id) {
  document.getElementById(id).classList.remove('show');
}

function showModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

/* ════════════════════════════════════════════
   TOAST
════════════════════════════════════════════ */
var toastTimer = null;
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = 'toast'; }, 2800);
}
