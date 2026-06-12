/* ============================================================
   data.js  —  ALPHA Token · Shared Data Store
   All reads and writes go through the DB object.
   Uses localStorage as the persistence engine.
   ============================================================ */

var DB = (function () {

  /* ── helpers ── */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* ══════════════════════════════════════════════════
     USERS
     Each user object:
     {
       id, name, username,
       balance,
       sessions,         ← number of 3-hr claims
       lastMine,         ← timestamp of last 3-hr claim
       miner: null | { type:'beta'|'alpha', boughtAt, expiresAt, claimedAt, expired }
       refs: [{ refereeId, refereeName, status:'pending'|'verified', earnedAlpha }]
       referredBy: userId | null,
       taskStates: { taskId: 'go'|'verify'|'pending'|'done'|'rejected' }
       taskHandles: { taskId: '@handle' }   ← for X follow tasks
       nfts: [{ nftId, name, img, price, boughtAt, sendRequest: null|{ address, status:'pending'|'sent' } }]
       history: [{ id, ts, type, desc, amount, balanceAfter }]
       lastSeen,
       createdAt
     }
  ═══════════════════════════════════════════════════ */

  function getUser(uid) {
    return load('user_' + uid, null);
  }

  function saveUser(user) {
    user.lastSeen = Date.now();
    save('user_' + user.id, user);
    // keep index
    var idx = load('user_index', []);
    if (idx.indexOf(user.id) === -1) { idx.push(user.id); save('user_index', idx); }
  }

  function getAllUsers() {
    var idx = load('user_index', []);
    var users = [];
    for (var i = 0; i < idx.length; i++) {
      var u = getUser(idx[i]);
      if (u) users.push(u);
    }
    return users;
  }

  function createUser(tgUser) {
    var u = {
      id: String(tgUser.id),
      name: tgUser.first_name || 'User',
      username: tgUser.username || '',
      balance: 0,
      sessions: 0,
      lastMine: 0,
      miner: null,
      refs: [],
      referredBy: null,
      taskStates: {},
      taskHandles: {},
      nfts: [],
      history: [],
      lastSeen: Date.now(),
      createdAt: Date.now()
    };
    saveUser(u);
    return u;
  }

  /* ── history helper ── */
  function addHistory(user, type, desc, amount) {
    var entry = {
      id: 'H' + Date.now() + Math.floor(Math.random() * 1000),
      ts: Date.now(),
      type: type,   // 'mine'|'task'|'ref'|'shop'|'claim_miner'|'airdrop'|'nft'|'event'
      desc: desc,
      amount: amount,
      balanceAfter: user.balance
    };
    user.history.unshift(entry);
    if (user.history.length > 200) user.history = user.history.slice(0, 200);
  }

  /* ══════════════════════════════════════════════════
     TASKS
  ═══════════════════════════════════════════════════ */
  var DEFAULT_TASKS = [
    { id: 't_ch1',  name: 'Join ALPHA Channel', desc: 'Join our official Telegram channel',  reward: 50,  type: 'telegram', target: '@ALPHATokenOfficial', icon: '📢', xFollow: false },
    { id: 't_ch2',  name: 'Join ALPHA Group',   desc: 'Join our community discussion group', reward: 30,  type: 'telegram', target: '@ALPHATokenGroup',    icon: '💬', xFollow: false },
    { id: 't_x1',   name: 'Follow on X',         desc: 'Follow @ALPHAToken on X (Twitter)',   reward: 25,  type: 'x_follow', target: 'https://x.com/ALPHAToken', icon: '🐦', xFollow: true  },
    { id: 't_ref10',name: 'Invite 10 Verified Refs', desc: 'Refer 10 users who each earn 100+ ALPHA', reward: 3000, type: 'auto_ref', target: '', icon: '🏆', xFollow: false, autoRef: 10 },
    { id: 't_ref3', name: 'Invite 3 Verified Refs',  desc: 'Refer 3 users who each earn 100+ ALPHA',  reward: 500,  type: 'auto_ref', target: '', icon: '🎯', xFollow: false, autoRef: 3  }
  ];

  function getTasks() {
    return load('alpha_tasks', DEFAULT_TASKS);
  }

  function saveTasks(tasks) {
    save('alpha_tasks', tasks);
  }

  /* ══════════════════════════════════════════════════
     EVENTS  (pinned campaign tasks, gold/black style)
  ═══════════════════════════════════════════════════ */
  function getEvents() {
    return load('alpha_events', []);
  }

  function saveEvents(events) {
    save('alpha_events', events);
  }

  /* ══════════════════════════════════════════════════
     X-FOLLOW VERIFICATION QUEUE
     { userId, userName, taskId, taskName, handle, ts, status:'pending'|'verified'|'rejected' }
  ═══════════════════════════════════════════════════ */
  function getXQueue() {
    return load('alpha_xqueue', []);
  }

  function saveXQueue(q) {
    save('alpha_xqueue', q);
  }

  /* ══════════════════════════════════════════════════
     REF VERIFICATION QUEUE
     { referrerId, referrerName, refereeId, refereeName, ts, status:'pending'|'verified' }
  ═══════════════════════════════════════════════════ */
  function getRefQueue() {
    return load('alpha_refqueue', []);
  }

  function saveRefQueue(q) {
    save('alpha_refqueue', q);
  }

  /* ══════════════════════════════════════════════════
     NFT MARKETPLACE LISTINGS  (admin uploads)
     { id, name, img, price, available }
  ═══════════════════════════════════════════════════ */
  function getNFTListings() {
    return load('alpha_nft_listings', []);
  }

  function saveNFTListings(list) {
    save('alpha_nft_listings', list);
  }

  /* NFT send requests queue
     { reqId, userId, userName, nftId, nftName, nftImg, address, ts, status:'pending'|'sent' }
  */
  function getNFTRequests() {
    return load('alpha_nft_requests', []);
  }

  function saveNFTRequests(reqs) {
    save('alpha_nft_requests', reqs);
  }

  /* ══════════════════════════════════════════════════
     GLOBAL STATS
  ═══════════════════════════════════════════════════ */
  var MAX_SUPPLY = 1000000000; // 1 billion

  function getGlobalStats() {
    return load('alpha_global', { totalMined: 0 });
  }

  function addToTotalMined(amount) {
    var g = getGlobalStats();
    g.totalMined = (g.totalMined || 0) + amount;
    save('alpha_global', g);
    return g.totalMined;
  }

  function isMaxSupplyReached() {
    var g = getGlobalStats();
    return (g.totalMined || 0) >= MAX_SUPPLY;
  }

  /* ══════════════════════════════════════════════════
     AIRDROP LOG
  ═══════════════════════════════════════════════════ */
  function getAirdropLog() {
    return load('alpha_airdrops', []);
  }

  function logAirdrop(entry) {
    var log = getAirdropLog();
    log.unshift(entry);
    save('alpha_airdrops', log);
  }

  /* ══════════════════════════════════════════════════
     DATA EXPORT  (admin backup)
  ═══════════════════════════════════════════════════ */
  function exportAll() {
    var users = getAllUsers();
    users.sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); });
    return {
      exportedAt: new Date().toISOString(),
      totalUsers: users.length,
      globalStats: getGlobalStats(),
      users: users,
      tasks: getTasks(),
      events: getEvents(),
      xQueue: getXQueue(),
      refQueue: getRefQueue(),
      nftListings: getNFTListings(),
      nftRequests: getNFTRequests(),
      airdropLog: getAirdropLog()
    };
  }

  /* ── PUBLIC API ── */
  return {
    getUser: getUser,
    saveUser: saveUser,
    getAllUsers: getAllUsers,
    createUser: createUser,
    addHistory: addHistory,

    getTasks: getTasks,
    saveTasks: saveTasks,

    getEvents: getEvents,
    saveEvents: saveEvents,

    getXQueue: getXQueue,
    saveXQueue: saveXQueue,

    getRefQueue: getRefQueue,
    saveRefQueue: saveRefQueue,

    getNFTListings: getNFTListings,
    saveNFTListings: saveNFTListings,

    getNFTRequests: getNFTRequests,
    saveNFTRequests: saveNFTRequests,

    getGlobalStats: getGlobalStats,
    addToTotalMined: addToTotalMined,
    isMaxSupplyReached: isMaxSupplyReached,
    MAX_SUPPLY: MAX_SUPPLY,

    getAirdropLog: getAirdropLog,
    logAirdrop: logAirdrop,

    exportAll: exportAll
  };

})();
