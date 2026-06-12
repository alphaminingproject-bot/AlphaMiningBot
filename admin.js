/* ============================================================
   admin.js  —  ALPHA Token Admin Dashboard Logic
   No external APIs. All data via data.js (DB object).
   ============================================================ */

/* ── CHANGE THIS PASSWORD ── */
var ADMIN_PASSWORD = 'alpha2025admin';

/* ─────────────────────────────────────────
   LOGIN
───────────────────────────────────────── */
function doLogin() {
  var pw = document.getElementById('pw-input').value;
  if (pw === ADMIN_PASSWORD) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display    = 'block';
    initDashboard();
  } else {
    document.getElementById('login-err').style.display = 'block';
  }
}

document.getElementById('pw-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doLogin();
});

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function initDashboard() {
  loadOverview();
  updateBadgeDots();
  renderTasks();
  renderEvents();
  renderNFTListings();
  loadAirdropLog();
  loadLeaderboard();
  /* auto-refresh every 30 seconds */
  setInterval(function () {
    loadOverview();
    updateBadgeDots();
  }, 30000);
}

/* ─────────────────────────────────────────
   SECTION SWITCH
───────────────────────────────────────── */
function showSection(name, el) {
  var sections = document.querySelectorAll('.section');
  for (var i = 0; i < sections.length; i++) sections[i].classList.remove('active');

  var navItems = document.querySelectorAll('.nav-item');
  for (var j = 0; j < navItems.length; j++) navItems[j].classList.remove('active');

  document.getElementById('section-' + name).classList.add('active');
  el.classList.add('active');

  /* load data for the section */
  if (name === 'overview')     loadOverview();
  if (name === 'users')        loadUsers();
  if (name === 'verify-ref')   loadRefQueue();
  if (name === 'verify-x')     loadXQueue();
  if (name === 'nft-requests') loadNFTRequests();
  if (name === 'leaderboard')  loadLeaderboard();
  if (name === 'backup')       loadBackupStats();
  if (name === 'airdrop')      loadAirdropLog();
}

/* ─────────────────────────────────────────
   BADGE DOTS (red indicators)
───────────────────────────────────────── */
function updateBadgeDots() {
  var refQ  = DB.getRefQueue().filter(function(r){ return r.status === 'pending'; });
  var xQ    = DB.getXQueue().filter(function(x){ return x.status === 'pending'; });
  var nftQ  = DB.getNFTRequests().filter(function(n){ return n.status === 'pending'; });

  toggleDot('dot-ref', refQ.length > 0);
  toggleDot('dot-x',   xQ.length  > 0);
  toggleDot('dot-nft', nftQ.length > 0);
}

function toggleDot(id, show) {
  var el = document.getElementById(id);
  if (el) { if (show) el.classList.add('show'); else el.classList.remove('show'); }
}

/* ─────────────────────────────────────────
   OVERVIEW
───────────────────────────────────────── */
function loadOverview() {
  var users  = DB.getAllUsers();
  var now    = Date.now();
  var online = users.filter(function(u){ return now - u.lastSeen < 2 * 60 * 1000; }).length;
  var gs     = DB.getGlobalStats();
  var mined  = gs.totalMined || 0;
  var left   = Math.max(0, DB.MAX_SUPPLY - mined);

  document.getElementById('ov-users').textContent  = users.length;
  document.getElementById('ov-online').textContent = online;
  document.getElementById('ov-mined').textContent  = Math.floor(mined).toLocaleString();
  document.getElementById('ov-left').textContent   = Math.floor(left).toLocaleString();

  users.sort(function(a, b){ return b.lastSeen - a.lastSeen; });

  var html = '';
  for (var i = 0; i < Math.min(users.length, 30); i++) {
    var u       = users[i];
    var ago     = timeSince(u.lastSeen);
    var isOn    = (now - u.lastSeen < 2 * 60 * 1000);
    var minerTxt = getMinerLabel(u);
    var statusBadge = isOn
      ? '<span class="badge green">ONLINE</span>'
      : '<span class="badge gray">OFFLINE</span>';

    html += '<tr>'
      + '<td>' + (isOn ? '<span class="dot-online"></span>' : '') + u.name + '</td>'
      + '<td style="color:var(--gray);">' + u.id + '</td>'
      + '<td style="color:var(--gold);font-weight:bold;">' + Math.floor(u.balance) + '</td>'
      + '<td>' + (u.sessions || 0) + '</td>'
      + '<td>' + (u.refs ? u.refs.length : 0) + '</td>'
      + '<td>' + minerTxt + '</td>'
      + '<td>' + statusBadge + '</td>'
      + '<td style="color:var(--gray);font-size:10px;">' + ago + '</td>'
      + '</tr>';
  }

  document.getElementById('ov-table').innerHTML = html
    || '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:20px;">No users yet</td></tr>';
}

