/* ============================================================
   config.js — ALPHA Platform · Global Configuration
   ONE file controls all numbers across the entire app.
   To change any value, change it here ONLY.
   ============================================================ */

const APP_CONFIG = {
  // ── Bot & Backend ─────────────────────────────────────────
  BOT_USERNAME:   "YourALPHABot",           // ← replace with your bot username
  BACKEND_URL:    "",

  // ── Supply ───────────────────────────────────────────────
  MAX_SUPPLY:     100000000000,              // 100 billion ALPHA

  // ── Mining ───────────────────────────────────────────────
  MINE_REWARD:    70,                        // ALPHA per 3-hour session
  MINE_INTERVAL:  3 * 60 * 60 * 1000,       // 3 hours in ms

  // ── Referrals ────────────────────────────────────────────
  REF_BONUS:      150,                       // ALPHA per verified referral
  REF_THRESHOLD:  100,                       // referee must earn this first

  // ── Referral milestone tasks ──────────────────────────────
  REF_MILESTONES: [
    { refs: 3,   reward: 500,   currency: "ALPHA", ton: 0 },
    { refs: 10,  reward: 3000,  currency: "ALPHA", ton: 0 },
    { refs: 100, reward: 20000, currency: "ALPHA", ton: 0.5 },
  ],

  // ── Miners ───────────────────────────────────────────────
  MINER_BETA_COST:    300,
  MINER_BETA_HOURS:   12,
  MINER_BETA_REWARD:  400,
  MINER_BETA_DAYS:    3,

  MINER_ALPHA_COST:   500,
  MINER_ALPHA_HOURS:  24,
  MINER_ALPHA_REWARD: 850,
  MINER_ALPHA_DAYS:   3,

  // ── Boost ────────────────────────────────────────────────
  BOOST_COST:         1000,                  // ALPHA to buy a boost
  BOOST_MULTIPLIER:   2,                     // 2x mining reward
  BOOST_DURATION:     24 * 60 * 60 * 1000,  // 24 hours

  // ── Vault & Transfer ─────────────────────────────────────
  VAULT_COST:         5000,                  // ALPHA to unlock vault
  TRANSFER_FEE_PCT:   0,                     // % fee on transfers (0 = free)

  // ── Daily Streak ─────────────────────────────────────────
  STREAK_REWARDS: {
    1:  100,
    3:  300,
    7:  1000,
    14: 3000,
    30: 10000,
    default: 50,
  },

  // ── Rank Titles ──────────────────────────────────────────
  RANKS: [
    { title: "Omega",          min: 0,       max: 9999,         wolf: "omega"   },
    { title: "Beta",           min: 10000,   max: 99999,        wolf: "beta"    },
    { title: "Alpha",          min: 100000,  max: 999999,       wolf: "alpha"   },
    { title: "Alpha of Alphas",min: 1000000, max: Infinity,     wolf: "aoa"     },
  ],

  // ── Ads / Published Tasks ─────────────────────────────────
  AD_COST_PER_CLICK:   300,                  // ALPHA per 1000 clicks = 0.3 per click
  AD_MIN_CLICKS:       1000,
  AD_MAX_CLICKS:       1000000,

  // ── Game ─────────────────────────────────────────────────
  GAME_BULLET_COST:    1,                    // 1 ALPHA = 1 bullet
  GAME_WIN_REWARD:     500,                  // ALPHA per winning team member
  GAME_MAX_TEAM:       5,
  GAME_COUNTDOWN:      8,                    // seconds before match starts

  GAME_VEHICLES: [
    { id: "v0", name: "Ares",     cost: 0,      health: 100,  damage: 10,  img: null },
    { id: "v1", name: "Hermes",   cost: 1000,   health: 150,  damage: 15,  img: null },
    { id: "v2", name: "Apollo",   cost: 5000,   health: 220,  damage: 22,  img: null },
    { id: "v3", name: "Poseidon", cost: 10000,  health: 300,  damage: 30,  img: null },
    { id: "v4", name: "Athena",   cost: 20000,  health: 400,  damage: 40,  img: null },
    { id: "v5", name: "Ares II",  cost: 50000,  health: 550,  damage: 55,  img: null },
    { id: "v6", name: "Kronos",   cost: 80000,  health: 750,  damage: 70,  img: null },
    { id: "v7", name: "Zeus",     cost: 100000, health: 1000, damage: 100, img: null },
  ],

  // ── Inactivity ────────────────────────────────────────────
  INACTIVITY_DAYS: 30,

  // ── Supported Currencies ─────────────────────────────────
  CURRENCIES: ["ALPHA", "TON", "USDT", "USDC"],
};
