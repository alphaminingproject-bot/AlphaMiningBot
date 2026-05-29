/* ============================================================
   tasks.js — ALPHA Platform · Tasks Module
   Handles: task categories, task completion, X handle verify,
   channel verify, event tasks, auto-ref tasks
   Independent: errors here don't affect other modules
   ============================================================ */

const TASKS = (() => {

  let _tasks      = [];
  let _events     = [];
  let _activeTab  = "all";
  let _loaded     = false;
  let _unsubTasks = null;
  let _unsubEvs   = null;

  // ── Categories ────────────────────────────────────────────
  const CATS = ["all", "social", "gaming", "partners", "referral"];

  // ── Load ─────────────────────────────────────────────────
  const load = () => {
    if (!_loaded) {
      // Attach real-time listeners once
      _unsubTasks = DB.listenTasks((tasks) => {
        _tasks = tasks;
        _render();
        _updateCatDots();
      });
      _unsubEvs = DB.listenEvents((events) => {
        _events = events;
        _render();
      });
      _loaded = true;
    }

    showSection(
      document.getElementById("loader-tasks"),
      document.getElementById("tasks-content")
    );
    _renderCats();
    _render();
  };

  // ── Category tabs ─────────────────────────────────────────
  const _renderCats = () => {
    const cont = document.getElementById("task-cats");
    cont.innerHTML = CATS.map(cat => `
      <button class="cat-btn${_activeTab === cat ? " active" : ""}"
        onclick="TASKS.switchCat('${cat}',this)" id="catbtn-${cat}">
        ${cat.toUpperCase()}
        <div class="cat-dot" id="catdot-${cat}"></div>
      </button>`).join("");
  };

  const switchCat = (cat, btn) => {
    _activeTab = cat;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
    btn?.classList.add("active");
    _render();
  };

  const _updateCatDots = () => {
    const u = window._currentUser;
    CATS.forEach(cat => {
      const dot = document.getElementById(`catdot-${cat}`);
      if (!dot) return;
      if (cat === "all") {
        const hasAny = _tasks.some(t => (u?.taskStates?.[t.id] || "go") === "go");
        dot.classList.toggle("show", hasAny);
      } else {
        const hasInCat = _tasks.filter(t => (t.category || "social") === cat)
          .some(t => (u?.taskStates?.[t.id] || "go") === "go");
        dot.classList.toggle("show", hasInCat);
      }
    });
  };

  // ── Main render ───────────────────────────────────────────
  const _render = () => {
    const list = document.getElementById("tasks-list");
    if (!list) return;
    list.innerHTML = "";

    // Event tasks first (pinned, gold)
    _events.forEach(ev => {
      (ev.tasks || []).forEach(task => {
        list.appendChild(_buildCard(task, true, ev.name));
      });
    });

    // Filter tasks by category
    const filtered = _activeTab === "all"
      ? _tasks
      : _tasks.filter(t => (t.category || "social") === _activeTab);

    filtered.forEach(task => list.appendChild(_buildCard(task, false, null)));

    if (!list.children.length) {
      list.innerHTML = '<div class="empty-state">No tasks in this category</div>';
    }

    // Update nav dot
    const u = window._currentUser;
    const hasUndone = _tasks.some(t => (u?.taskStates?.[t.id] || "go") === "go");
    document.getElementById("nav-task-dot")?.classList.toggle("show", hasUndone);
  };

  // ── Build task card ───────────────────────────────────────
  const _buildCard = (task, isEvent, eventName) => {
    const u     = window._currentUser;
    const state = u?.taskStates?.[task.id] || "go";
    const card  = document.createElement("div");
    card.className = `task-card${isEvent ? " event-task" : ""}`;

    const badgeHtml = isEvent
      ? `<div class="task-event-badge">📣 ${eventName || "EVENT"}</div>` : "";

    // Reward display (supports multi-currency)
    let rewardHtml = `+${task.reward} ALPHA`;
    if (task.tonReward && task.tonReward > 0) rewardHtml += ` + ${task.tonReward} TON`;
    if (task.extraCurrency && task.extraReward) rewardHtml += ` + ${task.extraReward} ${task.extraCurrency}`;

    // Button
    let btnHtml = "";
    if (task.type === "auto_ref") {
      btnHtml = state === "done"
        ? '<button class="task-btn done">✓ DONE</button>'
        : '<button class="task-btn verify" style="cursor:default;">AUTO</button>';
    } else if (state === "done") {
      btnHtml = '<button class="task-btn done">✓ DONE</button>';
    } else if (state === "pending") {
      btnHtml = '<button class="task-btn pending">PENDING</button>';
    } else if (state === "rejected") {
      btnHtml = `<button class="task-btn rejected" onclick="TASKS.retry('${task.id}')">RETRY</button>`;
    } else if (state === "verify") {
      if (task.type === "telegram") {
        btnHtml = `<button class="task-btn verify" onclick="TASKS.verifyChannel('${task.id}','${task.target}')">VERIFY</button>`;
      } else if (task.type === "x_follow" || task.xFollow) {
        btnHtml = `<button class="task-btn verify" onclick="TASKS.showXInput('${task.id}')">VERIFY</button>`;
      } else if (task.requiresInput) {
        btnHtml = `<button class="task-btn verify" onclick="TASKS.showCustomInput('${task.id}')">SUBMIT PROOF</button>`;
      } else {
        btnHtml = `<button class="task-btn verify" onclick="TASKS.verifyLink('${task.id}')">VERIFY</button>`;
      }
    } else {
      btnHtml = `<button class="task-btn go" onclick="TASKS.go('${task.id}','${task.type || ""}','${task.target || ""}')">GO →</button>`;
    }

    // X handle input
    const xHtml = (task.type === "x_follow" || task.xFollow)
      ? `<div class="x-input-wrap" id="xwrap_${task.id}">
           <input class="x-input" id="xinput_${task.id}" placeholder="@yourhandle"/>
           <button class="x-submit-btn" onclick="TASKS.submitX('${task.id}',${task.reward},'${task.name}')">SUBMIT</button>
         </div>` : "";

    // Custom input (for tasks requiring proof)
    const customHtml = task.requiresInput
      ? `<div class="x-input-wrap" id="custominput_${task.id}">
           <input class="x-input" id="custval_${task.id}" placeholder="${task.inputPlaceholder || "Enter your proof..."}"/>
           <button class="x-submit-btn" onclick="TASKS.submitCustom('${task.id}',${task.reward},'${task.name}')">SUBMIT</button>
         </div>` : "";

    card.innerHTML = `
      <div class="task-icon">${task.icon || "🎯"}</div>
      <div class="task-info">
        ${badgeHtml}
        <div class="task-name">${task.name}</div>
        <div class="task-desc">${task.desc || ""}</div>
        <div class="task-reward">${rewardHtml}</div>
        ${xHtml}${customHtml}
      </div>
      ${btnHtml}
    `;
    return card;
  };

  // ── Task actions ──────────────────────────────────────────
  const go = async (id, type, target) => {
    // Optimistically mark as verify
    if (!window._currentUser.taskStates) window._currentUser.taskStates = {};
    window._currentUser.taskStates[id] = "verify";
    _render();

    const url = type === "telegram"
      ? `https://t.me/${target.replace("@", "")}`
      : target;

    if (tg) { tg.openLink(url); } else { window.open(url, "_blank"); }
  };

  const verifyChannel = async (taskId, channel) => {
    showToast("Verifying membership...", "");
    const result = await DB.api.verifyChannel({ userId: String(TG_USER.id), channel, taskId });
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast(`+${result.reward} ALPHA! Channel verified ✅`, "suc");
  };

  const verifyLink = async (taskId) => {
    const result = await DB.api.completeTask(String(TG_USER.id), taskId);
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast(`+${result.reward} ALPHA! Task complete ✅`, "suc");
  };

  const retry = (id) => {
    if (window._currentUser.taskStates) window._currentUser.taskStates[id] = "go";
    _render();
  };

  const showXInput = (id) => {
    document.getElementById(`xwrap_${id}`)?.classList.toggle("show");
  };

  const showCustomInput = (id) => {
    document.getElementById(`custominput_${id}`)?.classList.toggle("show");
  };

  const submitX = async (taskId, reward, taskName) => {
    const handle = document.getElementById(`xinput_${taskId}`)?.value.trim() ?? "";
    if (!handle) { showToast("Please enter your @handle", "err"); return; }

    const result = await DB.api.submitXHandle({
      userId: String(TG_USER.id), taskId, taskName, handle, reward,
    });
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast("Submitted! Awaiting admin verification.", "suc");
  };

  const submitCustom = async (taskId, reward, taskName) => {
    const val = document.getElementById(`custval_${taskId}`)?.value.trim() ?? "";
    if (!val) { showToast("Please enter your proof", "err"); return; }

    const result = await DB.api.submitXHandle({
      userId: String(TG_USER.id), taskId, taskName, handle: val, reward,
    });
    if (!result.ok) { showToast(result.error, "err"); return; }
    showToast("Proof submitted! Awaiting admin verification.", "suc");
  };

  return { load, switchCat, go, verifyChannel, verifyLink, retry, showXInput, showCustomInput, submitX, submitCustom };

})();