/* ─────────────────────────────────────────
   ALL USERS
───────────────────────────────────────── */
function loadUsers() {
  var users  = DB.getAllUsers();
  var filter = (document.getElementById('user-search-inline') || {}).value || '';
  filter = filter.toLowerCase().trim();

  if (filter) {
    users = users.filter(function(u){
      return u.name.toLowerCase().indexOf(filter) !== -1
          || String(u.id).indexOf(filter) !== -1
          || (u.username || '').toLowerCase().indexOf(filter) !== -1;
    });
  }

  users.sort(function(a, b){ return b.balance - a.balance; });

  var html = '';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    html += '<tr>'
      + '<td>' + u.name + '</td>'
      + '<td style="color:var(--gray);">@' + (u.username || '—') + '</td>'
      + '<td style="color:var(--gray);font-size:10px;">' + u.id + '</td>'
      + '<td style="color:var(--gold);font-weight:bold;">' + Math.floor(u.balance) + '</td>'
      + '<td>' + (u.sessions || 0) + '</td>'
      + '<td>' + (u.refs ? u.refs.length : 0) + '</td>'
      + '<td>' + getMinerLabel(u) + '</td>'
      + '<td style="color:var(--gray);font-size:10px;">' + timeSince(u.lastSeen) + '</td>'
      + '</tr>';
  }

  document.getElementById('users-table').innerHTML = html
    || '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:20px;">No users found</td></tr>';
}

