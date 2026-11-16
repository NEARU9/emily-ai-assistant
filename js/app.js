// JavaScript aplikasi — tetap satu file agar state dan fungsi antarbagian tetap terhubung.
// Kategori: mascot/animasi, tema, navigasi, chat, riwayat, pengaturan, koneksi AI, composer, lampiran gambar, boot.

(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var uid = function () { return Math.random().toString(36).slice(2, 10); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var settings = Object.assign({ name: "", style: "sweet", speed: "quick" }, store.get("emilly:settings", {}));
  var sessions = store.get("emilly:sessions", []);
  var current = { id: uid(), turns: [] };
  var busy = false, ctl = null, pendingImage = null, activeImage = null;
  var samplePromise = null;

  /* ---------- Emily's moods (expression sprites) ---------- */
  var MOODS = ["neutral", "happy", "confused", "sleepy", "angry", "surprised", "choc", "chocsurprised", "thinking", "reading", "drinking", "sleeping"];
  var mascots = Array.prototype.map.call(document.querySelectorAll(".mascot"), function (el) {
    var mb = el.querySelector(".mb"), sps = {};
    MOODS.forEach(function (m) {
      var d = document.createElement("span");
      d.className = "sp" + (m === "neutral" ? " on" : "");
      d.style.backgroundImage = "var(--sp-" + m + ")";
      mb.appendChild(d);
      sps[m] = d;
    });
    return { el: el, mp: el.querySelector(".mp"), sps: sps };
  });
  mascots.forEach(function (x) {
    x.mp.addEventListener("animationend", function (e) {
      if (e.target === x.mp) x.mp.classList.remove("bump", "hop");
    });
  });
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  var mood = "neutral", transient = null, tTimer = 0, blinking = false, typing = false, idle = 0, idleT1 = 0, idleT2 = 0;
  function baseMood() {
    if (busy) return "thinking";
    if (typing) return "reading";
    if (idle >= 2) return "sleeping";
    if (idle === 1) return "sleepy";
    return "neutral";
  }
  function currentMood() {
    if (transient) return transient;
    var b = baseMood();
    return blinking && b === "neutral" ? "sleepy" : b;
  }
  function paint(quiet) {
    petMood(transient || baseMood());
    var m = currentMood();
    if (m === mood) return;
    var prev = mood; mood = m;
    mascots.forEach(function (x) {
      x.sps[prev].classList.remove("on");
      x.sps[m].classList.add("on");
      x.el.dataset.mood = m;
      if (!quiet) restart(x.mp, "bump");
    });
  }
  function flash(m, ms) {
    transient = m;
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { transient = null; paint(); }, ms);
    paint();
  }
  function scheduleBlink() {
    setTimeout(function () {
      if (!transient && baseMood() === "neutral" && !document.hidden) {
        blinking = true; paint(true);
        setTimeout(function () { blinking = false; paint(true); }, 150);
      }
      scheduleBlink();
    }, 2600 + Math.random() * 4200);
  }
  function resetIdle() {
    var was = idle;
    clearTimeout(idleT1); clearTimeout(idleT2);
    idle = 0;
    idleT1 = setTimeout(function () { if (!busy) { idle = 1; paint(); } }, 30000);
    idleT2 = setTimeout(function () { if (!busy) { idle = 2; paint(); } }, 60000);
    return was;
  }
  function wake() {
    var was = resetIdle();
    if (was >= 1) { paint(); if (was >= 2) flash("surprised", 1100); }
  }
  ["pointerdown", "keydown", "wheel"].forEach(function (ev) { document.addEventListener(ev, wake, true); });

  var POKES = [["surprised", 2200], ["happy", 2400], ["choc", 3400], ["drinking", 3400], ["reading", 3000], ["chocsurprised", 2400], ["angry", 1800], ["happy", 2400]];
  var lastPoke = -1;
  function poke() {
    var i;
    do { i = Math.floor(Math.random() * POKES.length); } while (i === lastPoke);
    lastPoke = i;
    flash(POKES[i][0], POKES[i][1]);
    mascots.forEach(function (x) { restart(x.mp, "hop"); });
  }
  mascots.forEach(function (x) { x.el.addEventListener("click", poke); });

  function setAvatar(el, m) { el.style.backgroundImage = "var(--sp-" + m + ")"; }

  /* ---------- Emily idle: 2 frame animations ---------- */
  var pet = $("#pet"), pfig = pet.querySelector(".fig"), bub = $("#bub"), frs = pet.querySelectorAll(".spr");
  var P = { x: 0, lift: 0, vy: 0, drag: null, hold: false, tm: 0, last: "" }, bubT = 0;
  /* frames: 0 neutral, 1 sway, 2 foot tap, 3 eyes closed, 4 mouth open, 5 settle */
  var ANIMS = {
    sway: { f: [0, 1, 2, 1, 0], t: [450, 480, 750, 480, 450] },
    murmur: { f: [0, 3, 4, 5, 0], t: [500, 1000, 800, 550, 400] }
  };
  function pbounds() { var r = document.querySelector(".main").getBoundingClientRect(), w = pet.offsetWidth; return { l: r.left + 8, r: Math.max(r.left + 40, r.right - w - 8) }; }
  function pground() { var f = $("#form"), r = f && f.getBoundingClientRect(); return r && r.height ? r.top + 4 : window.innerHeight - 8; }
  function psay(t, ms) { bub.textContent = t; bub.classList.add("show"); clearTimeout(bubT); bubT = setTimeout(function () { bub.classList.remove("show"); }, ms || 2200); }
  function phop() { pet.classList.remove("hop"); void pet.offsetWidth; pet.classList.add("hop"); }
  pet.addEventListener("animationend", function (e) { if (e.animationName === "hopp") pet.classList.remove("hop"); });
  function showF(i) { for (var k = 0; k < frs.length; k++) frs[k].classList.toggle("on", k === i); }
  function play(name) {
    clearTimeout(P.tm); if (P.hold || P.drag) return;
    var a = ANIMS[name], i = 0; P.last = name;
    (function step() {
      showF(a.f[i]);
      P.tm = setTimeout(function () { i++; if (i < a.f.length) step(); else { showF(0); schedule(1800 + Math.random() * 2600); } }, a.t[i]);
    })();
    if (name === "murmur" && Math.random() < 0.5) psay("Yes, Master.", 1800);
  }
  function schedule(ms) {
    clearTimeout(P.tm);
    P.tm = setTimeout(function () { play(P.last === "sway" ? "murmur" : "sway"); }, ms);
  }
  var WAKE = { happy: 1, surprised: 1, angry: 1, confused: 1 }, lastPM = "neutral";
  function petMood(m) {
    if (m === lastPM) return;
    var was = lastPM; lastPM = m;
    if (P.drag) return;
    if (m === "sleepy" || m === "sleeping") { clearTimeout(P.tm); P.hold = true; showF(3); psay("...", 1500); return; }
    if (P.hold) { P.hold = false; showF(4); phop(); psay("...Master?", 1800); schedule(1400); return; }
    if (WAKE[m]) { phop(); play("murmur"); }
  }
  function pstep(dt) {
    if (P.drag) return;
    if (P.lift > 0) {
      P.vy += 2400 * dt; P.lift -= P.vy * dt;
      if (P.lift <= 0) { P.lift = 0; P.vy = 0; showF(4); phop(); schedule(900); }
      return;
    }
    var b = pbounds(); P.x = Math.min(b.r, Math.max(b.l, P.x));
  }
  function prender() {
    var H = pet.offsetHeight || 190;
    pet.style.transform = "translate(" + P.x.toFixed(1) + "px," + (pground() - H * 0.956 - P.lift).toFixed(1) + "px)";
  }
  var plast = 0;
  function ptick(ts) {
    var dt = Math.min(0.05, (ts - plast) / 1000); plast = ts;
    if (!document.hidden) { pstep(dt); prender(); }
    requestAnimationFrame(ptick);
  }
  pfig.addEventListener("pointerdown", function (e) {
    e.preventDefault();
    var sx = e.clientX, sy = e.clientY, moved = false;
    function mv(ev) {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 7) return;
      if (!moved) { moved = true; P.drag = true; clearTimeout(P.tm); pet.classList.add("drag"); showF(2); bub.classList.remove("show"); }
      var H = pet.offsetHeight, w = pet.offsetWidth;
      P.x = ev.clientX - w / 2; P.lift = Math.max(0, pground() - H * 0.956 - (ev.clientY - H * 0.1)); P.vy = 0;
    }
    function up() {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up);
      if (moved) { P.drag = null; pet.classList.remove("drag"); if (P.lift <= 0) { showF(0); schedule(800); } }
      else if (P.hold) { P.hold = false; showF(4); phop(); psay("...Master?", 1800); schedule(1400); }
      else { phop(); play("murmur"); psay("Yes, Master.", 1800); }
    }
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
  });
  (function () { var b = pbounds(); P.x = (b.l + b.r) / 2; prender(); schedule(1200); requestAnimationFrame(function (t) { plast = t; ptick(t); }); })();

  /* ---------- Theme ---------- */
  var root = document.documentElement;
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  function isDark() {
    var t = root.getAttribute("data-theme");
    return t ? t === "dark" : mq.matches;
  }
  function syncThemeIcon() {
    $("#ico-sun").hidden = isDark();
    $("#ico-moon").hidden = !isDark();
  }
  var savedTheme = store.get("emilly:theme", null);
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  syncThemeIcon();
  if (mq.addEventListener) mq.addEventListener("change", syncThemeIcon);
  $("#theme").addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("emilly:theme", next);
    syncThemeIcon();
    flash(next === "dark" ? "sleepy" : "happy", 2200);
  });

  /* ---------- Views (hash routing) ---------- */
  var views = { chat: $("#view-chat"), history: $("#view-history"), settings: $("#view-settings") };
  function route() {
    var h = (location.hash || "#chat").slice(1);
    if (!views[h]) h = "chat";
    Object.keys(views).forEach(function (k) {
      views[k].hidden = k !== h;
      var a = $("#nav-" + k);
      if (k === h) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    $("#newchat").hidden = h !== "chat";
    if (h === "history") renderHistory();
    if (h === "chat") scrollLog();
  }
  window.addEventListener("hashchange", route);


  /* ---------- Rendering ---------- */
  var log = $("#log"), stage = $("#stage");
  function syncStage() {
    var has = current.turns.length > 0;
    log.hidden = !has;
    stage.hidden = has;
    if (has) document.body.setAttribute("data-chatting", ""); else document.body.removeAttribute("data-chatting");
  }
  function scrollLog() { log.scrollTop = log.scrollHeight; }

  function makeRow(role) {
    var row = document.createElement("div");
    row.className = "row " + (role === "user" ? "me" : "bot");
    var av = null;
    if (role !== "user") {
      av = document.createElement("div");
      av.className = "av";
      setAvatar(av, "neutral");
      row.appendChild(av);
    }
    var b = document.createElement("div");
    b.className = "bubble";
    row.appendChild(b);
    return { row: row, bubble: b, av: av };
  }
  function addBubble(role, text, opts) {
    opts = opts || {};
    var r = makeRow(role);
    if (opts.imageUrl) {
      var im = document.createElement("img");
      im.src = opts.imageUrl; im.alt = "Attached image";
      r.bubble.appendChild(im);
    }
    if (opts.typing) {
      var d = document.createElement("span");
      d.className = "dots"; d.innerHTML = "<i></i><i></i><i></i>";
      d.setAttribute("aria-label", "Emilly is typing");
      r.bubble.appendChild(d);
      if (r.av) setAvatar(r.av, "thinking");
    } else if (text) {
      r.bubble.appendChild(document.createTextNode(text));
    }
    log.appendChild(r.row);
    scrollLog();
    return r;
  }
  function setBubbleText(r, text) {
    r.bubble.textContent = text;
  }
  function renderLog() {
    log.textContent = "";
    current.turns.forEach(function (t) { addBubble(t.role, t.content); });
    syncStage();
    scrollLog();
  }

  /* ---------- Sessions ---------- */
  function persist() {
    if (!current.turns.length) return;
    var first = current.turns.find(function (t) { return t.role === "user"; });
    var title = first ? first.content.replace(/\s+/g, " ").slice(0, 60) : "Chat";
    var entry = { id: current.id, title: title, ts: Date.now(), turns: current.turns.slice(-60) };
    var i = sessions.findIndex(function (s) { return s.id === current.id; });
    if (i >= 0) sessions[i] = entry; else sessions.unshift(entry);
    sessions.sort(function (a, b) { return b.ts - a.ts; });
    sessions = sessions.slice(0, 30);
    store.set("emilly:sessions", sessions);
  }
  function newChat() {
    if (busy && ctl) ctl.abort();
    current = { id: uid(), turns: [] };
    pendingImage = null; activeImage = null; syncChip();
    renderLog();
    $("#msg").focus();
    flash("happy", 1800);
  }
  $("#newchat").addEventListener("click", newChat);

  /* ---------- History view ---------- */
  function renderHistory() {
    var list = $("#hist-list");
    list.textContent = "";
    if (!sessions.length) {
      var e = document.createElement("div");
      e.className = "empty";
      var av = document.createElement("div");
      av.className = "av"; setAvatar(av, "sleepy");
      var tx = document.createElement("div");
      tx.innerHTML = "No conversations yet.<br>Say hi to Emilly and she will keep them here.";
      var b = document.createElement("button");
      b.className = "btn"; b.type = "button"; b.textContent = "Start chatting";
      b.addEventListener("click", function () { location.hash = "#chat"; $("#msg").focus(); });
      e.appendChild(av); e.appendChild(tx); e.appendChild(b);
      list.appendChild(e);
      return;
    }
    sessions.forEach(function (s) {
      var item = document.createElement("div");
      item.className = "hist";
      var open = document.createElement("button");
      open.className = "open"; open.type = "button";
      var t = document.createElement("b"); t.textContent = s.title;
      var m = document.createElement("span");
      var d = new Date(s.ts);
      m.textContent = s.turns.length + " messages · " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      open.appendChild(t); open.appendChild(m);
      open.addEventListener("click", function () {
        if (busy && ctl) ctl.abort();
        current = { id: s.id, turns: s.turns.slice() };
        renderLog();
        location.hash = "#chat";
      });
      var del = document.createElement("button");
      del.className = "del"; del.type = "button"; del.setAttribute("aria-label", "Delete this conversation");
      del.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
      del.addEventListener("click", function () {
        sessions = sessions.filter(function (x) { return x.id !== s.id; });
        store.set("emilly:sessions", sessions);
        if (current.id === s.id) { current = { id: uid(), turns: [] }; renderLog(); }
        renderHistory();
      });
      item.appendChild(open); item.appendChild(del);
      list.appendChild(item);
    });
  }

  /* ---------- Settings ---------- */
  $("#set-name").value = settings.name;
  function saveSettings() { store.set("emilly:settings", settings); }
  $("#set-name").addEventListener("input", function (e) { settings.name = e.target.value.trim(); saveSettings(); });
  function resetClearBox() {
    var box = $("#clear-box");
    box.textContent = "";
    var b = document.createElement("button");
    b.className = "btn danger"; b.type = "button"; b.id = "clear"; b.textContent = "Clear all history";
    b.addEventListener("click", askClear);
    box.appendChild(b);
  }
  function askClear() {
    var box = $("#clear-box");
    box.textContent = "";
    var wrap = document.createElement("span");
    wrap.className = "confirm";
    var yes = document.createElement("button");
    yes.className = "btn danger"; yes.type = "button"; yes.textContent = "Yes, clear it";
    var no = document.createElement("button");
    no.className = "btn alt"; no.type = "button"; no.textContent = "Cancel";
    yes.addEventListener("click", function () {
      sessions = []; store.set("emilly:sessions", sessions);
      current = { id: uid(), turns: [] }; renderLog(); resetClearBox();
    });
    no.addEventListener("click", resetClearBox);
    wrap.appendChild(yes); wrap.appendChild(no);
    box.appendChild(wrap);
  }
  $("#clear").addEventListener("click", askClear);

  /* ---------- Claude connection ---------- */
  function getSample() {
    if (!samplePromise) {
      samplePromise = (window.claude && window.claude.use ? window.claude.use("sample") : Promise.resolve(null)).catch(function () { return null; });
    }
    return samplePromise;
  }
  getSample().then(function (s) {
    if (!s || !s.limits) return;
    s.limits().then(function (l) {
      if (l && l.images) {
        $("#file").accept = (l.images.mediaTypes || ["image/*"]).join(",");
        $("#clip").hidden = false;
      }
    }).catch(function () {});
  });

  function buildRules() {
    var tone = {
      sweet: "Soft, cheerful and a little playful. You may use an occasional ♡, ~ or ✦, but never more than one or two per reply.",
      casual: "Relaxed, like a close friend. Short sentences, easy words, no emoticons.",
      neutral: "Calm, clear and kind. No emoticons or decorative symbols."
    }[settings.style];
    return "You are Emilly, a gentle chibi-style AI companion inside a chat app. " +
      "Reply in the language the user writes in (Indonesian if it is unclear). " + tone + " " +
      "Keep replies short, usually one to three small paragraphs, unless the user asks for detail. " +
      "Help properly with questions, writing, studying, code and advice. If you do not know something, say so. " +
      "Write plain text only: no markdown headings, bold or tables. A short list with '-' is fine; put code on its own lines. " +
      (settings.name ? "The user likes to be called " + settings.name + ". " : "") +
      "Never claim to be human.";
  }

  var ERR = {
    unavailable: "I can't reach my thinking part from here. Replies work when this page is opened inside Claude.",
    not_granted: "I need your okay to use Claude for replies. Send again and allow it when asked.",
    sampling_disabled: "Claude isn't available for this account right now, so I can't answer.",
    rate_limited: "That was a lot at once. Give me a moment, then try again.",
    session_expired: "Your session expired. Please sign in again and resend.",
    image_rejected: "I couldn't read that image. Try a different one (JPEG, PNG, WebP or GIF).",
    refused: "I can't help with that one. Try asking in a different way.",
    empty_completion: "I came up blank. Try rephrasing your message.",
    upstream_error: "Something interrupted me. Tap retry to continue."
  };
  var RETRY = { upstream_error: 1, rate_limited: 1, empty_completion: 1, session_expired: 1 };

  function clearNotes() {
    log.querySelectorAll(".note").forEach(function (n) { n.remove(); });
  }
  function showNote(code) {
    clearNotes();
    var n = document.createElement("div");
    n.className = "note";
    var s = document.createElement("span");
    s.textContent = ERR[code] || ERR.upstream_error;
    n.appendChild(s);
    if (RETRY[code]) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = "Retry";
      b.addEventListener("click", function () { if (!busy) { clearNotes(); generate(); } });
      n.appendChild(b);
    }
    log.appendChild(n);
    scrollLog();
  }

  function setBusy(v) {
    busy = v;
    var s = $("#send");
    s.classList.toggle("busy", v);
    s.setAttribute("aria-label", v ? "Stop" : "Send");
    if (v) typing = false;
    paint();
  }

  async function generate() {
    setBusy(true);
    var r = addBubble("assistant", "", { typing: true });
    ctl = new AbortController();
    var shown = "";
    var outcome = "ok";
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctl.signal,
        body: JSON.stringify({ turns: current.turns.slice(-20), name: settings.name, style: settings.style })
      });
      if (!res.ok) throw { code: "upstream_error" };
      var text = (await res.json()).text;
      setBubbleText(r, text);
      if (r.av) setAvatar(r.av, "neutral");
      current.turns.push({ role: "assistant", content: text });
      activeImage = null;
      persist();
    } catch (e) {
      var code = (e && e.code) || "upstream_error";
      var partial = (e && e.text) || shown;
      outcome = code === "cancelled" ? "cancel" : "error";
      if (partial && code !== "refused") {
        setBubbleText(r, partial);
        if (r.av) setAvatar(r.av, "neutral");
        current.turns.push({ role: "assistant", content: partial });
        persist();
      } else {
        r.row.remove();
      }
      if (code !== "cancelled") showNote(code);
      if (code === "cancelled") activeImage = null;
    } finally {
      ctl = null;
      setBusy(false);
    }
    if (outcome === "ok") flash("happy", 3000);
    else if (outcome === "error") flash("confused", 3500);
    else flash("confused", 1500);
  }

  /* ---------- Composer ---------- */
  var msg = $("#msg");
  function autosize() {
    msg.style.height = "auto";
    msg.style.height = Math.min(msg.scrollHeight, 130) + "px";
  }
  msg.addEventListener("input", function () {
    autosize();
    typing = !busy && msg.value.trim().length > 0;
    paint();
  });
  msg.addEventListener("blur", function () { typing = false; paint(); });
  msg.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $("#form").requestSubmit();
    }
  });
  $("#form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) { if (ctl) ctl.abort(); return; }
    var text = msg.value.trim();
    if (!text && !pendingImage) return;
    clearNotes();
    var turnText = text || "(I sent you an image)";
    current.turns.push({ role: "user", content: turnText });
    syncStage();
    addBubble("user", text, { imageUrl: pendingImage ? pendingImage.url : null });
    activeImage = pendingImage;
    pendingImage = null; syncChip();
    msg.value = ""; autosize();
    typing = false;
    var s = $("#send"); restart(s, "fly");
    persist();
    generate();
  });
  document.querySelectorAll("#sugs button").forEach(function (b) {
    b.addEventListener("click", function () { if (busy) return; msg.value = b.textContent; autosize(); $("#form").requestSubmit(); });
  });
  $("#send").addEventListener("animationend", function (e) { e.currentTarget.classList.remove("fly"); });

  /* ---------- Image attach ---------- */
  function syncChip() {
    var c = $("#chip");
    c.classList.toggle("on", !!pendingImage);
    $("#chip-img").src = pendingImage ? pendingImage.url : "";
  }
  $("#clip").addEventListener("click", function () { $("#file").click(); });
  $("#file").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    pendingImage = { file: f, url: URL.createObjectURL(f) };
    syncChip();
    msg.focus();
    flash("surprised", 1400);
  });
  $("#chip-x").addEventListener("click", function () {
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    pendingImage = null; syncChip();
  });

  /* ---------- Boot ---------- */
  syncStage();
  route();
  resetIdle();
  scheduleBlink();
  flash("happy", 2200);
})();
