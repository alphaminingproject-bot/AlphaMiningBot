/* ============================================================
   leaderboard.js — ALPHA Platform · Leaderboard Module
   ============================================================ */

const LB = (() => {

  let _loaded = false;
  let _unsub  = null;

  const load = async () => {
    showSection(
      document.getElementById("loader-lb"),
      document.getElementById("lb-content")
    );

    if (!_unsub) {
      _unsub = DB.listenAllUsers(users => _render(users));
    }
    _loaded = true;
  };

  const _render = (users) => {
    users.sort((a, b) => (b.balance || 0) - (a.balance || 0));

    const top3 = users.slice(0, 3);
    const rest  = users.slice(3, 100);

    // Podium: 2nd, 1st, 3rd
    const order    = [top3[1], top3[0], top3[2]].filter(Boolean);
    const rkClass  = ["r2","r1","r3"];
    const rkBClass = ["b2","b1","b3"];
    const medals   = ["🥈","🥇","🥉"];
    const rkNums   = [2,1,3];

    document.getElementById("lb-podium").innerHTML = order.map((u, i) => {
      const rank = getRank(u.balance || 0);
      return `
        <div class="podium-item">
          <div class="podium-av ${rkClass[i]}">${medals[i]}<div class="podium-badge">${rkNums[i]}</div></div>
          <div class="podium-name">${u.name}</div>
          <span class="lb-rank ${getRankClass(rank.wolf)}">${rank.title}</span>
          <div class="podium-score">${fmtNum(u.balance||0)}</div>
          <div class="podium-block ${rkBClass[i]}"></div>
        </div>`;
    }).join("");

    const myId = String(TG_USER.id);
    document.getElementById("lb-list").innerHTML = rest.length
      ? rest.map((u, i) => {
          const rank = getRank(u.balance || 0);
          return `
            <div class="lb-row${u.id === myId ? " me" : ""}">
              <div class="lb-pos">#${i+4}</div>
              <div class="lb-avatar">${(u.name[0]||"A").toUpperCase()}</div>
              <div class="lb-name">
                ${u.name}${u.id === myId ? " (you)" : ""}
                <span class="lb-rank ${getRankClass(getRank(u.balance||0).wolf)}">${getRank(u.balance||0).title}</span>
              </div>
              <div class="lb-score">${fmtNum(u.balance||0)}</div>
            </div>`;
        }).join("")
      : '<div class="empty-state">No other users yet</div>';
  };

  return { load };
})();


/* ============================================================
   referrals.js — ALPHA Platform · Referrals Module
   ============================================================ */

const REFS = (() => {

  let _loaded = false;

  const load = () => {
    showSection(
      document.getElementById("loader-ref"),
      document.getElementById("ref-content")
    );
    _render();
    _loaded = true;
  };

  const updateCount = () => {
    const u = window._currentUser;
    if (!u) return;
    document.getElementById("ref-count").textContent  = u.refs?.length ?? 0;
  };

  const _render = () => {
    const u = window._currentUser;
    if (!u) return;

    const refs          = u.refs || [];
    const verifiedCount = refs.filter(r => r.status === "verified").length;

    document.getElementById("ref-count").textContent  = refs.length;
    document.getElementById("ref-earned").textContent = `+${fmtNum(verifiedCount * APP_CONFIG.REF_BONUS)} ALPHA earned from verified refs`;

    const link = `https://t.me/${APP_CONFIG.BOT_USERNAME}/app?startapp=ref_${u.id}`;
    document.getElementById("ref-link-box").textContent = link;

    // Milestones
    const msEl = document.getElementById("ref-milestones");
    msEl.innerHTML = APP_CONFIG.REF_MILESTONES.map(ms => {
      const done = verifiedCount >= ms.refs;
      return `
        <div class="ref-milestone${done ? " done" : ""}">
          <div class="rm-refs">${ms.refs}</div>
          <div class="rm-reward">+${fmtNum(ms.reward)} ALPHA${ms.ton ? ` + ${ms.ton} TON` : ""}</div>
          <div class="rm-status${done ? " done" : ""}">${done ? "✅ CLAIMED" : `${verifiedCount}/${ms.refs}`}</div>
        </div>`;
    }).join("");

    // Ref list
    document.getElementById("ref-list").innerHTML = refs.length
      ? refs.map(ref => `
          <div class="ref-item">
            <div class="ref-av">👤</div>
            <div class="ref-user">
              <div class="ref-uname">${ref.refereeName}</div>
              <div class="ref-ustat ${ref.status}">
                ${ref.status === "verified" ? "✅ Verified" : "⏳ Pending — needs 100 ALPHA"}
              </div>
            </div>
            <div class="ref-bonus">${ref.status === "verified" ? `+${APP_CONFIG.REF_BONUS}` : "---"}</div>
          </div>`).join("")
      : '<div class="empty-state">No referrals yet.<br>Share your link to earn!</div>';
  };

  const copyLink = () => {
    const link = document.getElementById("ref-link-box").textContent;
    copyText(link);
    showToast("Link copied! ✅", "suc");
  };

  const shareLink = () => {
    const link = document.getElementById("ref-link-box").textContent;
    const text = `🚀 Join ALPHA Token Airdrop and start mining!\n\nUse my referral link:\n${link}`;
    const url  = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg) tg.openTelegramLink(url); else window.open(url, "_blank");
  };

  return { load, updateCount, copyLink, shareLink };
})();