/* ─────────────────────────────────────────
   USER LOOKUP
───────────────────────────────────────── */
function doUserLookup() {
  var uid    = document.getElementById('lookup-id-input').value.trim();
  var result = document.getElementById('lookup-result');
  if (!uid) { result.innerHTML = '<div style="color:var(--red);font-size:11px;">Please enter a user ID</div>'; return; }

  var u = DB.getUser(uid);
  if (!u) { result.innerHTML = '<div style="color:var(--red);font-size:11px;padding:10px 0;">User not found: ' + uid + '</div>'; return; }

  /* miner detail */
  var minerDetail = 'None';
  if (u.miner) {
    var m = u.miner;
    if (m.expired) {
      minerDetail = m.type + ' (EXPIRED)';
    } else if (m.claimedAt) {
      minerDetail = m.type + ' (CLAIMED)';
    } else {
      minerDetail = m.type + ' — expires ' + new Date(m.expiresAt).toLocaleString();
    }
  }

  /* refs */
  var pendingRefs  = u.refs.filter(function(r){ return r.status === 'pending'; }).length;
  var verifiedRefs = u.refs.filter(function(r){ return r.status === 'verified'; }).length;

  /* count mining claims (sessions) */
  var histMine  = u.history ? u.history.filter(function(h){ return h.type === 'mine'; }).length : 0;
  var histClaim = u.history ? u.history.filter(function(h){ return h.type === 'claim_miner'; }).length : 0;

  /* history table */
  var histHtml = '';
  if (u.history && u.history.length) {
    for (var i = 0; i < Math.min(u.history.length, 50); i++) {
      var h = u.history[i];
      var pos = h.amount > 0;
      histHtml += '<tr>'
        + '<td style="font-size:9px;color:var(--gray);">' + h.id + '</td>'
        + '<td>' + h.type + '</td>'
        + '<td>' + h.desc + '</td>'
        + '<td style="color:' + (pos ? 'var(--green)' : 'var(--red)') + ';font-weight:bold;">'
        +   (pos ? '+' : '') + h.amount.toFixed(1)
        + '</td>'
        + '<td>' + Math.floor(h.balanceAfter) + '</td>'
        + '<td style="font-size:10px;color:var(--gray);">' + new Date(h.ts).toLocaleString() + '</td>'
        + '</tr>';
    }
  } else {
    histHtml = '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:10px;">No history</td></tr>';
  }

  result.innerHTML =
    '<div class="user-detail-card">'
    + '<div class="ud-name">' + u.name + ' ' + (u.username ? '(@' + u.username + ')' : '') + '</div>'
    + '<div class="ud-id">ID: ' + u.id + ' &nbsp;·&nbsp; Joined: ' + new Date(u.createdAt || 0).toLocaleDateString() + '</div>'
    + '<div class="ud-grid">'
    +   '<div class="ud-stat"><div class="ud-sv">' + Math.floor(u.balance) + '</div><div class="ud-sl">ALPHA BALANCE</div></div>'
    +   '<div class="ud-stat"><div class="ud-sv">' + (u.sessions || 0) + '</div><div class="ud-sl">SESSIONS</div></div>'
    +   '<div class="ud-stat"><div class="ud-sv">' + histMine + '</div><div class="ud-sl">3H CLAIMS</div></div>'
    +   '<div class="ud-stat"><div class="ud-sv">' + histClaim + '</div><div class="ud-sl">MINER CLAIMS</div></div>'
    +   '<div class="ud-stat"><div class="ud-sv">' + pendingRefs + '</div><div class="ud-sl">PENDING REFS</div></div>'
    +   '<div class="ud-stat"><div class="ud-sv">' + verifiedRefs + '</div><div class="ud-sl">VERIFIED REFS</div></div>'
    + '</div>'
    + '<div style="font-size:10px;color:var(--gray);margin-bottom:10px;">Auto Miner: <span style="color:var(--white);">' + minerDetail + '</span></div>'
    + '<div style="font-size:10px;color:var(--gray);margin-bottom:14px;">Referred By: <span style="color:var(--white);">' + (u.referredBy || 'None') + '</span></div>'
    + '</div>'
    + '<div class="tbl-card">'
    +   '<div class="tbl-head"><span class="tbl-title">TRANSACTION HISTORY</span></div>'
    +   '<div class="tbl-body"><table>'
    +     '<thead><tr><th>TX ID</th><th>TYPE</th><th>DESCRIPTION</th><th>AMOUNT</th><th>BAL AFTER</th><th>DATE</th></tr></thead>'
    +     '<tbody>' + histHtml + '</tbody>'
    +   '</table></div>'
    + '</div>';
}

/* ─────────────────────────────────────────
   REF QUEUE
───────────────────────────────────────── */
function loadRefQueue() {
  var q    = DB.getRefQueue();
  var html = '';

  for (var i = 0; i < q.length; i++) {
    var r = q[i];
    var actionHtml = '';
    if (r.status === 'pending') {
      actionHtml =
        '<button class="btn success sm" onclick="approveRef(' + i + ')">APPROVE</button> '
        + '<button class="btn danger sm" onclick="rejectRef(' + i + ')">REJECT</button>';
    } else {
      actionHtml = '<span class="badge ' + (r.status === 'verified' ? 'green' : 'red') + '">' + r.status.toUpperCase() + '</span>';
    }

    html += '<tr>'
      + '<td>' + r.referrerName + '</td>'
      + '<td style="color:var(--gray);font-size:10px;">' + r.referrerId + '</td>'
      + '<td>' + r.refereeName + '</td>'
      + '<td style="color:var(--gray);font-size:10px;">' + r.refereeId + '</td>'
      + '<td style="font-size:10px;color:var(--gray);">' + new Date(r.ts).toLocaleDateString() + '</td>'
      + '<td><span class="badge ' + (r.status === 'pending' ? 'gold' : r.status === 'verified' ? 'green' : 'red') + '">' + r.status.toUpperCase() + '</span></td>'
      + '<td>' + actionHtml + '</td>'
      + '</tr>';
  }

  document.getElementById('ref-queue-table').innerHTML = html
    || '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:20px;">No pending referrals</td></tr>';

  updateBadgeDots();
}

