/* ============================================================
   shop.js — ALPHA Platform · Shop Module
   Handles: miners, vehicles, NFT listings
   Independent: errors here don't affect other modules
   ============================================================ */

const SHOP = (() => {

  let _loaded      = false;
  let _currentNFT  = null;
  let _unsubList   = null;

  const load = () => {
    if (!_loaded) {
      // Real-time NFT listings listener
      _unsubList = DB.listenNFTListings((listings) => {
        if (document.getElementById("sub-market").classList.contains("active")) {
          _renderMarket(listings);
        }
      });
      _loaded = true;
    }

    showSection(
      document.getElementById("loader-shop"),
      document.getElementById("shop-content")
    );
    _renderMiners();
    _renderVehicles();
  };

  // ── Tab switching ─────────────────────────────────────────
  const switchTab = (name, btn) => {
    document.querySelectorAll(".sub-page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".sub-tab").forEach(b => b.classList.remove("active"));
    document.getElementById(`sub-${name}`)?.classList.add("active");
    btn?.classList.add("active");

    if (name === "market") {
      DB.listenNFTListings(listings => _renderMarket(listings));
    }
    if (name === "vehicles") _renderVehicles();
  };

  // ── Miners ────────────────────────────────────────────────
  const _renderMiners = () => {
    const u    = window._currentUser;
    const cont = document.getElementById("sub-miners");
    if (!cont) return;

    const hasMiner = u?.miner && !u.miner.expired && !u.miner.claimedAt;

    cont.innerHTML = [
      {
        type: "beta", name: "Beta Miner", badge: "BETA",
        cost: APP_CONFIG.MINER_BETA_COST, hours: APP_CONFIG.MINER_BETA_HOURS,
        reward: APP_CONFIG.MINER_BETA_REWARD, days: APP_CONFIG.MINER_BETA_DAYS,
        icon: "⚙️",
      },
      {
        type: "alphaminer", name: "Alpha Miner", badge: "ALPHA",
        cost: APP_CONFIG.MINER_ALPHA_COST, hours: APP_CONFIG.MINER_ALPHA_HOURS,
        reward: APP_CONFIG.MINER_ALPHA_REWARD, days: APP_CONFIG.MINER_ALPHA_DAYS,
        icon: "🔮",
      },
    ].map(m => `
      <div class="miner-card">
        <div class="miner-placeholder">${m.icon}</div>
        <div class="miner-body">
          <div class="miner-name">${m.name}</div>
          <span class="miner-badge ${m.type}">${m.badge}</span>
          <div class="miner-detail">Duration: <span>${m.hours} hour auto-mining</span></div>
          <div class="miner-detail">Valid for: <span>${m.days} days</span></div>
          <div class="miner-detail">Reward: <span style="color:var(--gold)">+${m.reward} ALPHA</span></div>
          <div class="miner-detail">Cost: <span style="color:var(--gold)">${m.cost} ALPHA</span></div>
          <button class="buy-btn" id="buy-${m.type}-btn"
            ${hasMiner ? "disabled" : ""}
            onclick="SHOP.buyMiner('${m.type}')">
            ${hasMiner ? "MINER ACTIVE" : `BUY — ${m.cost} ALPHA`}
          </button>
        </div>
      </div>`).join("");
  };

  const buyMiner = async (type) => {
    const btn    = document.getElementById(`buy-${type}-btn`);
    if (btn) { btn.disabled = true; btn.textContent = "PROCESSING..."; }

    const result = await DB.api.buyMiner(String(TG_USER.id), type);

    if (!result.ok) {
      showToast(result.error, "err");
      _renderMiners();
    } else {
      showToast("Miner activated! ⚙️", "suc");
    }
  };

  // ── Vehicles ──────────────────────────────────────────────
  const _renderVehicles = () => {
    const u    = window._currentUser;
    const cont = document.getElementById("sub-vehicles");
    if (!cont) return;

    const owned    = u?.vehicles || ["v0"]; // v0 is always free/owned
    const selected = u?.selectedVehicle || "v0";

    cont.innerHTML = `
      <div class="vehicle-grid">
        ${APP_CONFIG.GAME_VEHICLES.map(v => {
          const isOwned    = owned.includes(v.id);
          const isSelected = selected === v.id;
          return `
            <div class="vehicle-card ${isOwned ? "owned" : ""} ${isSelected ? "selected" : ""}" onclick="SHOP.selectVehicle('${v.id}')">
              ${isOwned ? '<div class="vehicle-owned-badge">OWNED</div>' : ""}
              <div class="vehicle-img" style="background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:36px;">🚗</div>
              <div class="vehicle-name">${v.name}</div>
              <div class="vehicle-stat">HP: ${v.health} · DMG: ${v.damage}</div>
              ${v.cost === 0
                ? '<div class="vehicle-cost">FREE</div>'
                : `<div class="vehicle-cost">${v.cost.toLocaleString()} ALPHA</div>`}
              ${isOwned
                ? (isSelected
                    ? '<button class="buy-btn" style="background:var(--green);margin-top:8px;" disabled>SELECTED</button>'
                    : '<button class="buy-btn" style="margin-top:8px;" onclick="SHOP.selectVehicle(\''+v.id+'\')">SELECT</button>')
                : `<button class="buy-btn" style="margin-top:8px;" onclick="SHOP.buyVehicle('${v.id}')">BUY</button>`}
            </div>`;
        }).join("")}
      </div>`;
  };

  const buyVehicle = async (vehicleId) => {
    const result = await DB.api.buyVehicle(String(TG_USER.id), vehicleId);
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast("Vehicle purchased! 🚗", "suc");
    _renderVehicles();
  };

  const selectVehicle = async (vehicleId) => {
    const u = window._currentUser;
    if (!u) return;
    const owned = u.vehicles || ["v0"];
    if (!owned.includes(vehicleId)) {
      showToast("You don't own this vehicle!", "err"); return;
    }
    // Save selected vehicle locally (no backend call needed)
    u.selectedVehicle = vehicleId;
    _renderVehicles();
    showToast("Vehicle selected! ✅", "suc");
  };

  // ── NFT Market ────────────────────────────────────────────
  const _renderMarket = (listings) => {
    const cont = document.getElementById("sub-market");
    if (!cont) return;

    const available = listings.filter(l => l.available);
    if (!available.length) {
      cont.innerHTML = '<div class="empty-state">No NFTs available right now</div>';
      return;
    }

    cont.innerHTML = available.map(nft => `
      <div class="miner-card">
        <img class="miner-img" src="${nft.img}" alt="${nft.name}" onerror="this.style.display='none'">
        <div class="miner-body">
          <div class="miner-name">${nft.name}</div>
          <div class="miner-detail">Price: <span style="color:var(--gold)">${nft.price.toLocaleString()} ALPHA</span></div>
          <button class="buy-btn" onclick="SHOP.buyNFT('${nft.id}')">BUY — ${nft.price.toLocaleString()} ALPHA</button>
        </div>
      </div>`).join("");
  };

  const buyNFT = async (nftId) => {
    const result = await DB.api.buyNFT(String(TG_USER.id), nftId);
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast(`NFT purchased! 🎉`, "suc");
  };

  // ── NFT Send ──────────────────────────────────────────────
  const openSendNFT = (nftId) => {
    _currentNFT = nftId;
    document.getElementById("send-nft-address").value = "";
    showModal("modal-send-nft");
  };

  const confirmSendNFT = async () => {
    const address = document.getElementById("send-nft-address").value.trim();
    if (!address) { showToast("Enter a wallet address", "err"); return; }

    const result = await DB.api.requestNFTSend({
      userId: String(TG_USER.id), nftId: _currentNFT, address,
    });
    if (!result.ok) { showToast(result.error, "err"); return; }
    closeModal("modal-send-nft");
    showToast("Send request submitted! ✅", "suc");
  };

  return { load, switchTab, buyMiner, buyVehicle, selectVehicle, buyNFT, openSendNFT, confirmSendNFT };

})();