/* ============================================================
   ads.js — ALPHA Platform · Task Board (Ads) Module
   Users can publish their own tasks. 300,000 ALPHA per 1000 clicks.
   ============================================================ */

const ADS = (() => {

  let _loaded  = false;
  let _unsub   = null;

  const load = () => {
    showSection(
      document.getElementById("loader-ads"),
      document.getElementById("ads-content")
    );
    if (!_unsub) {
      _unsub = DB.listenAds(ads => _renderBrowse(ads));
    }
    _renderPublishForm();
    _renderMyAds();
    _loaded = true;
  };

  const switchTab = (name, btn) => {
    document.querySelectorAll("#ads-content .sub-page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll("#ads-content .sub-tab").forEach(b => b.classList.remove("active"));
    document.getElementById(`sub-${name}`)?.classList.add("active");
    btn?.classList.add("active");
    if (name === "mine") _renderMyAds();
  };

  const _renderBrowse = (ads) => {
    const cont = document.getElementById("sub-browse");
    if (!cont) return;
    if (!ads.length) {
      cont.innerHTML = '<div class="empty-state">No published tasks right now</div>';
      return;
    }
    cont.innerHTML = ads.map(ad => {
      const pct = Math.min(ad.clicksDone / ad.clicksTotal * 100, 100);
      return `
        <div class="ad-card">
          <div class="ad-badge">📢 SPONSORED TASK</div>
          <div class="task-name">${ad.name}</div>
          <div class="task-desc">${ad.desc || ""}</div>
          <div class="task-reward" style="margin-top:4px;">+${ad.rewardPerClick} ALPHA per click</div>
          <div class="ad-progress">
            <div class="ad-progress-label">
              <span>${ad.clicksDone.toLocaleString()} clicks</span>
              <span>${ad.clicksTotal.toLocaleString()} total</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          </div>
          <button class="task-btn go" style="margin-top:10px;width:100%;" onclick="ADS.clickAd('${ad.id}','${ad.url}','${ad.type}','${ad.target}')">DO TASK →</button>
        </div>`;
    }).join("");
  };

  const clickAd = async (adId, url, type, target) => {
    // Open the task
    if (type === "telegram") {
      const ch = target.replace("@","");
      if (tg) tg.openTelegramLink(`https://t.me/${ch}`); else window.open(`https://t.me/${ch}`,"_blank");
    } else {
      if (tg) tg.openLink(url); else window.open(url,"_blank");
    }

    // Record click on backend
    const result = await DB.api.clickAd({ userId: String(TG_USER.id), adId });
    if (result.ok) showToast(`+${result.reward} ALPHA earned!`, "suc");
  };

  const _renderPublishForm = () => {
    const cont = document.getElementById("sub-publish");
    if (!cont) return;
    cont.innerHTML = `
      <div class="publish-form">
        <div class="publish-title">PUBLISH A TASK</div>
        <div class="sec-sub">Cost: 300 ALPHA per 1,000 clicks. Users earn ALPHA for completing your task.</div>
        <div class="form-group">
          <label class="form-label">TASK NAME *</label>
          <input class="form-input" id="ad-name" placeholder="e.g. Join our Telegram channel"/>
        </div>
        <div class="form-group">
          <label class="form-label">DESCRIPTION</label>
          <input class="form-input" id="ad-desc" placeholder="Brief task description"/>
        </div>
        <div class="form-group">
          <label class="form-label">TASK TYPE</label>
          <select class="form-select" id="ad-type">
            <option value="telegram">Telegram Channel/Group</option>
            <option value="x_follow">X (Twitter) Follow</option>
            <option value="link">Website/Link</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">TARGET (channel @handle or URL) *</label>
          <input class="form-input" id="ad-target" placeholder="@channel or https://..."/>
        </div>
        <div class="form-group">
          <label class="form-label">NUMBER OF CLICKS *</label>
          <input class="form-input" id="ad-clicks" type="number" min="1000" step="1000" placeholder="Min 1,000"/>
          <input class="clicks-slider" id="ad-slider" type="range" min="1000" max="1000000" step="1000" value="1000"
            oninput="ADS.updateClicksPreview(this.value)"/>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gray);margin-bottom:4px;">
            <span>Total cost</span><span id="ad-cost-preview" style="color:var(--gold);">300 ALPHA</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--gray);">
            <span>Reward per click</span><span style="color:var(--white);">0.3 ALPHA</span>
          </div>
        </div>
        <button class="btn primary full" onclick="ADS.submitAd()">SUBMIT FOR REVIEW</button>
      </div>`;
  };

  const updateClicksPreview = (val) => {
    const clicks = parseInt(val, 10) || 1000;
    const cost   = Math.floor(clicks / 1000) * APP_CONFIG.AD_COST_PER_CLICK;
    const input  = document.getElementById("ad-clicks");
    const preview= document.getElementById("ad-cost-preview");
    if (input)   input.value   = clicks.toLocaleString();
    if (preview) preview.textContent = `${cost.toLocaleString()} ALPHA`;
  };

  const submitAd = async () => {
    const name   = document.getElementById("ad-name")?.value.trim();
    const desc   = document.getElementById("ad-desc")?.value.trim();
    const type   = document.getElementById("ad-type")?.value;
    const target = document.getElementById("ad-target")?.value.trim();
    const clicks = parseInt(document.getElementById("ad-clicks")?.value.replace(/,/g,""), 10);

    if (!name)   { showToast("Task name required", "err"); return; }
    if (!target) { showToast("Target required", "err"); return; }
    if (!clicks || clicks < 1000) { showToast("Minimum 1,000 clicks", "err"); return; }

    const cost = Math.floor(clicks / 1000) * APP_CONFIG.AD_COST_PER_CLICK;
    const u    = window._currentUser;
    if ((u?.balance || 0) < cost) {
      showToast(`Not enough ALPHA! You need ${cost.toLocaleString()} ALPHA`, "err"); return;
    }

    const result = await DB.api.submitAd({
      userId: String(TG_USER.id), userName: u.name,
      name, desc, type, target, clicksTotal: clicks, cost,
    });

    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast("Task submitted for admin review! ✅", "suc");
    _renderPublishForm();
  };

  const _renderMyAds = async () => {
    const cont = document.getElementById("sub-mine-ads");
    if (!cont) return;
    cont.innerHTML = '<div class="empty-state">Loading...</div>';

    const snap = await DB._fs.collection("ads").where("userId", "==", String(TG_USER.id)).get();
    const ads  = snap.docs.map(d => d.data());

    if (!ads.length) {
      cont.innerHTML = '<div class="empty-state">You have not published any tasks yet</div>';
      return;
    }

    cont.innerHTML = ads.map(ad => {
      const pct = Math.min(ad.clicksDone / ad.clicksTotal * 100, 100);
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:12px;font-weight:bold;color:var(--white);">${ad.name}</div>
            <span class="badge ${ad.status==="live"?"green":ad.status==="pending"?"gold":"red"}">${ad.status.toUpperCase()}</span>
          </div>
          <div style="font-size:10px;color:var(--gray);margin-bottom:8px;">${ad.clicksDone||0} / ${ad.clicksTotal} clicks</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div style="font-size:9px;color:var(--gray);margin-top:4px;">Cost paid: ${ad.cost?.toLocaleString()||0} ALPHA</div>
        </div>`;
    }).join("");
  };

  return { load, switchTab, clickAd, updateClicksPreview, submitAd };
})();


/* ============================================================
   transfer.js — ALPHA Platform · Transfer Module
   Vault unlock (5000 ALPHA) + peer ALPHA transfers
   Every transfer has a unique TX ID
   ============================================================ */

const TRANSFER = (() => {

  let _loaded = false;
  let _unsub  = null;

  const load = () => {
    showSection(
      document.getElementById("loader-transfer"),
      document.getElementById("transfer-content")
    );
    _render();
    if (!_unsub) {
      _unsub = DB.listenUserTransactions(String(TG_USER.id), txns => _renderTxns(txns));
    }
    _loaded = true;
  };

  const _render = () => {
    const u    = window._currentUser;
    const cont = document.getElementById("transfer-content");
    if (!cont) return;

    if (!u?.vault) {
      // Vault locked
      cont.innerHTML = `
        <div class="vault-lock">
          <div class="vault-icon">🔒</div>
          <div class="vault-title">VAULT LOCKED</div>
          <div class="vault-sub">
            Unlock the ALPHA Vault to send tokens to other users.<br><br>
            Every transfer is recorded with a unique transaction ID.
            One vault unlock is permanent — you never pay again.
          </div>
          <button class="btn primary full" onclick="TRANSFER.unlockVault()">UNLOCK VAULT — 5,000 ALPHA</button>
        </div>`;
      return;
    }

    // Vault unlocked — show transfer UI
    cont.innerHTML = `
      <div class="sec-title">TRANSFER ALPHA</div>
      <div class="transfer-form card">
        <div class="form-group">
          <label class="form-label">RECIPIENT USER ID</label>
          <input class="form-input" id="transfer-to-id" placeholder="Enter recipient's ID..."/>
        </div>
        <div class="form-group">
          <label class="form-label">AMOUNT (ALPHA)</label>
          <input class="form-input" id="transfer-amount" type="number" min="1" placeholder="Amount..."/>
        </div>
        <div class="form-group">
          <label class="form-label">NOTE (OPTIONAL)</label>
          <input class="form-input" id="transfer-note" placeholder="Optional note..."/>
        </div>
        <button class="btn primary full" onclick="TRANSFER.send()">SEND ALPHA</button>
      </div>
      <div class="sec-title" style="margin-top:14px;">TRANSACTION HISTORY</div>
      <div id="txn-list"><div class="empty-state">Loading...</div></div>`;
  };

  const _renderTxns = (txns) => {
    const cont = document.getElementById("txn-list");
    if (!cont) return;
    cont.innerHTML = txns.length
      ? txns.map(tx => {
          const isOut = tx.fromId === String(TG_USER.id);
          return `
            <div class="txn-item">
              <div class="txn-row1">
                <span class="txn-type">${tx.type?.toUpperCase() || "TRANSFER"}</span>
                <span class="txn-amt ${isOut?"neg":"pos"}">${isOut?"-":"+"}${fmtNum(tx.amount)} ALPHA</span>
              </div>
              <div class="txn-desc">${tx.desc || (isOut ? `To: ${tx.toName||tx.toId}` : `From: ${tx.fromName||tx.fromId}`)}</div>
              <div class="txn-id" onclick="copyText('${tx.txId}');showToast('TX ID copied ✅','suc')">📋 ${tx.txId}</div>
              <div class="txn-ts">${formatDate(tx.ts)}</div>
            </div>`;
        }).join("")
      : '<div class="empty-state">No transactions yet</div>';
  };

  const unlockVault = async () => {
    const result = await DB.api.buyVault(String(TG_USER.id));
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast("Vault unlocked! You can now send ALPHA. 🔓", "suc");
    _render();
  };

  const send = async () => {
    const toId   = document.getElementById("transfer-to-id")?.value.trim();
    const amount = parseInt(document.getElementById("transfer-amount")?.value, 10);
    const note   = document.getElementById("transfer-note")?.value.trim();

    if (!toId)              { showToast("Enter a recipient ID", "err"); return; }
    if (!amount || amount < 1) { showToast("Enter a valid amount", "err"); return; }
    if (toId === String(TG_USER.id)) { showToast("You can't send to yourself", "err"); return; }

    const result = await DB.api.transferAlpha({
      fromId: String(TG_USER.id),
      toId, amount, note,
    });

    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast(`Sent ${amount} ALPHA! TX: ${result.txId}`, "suc");
    document.getElementById("transfer-to-id").value  = "";
    document.getElementById("transfer-amount").value = "";
    document.getElementById("transfer-note").value   = "";
  };

  const confirm = () => send(); // called from modal

  return { load, unlockVault, send, confirm };
})();


/* ============================================================
   wallet.js — ALPHA Platform · Wallet Module
   Shows ALPHA, TON, USDT, USDC balances + live prices
   Handles withdrawals (admin approves)
   ============================================================ */

const WALLET = (() => {

  let _loaded     = false;
  let _prices     = { TON: 0, USDT: 1, USDC: 1, ALPHA: 0 };
  let _currentCoin = null;
  let _priceTimer  = null;

  const load = async () => {
    showSection(
      document.getElementById("loader-wallet"),
      document.getElementById("wallet-content")
    );
    await _fetchPrices();
    _renderCoins();
    if (!_priceTimer) _priceTimer = setInterval(_fetchPrices, 60000); // refresh every 60s
    _loaded = true;
  };

  const _fetchPrices = async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network,tether,usd-coin&vs_currencies=usd"
      );
      const data = await res.json();
      _prices.TON  = data["the-open-network"]?.usd || 0;
      _prices.USDT = data["tether"]?.usd           || 1;
      _prices.USDC = data["usd-coin"]?.usd          || 1;
      _renderCoins();
    } catch { /* use cached prices */ }
  };

  const _renderCoins = () => {
    const u    = window._currentUser;
    const cont = document.getElementById("wallet-content");
    if (!cont) return;

    const coins = [
      { symbol: "ALPHA", name: "ALPHA Token", icon: "⚡", balance: u?.balance || 0, price: _prices.ALPHA, color: "#1a6fff" },
      { symbol: "TON",   name: "Toncoin",     icon: "💎", balance: u?.tonBalance  || 0, price: _prices.TON,  color: "#0088cc" },
      { symbol: "USDT",  name: "Tether USD",  icon: "💵", balance: u?.usdtBalance || 0, price: _prices.USDT, color: "#26a17b" },
      { symbol: "USDC",  name: "USD Coin",    icon: "🔵", balance: u?.usdcBalance || 0, price: _prices.USDC, color: "#2775ca" },
    ];

    // Custom tokens
    const customTokens = u?.customTokens || [];

    cont.innerHTML = `
      <div class="sec-title">YOUR WALLET</div>
      ${coins.map(c => `
        <div class="coin-item" onclick="WALLET.openWithdraw('${c.symbol}')">
          <div class="coin-logo" style="background:${c.color}22;border:1px solid ${c.color}44;">${c.icon}</div>
          <div class="coin-info">
            <div class="coin-name">${c.name}</div>
            <div class="coin-price">1 ${c.symbol} = $${c.price.toFixed(4)}</div>
          </div>
          <div class="coin-balance">
            <div class="coin-bal-num">${c.balance.toFixed(4)}</div>
            <div class="coin-bal-usd">≈ $${(c.balance * c.price).toFixed(2)}</div>
          </div>
        </div>`).join("")}
      ${customTokens.map(ct => `
        <div class="coin-item">
          <div class="coin-logo" style="background:var(--goldfade);border:1px solid rgba(240,180,41,0.3);">
            ${ct.img ? `<img src="${ct.img}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;"/>` : "🪙"}
          </div>
          <div class="coin-info">
            <div class="coin-name">${ct.name}</div>
            <div class="coin-price">${ct.symbol}</div>
          </div>
          <div class="coin-balance">
            <div class="coin-bal-num">${(ct.balance || 0).toFixed(4)}</div>
          </div>
        </div>`).join("")}
      <div style="margin-top:14px;">
        <div class="sec-title">WITHDRAWAL HISTORY</div>
        <div id="withdraw-history"><div class="empty-state">Loading...</div></div>
      </div>`;

    // Load withdrawal history
    DB.listenUserWithdrawals(String(TG_USER.id), wds => _renderWithdrawHistory(wds));
  };

  const _renderWithdrawHistory = (wds) => {
    const cont = document.getElementById("withdraw-history");
    if (!cont) return;
    cont.innerHTML = wds.length
      ? wds.map(w => `
          <div class="txn-item">
            <div class="txn-row1">
              <span class="txn-type">WITHDRAW</span>
              <span class="txn-amt neg">-${w.amount} ${w.currency}</span>
            </div>
            <div class="txn-desc">To: ${w.address}</div>
            <div class="txn-id" onclick="copyText('${w.txId}');showToast('TX copied','suc')">📋 ${w.txId}</div>
            <div class="withdraw-status">
              <span class="withdraw-pending ${w.status}">${w.status.toUpperCase()}</span>
            </div>
            <div class="txn-ts">${formatDate(w.ts)}</div>
          </div>`).join("")
      : '<div class="empty-state">No withdrawals yet</div>';
  };

  const openWithdraw = (symbol) => {
    _currentCoin = symbol;
    document.getElementById("withdraw-modal-title").textContent = `Withdraw ${symbol}`;
    document.getElementById("withdraw-address").value = "";
    document.getElementById("withdraw-amount").value  = "";
    showModal("modal-withdraw");
  };

  const confirmWithdraw = async () => {
    const address = document.getElementById("withdraw-address").value.trim();
    const amount  = parseFloat(document.getElementById("withdraw-amount").value);
    const chain   = document.getElementById("withdraw-chain").value;

    if (!address)            { showToast("Enter a wallet address", "err"); return; }
    if (!amount || amount <= 0) { showToast("Enter a valid amount", "err"); return; }

    const u = window._currentUser;
    const balanceKey = _currentCoin === "ALPHA" ? "balance"
      : _currentCoin === "TON"  ? "tonBalance"
      : _currentCoin === "USDT" ? "usdtBalance"
      : "usdcBalance";

    if ((u?.[balanceKey] || 0) < amount) {
      showToast(`Insufficient ${_currentCoin} balance`, "err"); return;
    }

    const result = await DB.api.requestWithdraw({
      userId:   String(TG_USER.id),
      currency: _currentCoin,
      amount, address, chain,
    });

    if (!result.ok) { showToast(result.error, "err"); return; }
    closeModal("modal-withdraw");
    showToast("Withdrawal submitted! Pending admin review. ✅", "suc");
  };

  return { load, openWithdraw, confirmWithdraw };
})();


/* ============================================================
   profile.js — ALPHA Platform · Profile Module
   Shows rank, stats, NFT gallery, vehicle gallery
   Country detection via Intl API + Telegram language_code
   ============================================================ */

const PROFILE = (() => {

  const open = () => {
    const u = window._currentUser;
    if (!u) return;

    const rank    = getRank(u.balance || 0);
    const country = _detectCountry();

    // NFTs
    const nftsHtml = u.nfts?.length
      ? `<div class="nft-grid">${u.nfts.map(nft => `
          <div class="nft-item">
            <img src="${nft.img}" alt="${nft.name}" onerror="this.style.display='none'">
            <div class="nft-item-body">
              <div class="nft-item-name">${nft.name}</div>
              ${nft.sendRequest
                ? `<div style="font-size:9px;color:var(--gold);text-align:center;">📬 ${nft.sendRequest.status}</div>`
                : `<button class="nft-send-btn" onclick="SHOP.openSendNFT('${nft.nftId}')">SEND ↗</button>`}
            </div>
          </div>`).join("")}</div>`
      : '<div class="empty-state">No NFTs owned yet</div>';

    // Vehicles
    const owned    = u.vehicles || ["v0"];
    const vehiclesHtml = owned.map(vid => {
      const v = APP_CONFIG.GAME_VEHICLES.find(x => x.id === vid);
      return v ? `
        <div style="display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:6px;">
          <span style="font-size:24px;">🚗</span>
          <div><div style="font-size:11px;font-weight:bold;color:var(--white);">${v.name}</div>
          <div style="font-size:9px;color:var(--gray);">HP: ${v.health} · DMG: ${v.damage}</div></div>
        </div>` : "";
    }).join("") || '<div class="empty-state">No vehicles owned</div>';

    document.getElementById("profile-body").innerHTML = `
      <!-- Wolf avatar -->
      <div style="text-align:center;padding:10px 0 16px;">
        <div class="wolf-avatar">${WOLF_SVG[rank.wolf]}</div>
        <div style="font-size:16px;font-weight:bold;color:var(--white);margin-bottom:4px;">${u.name}</div>
        <div style="font-size:10px;color:var(--gray);margin-bottom:6px;">ID: ${u.id}</div>
        <span class="hdr-rank-badge ${getRankClass(rank.wolf)}" style="position:static;font-size:11px;padding:4px 12px;">
          ${getRankSymbol(rank.wolf)} ${rank.title}
        </span>
        ${country ? `<div style="font-size:10px;color:var(--gray);margin-top:6px;">📍 ${country}</div>` : ""}
        ${u.username ? `<div style="font-size:10px;color:var(--blue);margin-top:3px;">@${u.username}</div>` : ""}
      </div>

      <!-- Profile tabs -->
      <div class="profile-tabs">
        <button class="profile-tab active" onclick="PROFILE.switchTab('info',this)">INFO</button>
        <button class="profile-tab"        onclick="PROFILE.switchTab('nfts',this)">NFTS</button>
        <button class="profile-tab"        onclick="PROFILE.switchTab('vehicles',this)">VEHICLES</button>
        <button class="profile-tab"        onclick="PROFILE.switchTab('coins',this)">COINS</button>
      </div>

      <!-- INFO tab -->
      <div class="profile-sub-page active" id="ptab-info">
        <div class="stats-row">
          <div class="stat-card"><div class="stat-v">${fmtNum(u.balance||0)}</div><div class="stat-l">ALPHA</div></div>
          <div class="stat-card"><div class="stat-v">${u.sessions||0}</div><div class="stat-l">SESSIONS</div></div>
          <div class="stat-card"><div class="stat-v">${u.refs?.length||0}</div><div class="stat-l">REFERRALS</div></div>
          <div class="stat-card"><div class="stat-v">${u.streak?.count||0}</div><div class="stat-l">STREAK 🔥</div></div>
        </div>
        <div class="card" style="margin-top:8px;">
          <div style="font-size:10px;color:var(--gray);margin-bottom:4px;">Member since</div>
          <div style="font-size:11px;color:var(--white);">${new Date(u.createdAt||0).toLocaleDateString()}</div>
        </div>
        <div class="card">
          <div style="font-size:10px;color:var(--gray);margin-bottom:4px;">Vault status</div>
          <div style="font-size:11px;color:${u.vault?"var(--green)":"var(--red)"};">${u.vault?"🔓 Unlocked":"🔒 Locked"}</div>
        </div>
      </div>

      <!-- NFTS tab -->
      <div class="profile-sub-page" id="ptab-nfts">${nftsHtml}</div>

      <!-- VEHICLES tab -->
      <div class="profile-sub-page" id="ptab-vehicles">${vehiclesHtml}</div>

      <!-- COINS tab -->
      <div class="profile-sub-page" id="ptab-coins">
        <div class="sec-sub">Your token balances. Tap a coin to withdraw.</div>
        <div class="coin-item" onclick="WALLET.openWithdraw('ALPHA')">
          <div class="coin-logo" style="background:rgba(26,111,255,0.15);">⚡</div>
          <div class="coin-info"><div class="coin-name">ALPHA</div></div>
          <div class="coin-balance"><div class="coin-bal-num">${fmtNum(u.balance||0)}</div></div>
        </div>
        <div class="coin-item" onclick="WALLET.openWithdraw('TON')">
          <div class="coin-logo" style="background:rgba(0,136,204,0.15);">💎</div>
          <div class="coin-info"><div class="coin-name">TON</div></div>
          <div class="coin-balance"><div class="coin-bal-num">${(u.tonBalance||0).toFixed(4)}</div></div>
        </div>
        <div class="coin-item" onclick="WALLET.openWithdraw('USDT')">
          <div class="coin-logo" style="background:rgba(38,161,123,0.15);">💵</div>
          <div class="coin-info"><div class="coin-name">USDT</div></div>
          <div class="coin-balance"><div class="coin-bal-num">${(u.usdtBalance||0).toFixed(4)}</div></div>
        </div>
        <div class="coin-item" onclick="WALLET.openWithdraw('USDC')">
          <div class="coin-logo" style="background:rgba(39,117,202,0.15);">🔵</div>
          <div class="coin-info"><div class="coin-name">USDC</div></div>
          <div class="coin-balance"><div class="coin-bal-num">${(u.usdcBalance||0).toFixed(4)}</div></div>
        </div>
        ${(u.customTokens||[]).map(ct => `
          <div class="coin-item">
            <div class="coin-logo" style="background:var(--goldfade);">
              ${ct.img ? `<img src="${ct.img}" style="width:28px;height:28px;border-radius:50%;"/>` : "🪙"}
            </div>
            <div class="coin-info"><div class="coin-name">${ct.name}</div><div class="coin-price">${ct.symbol}</div></div>
            <div class="coin-balance"><div class="coin-bal-num">${(ct.balance||0).toFixed(4)}</div></div>
          </div>`).join("")}
      </div>`;

    openOverlay("overlay-profile");
  };

  const switchTab = (name, btn) => {
    document.querySelectorAll(".profile-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".profile-sub-page").forEach(p => p.classList.remove("active"));
    btn?.classList.add("active");
    document.getElementById(`ptab-${name}`)?.classList.add("active");
  };

  // ── Country detection ─────────────────────────────────────
  const _detectCountry = () => {
    try {
      // Try Telegram language code first
      const langCode = tg?.initDataUnsafe?.user?.language_code || "";
      const locale   = new Intl.DisplayNames(["en"], { type: "region" });
      // Map language codes to regions (approximate)
      const langToRegion = {
        en: "US", es: "ES", fr: "FR", de: "DE", ru: "RU",
        pt: "BR", ar: "SA", zh: "CN", ja: "JP", ko: "KR",
        it: "IT", nl: "NL", pl: "PL", tr: "TR", uk: "UA",
        fa: "IR", hi: "IN", bn: "BD", vi: "VN", th: "TH",
      };
      const region = langToRegion[langCode];
      if (region) return locale.of(region);

      // Fallback: use browser timezone
      const tz     = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzParts = tz.split("/");
      return tzParts.length > 1 ? tzParts[1].replace(/_/g," ") : tz;
    } catch {
      return "";
    }
  };

  return { open, switchTab };
})();