function approveRef(idx) {
  var q = DB.getRefQueue();
  var r = q[idx];
  if (!r || r.status !== 'pending') return;

  r.status = 'verified';
  DB.saveRefQueue(q);

  /* credit referrer 100 ALPHA */
  var referrer = DB.getUser(r.referrerId);
  if (referrer) {
    referrer.balance += 100;
    for (var i = 0; i < referrer.refs.length; i++) {
      if (referrer.refs[i].refereeId === r.refereeId) {
        referrer.refs[i].status = 'verified';
        break;
      }
    }
    DB.addHistory(referrer, 'ref', 'Referral verified: ' + r.refereeName, 100);
    DB.addToTotalMined(100);
    DB.saveUser(referrer);
  }

  loadRefQueue();
  showToast('Referral approved! +100 ALPHA sent to ' + r.referrerName, 'suc');
}

function rejectRef(idx) {
  var q = DB.getRefQueue();
  if (!q[idx]) return;
  q[idx].status = 'rejected';
  DB.saveRefQueue(q);
  loadRefQueue();
  showToast('Referral rejected.', 'err');
}

/* ─────────────────────────────────────────
   X TASK QUEUE
───────────────────────────────────────── */
function loadXQueue() {
  var q    = DB.getXQueue();
  var html = '';

  for (var i = 0; i < q.length; i++) {
    var x = q[i];
    var actionHtml = '';
    if (x.status === 'pending') {
      actionHtml =
        '<button class="btn success sm" onclick="approveX(' + i + ')">VERIFIED</button> '
        + '<button class="btn danger sm" onclick="rejectX(' + i + ')">REJECT</button>';
    } else {
      actionHtml = '<span class="badge ' + (x.status === 'verified' ? 'green' : 'red') + '">' + x.status.toUpperCase() + '</span>';
    }

    html += '<tr>'
      + '<td>' + x.userName + ' <span style="color:var(--gray);font-size:9px;">(' + x.userId + ')</span></td>'
      + '<td>' + (x.taskName || x.taskId) + '</td>'
      + '<td style="color:var(--blue);">@' + x.handle + '</td>'
      + '<td style="font-size:10px;color:var(--gray);">' + new Date(x.ts).toLocaleDateString() + '</td>'
      + '<td><span class="badge ' + (x.status === 'pending' ? 'gold' : x.status === 'verified' ? 'green' : 'red') + '">' + x.status.toUpperCase() + '</span></td>'
      + '<td>' + actionHtml + '</td>'
      + '</tr>';
  }

  document.getElementById('x-queue-table').innerHTML = html
    || '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:20px;">No submissions</td></tr>';

  updateBadgeDots();
}

function approveX(idx) {
  var q = DB.getXQueue();
  var x = q[idx];
  if (!x || x.status !== 'pending') return;

  x.status   = 'verified';
  x.notified = false;
  DB.saveXQueue(q);

  /* grant reward to user */
  var u = DB.getUser(x.userId);
  if (u) {
    u.taskStates[x.taskId] = 'done';
    u.balance += (x.reward || 0);
    DB.addHistory(u, 'task', 'X task verified: ' + (x.taskName || x.taskId), x.reward || 0);
    if (x.reward) DB.addToTotalMined(x.reward);
    DB.saveUser(u);
  }

  loadXQueue();
  showToast('X task approved for @' + x.handle + '! Reward granted.', 'suc');
}

function rejectX(idx) {
  var q = DB.getXQueue();
  var x = q[idx];
  if (!x || x.status !== 'pending') return;

  x.status   = 'rejected';
  x.notified = false;
  DB.saveXQueue(q);

  /* reset task state so user can retry */
  var u = DB.getUser(x.userId);
  if (u) {
    u.taskStates[x.taskId] = 'rejected';
    DB.saveUser(u);
  }

  loadXQueue();
  showToast('X task rejected. User will be notified to retry.', 'err');
}

