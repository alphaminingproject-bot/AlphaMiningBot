/* ============================================================
   supabase.js — ALPHA Platform · Supabase Data Layer
   Replaces data.js. Paste your credentials below.
   ============================================================ */

const SUPA_URL    = "https://edgliaeodujpkaiygbur.supabase.co";   // e.g. https://xyzabc.supabase.co
const SUPA_ANON   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZ2xpYWVvZHVqcGthaXlnYnVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzY4NjAsImV4cCI6MjA5NDcxMjg2MH0.yo7GwnrMHApzJo9HWtTHB5y-2qAK1J5IoaDABXMb2-A";        // starts with eyJ...
let ADMIN_SECRET = "12qwert34asdf56zxcv78poi";   // your admin secret

// ── Supabase client ───────────────────────────────────────────
const _supa = supabase.createClient(SUPA_URL, SUPA_ANON, {
  realtime: { params: { eventsPerSecond: 10 } }
});

// ── API call helper ───────────────────────────────────────────
const _post = async (path, body = {}, secret = null) => {
  const headers = { "Content-Type": "application/json" };
  if (secret) headers["x-admin-secret"] = secret;
  try {
    const res = await fetch(`${APP_CONFIG.BACKEND_URL}${path}`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    return res.json();
  } catch { return { ok: false, error: "Network error." }; }
};

const _delete = async (path, secret) => {
  try {
    const res = await fetch(`${APP_CONFIG.BACKEND_URL}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
    });
    return res.json();
  } catch { return { ok: false, error: "Network error." }; }
};

/* ============================================================
   DIRECT SUPABASE CALLS
   These replace the Firebase direct reads/writes
   ============================================================ */

// ── Users ─────────────────────────────────────────────────────
const _getUser = async (uid) => {
  const { data } = await _supa.from("users").select("*").eq("id", String(uid)).single();
  return data || null;
};

const _getAllUsers = async () => {
  const { data } = await _supa.from("users").select("*");
  return data || [];
};

// ── Global stats ──────────────────────────────────────────────
const _getGlobalStats = async () => {
  const { data } = await _supa.from("global_stats").select("*").eq("id","main").single();
  return data || { total_mined: 0, maintenance: false };
};

// ── Real-time subscription helper ─────────────────────────────
// Supabase real-time works differently from Firebase.
// We subscribe to table changes and call the callback.
const _listen = (table, filter, callback) => {
  const channel = _supa.channel(`${table}_changes`)
    .on("postgres_changes",
      { event: "*", schema: "public", table, filter },
      payload => callback(payload)
    )
    .subscribe();
  return () => _supa.removeChannel(channel); // returns unsubscribe function
};

// Listen to a specific user row
const _listenUser = (uid, callback) => {
  // Initial load
  _getUser(uid).then(user => { if (user) callback(user); });
  // Real-time updates
  return _listen("users", `id=eq.${uid}`, async () => {
    const user = await _getUser(uid);
    if (user) callback(user);
  });
};

// Listen to a whole table
const _listenTable = (table, callback, filter = null) => {
  // Initial load
  const query = filter
    ? _supa.from(table).select("*").eq(filter.col, filter.val)
    : _supa.from(table).select("*");
  query.then(({ data }) => callback(data || []));

  // Real-time
  return _listen(table, filter ? `${filter.col}=eq.${filter.val}` : undefined, async () => {
    const { data } = filter
      ? await _supa.from(table).select("*").eq(filter.col, filter.val)
      : await _supa.from(table).select("*");
    callback(data || []);
  });
};

/* ============================================================
   DB OBJECT — same interface as before so all modules work
   ============================================================ */
const DB = {

  MAX_SUPPLY: APP_CONFIG.MAX_SUPPLY,

  // ── Real-time listeners ──────────────────────────────────────

  listenConfig: (cb) => {
    _getGlobalStats().then(s => cb({ maintenance: s.maintenance }));
    return _listen("global_stats", "id=eq.main", async () => {
      const s = await _getGlobalStats();
      cb({ maintenance: s.maintenance });
    });
  },

  listenGlobalStats: (cb) => {
    _getGlobalStats().then(s => cb({ totalMined: s.total_mined }));
    return _listen("global_stats", "id=eq.main", async () => {
      const s = await _getGlobalStats();
      cb({ totalMined: s.total_mined });
    });
  },

  listenUser: (uid, cb) => _listenUser(uid, cb),

  listenAllUsers: (cb) => _listenTable("users", cb),

  listenTasks: (cb) => _listenTable("tasks", cb),

  listenEvents: (cb) => _listenTable("events", cb),

  listenAds: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("ads").select("*").eq("status","live");
      cb(data || []);
    };
    load();
    return _listen("ads", "status=eq.live", load);
  },

  listenAllAds: (cb) => _listenTable("ads", cb),

  listenXQueue: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("x_queue").select("*").order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, docId: r.doc_id, userId: r.user_id, userName: r.user_name, taskId: r.task_id, taskName: r.task_name })));
    };
    load();
    return _listen("x_queue", undefined, load);
  },

  listenUserXItems: (uid, cb) => {
    const load = async () => {
      const { data } = await _supa.from("x_queue").select("*").eq("user_id", String(uid));
      cb((data||[]).map(r => ({ ...r, docId: r.doc_id, userId: r.user_id, userName: r.user_name, taskId: r.task_id, taskName: r.task_name })));
    };
    load();
    return _listen("x_queue", `user_id=eq.${uid}`, load);
  },

  listenRefQueue: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("ref_queue").select("*").order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, docId: r.doc_id, referrerId: r.referrer_id, referrerName: r.referrer_name, refereeId: r.referee_id, refereeName: r.referee_name })));
    };
    load();
    return _listen("ref_queue", undefined, load);
  },

  listenWithdrawQueue: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("withdrawals").select("*").order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, txId: r.tx_id, userId: r.user_id, userName: r.user_name })));
    };
    load();
    return _listen("withdrawals", undefined, load);
  },

  listenUserWithdrawals: (uid, cb) => {
    const load = async () => {
      const { data } = await _supa.from("withdrawals").select("*").eq("user_id", String(uid)).order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, txId: r.tx_id })));
    };
    load();
    return _listen("withdrawals", `user_id=eq.${uid}`, load);
  },

  listenNFTListings: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("nft_listings").select("*").eq("available", true);
      cb(data||[]);
    };
    load();
    return _listen("nft_listings", "available=eq.true", load);
  },

  listenAllNFTListings: (cb) => _listenTable("nft_listings", cb),

  listenNFTRequests: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("nft_requests").select("*").order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, reqId: r.req_id, userId: r.user_id, userName: r.user_name, nftId: r.nft_id, nftName: r.nft_name, nftImg: r.nft_img })));
    };
    load();
    return _listen("nft_requests", undefined, load);
  },

  listenUserNFTRequests: (uid, cb) => {
    const load = async () => {
      const { data } = await _supa.from("nft_requests").select("*").eq("user_id", String(uid));
      cb((data||[]).map(r => ({ ...r, reqId: r.req_id, nftId: r.nft_id })));
    };
    load();
    return _listen("nft_requests", `user_id=eq.${uid}`, load);
  },

  listenUserTransactions: (uid, cb) => {
    const load = async () => {
      const { data } = await _supa.from("transactions").select("*").eq("user_id", String(uid)).order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, txId: r.tx_id, fromId: r.from_id, fromName: r.from_name, toId: r.to_id, toName: r.to_name })));
    };
    load();
    return _listen("transactions", `user_id=eq.${uid}`, load);
  },

  listenUserNotifications: (uid, cb) => {
    const load = async () => {
      const { data } = await _supa.from("notifications").select("*").eq("user_id", String(uid)).eq("read", false).order("ts", { ascending: false });
      cb((data||[]).map(r => ({ ...r, docId: r.id })));
    };
    load();
    return _listen("notifications", `user_id=eq.${uid}`, load);
  },

  listenAirdropLog: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("airdrops").select("*").order("ts", { ascending: false });
      cb(data||[]);
    };
    load();
    return _listen("airdrops", undefined, load);
  },

  listenAdminLog: (cb) => {
    const load = async () => {
      const { data } = await _supa.from("admin_log").select("*").order("ts", { ascending: false }).limit(200);
      cb(data||[]);
    };
    load();
    return _listen("admin_log", undefined, load);
  },

  listenCustomTokens: (cb) => _listenTable("custom_tokens", cb),

  // ── One-time reads ────────────────────────────────────────────
  getUser:      _getUser,
  getAllUsers:   _getAllUsers,
  getGlobalStats: _getGlobalStats,

  getTransaction: async (txId) => {
    const { data } = await _supa.from("transactions").select("*").eq("tx_id", txId).single();
    return data || null;
  },

  getAirdropLog: async () => {
    const { data } = await _supa.from("airdrops").select("*").order("ts", { ascending: false });
    return data || [];
  },

  exportAll: async () => {
    const [users, stats, airdrops] = await Promise.all([
      _getAllUsers(), _getGlobalStats(),
      _supa.from("airdrops").select("*").then(r => r.data||[])
    ]);
    const tables = await Promise.all([
      _supa.from("tasks").select("*"),
      _supa.from("events").select("*"),
      _supa.from("x_queue").select("*"),
      _supa.from("ref_queue").select("*"),
      _supa.from("nft_listings").select("*"),
      _supa.from("nft_requests").select("*"),
      _supa.from("transactions").select("*"),
      _supa.from("withdrawals").select("*"),
      _supa.from("ads").select("*"),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      totalUsers: users.length,
      globalStats: stats,
      users: users.sort((a,b) => String(a.id).localeCompare(String(b.id))),
      tasks: tables[0].data||[], events: tables[1].data||[],
      xQueue: tables[2].data||[], refQueue: tables[3].data||[],
      nftListings: tables[4].data||[], nftRequests: tables[5].data||[],
      transactions: tables[6].data||[], withdrawals: tables[7].data||[],
      ads: tables[8].data||[], airdropLog: airdrops,
    };
  },

  // ── Game (Supabase Realtime for PvP) ─────────────────────────
  createMatch: async (matchData) => {
    await _supa.from("matches").upsert({ code: matchData.code, data: matchData });
  },

  listenMatch: (code, cb) => {
    _supa.from("matches").select("*").eq("code", code).single().then(({ data }) => {
      if (data) cb(data.data);
    });
    return _listen("matches", `code=eq.${code}`, async () => {
      const { data } = await _supa.from("matches").select("*").eq("code", code).single();
      if (data) cb(data.data);
    });
  },

  updateMatch: async (code, updates) => {
    const { data } = await _supa.from("matches").select("*").eq("code", code).single();
    if (data) {
      const merged = { ...data.data, ...updates };
      await _supa.from("matches").update({ data: merged }).eq("code", code);
    }
  },

  removeMatch: async (code) => {
    await _supa.from("matches").delete().eq("code", code);
  },

  // ── Supabase database function caller ─────────────────────────
  // Calls a database function directly — runs server-side, cannot be faked
  rpc: async (fnName, params = {}) => {
    const { data, error } = await _supa.rpc(fnName, params);
    if (error) return { ok: false, error: error.message };
    return data || { ok: true };
  },

  // ── API calls (go to Supabase Edge Function or direct RPC) ───
  api: {
    initUser:       (body)           => _post("/initUser",       body),
    mine:           (userId)         => _supa.rpc("mine_alpha",  { p_user_id: String(userId) }).then(r => r.data || { ok: false, error: r.error?.message }),
    claimStreak:    (userId)         => _supa.rpc("claim_streak",{ p_user_id: String(userId) }).then(r => r.data || { ok: false, error: r.error?.message }),
    buyMiner:       (userId, type)   => _supa.rpc("buy_miner",   { p_user_id: String(userId), p_type: type }).then(r => r.data || { ok: false, error: r.error?.message }),
    claimMiner:     (userId)         => _supa.rpc("claim_miner", { p_user_id: String(userId) }).then(r => r.data || { ok: false, error: r.error?.message }),
    buyBoost:       (userId)         => _supa.rpc("buy_boost",   { p_user_id: String(userId) }).then(r => r.data || { ok: false, error: r.error?.message }),
    buyVault:       (userId)         => _supa.rpc("buy_vault",   { p_user_id: String(userId) }).then(r => r.data || { ok: false, error: r.error?.message }),
    transferAlpha:  (body)           => _supa.rpc("transfer_alpha", { p_from_id: String(body.fromId), p_to_id: String(body.toId), p_amount: body.amount, p_note: body.note||"" }).then(r => r.data || { ok: false, error: r.error?.message }),
    gameWin:        (body)           => _supa.rpc("game_win",    { p_user_id: String(body.userId), p_reward: body.reward }).then(r => r.data || { ok: false, error: r.error?.message }),
    completeTask:   (userId, taskId) => _post("/completeTask",   { userId, taskId }),
    submitXHandle:  (body)           => _post("/submitXHandle",  body),
    verifyChannel:  (body)           => _post("/verifyChannel",  body),
    submitAd:       (body)           => _post("/submitAd",       body),
    clickAd:        (body)           => _post("/clickAd",        body),
    buyNFT:         (userId, nftId)  => _post("/buyNFT",         { userId, nftId }),
    requestNFTSend: (body)           => _post("/requestNFTSend", body),
    buyVehicle:     (userId, vId)    => _post("/buyVehicle",     { userId, vehicleId: vId }),
    buyBullets:     (userId, amt)    => _post("/buyBullets",     { userId, amount: amt }),
    requestWithdraw:(body)           => _post("/requestWithdraw",body),
    markNotifRead:  (uid, docId)     => _supa.from("notifications").update({ read: true }).eq("id", docId).then(() => ({ ok: true })),
  },

  // ── Admin API ─────────────────────────────────────────────────
  adminApi: (secret) => ({
    airdrop:           (b) => _post("/admin/airdrop",           b, secret),
    approveRef:        (b) => _post("/admin/approveRef",        b, secret),
    rejectRef:         (b) => _post("/admin/rejectRef",         b, secret),
    approveXTask:      (b) => _post("/admin/approveXTask",      b, secret),
    rejectXTask:       (b) => _post("/admin/rejectXTask",       b, secret),
    approveAd:         (b) => _post("/admin/approveAd",         b, secret),
    rejectAd:          (b) => _post("/admin/rejectAd",          b, secret),
    markNFTSent:       (b) => _post("/admin/markNFTSent",       b, secret),
    approveWithdraw:   (b) => _post("/admin/approveWithdraw",   b, secret),
    rejectWithdraw:    (b) => _post("/admin/rejectWithdraw",    b, secret),
    addTask:           (b) => _post("/admin/addTask",           b, secret),
    deleteTask:      (id)  => _delete(`/admin/deleteTask/${id}`,   secret),
    addEvent:          (b) => _post("/admin/addEvent",          b, secret),
    deleteEvent:     (id)  => _delete(`/admin/deleteEvent/${id}`,  secret),
    addNFTListing:     (b) => _post("/admin/addNFTListing",     b, secret),
    updateNFTListing:  (b) => _post("/admin/updateNFTListing",  b, secret),
    deleteNFTListing:(id)  => _delete(`/admin/deleteNFTListing/${id}`, secret),
    addCustomToken:    (b) => _post("/admin/addCustomToken",    b, secret),
    deleteCustomToken:(id) => _delete(`/admin/deleteCustomToken/${id}`, secret),
    giftUser:          (b) => _post("/admin/giftUser",          b, secret),
    flagUser:          (b) => _post("/admin/flagUser",          b, secret),
    lookupTxn:         (b) => _post("/admin/lookupTxn",         b, secret),
    setMaintenance:    (b) => _post("/admin/setMaintenance",    b, secret),
    sendBotMessage:    (b) => _post("/admin/sendBotMessage",    b, secret),
  }),

  // Expose supa client for direct admin queries
  _supa,
};
