(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const toast = (m) => { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2800); };
  // На сайте GitHub страница обращается к заводу через туннель: CF_API — его адрес, токен — после входа.
  const API = String(window.CF_API || "").replace(/\/$/, "");
  const ls = { get: (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
               set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} } };
  let token = ls.get("cf-token");
  const hdr = () => token ? { Authorization: "Bearer " + token } : {};
  function needLogin() {
    if ($("authDlg").open) return;
    $("authMsg").textContent = ""; $("authDlg").showModal(); $("authUser").focus();
  }
  async function api(path, body) {
    const r = await fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json", ...hdr() }, body: JSON.stringify(body || {}) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { needLogin(); throw new Error(d.error || "нужен вход"); }
    if (!r.ok) throw new Error(d.error || "ошибка " + r.status);
    return d;
  }
  $("authForm").onsubmit = async (e) => {
    e.preventDefault();
    $("authMsg").textContent = "";
    try {
      const r = await fetch(API + "/api/auth", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: $("authUser").value, password: $("authPass").value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "ошибка " + r.status);
      token = d.token; ls.set("cf-token", token);
      $("authPass").value = ""; $("authDlg").close(); load(true);
    } catch (err) { $("authMsg").textContent = err.message === "Failed to fetch" ? "Завод не отвечает — компьютер выключен или нет интернета" : err.message; }
  };
  $("authDlg").addEventListener("cancel", (e) => e.preventDefault());
  $("logoutBtn").onclick = async () => { try { await api("/api/logout"); } catch (e) {} token = ""; ls.set("cf-token", ""); needLogin(); };
  const readFile = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
  const DAYS = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"];
  const pad = (n) => String(n).padStart(2, "0");
  const localInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const human = (s) => { if (!s) return ""; const d = new Date(s.replace(" ", "T")); return `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  let state = null, editing = false, kind = "post", refs = [];
  const P = () => state?.profile || {};

  // ── форма ──
  function drawForm() {
    document.querySelectorAll("#kindSeg button").forEach(b => b.classList.toggle("on", b.dataset.kind === kind));
    const n = kind === "slides" ? [3, 4, 5, 6, 7, 8] : kind === "ad" ? [3, 4, 5, 6] : [1, 2, 3, 4, 5];
    const cur = +$("count").value || (kind === "slides" ? 5 : kind === "ad" ? 5 : 3);
    $("count").innerHTML = n.map(x => `<option ${x === cur ? "selected" : ""}>${x}</option>`).join("");
    if (!n.includes(cur)) $("count").value = String(kind === "post" ? 3 : 5);
    $("countLbl").textContent = kind === "slides" ? "Слайдов (без обложки)" : kind === "ad" ? "Кадров в видео" : "Фото";
    $("count").disabled = !!refs.length && kind !== "slides";
    $("aspectBox").hidden = kind === "ad";
    $("refsNoteBox").hidden = !refs.length;
    $("igAcc").textContent = P().instagram ? "→ @" + P().instagram : "аккаунт Instagram не указан (⚙)";
    $("howHint").textContent = (kind === "slides"
      ? "Claude напишет слайды и подпись и подберёт фото для обложки, текст на слайды завод наложит сам — его можно править."
      : kind === "ad" ? "Claude подберёт фото и видеоклипы бренда и напишет подпись, завод соберёт Reels под Instagram: 9:16, 1080×1920, 10–20 сек, до 30 МБ."
      : "Claude напишет подпись и подберёт фото из библиотеки бренда.") + " После одобрения пост ждёт в «Запланировано», пока вы не поставите дату.";
  }
  $("kindSeg").onclick = (e) => { const b = e.target.closest("[data-kind]"); if (b) { kind = b.dataset.kind; $("count").value = ""; drawForm(); } };
  async function addFiles(files) {
    for (const f of files) {
      if (!f.type.startsWith("image/") || refs.length >= 10) continue;
      refs.push(await readFile(f));
    }
    drawThumbs();
  }
  function drawThumbs() {
    $("thumbs").innerHTML = refs.map((u, i) => `<span><img src="${u}" alt=""><button data-rm="${i}" aria-label="Убрать фото">✕</button></span>`).join("");
    drawForm();
  }
  $("thumbs").onclick = (e) => { if (e.target.dataset.rm) { refs.splice(+e.target.dataset.rm, 1); drawThumbs(); } };
  $("file").onchange = (e) => { addFiles(e.target.files); e.target.value = ""; };
  $("drop").ondragover = (e) => { e.preventDefault(); $("drop").classList.add("over"); };
  $("drop").ondragleave = () => $("drop").classList.remove("over");
  $("drop").ondrop = (e) => { e.preventDefault(); $("drop").classList.remove("over"); addFiles(e.dataTransfer.files); };
  document.addEventListener("paste", (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length && !e.target.closest(".job") && !e.target.closest("dialog")) addFiles(files);
  });
  $("createBtn").onclick = async () => {
    $("msg").textContent = "";
    const b = $("createBtn"); b.disabled = true;
    try {
      await api("/api/jobs", { kind, title: $("title").value, brief: $("brief").value, refs, refs_note: $("refsNote").value,
        aspect: $("aspect").value, count: +$("count").value, lang: $("lang").value, story: $("story").checked });
      $("title").value = ""; $("brief").value = ""; $("refsNote").value = ""; refs = []; drawThumbs();
      tab = "work"; toast("Задание запущено"); load(true);
    } catch (e) { $("msg").textContent = e.message; }
    finally { b.disabled = false; }
  };

  // ── библиотека и неделя ──
  $("libFile").onchange = async (e) => {
    const files = [...e.target.files].filter(f => /^(image|video)\//.test(f.type)).slice(0, 30);
    e.target.value = "";
    if (!files.length) return;
    const big = files.find(f => f.type.startsWith("video/") && f.size > 60e6);
    if (big) { toast(`«${big.name}» больше 60 МБ — сократите или сожмите видео`); return; }
    try {
      toast("Загружаю…");
      const data = await Promise.all(files.map(async f => ({ name: f.name, data: await readFile(f) })));
      const r = await api("/api/library", { files: data });
      toast(`Добавлено: ${r.added}. Claude опишет и проверит их на запреты за пару минут`); lib = null; load(true);
    } catch (err) { toast(err.message); }
  };
  $("wkRun").onclick = async () => {
    const w = state?.settings?.weekly || {};
    if (!confirm(`Сделать пачку из ${w.count || 20} постов сейчас? Claude будет писать ~5–15 минут.`)) return;
    try { await api("/api/weekly"); toast("Готовлю посты — они появятся в «Запланировано»"); load(true); } catch (e) { toast(e.message); }
  };
  function drawWeek() {
    const w = state.settings.weekly, wk = state.week, lib = wk.library;
    $("wkInfo").textContent = w.enabled
      ? `Каждую неделю в ${DAYS[w.weekday]} в ${pad(w.hour)}:00 — ${w.count} постов: ${w.video || 0} видео Reels и ${w.count - (w.video || 0)} фото-постов (казахских: ${w.kz}, кликбейтных: ${w.clickbait}), каждый с репостом в сторис. Следующая пачка: ${human(wk.next + ":00")}.`
      : "Автоматическая пачка выключена (⚙ Настройки).";
    $("wkNote").innerHTML = wk.busy ? `<span class="spin" style="display:inline-block;width:10px;height:10px;border:2px solid var(--accent);border-right-color:transparent;border-radius:50%;animation:s 1s linear infinite;margin-right:6px"></span>${esc(wk.note)}` : esc(wk.note || "");
    $("wkErr").hidden = !wk.error; $("wkErr").textContent = wk.error || "";
    $("wkRun").disabled = wk.busy;
    $("libInfo").textContent = `Библиотека: фото ${lib.total}, можно в посты ${lib.allowed}` + (lib.banned ? `, под запретом ${lib.banned}` : "")
      + (lib.clips ? ` · видеоклипов ${lib.clips_allowed} из ${lib.clips}` : "") + (lib.describing ? ` · ${lib.note || "Claude проверяет…"}` : "");
  }

  // ── очередь ──
  const TABS = [
    ["review", "На одобрении", j => j.status === "review"],
    ["sched", "Запланировано", j => j.status === "scheduled"],
    ["work", "В работе", j => ["queued", "working", "approved", "publishing", "error"].includes(j.status)],
    ["done", "Опубликовано", j => j.status === "published"],
    ["all", "Все", () => true],
  ];
  let tab = "sched";
  const ST = { queued: "в очереди", working: "в работе", review: "на одобрении", approved: "публикуется", publishing: "публикуется",
               published: "опубликовано", scheduled: "запланировано", error: "ошибка", rejected: "отклонено" };
  const KIND = { post: "🖼 фото-пост", slides: "📝 карусель", ad: "🎬 видео" };
  const arCss = (a) => (a || "4:5").replace(":", "/");
  const f = (j, name, v) => {
    const q = [v ? "v=" + v : "", token && API ? "t=" + encodeURIComponent(token) : ""].filter(Boolean).join("&");
    return `${API}/files/${j.id}/${encodeURIComponent(name)}${q ? "?" + q : ""}`;
  };
  const editable = (j) => ["review", "scheduled", "error", "rejected"].includes(j.status);

  const photoEditable = (j) => editable(j) && !j.refs?.length;
  const srcs = (j) => (j.assets || []).map(a => a.src || "");
  const MINP = { post: 1, ad: 2, slides: 1 };
  function assetHtml(j, a) {
    const busy = ["queued", "working", "publishing", "approved"].includes(j.status);
    const clip = (a.src || "").startsWith("video/");
    const media = a.image ? `<div class="media"><a href="${f(j, a.image)}" target="_blank" style="display:contents"><img src="${f(j, a.image)}" alt="Кадр ${a.n + 1}" loading="lazy"></a>${clip ? `<span class="clipmark">🎬 клип</span>` : ""}</div>`
      : `<div class="media">${busy ? "готовится…" : "нет"}</div>`;
    if (!photoEditable(j)) return `<div class="asset">${media}</div>`;
    const n = j.assets.length, i = a.n, id = `${j.id}|${i}`;
    const tools = j.kind === "slides"
      ? `<button data-redo="${id}" title="Claude подберёт другое фото">↻</button><button data-pick="${id}" title="Выбрать фото из библиотеки">🖼 выбрать</button>`
      : `<button data-move="${id}|-1" ${i === 0 ? "disabled" : ""} title="Левее">◀</button>
         <button data-redo="${id}" ${a.src ? "" : "disabled"} title="Claude подберёт другое">↻</button>
         <button data-pick="${id}" title="Заменить фото из библиотеки">🖼</button>
         <button data-rm="${id}" ${n <= (MINP[j.kind] || 1) ? "disabled" : ""} title="Убрать из поста">✕</button>
         <button data-move="${id}|1" ${i === n - 1 ? "disabled" : ""} title="Правее">▶</button>`;
    return `<div class="asset">${media}<div class="ab">${tools}</div></div>`;
  }
  function musicHtml(j) {
    if (j.kind !== "ad") return "";
    const mu = j.music || {}, st = state.music_styles || {};
    if (!photoEditable(j)) return mu.name ? `<div class="vinfo">🎵 ${esc(mu.name)}</div>` : "";
    return `<div class="when" style="margin:0 0 8px"><span class="hint">🎵 Музыка:</span>
      <select data-music="${j.id}" ${mu.own ? "disabled title='Берутся ваши треки из папки library\\${esc(P().id)}\\music'" : ""}>${Object.entries(st).map(([k, v]) => `<option value="${k}" ${mu.style === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select>
      <button class="btn ghost small" data-reroll="${j.id}" title="Завод сочинит другую мелодию в этом же стиле">🔀 другая мелодия</button>
      ${mu.own ? `<span class="hint">${esc(mu.name || "")}</span>` : ""}</div>`;
  }
  function addTileHtml(j) {
    if (!photoEditable(j) || j.kind === "slides" || (j.assets || []).length >= 10) return "";
    return `<div class="asset add"><button data-pick="${j.id}|add">+ ${j.kind === "ad" ? "фото или клип" : "фото"} из библиотеки</button>
      <label>📤 загрузить своё<input type="file" data-up="${j.id}" accept="image/*${j.kind === "ad" ? ",video/mp4,video/quicktime,video/webm" : ""}" class="vh"></label></div>`;
  }

  function slidesHtml(j) {
    const ed = editable(j);
    const pics = (j.slide_files || []).map((n, i) => `<div class="asset"><div class="media"><a href="${f(j, n, j.slides_v)}" target="_blank" style="display:contents"><img src="${f(j, n, j.slides_v)}" alt="Слайд ${i + 1}" loading="lazy"></a></div>${i === 0 && ed && !j.refs?.length ? `<div class="ab"><button data-redo="${j.id}|0" title="Claude подберёт другое фото">↻ обложка</button><button data-pick="${j.id}|0" title="Выбрать фото обложки из библиотеки">🖼 выбрать</button></div>` : ""}</div>`).join("");
    const box = ed && j.slides?.length ? `<details style="margin-bottom:10px"><summary class="hint" style="cursor:pointer">✎ Текст слайдов</summary><div class="slides-ed" data-slides="${j.id}" style="margin-top:8px">
        ${j.slides.map((s, i) => `<div class="sl"><b>${i === 0 ? "обл." : i}</b><div>
          <input data-st="title" value="${esc(s.title)}" placeholder="Заголовок">
          <textarea data-st="text" rows="${i === 0 ? 1 : 2}" placeholder="${i === 0 ? "Подзаголовок (можно пусто)" : "Текст слайда"}">${esc(s.text)}</textarea></div></div>`).join("")}
        <div class="acts"><button class="btn ghost small" data-slidesave="${j.id}">↻ Перерисовать слайды</button></div>
      </div></details>` : "";
    return (pics ? `<div class="assets">${pics}</div>` : (j.assets?.length ? `<div class="assets">${j.assets.map(a => assetHtml(j, a)).join("")}</div>` : "")) + box;
  }

  function whenHtml(j) {
    const min = localInput(new Date(Date.now() + 2 * 60000));
    const v = j.publish_at ? j.publish_at.slice(0, 16).replace(" ", "T") : "";
    return `<span class="when ${v ? "" : "unset"}"><span class="hint">🗓 Публикация:</span>
      <input type="datetime-local" data-when="${j.id}" value="${v}" min="${min}" step="300">
      ${v ? `<button class="btn ghost small" data-act="clear_time">Снять дату</button>` : `<span class="hint" style="color:var(--warn)">выберите день и время</span>`}</span>`;
  }

  function jobHtml(j) {
    const pub = j.published || {};
    const review = j.status === "review", sched = j.status === "scheduled", ed = editable(j);
    const spin = ["queued", "working", "approved", "publishing"].includes(j.status);
    const loginErr = j.error_kind === "login" || /Войти/.test(j.error || "");
    const ro = ed ? "" : "readonly";
    return `<section class="card job" data-job="${j.id}" style="--ar:${arCss(j.aspect)}">
      <div class="jh"><span class="t">${esc(j.title)}</span>
        ${j.lang === "kz" ? `<span class="tag">🇰🇿 қаз</span>` : ""}${j.clickbait ? `<span class="tag">🔥 кликбейт</span>` : ""}
        <span class="badge">${KIND[j.kind] || j.kind} · ${esc(j.aspect)}</span>
        <span class="st ${j.status}">${ST[j.status] || j.status}</span></div>
      <div class="stage">${spin ? '<span class="spin"></span>' : ""}${esc(j.stage || "")} <span class="hint">· создано ${esc(j.created.slice(5, 16))}</span>${j.publish_at && j.status !== "published" ? ` <b>· 🗓 ${esc(human(j.publish_at))}</b>` : ""}</div>
      ${j.error ? `<div class="err">${esc(j.error)}</div>` : ""}
      ${j.concept?.idea ? `<div class="idea" style="border:none;padding:0;margin-bottom:8px">💡 ${esc(j.concept.idea)}</div>` : ""}
      ${j.final_video ? `<div class="assets" style="grid-template-columns:minmax(180px,240px)"><div class="asset"><div class="media" style="aspect-ratio:9/16"><video src="${f(j, j.final_video)}" controls playsinline preload="metadata"></video></div></div></div>
        ${j.video_info ? `<div class="vinfo">Reels: ${j.video_info.w}×${j.video_info.h}, ${j.video_info.dur} сек, ${j.video_info.mb} МБ${j.video_info.db != null ? " · 🔊 со звуком" : ""} — готово для Instagram</div>` : ""}
        ${musicHtml(j)}
        <div class="hint" style="margin:-4px 0 4px">Кадры видео по порядку${photoEditable(j) ? " — меняйте, видео пересоберётся само" : ""}:</div>` : ""}
      ${j.kind === "slides" ? slidesHtml(j) : (j.assets?.length || photoEditable(j) ? `<div class="assets">${(j.assets || []).map(a => assetHtml(j, a)).join("")}${addTileHtml(j)}</div>` : "")}
      ${j.caption || review ? `<div class="edit">
        <label>Название (видно только здесь)<input data-ed="title" maxlength="120" value="${esc(j.title)}" ${ro}></label>
        <label>Подпись Instagram<textarea data-ed="caption" rows="6" ${ro}>${esc(j.caption)}</textarea></label>
        <label>Хештеги<input data-ed="hashtags" value="${esc((j.hashtags || []).join(" "))}" ${ro}></label>
      </div>` : ""}
      ${j.story ? `<div class="row-story">${j.story_image ? `<a href="${f(j, j.story_image)}" target="_blank"><img class="storyimg" src="${f(j, j.story_image)}" alt="Сторис" loading="lazy"></a>` : ""}
        <div class="edit"><label>Заголовок сторис<input data-ed="story_title" maxlength="80" value="${esc(j.story_title || "")}" ${ro}></label>
        <span class="hint">Сторис-репост выйдет сразу после поста.</span></div></div>` : ""}
      ${pub.instagram?.ok ? `<div class="links"><a href="${esc(pub.instagram.url || "https://www.instagram.com/")}" target="_blank" rel="noopener">Instagram ↗</a>${pub.story?.ok ? `<a href="${esc(pub.story.url || "https://www.instagram.com/")}" target="_blank" rel="noopener">Сторис ↗</a>` : ""}<span class="hint">${esc((pub.instagram.at || "").slice(5, 16))}</span></div>` : ""}
      <div class="acts main">
        ${sched ? whenHtml(j) : ""}
        ${review ? `<button class="btn ok small" data-act="approve">✓ Одобрить → в «Запланировано»</button>
          <button class="btn ghost small" data-act="concept">Другая идея…</button>` : ""}
        ${sched || review ? `<button class="btn ghost small" data-act="publish_now">Опубликовать сейчас</button>` : ""}
        ${j.status === "error" ? `${loginErr ? `<button class="btn small" data-login>🔑 Войти</button>` : ""}<button class="btn small" data-act="retry">Повторить</button>` : ""}
        <span class="grow"></span>
        ${sched ? `<button class="btn ghost small" data-act="unschedule" title="Вернуть на одобрение">↩</button>` : ""}
        ${review ? `<button class="btn ghost small" data-act="reject">Отклонить</button>` : ""}
        ${spin ? "" : `<button class="btn danger small" data-act="delete">Удалить</button>`}
      </div>
    </section>`;
  }

  function planbarHtml(list) {
    const free = list.filter(j => !j.publish_at).length;
    if (!free) return "";
    const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0);
    return `<div class="card planbar"><b>Без даты: ${free}</b>
      <span>Расставить с</span><input type="datetime-local" id="planStart" value="${localInput(d)}" step="300">
      <span>каждые</span><input type="number" id="planEvery" value="${+localStorage.getItem("cf-every") || 8}" min="0.25" step="0.25"><span>ч</span>
      <button class="btn small" id="planGo">Расставить</button>
      <span class="hint">или поставьте дату каждому посту ниже</span></div>`;
  }

  function render() {
    if (!state) return;
    const jobs = state.jobs;
    $("tabs").innerHTML = TABS.map(([k, name, fn]) => {
      const n = jobs.filter(fn).length;
      return `<button class="tab ${tab === k ? "on" : ""}" data-tab="${k}">${name}${n && k !== "all" ? `<b>${n}</b>` : ""}</button>`;
    }).join("");
    let list = jobs.filter(TABS.find(t => t[0] === tab)[2]);
    if (tab === "sched") {  // сначала без даты (их надо расставить), потом по времени выхода
      list.sort((a, b) => (!!a.publish_at - !!b.publish_at) || (a.publish_at || a.created).localeCompare(b.publish_at || b.created));
    }
    $("planbar").innerHTML = tab === "sched" ? planbarHtml(list) : "";
    $("jobs").innerHTML = list.length ? list.map(jobHtml).join("")
      : `<div class="card empty">${tab === "sched" ? "Нет запланированных постов." : tab === "review" ? "Нечего одобрять." : "Пусто"}</div>`;
  }

  function renderPills() {
    const ai = state.ai;
    $("aiPill").className = "pill " + (ai.ok ? "ok" : ai.ok === false ? "err" : "");
    $("aiPill").textContent = "Claude: " + ai.note;
    const br = state.browser;
    $("brPill").className = "pill " + (state.login_open ? "err" : br.busy ? "busy" : "");
    $("brPill").textContent = state.login_open ? "Открыто окно входа — закройте его, когда войдёте"
      : br.busy ? `Браузер: ${br.busy} (${Math.round(br.for_s / 60)} мин)${br.queue ? ` · ещё ${br.queue}` : ""}` : "Браузер: свободен";
  }

  let first = true, lastKey = "";
  async function load(force) {
    if (editing && !force) return;  // не перерисовывать, пока человек печатает
    try {
      const r = await fetch(API + "/api/state", { headers: hdr() });
      if (r.status === 401) { needLogin(); return; }
      $("offline").hidden = true;
      state = await r.json();
      if (first) {
        first = false; drawForm(); $("story").checked = P().story !== false;
        const ic = P().icon || "🫒", nm = P().name || "";
        if (P().post_aspect) $("aspect").value = P().post_aspect;
        document.title = "Контент-завод " + nm;
        $("brandH1").textContent = `${ic} Контент-завод ${nm}`; $("brandH3").textContent = `${ic} Бренд — Claude читает это в каждом посте`;
        $("authH2").textContent = `${ic} Контент-завод ${nm}`;
        const fav = document.querySelector("link[rel=icon]");
        if (fav) fav.href = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${ic}</text></svg>`;
      }
      $("loginBtn").hidden = !!state.remote; $("logoutBtn").hidden = !state.remote;
      const tn = state.tunnel || {};
      $("netPill").hidden = !!state.remote || !tn.site;
      $("netPill").className = "pill " + (tn.url && tn.note === "работает" ? "ok" : "");
      $("netPill").innerHTML = tn.url && tn.note === "работает" ? `🌍 <a href="${esc(tn.site)}" target="_blank" style="color:inherit">из интернета: вкл</a>` : "🌍 " + esc(tn.note || "");
      renderPills(); drawWeek();
      // задания не изменились — список не трогаем (иначе сбивается прокрутка и перезагружаются видео)
      const key = JSON.stringify(state.jobs);
      if (key === lastKey && !force) return;
      lastKey = key;
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
    } catch (e) { if (API) $("offline").hidden = false; }
  }
  setInterval(load, 3000);
  load();

  $("tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) { tab = b.dataset.tab; render(); } };
  $("planbar").onclick = async (e) => {
    if (e.target.id !== "planGo") return;
    const every = +$("planEvery").value;
    try { localStorage.setItem("cf-every", every); } catch (err) {}
    try { const r = await api("/api/plan", { start: $("planStart").value, every_h: every }); toast(`Даты поставлены: ${r.n}`); load(true); }
    catch (err) { toast(err.message); }
  };
  $("jobs").addEventListener("focusin", (e) => { if (e.target.dataset.ed || e.target.dataset.st || e.target.dataset.when) editing = true; });
  $("jobs").addEventListener("focusout", async (e) => {
    const t = e.target;
    if (t.dataset.st || t.dataset.when) { setTimeout(() => { if (!document.activeElement?.dataset?.st) editing = false; }, 50); return; }
    if (!t.dataset.ed || t.readOnly) { editing = false; return; }
    editing = false;
    const jid = t.closest("[data-job]").dataset.job;
    const job = state.jobs.find(x => x.id === jid) || {};
    const old = t.dataset.ed === "hashtags" ? (job.hashtags || []).join(" ") : job[t.dataset.ed] || "";
    if (t.dataset.ed === "title" && !t.value.trim()) { t.value = old; return; }
    if (t.value === old) return;
    try { await api(`/api/jobs/${jid}/edit`, { [t.dataset.ed]: t.value }); if (t.dataset.ed === "story_title") toast("Сторис перерисована"); } catch (err) { toast(err.message); }
    load(true);
  });
  async function setPhotos(jid, list, msg) {
    const job = state.jobs.find(x => x.id === jid);
    if (list.some(x => !x)) { toast("У старого фото нет источника в библиотеке — сначала замените его через 🖼"); return; }
    try {
      await api(`/api/jobs/${jid}/photos`, { srcs: list }); editing = false;
      toast(msg + (job?.kind === "ad" ? " — видео пересобирается (~1 мин)" : "")); lib = null; load(true);
    } catch (err) { toast(err.message); }
  }
  $("jobs").addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.music) {
      try { await api(`/api/jobs/${t.dataset.music}/music`, { style: t.value }); toast("Музыка: " + t.selectedOptions[0].text + " — видео пересоберётся (~1 мин)"); load(true); }
      catch (err) { toast(err.message); }
      return;
    }
    if (t.dataset.up) {  // своё фото/клип: в библиотеку бренда → в пост
      const file = t.files[0], jid = t.dataset.up; t.value = "";
      if (!file) return;
      if (file.size > 60e6) { toast("Файл больше 60 МБ"); return; }
      try {
        toast("Загружаю…");
        const r = await api("/api/library", { files: [{ name: file.name, data: await readFile(file) }] });
        const job = state.jobs.find(x => x.id === jid);
        await setPhotos(jid, [...srcs(job), ...r.names], "Добавлено в пост и в библиотеку");
      } catch (err) { toast(err.message); }
      return;
    }
    if (!t.dataset.when || !t.value) return;
    try { await api(`/api/jobs/${t.dataset.when}/time`, { publish_at: t.value }); editing = false; toast("Время публикации: " + human(t.value.replace("T", " "))); load(true); }
    catch (err) { toast(err.message); }
  });
  $("jobs").addEventListener("click", async (e) => {
    const t = e.target;
    if (t.closest("[data-login]")) { $("loginBtn").click(); return; }
    const ss = t.closest("[data-slidesave]");
    if (ss) {
      const box = document.querySelector(`[data-slides="${ss.dataset.slidesave}"]`);
      const slides = [...box.querySelectorAll(".sl")].map(r => ({ title: r.querySelector("[data-st=title]").value, text: r.querySelector("[data-st=text]").value }));
      ss.disabled = true;
      try { await api(`/api/jobs/${ss.dataset.slidesave}/slides`, { slides }); editing = false; toast("Слайды перерисованы"); load(true); }
      catch (err) { toast(err.message); ss.disabled = false; }
      return;
    }
    const rr = t.closest("[data-reroll]");
    if (rr) {
      rr.disabled = true;
      try { await api(`/api/jobs/${rr.dataset.reroll}/music`, { reroll: true }); toast("Сочиняю другую мелодию — видео пересоберётся (~1 мин)"); load(true); }
      catch (err) { toast(err.message); rr.disabled = false; }
      return;
    }
    const pk = t.closest("[data-pick]");
    if (pk) { const [jid, n] = pk.dataset.pick.split("|"); openPicker(jid, n); return; }
    const rm = t.closest("[data-rm]");
    if (rm) {
      const [jid, n] = rm.dataset.rm.split("|"), job = state.jobs.find(x => x.id === jid);
      const list = srcs(job); list.splice(+n, 1);
      return setPhotos(jid, list, "Фото убрано");
    }
    const mv = t.closest("[data-move]");
    if (mv) {
      const [jid, n, d] = mv.dataset.move.split("|"), job = state.jobs.find(x => x.id === jid);
      const list = srcs(job), i = +n, k = i + +d;
      if (k < 0 || k >= list.length) return;
      [list[i], list[k]] = [list[k], list[i]];
      return setPhotos(jid, list, "Порядок изменён");
    }
    const redo = t.closest("[data-redo]");
    if (redo) {
      const [jid, n] = redo.dataset.redo.split("|");
      redo.disabled = true;
      try { await api(`/api/jobs/${jid}/redo`, { n: +n }); editing = false; toast("Claude подбирает другое фото…"); load(true); } catch (err) { toast(err.message); redo.disabled = false; }
      return;
    }
    const b = t.closest("[data-act]");
    if (!b) return;
    const card = b.closest("[data-job]"), jid = card.dataset.job;
    let act = b.dataset.act, body = {};
    if (act === "delete" && !confirm("Удалить пост и все его файлы?")) return;
    if (act === "publish_now" && !confirm("Опубликовать в Instagram прямо сейчас?")) return;
    if (act === "clear_time") { act = "time"; body = { publish_at: "" }; }
    if (act === "concept") {
      const fb = prompt("Что изменить? (например: «короче», «больше про рецепт», «другие фото»)");
      if (fb === null) return;
      body = { feedback: fb };
    }
    card.querySelectorAll("[data-ed]").forEach(x => x.blur());
    b.disabled = true;
    try {
      await api(`/api/jobs/${jid}/${act}`, body); editing = false;
      if (act === "approve") toast("Одобрено — поставьте дату в «Запланировано»");
      load(true);
    } catch (err) { toast(err.message); b.disabled = false; }
  });

  // ── выбор фото из библиотеки ──
  let lib = null, pick = null;
  const thumbUrl = (src) => `${API}/lib/${src.split("/").map(encodeURIComponent).join("/")}${token && API ? "?t=" + encodeURIComponent(token) : ""}`;
  async function openPicker(jid, n) {
    const job = state.jobs.find(x => x.id === jid);
    if (!job) return;
    pick = { jid, n, kind: job.kind };
    $("pickTitle").textContent = n === "add" ? (job.kind === "ad" ? "Добавить фото или клип" : "Добавить фото") : `Заменить кадр ${+n + 1}`;
    $("pickQ").value = ""; $("pickGrid").innerHTML = `<p class="hint">Загружаю библиотеку…</p>`;
    $("pickDlg").showModal();
    try {
      if (!lib) lib = await (await fetch(API + "/api/library", { headers: hdr() })).json();
      drawPicker();
    } catch (e) { $("pickGrid").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  }
  function drawPicker() {
    const job = state.jobs.find(x => x.id === pick.jid), taken = new Set(srcs(job));
    const q = $("pickQ").value.trim().toLowerCase();
    const items = (lib.items || []).filter(x => (pick.kind === "ad" || !x.clip) && (!q || (x.desc + " " + x.src).toLowerCase().includes(q)));
    const st = lib.status || {};
    $("pickHint").textContent = `Показаны только разрешённые (${items.length})` + (st.banned ? ` — ${st.banned} фото скрыто по запретам бренда` : "")
      + ". Сначала — которые реже были в постах. Наведите на фото — описание.";
    $("pickGrid").innerHTML = items.map(x => `<button type="button" data-src="${esc(x.src)}" class="${taken.has(x.src) ? "taken" : ""}" title="${esc(x.desc)}${taken.has(x.src) ? " (уже в этом посте)" : ""}">
        <img src="${thumbUrl(x.src)}" alt="${esc(x.desc)}" loading="lazy">${x.clip ? `<span class="c">🎬 ${x.dur} с</span>` : ""}<span class="u">было: ${x.used}</span></button>`).join("")
      || `<p class="hint">Ничего не найдено.</p>`;
  }
  $("pickQ").oninput = () => lib && drawPicker();
  $("pickClose").onclick = () => $("pickDlg").close();
  $("pickGrid").onclick = async (e) => {
    const b = e.target.closest("[data-src]");
    if (!b || b.classList.contains("taken") || !pick) return;
    const job = state.jobs.find(x => x.id === pick.jid), list = srcs(job);
    if (pick.n === "add") list.push(b.dataset.src); else list[+pick.n] = b.dataset.src;
    $("pickDlg").close();
    await setPhotos(pick.jid, list, pick.n === "add" ? "Добавлено" : "Фото заменено");
  };

  // ── идеи ──
  $("ideasBtn").onclick = () => $("ideasDlg").showModal();
  $("ideasClose").onclick = () => $("ideasDlg").close();
  let ideas = [];
  $("ideasGo").onclick = async () => {
    const b = $("ideasGo"); b.disabled = true; b.textContent = "Claude думает…";
    $("ideasList").innerHTML = `<p class="hint">Около минуты…</p>`;
    try {
      ideas = (await api("/api/ideas", { hint: $("ideasHint").value })).ideas;
      $("ideasList").innerHTML = ideas.map((x, i) => `<div class="idea"><div class="it">${KIND[x.kind] || ""} · ${esc(x.title)}</div>
        <div class="ib">${esc(x.brief)}</div><div class="iw">${esc(x.why)}</div>
        <div class="acts" style="margin-top:6px"><button class="btn small" data-take="${i}">В работу →</button></div></div>`).join("") || `<p class="hint">Пусто — попробуйте ещё раз.</p>`;
    } catch (e) { $("ideasList").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    finally { b.disabled = false; b.textContent = "Предложить"; }
  };
  $("ideasList").onclick = (e) => {
    const b = e.target.closest("[data-take]");
    if (!b) return;
    const x = ideas[+b.dataset.take];
    kind = x.kind; $("count").value = ""; drawForm();
    $("title").value = x.title; $("brief").value = x.brief;
    $("ideasDlg").close();
    toast("Тема в форме — нажмите «Запустить»");
  };

  // ── настройки ──
  $("wHour").innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}">${pad(h)}:00</option>`).join("");
  $("setBtn").onclick = () => {
    const s = state?.settings || {}, w = s.weekly || {}, p = P();
    $("wEnabled").checked = !!w.enabled; $("wCount").value = w.count; $("wVideo").value = w.video || 0; $("wKz").value = w.kz; $("wCb").value = w.clickbait;
    $("pBanned").value = p.banned || "";
    $("wDay").value = w.weekday; $("wHour").value = w.hour;
    $("pIg").value = p.instagram || ""; $("pAbout").value = p.about || ""; $("pTopics").value = p.topics || "";
    $("pVoice").value = p.voice || ""; $("pTags").value = p.hashtags || ""; $("pTagsKz").value = p.hashtags_kz || "";
    $("pStory").checked = p.story !== false; $("sVis").checked = !!s.browser_visible;
    $("setDlg").showModal();
  };
  $("sCancel").onclick = () => $("setDlg").close();
  $("sSave").onclick = async () => {
    try {
      await api("/api/settings", {
        browser_visible: $("sVis").checked,
        weekly: { enabled: $("wEnabled").checked, count: +$("wCount").value, video: +$("wVideo").value, kz: +$("wKz").value, clickbait: +$("wCb").value,
                  weekday: +$("wDay").value, hour: +$("wHour").value },
        profile: { instagram: $("pIg").value, about: $("pAbout").value, topics: $("pTopics").value, voice: $("pVoice").value,
                   hashtags: $("pTags").value, hashtags_kz: $("pTagsKz").value, banned: $("pBanned").value, story: $("pStory").checked } });
      lib = null;
      $("setDlg").close(); toast("Сохранено"); load(true);
    } catch (e) { toast(e.message); }
  };

  // ── вход ──
  $("loginBtn").onclick = async () => {
    if (!confirm("Открыть Chrome с Instagram бренда? Пока окно открыто, публикации ждут.")) return;
    const b = $("loginBtn"); b.disabled = true; b.textContent = "Открываю Chrome…";
    try { await api("/api/login"); toast("Войдите в Instagram и закройте окно Chrome"); }
    catch (e) { toast(e.message); }
    finally { b.disabled = false; b.textContent = "🔑 Войти в Instagram"; load(); }
  };
})();