/* ─────────────────────────────────────────
   NFT SEND REQUESTS
───────────────────────────────────────── */
function loadNFTRequests() {
  var reqs = DB.getNFTRequests();
  var html = '';

  for (var i = 0; i < reqs.length; i++) {
    var r = reqs[i];
    var actionHtml = '';
    if (r.status === 'pending') {
      actionHtml = '<button class="btn success sm" onclick="markNFTSent(\'' + r.reqId + '\')">MARK SENT</button>';
    } else {
      actionHtml = '<span class="badge green">SENT</span>';
    }

    html += '<tr>'
      + '<td>' + r.userName + ' <span style="color:var(--gray);font-size:9px;">(' + r.userId + ')</span></td>'
      + '<td>' + r.nftName + '</td>'
      + '<td style="font-size:10px;color:var(--gray);max-width:180px;word-break:break-all;">' + r.address + '</td>'
      + '<td style="font-size:10px;color:var(--gray);">' + new Date(r.ts).toLocaleDateString() + '</td>'
      + '<td><span class="badge ' + (r.status === 'pending' ? 'gold' : 'green') + '">' + r.status.toUpperCase() + '</span></td>'
      + '<td>' + actionHtml + '</td>'
      + '</tr>';
  }

  document.getElementById('nft-req-table').innerHTML = html
    || '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:20px;">No pending NFT requests</td></tr>';

  updateBadgeDots();
}

function markNFTSent(reqId) {
  var reqs = DB.getNFTRequests();
  for (var i = 0; i < reqs.length; i++) {
    if (reqs[i].reqId === reqId) {
      reqs[i].status   = 'sent';
      reqs[i].notified = false;
      break;
    }
  }
  DB.saveNFTRequests(reqs);
  loadNFTRequests();
  showToast('NFT marked as sent. User will be notified.', 'suc');
}

/* ─────────────────────────────────────────
   TASK MANAGEMENT
───────────────────────────────────────── */
function onTaskTypeChange() {
  var type  = document.getElementById('t-type').value;
  var label = document.getElementById('t-target-label');
  if (type === 'telegram') label.textContent = 'CHANNEL/GROUP HANDLE (@name) *';
  else if (type === 'x_follow') label.textContent = 'PROFILE URL (https://x.com/...) *';
  else label.textContent = 'URL *';
}

function addTask() {
  var name   = document.getElementById('t-name').value.trim();
  var reward = parseInt(document.getElementById('t-reward').value, 10);
  var type   = document.getElementById('t-type').value;
  var icon   = document.getElementById('t-icon').value.trim() || '🎯';
  var target = document.getElementById('t-target').value.trim();
  var desc   = document.getElementById('t-desc').value.trim();

  if (!name)          { showToast('Task name is required', 'err'); return; }
  if (!reward || reward < 1) { showToast('Reward must be at least 1 ALPHA', 'err'); return; }
  if (!target)        { showToast('Target URL or handle is required', 'err'); return; }

  var tasks = DB.getTasks();
  var newTask = {
    id:       'task_' + Date.now(),
    name:     name,
    reward:   reward,
    type:     type,
    icon:     icon,
    target:   target,
    desc:     desc,
    xFollow:  (type === 'x_follow')
  };

  tasks.push(newTask);
  DB.saveTasks(tasks);
  renderTasks();
  clearTaskForm();
  showToast('Task "' + name + '" added!', 'suc');
}

function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  var tasks = DB.getTasks().filter(function(t){ return t.id !== id; });
  DB.saveTasks(tasks);
  renderTasks();
  showToast('Task deleted', 'err');
}

function clearTaskForm() {
  ['t-name','t-reward','t-icon','t-target','t-desc'].forEach(function(id){
    document.getElementById(id).value = '';
  });
}

