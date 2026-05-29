/* ============================================================
   game.js — ALPHA Platform · Alpha World War
   2D top-down tank battle. Solo vs bots + PvP via Firebase.
   Completely independent — game errors don't affect app.
   ============================================================ */

const GAME = (() => {

  // ── State ──────────────────────────────────────────────────
  let _canvas, _ctx, _animId;
  let _gameState   = null;  // current running game
  let _matchCode   = null;
  let _matchRef    = null;
  let _unsubMatch  = null;
  let _loaded      = false;
  let _joystick    = { active: false, dx: 0, dy: 0, startX: 0, startY: 0 };

  // ── Load page ─────────────────────────────────────────────
  const load = () => {
    showSection(
      document.getElementById("loader-game"),
      document.getElementById("game-content")
    );
    _renderMyVehicles();
    _updateBulletCount();
    _loaded = true;
  };

  const _renderMyVehicles = () => {
    const u    = window._currentUser;
    const cont = document.getElementById("my-vehicles-list");
    if (!cont) return;
    const owned = u?.vehicles || ["v0"];
    const sel   = u?.selectedVehicle || "v0";
    cont.innerHTML = owned.map(vid => {
      const v = APP_CONFIG.GAME_VEHICLES.find(x => x.id === vid);
      if (!v) return "";
      return `
        <div style="display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid ${sel===vid?"var(--blue)":"var(--border)"};border-radius:8px;padding:10px;margin-bottom:6px;">
          <span style="font-size:24px;">🚗</span>
          <div style="flex:1;">
            <div style="font-size:12px;font-weight:bold;color:var(--white);">${v.name}</div>
            <div style="font-size:9px;color:var(--gray);">HP: ${v.health} · DMG: ${v.damage}/shot</div>
          </div>
          ${sel===vid ? '<span style="font-size:9px;color:var(--blue);">SELECTED</span>' : `<button class="btn ghost sm" onclick="SHOP.selectVehicle('${v.id}')">SELECT</button>`}
        </div>`;
    }).join("") || '<div class="empty-state">No vehicles. Visit Shop → Vehicles</div>';
  };

  const _updateBulletCount = () => {
    const u   = window._currentUser;
    const cnt = document.getElementById("bullet-count");
    if (cnt) cnt.textContent = u?.bullets ?? 0;
  };

  const buyBullets = async () => {
    const input = document.getElementById("bullet-input");
    const amt   = parseInt(input?.value, 10);
    if (!amt || amt < 1) { showToast("Enter a valid amount", "err"); return; }
    const result = await DB.api.buyBullets(String(TG_USER.id), amt);
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast(`+${amt} bullets purchased! 🔴`, "suc");
    if (input) input.value = "";
    _updateBulletCount();
  };

  // ── PvP UI ────────────────────────────────────────────────
  const showPvP = () => {
    const panel = document.getElementById("pvp-panel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  };

  const createMatch = async () => {
    const u    = window._currentUser;
    const code = genMatchCode();
    _matchCode = code;

    const matchData = {
      code,
      status:    "waiting",   // waiting → ready → countdown → playing → ended
      createdBy: String(u.id),
      createdAt: Date.now(),
      teams: {
        A: [{ id: String(u.id), name: u.name, ready: false, vehicle: u.selectedVehicle || "v0" }],
        B: [],
      },
    };

    await DB.createMatch(matchData);
    _listenMatch(code);
    _renderLobby(matchData, "A");
    showToast(`Match created! Code: ${code}`, "suc");
  };

  const joinMatch = async () => {
    const code = document.getElementById("join-code-input")?.value.trim().toUpperCase();
    if (!code || code.length !== 6) { showToast("Enter a valid 6-letter code", "err"); return; }

    const u     = window._currentUser;
    _matchCode  = code;

    // Read match first
    const ref   = DB._rt.ref(`matches/${code}`);
    const snap  = await ref.get();
    if (!snap.exists()) { showToast("Match not found", "err"); return; }

    const match = snap.val();
    if (match.status !== "waiting") { showToast("Match has already started", "err"); return; }

    // Join team B
    const teamB = match.teams.B || [];
    if (teamB.length >= APP_CONFIG.GAME_MAX_TEAM) { showToast("Team B is full", "err"); return; }
    teamB.push({ id: String(u.id), name: u.name, ready: false, vehicle: u.selectedVehicle || "v0" });

    await DB.updateMatch(code, { "teams/B": teamB });
    _listenMatch(code);
    _renderLobby(match, "B");
    showToast("Joined match!", "suc");
  };

  const _listenMatch = (code) => {
    if (_unsubMatch) _unsubMatch();
    _unsubMatch = DB.listenMatch(code, (matchData) => {
      _renderLobby(matchData, _getMyTeam(matchData));
      if (matchData.status === "countdown") {
        _startCountdown(matchData);
      } else if (matchData.status === "playing") {
        _launchGame(matchData, false);
      } else if (matchData.status === "ended") {
        _handleGameEnd(matchData);
      }
    });
  };

  const _getMyTeam = (match) => {
    const uid = String(TG_USER.id);
    if ((match.teams.A || []).some(p => p.id === uid)) return "A";
    return "B";
  };

  const _renderLobby = (match, myTeam) => {
    const lobby = document.getElementById("match-lobby");
    if (!lobby) return;
    lobby.style.display = "block";
    document.querySelector(".game-menu > .game-mode-grid").style.display = "none";

    const teamA = match.teams.A || [];
    const teamB = match.teams.B || [];

    lobby.innerHTML = `
      <div class="match-panel">
        <div class="sec-title">MATCH CODE</div>
        <div class="match-code" onclick="copyText('${match.code}');showToast('Code copied','suc')">${match.code}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          <div>
            <div style="font-size:9px;color:var(--blue);margin-bottom:6px;letter-spacing:2px;">TEAM A</div>
            ${teamA.map(p => `<div class="match-player ${p.ready?"ready":""}">${p.name} ${p.ready?"✓":""}</div>`).join("")}
          </div>
          <div>
            <div style="font-size:9px;color:var(--red);margin-bottom:6px;letter-spacing:2px;">TEAM B</div>
            ${teamB.length ? teamB.map(p => `<div class="match-player ${p.ready?"ready":""}">${p.name} ${p.ready?"✓":""}</div>`).join("") : '<div style="font-size:10px;color:var(--gray);">Waiting...</div>'}
          </div>
        </div>
        <button class="btn primary full" style="margin-top:14px;" onclick="GAME.readyUp()">✓ READY</button>
        <button class="btn ghost full"   style="margin-top:8px;"  onclick="GAME.leaveMatch()">LEAVE MATCH</button>
      </div>`;
  };

  const readyUp = async () => {
    if (!_matchCode) return;
    const uid   = String(TG_USER.id);
    const snap  = await DB._rt.ref(`matches/${_matchCode}`).get();
    if (!snap.exists()) return;
    const match = snap.val();
    const team  = _getMyTeam(match);
    const members = match.teams[team] || [];
    const idx   = members.findIndex(p => p.id === uid);
    if (idx < 0) return;
    members[idx].ready = true;

    // Check if all ready
    const allReady = [...(match.teams.A||[]), ...(match.teams.B||[])].every(p => p.ready);
    const updates  = { [`teams/${team}`]: members };
    if (allReady && match.teams.B?.length > 0) updates.status = "countdown";
    await DB.updateMatch(_matchCode, updates);
  };

  const leaveMatch = async () => {
    if (_unsubMatch) _unsubMatch();
    _matchCode = null;
    const lobby = document.getElementById("match-lobby");
    if (lobby) lobby.style.display = "none";
    document.querySelector(".game-menu > .game-mode-grid").style.display = "grid";
    document.getElementById("pvp-panel").style.display = "none";
  };

  // ── Countdown before game starts ──────────────────────────
  const _startCountdown = (matchData) => {
    const overlay = document.getElementById("countdown-overlay");
    const numEl   = document.getElementById("countdown-num");
    overlay.style.display = "flex";
    let count = APP_CONFIG.GAME_COUNTDOWN;
    numEl.textContent = count;
    const timer = setInterval(() => {
      count--;
      numEl.textContent = count;
      numEl.style.animation = "none";
      setTimeout(() => { numEl.style.animation = "countPulse 1s ease-in-out"; }, 10);
      if (count <= 0) {
        clearInterval(timer);
        overlay.style.display = "none";
        _launchGame(matchData, false);
      }
    }, 1000);
  };

  // ── Start solo vs bots ────────────────────────────────────
  const startSolo = () => {
    const u     = window._currentUser;
    const vidId = u?.selectedVehicle || "v0";
    const v     = APP_CONFIG.GAME_VEHICLES.find(x => x.id === vidId) || APP_CONFIG.GAME_VEHICLES[0];

    const soloMatch = {
      code:   "SOLO",
      status: "playing",
      mode:   "solo",
      teams: {
        A: [{ id: String(u.id), name: u.name, vehicle: vidId }],
        B: [], // bots
      },
    };
    _launchGame(soloMatch, true);
  };

  // ── Launch game canvas ────────────────────────────────────
  const _launchGame = (matchData, isSolo) => {
    const wrap = document.getElementById("game-canvas-wrap");
    wrap.classList.add("show");
    _canvas = document.getElementById("game-canvas");
    _ctx    = _canvas.getContext("2d");

    // Size canvas to screen
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight - 80; // account for HUD

    const u   = window._currentUser;
    const vid = u?.selectedVehicle || "v0";
    const v   = APP_CONFIG.GAME_VEHICLES.find(x => x.id === vid) || APP_CONFIG.GAME_VEHICLES[0];

    _gameState = {
      isSolo,
      matchData,
      player: {
        x:       _canvas.width  / 2,
        y:       _canvas.height / 2,
        angle:   0,
        hp:      v.health,
        maxHp:   v.health,
        damage:  v.damage,
        speed:   3,
        vehicle: v,
        bullets: u?.bullets ?? 999,
        score:   0,
      },
      bots:      isSolo ? _spawnBots(3) : [],
      bullets:   [],
      blocks:    _generateBlocks(),
      gameOver:  false,
      winner:    null,
    };

    _setupControls();
    _gameLoop();
  };

  // ── Spawn AI bots ─────────────────────────────────────────
  const _spawnBots = (count) => {
    const bots = [];
    for (let i = 0; i < count; i++) {
      const v = APP_CONFIG.GAME_VEHICLES[Math.floor(Math.random() * 3)]; // lower tier bots
      bots.push({
        x:       Math.random() * (_canvas.width  - 100) + 50,
        y:       Math.random() * (_canvas.height - 100) + 50,
        angle:   Math.random() * Math.PI * 2,
        hp:      v.health * 0.7,
        maxHp:   v.health * 0.7,
        damage:  v.damage * 0.8,
        speed:   1.5 + Math.random(),
        vehicle: v,
        shootTimer: 0,
        moveTimer:  0,
        targetAngle: Math.random() * Math.PI * 2,
      });
    }
    return bots;
  };

  // ── Generate random cover blocks ──────────────────────────
  const _generateBlocks = () => {
    const blocks = [];
    const count  = 20;
    for (let i = 0; i < count; i++) {
      blocks.push({
        x:      Math.random() * (_canvas.width  - 60) + 30,
        y:      Math.random() * (_canvas.height - 60) + 30,
        w:      40 + Math.random() * 60,
        h:      40 + Math.random() * 60,
        hp:     3,
        maxHp:  3,
      });
    }
    return blocks;
  };

  // ── Main game loop ────────────────────────────────────────
  const _gameLoop = () => {
    if (!_gameState || _gameState.gameOver) return;
    _update();
    _draw();
    _animId = requestAnimationFrame(_gameLoop);
  };

  const _update = () => {
    const gs = _gameState;
    const p  = gs.player;

    // Move player from joystick
    if (_joystick.active) {
      p.x     += _joystick.dx * p.speed;
      p.y     += _joystick.dy * p.speed;
      p.angle  = Math.atan2(_joystick.dy, _joystick.dx);
    }

    // Clamp to canvas
    p.x = Math.max(20, Math.min(_canvas.width  - 20, p.x));
    p.y = Math.max(20, Math.min(_canvas.height - 20, p.y));

    // Update bullets
    gs.bullets = gs.bullets.filter(b => {
      b.x += Math.cos(b.angle) * 8;
      b.y += Math.sin(b.angle) * 8;
      if (b.x < 0 || b.x > _canvas.width || b.y < 0 || b.y > _canvas.height) return false;

      // Hit bots
      if (b.owner === "player") {
        for (let i = gs.bots.length - 1; i >= 0; i--) {
          const bot = gs.bots[i];
          if (_dist(b, bot) < 20) {
            bot.hp -= b.damage;
            if (bot.hp <= 0) {
              gs.bots.splice(i, 1);
              p.score++;
              _updateHUD();
            }
            return false;
          }
        }
      }

      // Hit blocks
      for (let i = gs.blocks.length - 1; i >= 0; i--) {
        const bl = gs.blocks[i];
        if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) {
          bl.hp--;
          if (bl.hp <= 0) gs.blocks.splice(i, 1);
          return false;
        }
      }

      return true;
    });

    // Update bots AI
    gs.bots.forEach(bot => {
      bot.moveTimer++;
      bot.shootTimer++;

      // Random movement
      if (bot.moveTimer > 60) {
        bot.targetAngle = Math.atan2(p.y - bot.y, p.x - bot.x) + (Math.random() - 0.5);
        bot.moveTimer   = 0;
      }
      bot.angle  += (bot.targetAngle - bot.angle) * 0.05;
      bot.x      += Math.cos(bot.angle) * bot.speed;
      bot.y      += Math.sin(bot.angle) * bot.speed;
      bot.x       = Math.max(20, Math.min(_canvas.width  - 20, bot.x));
      bot.y       = Math.max(20, Math.min(_canvas.height - 20, bot.y));

      // Bot shoots at player
      if (bot.shootTimer > 90) {
        bot.shootTimer = 0;
        gs.bullets.push({
          x:      bot.x, y:      bot.y,
          angle:  Math.atan2(p.y - bot.y, p.x - bot.x),
          damage: bot.damage,
          owner:  "bot",
        });
      }

      // Bot bullet hits player
      gs.bullets.filter(b => b.owner === "bot").forEach(b => {
        if (_dist(b, p) < 20) {
          p.hp -= b.damage;
          b.dead = true;
          _updateHUD();
        }
      });
    });
    gs.bullets = gs.bullets.filter(b => !b.dead);

    // Check game over
    if (p.hp <= 0) {
      gs.gameOver = true;
      gs.winner   = "bots";
      setTimeout(() => _endGame(), 500);
    } else if (gs.isSolo && gs.bots.length === 0) {
      gs.gameOver = true;
      gs.winner   = "player";
      setTimeout(() => _endGame(), 500);
    }
  };

  // ── Draw ──────────────────────────────────────────────────
  const _draw = () => {
    const gs  = _gameState;
    const ctx = _ctx;

    // Background
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);

    // Grid
    ctx.strokeStyle = "rgba(26,111,255,0.06)";
    ctx.lineWidth   = 1;
    for (let x = 0; x < _canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, _canvas.height); ctx.stroke();
    }
    for (let y = 0; y < _canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(_canvas.width, y); ctx.stroke();
    }

    // Blocks
    gs.blocks.forEach(bl => {
      const alpha = bl.hp / bl.maxHp;
      ctx.fillStyle   = `rgba(30,45,68,${alpha})`;
      ctx.strokeStyle = `rgba(26,111,255,${alpha * 0.4})`;
      ctx.lineWidth   = 2;
      ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
      ctx.strokeRect(bl.x, bl.y, bl.w, bl.h);
    });

    // Player tank
    _drawTank(gs.player, "#1a6fff", true);

    // Bots
    gs.bots.forEach(bot => _drawTank(bot, "#ff3d5a", false));

    // Bullets
    gs.bullets.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = b.owner === "player" ? "#f0b429" : "#ff3d5a";
      ctx.fill();
      ctx.shadowBlur  = 6;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  };

  const _drawTank = (tank, color, isPlayer) => {
    const ctx = _ctx;
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle + Math.PI / 2);

    // Body
    ctx.fillStyle   = color;
    ctx.strokeStyle = isPlayer ? "#fff" : "#ff8888";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -18, 28, 36, 4);
    ctx.fill();
    ctx.stroke();

    // Turret
    ctx.fillStyle = isPlayer ? "#0d4fd6" : "#cc0020";
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();

    // Barrel
    ctx.fillStyle = isPlayer ? "#0a3ab0" : "#990000";
    ctx.fillRect(-3, -26, 6, 18);

    // Tracks
    ctx.fillStyle = isPlayer ? "#0b3a9e" : "#8b0000";
    ctx.fillRect(-18, -18, 6, 36);
    ctx.fillRect( 12, -18, 6, 36);

    ctx.restore();

    // HP bar
    const barW = 36;
    const barH = 4;
    const barX = tank.x - barW / 2;
    const barY = tank.y - 28;
    ctx.fillStyle = "#1e2d44";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = tank.hp / tank.maxHp > 0.5 ? "#20d4a0" : tank.hp / tank.maxHp > 0.25 ? "#f0b429" : "#ff3d5a";
    ctx.fillRect(barX, barY, barW * Math.max(0, tank.hp / tank.maxHp), barH);
  };

  // ── Fire ─────────────────────────────────────────────────
  const fire = () => {
    if (!_gameState || _gameState.gameOver) return;
    const p = _gameState.player;

    if (p.bullets !== 999 && p.bullets <= 0) {
      showToast("No bullets! Buy more in Shop → Game", "err"); return;
    }
    if (p.bullets !== 999) p.bullets--;

    _gameState.bullets.push({
      x:      p.x + Math.cos(p.angle) * 20,
      y:      p.y + Math.sin(p.angle) * 20,
      angle:  p.angle,
      damage: p.damage,
      owner:  "player",
    });

    document.getElementById("hud-bullets").textContent =
      p.bullets === 999 ? "∞" : p.bullets;
  };

  // ── HUD update ────────────────────────────────────────────
  const _updateHUD = () => {
    if (!_gameState) return;
    const p   = _gameState.player;
    const pct = Math.max(0, p.hp / p.maxHp * 100);
    document.getElementById("hud-hp-bar").style.width = `${pct}%`;
    document.getElementById("hud-hp-num").textContent = Math.max(0, Math.floor(p.hp));
    document.getElementById("hud-score").textContent  = `${p.score} kills`;
    document.getElementById("hud-bullets").textContent = p.bullets === 999 ? "∞" : p.bullets;
  };

  // ── Controls ─────────────────────────────────────────────
  const _setupControls = () => {
    const jBase = document.getElementById("joystick-base");
    const jDot  = document.getElementById("joystick-dot");

    const onStart = (e) => {
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const rect  = jBase.getBoundingClientRect();
      _joystick.startX = rect.left + rect.width  / 2;
      _joystick.startY = rect.top  + rect.height / 2;
      _joystick.active = true;
    };

    const onMove = (e) => {
      e.preventDefault();
      if (!_joystick.active) return;
      const touch = e.touches ? e.touches[0] : e;
      const dx    = touch.clientX - _joystick.startX;
      const dy    = touch.clientY - _joystick.startY;
      const dist  = Math.sqrt(dx * dx + dy * dy);
      const maxD  = 35;
      const clamp = Math.min(dist, maxD);
      const angle = Math.atan2(dy, dx);

      _joystick.dx = Math.cos(angle) * (clamp / maxD);
      _joystick.dy = Math.sin(angle) * (clamp / maxD);

      jDot.style.transform = `translate(${Math.cos(angle)*clamp}px, ${Math.sin(angle)*clamp}px)`;
    };

    const onEnd = () => {
      _joystick.active = false;
      _joystick.dx = 0;
      _joystick.dy = 0;
      jDot.style.transform = "translate(0,0)";
    };

    jBase.addEventListener("touchstart", onStart, { passive: false });
    jBase.addEventListener("touchmove",  onMove,  { passive: false });
    jBase.addEventListener("touchend",   onEnd);
    jBase.addEventListener("mousedown",  onStart);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onEnd);
  };

  // ── Game end ──────────────────────────────────────────────
  const _endGame = async () => {
    if (_animId) cancelAnimationFrame(_animId);

    const gs  = _gameState;
    const won = gs.winner === "player";

    // Award ALPHA if won solo
    if (won && gs.isSolo) {
      const result = await DB.api.gameWin({
        userId: String(TG_USER.id),
        mode:   "solo",
        reward: APP_CONFIG.GAME_WIN_REWARD,
      });
      if (result.ok) showToast(`+${APP_CONFIG.GAME_WIN_REWARD} ALPHA! Victory! 🏆`, "suc");
    }

    // Show result overlay on canvas
    const ctx = _ctx;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, _canvas.width, _canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = won ? "#20d4a0" : "#ff3d5a";
    ctx.font      = `bold 32px monospace`;
    ctx.fillText(won ? "VICTORY!" : "DEFEATED", _canvas.width/2, _canvas.height/2 - 20);
    ctx.font      = "14px monospace";
    ctx.fillStyle = "#e8f0ff";
    ctx.fillText(`Score: ${gs.player.score} kills`, _canvas.width/2, _canvas.height/2 + 20);

    setTimeout(exitGame, 3000);
  };

  const _handleGameEnd = (matchData) => {
    // PvP end handled similarly
    _endGame();
  };

  const exitGame = () => {
    if (_animId) cancelAnimationFrame(_animId);
    _gameState = null;
    document.getElementById("game-canvas-wrap").classList.remove("show");
    if (_unsubMatch) _unsubMatch();
  };

  // ── Helpers ───────────────────────────────────────────────
  const _dist = (a, b) => Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);

  return { load, startSolo, showPvP, createMatch, joinMatch, readyUp, leaveMatch, fire, exitGame, buyBullets };

})();