function renderTasks() {
  var tasks = DB.getTasks();
  var badge = document.getElementById('tasks-count-badge');
  if (badge) badge.textContent = tasks.length + ' tasks';

  var cont = document.getElementById('tasks-admin-list');
  if (!cont) return;

  if (!tasks.length) {
    cont.innerHTML = '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No tasks yet. Add one above.</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    html +=
      '<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">'
      + '<span style="font-size:22px;flex-shrink:0;">' + (t.icon || '🎯') + '</span>'
      + '<div style="flex:1;">'
      +   '<div style="font-size:12px;font-weight:bold;color:var(--white);">' + t.name + '</div>'
      +   '<div style="font-size:9px;color:var(--gray);margin-top:2px;">' + t.type + ' &nbsp;·&nbsp; ' + (t.target || '') + '</div>'
      +   '<div style="font-size:9px;color:var(--gray);">' + (t.desc || '') + '</div>'
      + '</div>'
      + '<div style="font-size:12px;font-weight:bold;color:var(--gold);flex-shrink:0;">+' + t.reward + ' ALPHA</div>'
      + '<button class="btn danger sm" onclick="deleteTask(\'' + t.id + '\')">DELETE</button>'
      + '</div>';
  }
  cont.innerHTML = html;
}

/* ─────────────────────────────────────────
   EVENTS
───────────────────────────────────────── */
function createEvent() {
  var name   = document.getElementById('ev-name').value.trim();
  var icon   = document.getElementById('ev-icon').value.trim() || '📣';
  var desc   = document.getElementById('ev-desc').value.trim();
  var tName  = document.getElementById('ev-t-name').value.trim();
  var tRew   = parseInt(document.getElementById('ev-t-reward').value, 10);
  var tType  = document.getElementById('ev-t-type').value;
  var tIcon  = document.getElementById('ev-t-icon').value.trim() || '🎯';
  var tTarget= document.getElementById('ev-t-target').value.trim();

  if (!name)  { showToast('Event name required', 'err'); return; }
  if (!tName) { showToast('Task name required', 'err'); return; }
  if (!tRew || tRew < 1) { showToast('Task reward required', 'err'); return; }

  var events = DB.getEvents();
  events.push({
    id:    'ev_' + Date.now(),
    name:  name,
    icon:  icon,
    desc:  desc,
    createdAt: Date.now(),
    tasks: [{
      id:      'ev_t_' + Date.now(),
      name:    tName,
      reward:  tRew,
      type:    tType,
      icon:    tIcon,
      target:  tTarget,
      xFollow: (tType === 'x_follow'),
      desc:    desc
    }]
  });

  DB.saveEvents(events);
  renderEvents();
  /* clear */
  ['ev-name','ev-icon','ev-desc','ev-t-name','ev-t-reward','ev-t-icon','ev-t-target'].forEach(function(id){
    document.getElementById(id).value = '';
  });
  showToast('Event created!', 'suc');
}

function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  var events = DB.getEvents().filter(function(e){ return e.id !== id; });
  DB.saveEvents(events);
  renderEvents();
  showToast('Event deleted', 'err');
}

function renderEvents() {
  var events = DB.getEvents();
  var cont   = document.getElementById('events-list');
  if (!cont) return;

  if (!events.length) {
    cont.innerHTML = '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No events created yet</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    html +=
      '<div style="background:linear-gradient(135deg,rgba(240,180,41,0.06),rgba(0,0,0,0.5));border:1px solid rgba(240,180,41,0.3);border-radius:10px;padding:14px;margin-bottom:10px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
      +   '<span style="font-size:20px;">' + ev.icon + '</span>'
      +   '<span style="font-size:13px;font-weight:bold;color:var(--gold);">' + ev.name + '</span>'
      +   '<button class="btn danger sm" style="margin-left:auto;" onclick="deleteEvent(\'' + ev.id + '\')">DELETE</button>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--gray);margin-bottom:8px;">' + (ev.desc || '') + '</div>'
      + '<div style="font-size:9px;letter-spacing:2px;color:var(--gold);margin-bottom:6px;">TASKS</div>';

    for (var j = 0; j < ev.tasks.length; j++) {
      var t = ev.tasks[j];
      html += '<div style="background:rgba(0,0,0,0.3);border-radius:6px;padding:8px 10px;font-size:10px;color:var(--white);">'
        + (t.icon || '') + ' ' + t.name + ' &nbsp;·&nbsp; <span style="color:var(--gold);">+' + t.reward + ' ALPHA</span>'
        + '</div>';
    }

    html += '</div>';
  }
  cont.innerHTML = html;
}

/* ─────────────────────────────────────────
   NFT MARKET
───────────────────────────────────────── */
var pendingNFTImg = '';

function previewNFTImage() {
  var file = document.getElementById('nft-img-file').files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    pendingNFTImg = e.target.result;
    var prev = document.getElementById('nft-img-preview');
    prev.innerHTML = '<img src="' + pendingNFTImg + '" alt="preview"/>';
  };
  reader.readAsDataURL(file);
}

function addNFTListing() {
  var name  = document.getElementById('nft-name').value.trim();
  var price = parseInt(document.getElementById('nft-price').value, 10);

  if (!name)           { showToast('NFT name required', 'err'); return; }
  if (!price || price < 1) { showToast('Price required', 'err'); return; }
  if (!pendingNFTImg)  { showToast('Please select an image', 'err'); return; }

  var listings = DB.getNFTListings();
  listings.push({
    id:        'nft_' + Date.now(),
    name:      name,
    price:     price,
    img:       pendingNFTImg,
    available: true,
    createdAt: Date.now()
  });
  DB.saveNFTListings(listings);

  pendingNFTImg = '';
  document.getElementById('nft-name').value  = '';
  document.getElementById('nft-price').value = '';
  document.getElementById('nft-img-file').value = '';
  document.getElementById('nft-img-preview').innerHTML = 'No image selected';

  renderNFTListings();
  showToast('NFT listing added!', 'suc');
}

function toggleNFTAvailable(id) {
  var listings = DB.getNFTListings();
  for (var i = 0; i < listings.length; i++) {
    if (listings[i].id === id) {
      listings[i].available = !listings[i].available;
      break;
    }
  }
  DB.saveNFTListings(listings);
  renderNFTListings();
}

function deleteNFTListing(id) {
  if (!confirm('Delete this NFT listing?')) return;
  var listings = DB.getNFTListings().filter(function(n){ return n.id !== id; });
  DB.saveNFTListings(listings);
  renderNFTListings();
  showToast('NFT listing deleted', 'err');
}

function renderNFTListings() {
  var listings = DB.getNFTListings();
  var cont     = document.getElementById('nft-listings-list');
  if (!cont) return;

  if (!listings.length) {
    cont.innerHTML = '<div style="text-align:center;color:var(--gray);padding:20px;font-size:11px;">No NFT listings yet</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < listings.length; i++) {
    var n = listings[i];
    html +=
      '<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px;">'
      + '<img src="' + n.img + '" style="width:50px;height:50px;object-fit:cover;border-radius:6px;" onerror="this.style.display=\'none\'">'
      + '<div style="flex:1;">'
      +   '<div style="font-size:12px;font-weight:bold;color:var(--white);">' + n.name + '</div>'
      +   '<div style="font-size:10px;color:var(--gold);margin-top:2px;">' + n.price + ' ALPHA</div>'
      +   '<span class="badge ' + (n.available ? 'green' : 'gray') + '" style="margin-top:4px;display:inline-block;">' + (n.available ? 'AVAILABLE' : 'HIDDEN') + '</span>'
      + '</div>'
      + '<button class="btn warning sm" onclick="toggleNFTAvailable(\'' + n.id + '\')">' + (n.available ? 'HIDE' : 'SHOW') + '</button>'
      + '<button class="btn danger sm"  onclick="deleteNFTListing(\'' + n.id + '\')">DELETE</button>'
      + '</div>';
  }
  cont.innerHTML = html;
}

/* ─────────────────────────────────────────
   AIRDROP
───────────────────────────────────────── */
function doAirdrop() {
  var uid    = document.getElementById('drop-id').value.trim();
  var amount = parseInt(document.getElementById('drop-amount').value, 10);
  var note   = document.getElementById('drop-note').value.trim();

  if (!uid)              { showToast('User ID required', 'err'); return; }
  if (!amount || amount < 1) { showToast('Amount must be at least 1', 'err'); return; }

  var u = DB.getUser(uid);
  if (!u) { showToast('User not found: ' + uid, 'err'); return; }

  u.balance += amount;
  DB.addHistory(u, 'airdrop', 'Admin airdrop' + (note ? ': ' + note : ''), amount);
  DB.addToTotalMined(amount);
  DB.saveUser(u);

  /* log */
  DB.logAirdrop({ userId: uid, userName: u.name, amount: amount, note: note, ts: Date.now() });

  document.getElementById('drop-id').value     = '';
  document.getElementById('drop-amount').value = '';
  document.getElementById('drop-note').value   = '';

  loadAirdropLog();
  showToast('+' + amount + ' ALPHA airdropped to ' + u.name + '!', 'suc');
}

function loadAirdropLog() {
  var log  = DB.getAirdropLog();
  var html = '';
  for (var i = 0; i < log.length; i++) {
    var a = log[i];
    html += '<tr>'
      + '<td style="color:var(--gray);font-size:10px;">' + a.userId + '</td>'
      + '<td>' + a.userName + '</td>'
      + '<td style="color:var(--gold);font-weight:bold;">+' + a.amount + '</td>'
      + '<td style="color:var(--gray);">' + (a.note || '—') + '</td>'
      + '<td style="font-size:10px;color:var(--gray);">' + new Date(a.ts).toLocaleString() + '</td>'
      + '</tr>';
  }
  var tbody = document.getElementById('airdrop-log-table');
  if (tbody) {
    tbody.innerHTML = html
      || '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:20px;">No airdrops yet</td></tr>';
  }
}

/* ─────────────────────────────────────────
   LEADERBOARD
───────────────────────────────────────── */
function loadLeaderboard() {
  var users = DB.getAllUsers();
  users.sort(function(a, b){ return b.balance - a.balance; });

  var html = '';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var rankLabel = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
    html += '<tr>'
      + '<td style="font-weight:bold;color:var(--gold);">' + rankLabel + '</td>'
      + '<td>' + u.name + '</td>'
      + '<td style="color:var(--gray);">@' + (u.username || '—') + '</td>'
      + '<td style="font-weight:bold;color:var(--blue);">' + Math.floor(u.balance) + '</td>'
      + '<td>' + (u.sessions || 0) + '</td>'
      + '<td>' + (u.refs ? u.refs.length : 0) + '</td>'
      + '</tr>';
  }

  var tbody = document.getElementById('lb-table');
  if (tbody) {
    tbody.innerHTML = html
      || '<tr><td colspan="6" style="text-align:center;color:var(--gray);padding:20px;">No users yet</td></tr>';
  }
}

/* ─────────────────────────────────────────
   BACKUP / EXPORT
───────────────────────────────────────── */
function loadBackupStats() {
  var gs    = DB.getGlobalStats();
  var users = DB.getAllUsers();
  var cont  = document.getElementById('backup-stats');
  if (!cont) return;

  cont.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">'
    + '<div class="ud-stat"><div class="ud-sv">' + users.length + '</div><div class="ud-sl">TOTAL USERS</div></div>'
    + '<div class="ud-stat"><div class="ud-sv">' + Math.floor(gs.totalMined || 0).toLocaleString() + '</div><div class="ud-sl">TOTAL MINED</div></div>'
    + '<div class="ud-stat"><div class="ud-sv">' + DB.getTasks().length + '</div><div class="ud-sl">ACTIVE TASKS</div></div>'
    + '</div>';
}

function downloadBackup() {
  var data     = DB.exportAll();
  var jsonStr  = JSON.stringify(data, null, 2);
  var blob     = new Blob([jsonStr], { type: 'application/json' });
  var url      = URL.createObjectURL(blob);
  var a        = document.createElement('a');
  var filename = 'alpha_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  a.href       = url;
  a.download   = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded: ' + filename, 'suc');
}

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function getMinerLabel(u) {
  if (!u.miner) return '<span style="color:var(--gray);font-size:10px;">None</span>';
  var m   = u.miner;
  var now = Date.now();
  if (m.expired)   return '<span class="badge gray">EXPIRED</span>';
  if (m.claimedAt) return '<span class="badge blue">CLAIMED</span>';
  if (now > m.expiresAt) return '<span class="badge red">EXPIRED</span>';
  return '<span class="badge green">' + m.type.toUpperCase() + '</span>';
}

function timeSince(ts) {
  var s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return s + 's ago';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
var toastTimer = null;
function showToast(msg, type) {
  var t = document.getElementById('admin-toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.className = 'toast'; }, 3000);
}
