(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const LAYOUTS = [
    ["t-classic", "Classic", "linear-gradient(160deg,#fff 60%,#1767c7 60%)"],
    ["t-split", "Split", "linear-gradient(#111827 50%,#f4f6f9 50%)"],
    ["t-corporate", "Corporate", "linear-gradient(90deg,#0f766e 14%,#fff 14%)"],
    ["t-midnight", "Midnight", "radial-gradient(circle at 85% 0,#2d5be3,#0b1220 70%)"],
    ["t-minimal", "Minimal", "linear-gradient(#fafaf8 80%,#2d5be3 80%,#2d5be3 86%,#fafaf8 86%)"],
    ["t-bold", "Bold", "#e8590c"],
    ["t-sunset", "Sunset", "linear-gradient(160deg,#ffd9bd,#fff7f0)"]
  ];
  const FONTS = [
    { id: "modern", label: "Modern", family: "Figtree,Arial,sans-serif", weight: 800, size: "17px" },
    { id: "serif", label: "Serif", family: "'Playfair Display',Georgia,serif", weight: 700, size: "18px" },
    { id: "rounded", label: "Rounded", family: "Nunito,Arial,sans-serif", weight: 800, size: "18px" },
    { id: "condensed", label: "Condensed", family: "'Barlow Condensed','Arial Narrow',sans-serif", weight: 700, size: "22px" }
  ];
  const TOGGLES = [["phone", "Phone number"], ["sub", "Tagline"], ["scan", "“Scan to pay” label"], ["foot", "Footer line"]];
  const COLORS = ["#1767c7", "#0f766e", "#e8590c", "#c2255c", "#7048e8", "#111827", "#d4a017"];
  const LOGO_NORMAL = "images/UPI-Normal-Logo.png";
  const LOGO_REVERSE = "images/UPI-Reverse-Logo.png";
  const state = { template: "t-classic", orientation: "portrait", accent: COLORS[0], font: "modern", show: { phone: true, sub: true, scan: true, foot: true }, photoUrl: "", payload: "" };
  const card = $("paymentCard"), qrBox = $("generatedQr"), qrPh = $("qrPlaceholder");
  const inputs = ["personName", "upiId", "businessName", "phone", "qrAmount"].map($);
  const [nameIn, upiIn, bizIn, phoneIn, amtIn] = inputs;
  const exportBtns = [$("downloadPng"), $("downloadPdf"), $("shareCard")];

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const currentName = () => nameIn.value.trim() || "Your Name";

  function setStatus(msg, kind = "") { const el = $("qrStatus"); el.textContent = msg; el.className = "status " + kind; }
  function exportStatus(msg, isError = false) { const el = $("exportStatus"); el.textContent = msg; el.style.color = isError ? "#a12a2a" : ""; }
  let toastTimer;
  function toast(msg, isError = false) {
    const el = $("toast"); (document.querySelector("dialog[open]") || document.body).appendChild(el); el.textContent = msg; el.className = "toast show" + (isError ? " err" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.className = "toast"), 2800);
  }
  function validate() {
    const upi = upiIn.value.trim(), okUpi = /^[^@\s]+@[^@\s]+$/.test(upi), amt = amtIn.value.trim();
    upiIn.classList.toggle("ok", okUpi); upiIn.classList.toggle("bad", !!upi && !okUpi); upiIn.setAttribute("aria-invalid", !!upi && !okUpi);
    const okAmt = !amt || (/^\d+(\.\d{1,2})?$/.test(amt) && Number(amt) > 0);
    amtIn.classList.toggle("bad", !okAmt); amtIn.setAttribute("aria-invalid", !okAmt);
    $("tab-details").classList.toggle("done", okUpi && okAmt && !!nameIn.value.trim());
  }
  const canExport = () => !!state.payload && !!nameIn.value.trim();
  function syncExportButtons() { const ok = canExport() && $("verifyQr").checked; exportBtns.forEach((b) => (b.disabled = !ok)); }
  function goFix(id) { $("dlDlg").close(); showTab("details"); $(id).focus(); }
  function renderChecks() {
    const upi = upiIn.value.trim(), amt = amtIn.value.trim();
    const okUpi = /^[^@\s]+@[^@\s]+$/.test(upi), okAmt = !amt || (/^\d+(\.\d{1,2})?$/.test(amt) && Number(amt) > 0);
    const items = [
      [!!nameIn.value.trim(), "Name added", "Add your name", "personName"],
      [okUpi, "UPI ID looks valid", upi ? "Fix your UPI ID (it looks like name@bank)" : "Add your UPI ID", "upiId"]
    ];
    if (!okAmt) items.push([false, "", "Fix the amount (for example 250 or 99.50)", "qrAmount"]);
    const ul = $("checks"); ul.replaceChildren();
    items.forEach(([ok, done, todo, field]) => {
      const li = document.createElement("li"); li.className = ok ? "ok" : "todo";
      li.innerHTML = `<span class="mark" aria-hidden="true">${ok ? "✓" : "!"}</span><span class="txt"></span>`;
      li.querySelector(".txt").textContent = ok ? done : todo;
      if (!ok) {
        const b = document.createElement("button"); b.type = "button"; b.className = "fix"; b.textContent = "Fix";
        b.setAttribute("aria-label", "Fix: " + todo); b.addEventListener("click", () => goFix(field)); li.appendChild(b);
      }
      ul.appendChild(li);
    });
    const ready = canExport(); $("verifyQr").disabled = !ready; $("verifyBox").classList.toggle("off", !ready);
  }
  function updateExportState() {
    renderChecks(); syncExportButtons();
    const ready = canExport(), checked = $("verifyQr").checked;
    exportStatus(!ready ? "Complete the checklist above to enable downloads." : !checked ? "Scan the QR with a UPI app, then tick the box above." : "Ready to download.");
  }
  function setExportEnabled() { $("verifyQr").checked = false; updateExportState(); }

  /* ---------- Tabs ---------- */
  function showTab(name) {
    ["details", "design"].forEach((n) => {
      const on = n === name;
      $("tab-" + n).classList.toggle("active", on);
      $("tab-" + n).setAttribute("aria-selected", on);
      $("tab-" + n).tabIndex = on ? 0 : -1;
      $("pane-" + n).hidden = !on;
      if (on && n === "design") renderThumbs();
    });
    $("mainBtn").textContent = name === "design" ? "Download card" : "Next: choose a design";
    $("backBtn").hidden = name !== "design";
  }
  ["details", "design"].forEach((n) => $("tab-" + n).addEventListener("click", () => showTab(n)));
  document.querySelector(".tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const n = document.activeElement === $("tab-details") ? "design" : "details";
    showTab(n); $("tab-" + n).focus();
  });

  /* ---------- UPI payload + QR ---------- */
  function buildPayload() {
    const pa = upiIn.value.trim();
    if (!/^[^@\s]+@[^@\s]+$/.test(pa)) return null;
    let p = `upi://pay?pa=${encodeURIComponent(pa).replace(/%40/g, "@")}&pn=${encodeURIComponent(currentName())}&cu=INR&mode=01`;
    const a = amtIn.value.trim();
    if (a) {
      if (!/^\d+(\.\d{1,2})?$/.test(a) || Number(a) <= 0) return false;
      p += `&am=${Number(a).toFixed(2)}`;
    }
    return p;
  }
  function clearQr() {
    qrBox.replaceChildren(); state.payload = ""; qrBox.hidden = true; qrPh.hidden = false; setExportEnabled(false); refreshThumbs();
  }
  const generateQr = debounce(() => {
    if (typeof window.QRCode === "undefined") return setStatus("QR library failed to load. Check your connection.", "error");
    const p = buildPayload();
    if (p === false) { clearQr(); return setStatus("Amount must be a positive number, like 250 or 99.50.", "error"); }
    if (!p) { clearQr(); return setStatus(upiIn.value.trim() ? "Keep typing. A UPI ID looks like name@bank." : "Enter your UPI ID and the QR appears automatically."); }
    if (p === state.payload) return;
    try {
      qrBox.replaceChildren();
      new QRCode(qrBox, { text: p, width: 248, height: 248, colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.H });
      state.payload = p; qrBox.hidden = false; qrPh.hidden = true; refreshThumbs();
      setStatus("QR is ready. Scan it once to confirm the recipient.", "ok");
      setExportEnabled(true);
    } catch { clearQr(); setStatus("Could not generate the QR code.", "error"); }
  }, 350);

  /* ---------- Card text / photo ---------- */
  function updateText() {
    refreshThumbs();
    $("previewName").textContent = currentName();
    $("previewSubtitle").textContent = bizIn.value.trim();
    $("previewUpi").textContent = upiIn.value.trim() || "Add your UPI ID";
    $("previewPhone").textContent = phoneIn.value.trim();
    $("previewPhone").hidden = !phoneIn.value.trim();
  }
  function updatePhoto() {
    const img = $("personPhoto");
    if (state.photoUrl) img.src = state.photoUrl; else img.removeAttribute("src");
    img.hidden = !state.photoUrl; $("photoPlaceholder").hidden = !!state.photoUrl; refreshThumbs();
  }
  $("photoInput").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type) || f.size > 8 * 1024 * 1024) {
      e.target.value = ""; return toast("Choose a PNG, JPEG or WebP photo under 8 MB.", true);
    }
    const r = new FileReader();
    r.onload = () => { openCrop(String(r.result)); e.target.value = ""; };
    r.onerror = () => toast("Could not read that photo. Try another file.", true);
    r.readAsDataURL(f);
  });
  $("removePhoto").addEventListener("click", () => { state.photoUrl = ""; $("photoInput").value = ""; updatePhoto(); });

  /* ---------- Photo crop ---------- */
  // The canvas shows the whole photo; the circle marks what ends up on the card.
  const cv = $("cropCv"), cx = cv.getContext("2d"), VIEW = 300, CROP = 200, PAD = (VIEW - CROP) / 2;
  const crop = { img: null, zoom: 1, x: 0, y: 0, base: 1 };
  function clampCrop() {
    const s = crop.base * crop.zoom;
    crop.x = Math.min(PAD, Math.max(PAD + CROP - crop.img.width * s, crop.x));
    crop.y = Math.min(PAD, Math.max(PAD + CROP - crop.img.height * s, crop.y));
  }
  function drawCrop() {
    const s = crop.base * crop.zoom;
    cx.fillStyle = "#e9edf2"; cx.fillRect(0, 0, VIEW, VIEW);
    cx.drawImage(crop.img, crop.x, crop.y, crop.img.width * s, crop.img.height * s);
    cx.fillStyle = "rgba(15,23,42,.55)"; cx.beginPath();
    cx.rect(0, 0, VIEW, VIEW); cx.arc(VIEW / 2, VIEW / 2, CROP / 2, 0, Math.PI * 2, true); cx.fill("evenodd");
    cx.strokeStyle = "#fff"; cx.lineWidth = 2; cx.beginPath(); cx.arc(VIEW / 2, VIEW / 2, CROP / 2, 0, Math.PI * 2); cx.stroke();
  }
  function openCrop(src) {
    const img = new Image();
    img.onload = () => {
      crop.img = img; crop.zoom = 1; crop.base = CROP / Math.min(img.width, img.height); $("zoom").value = 1;
      crop.x = (VIEW - img.width * crop.base) / 2; crop.y = (VIEW - img.height * crop.base) / 2;
      clampCrop(); drawCrop(); $("cropDlg").showModal();
    };
    img.onerror = () => toast("Could not read that photo. Try another file.", true);
    img.src = src;
  }
  $("zoom").addEventListener("input", (e) => {
    const old = crop.base * crop.zoom, z = Number(e.target.value), nw = crop.base * z;
    const px = (VIEW / 2 - crop.x) / old, py = (VIEW / 2 - crop.y) / old;
    crop.zoom = z; crop.x = VIEW / 2 - px * nw; crop.y = VIEW / 2 - py * nw; clampCrop(); drawCrop();
  });
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const k = VIEW / cv.getBoundingClientRect().width;
    crop.x = drag.x + (e.clientX - drag.px) * k; crop.y = drag.y + (e.clientY - drag.py) * k; clampCrop(); drawCrop();
  });
  ["pointerup", "pointercancel"].forEach((t) => cv.addEventListener(t, () => (drag = null)));
  $("cropCancel").addEventListener("click", () => $("cropDlg").close());
  $("cropOk").addEventListener("click", () => {
    const out = document.createElement("canvas"), k = 2; out.width = out.height = CROP * k;
    const o = out.getContext("2d"), s = crop.base * crop.zoom * k;
    o.fillStyle = "#fff"; o.fillRect(0, 0, CROP * k, CROP * k);
    o.drawImage(crop.img, (crop.x - PAD) * k, (crop.y - PAD) * k, crop.img.width * s, crop.img.height * s);
    state.photoUrl = out.toDataURL("image/jpeg", 0.92); updatePhoto(); $("cropDlg").close();
  });

  /* ---------- Design controls ---------- */
  function lum(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function mix(hex, base, pct) {
    const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const b = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
    return "#" + a.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)).toString(16).padStart(2, "0")).join("");
  }
  const cardClass = (t) => `card ${t} ${state.orientation}` + Object.keys(state.show).filter((k) => !state.show[k]).map((k) => " hide-" + k).join("");
  const logoFor = (t, accent) => (["t-split", "t-midnight"].includes(t) || (t === "t-bold" && lum(accent) <= 0.45) ? LOGO_REVERSE : LOGO_NORMAL);
  // Live miniatures: each layout button shows a scaled copy of the real card.
  function renderThumbs() {
    const land = state.orientation === "landscape", w = land ? 480 : 300, h = land ? 302 : 480;
    const L = $("layouts"); L.classList.toggle("land", land);
    const tw = L.querySelector(".thumb").clientWidth; // 0 while the Design tab is hidden
    const k = land ? (tw > 20 ? Math.min(0.34, (tw - 8) / 480) : 0.3) : 0.27;
    document.querySelectorAll(".lay").forEach((btn) => {
      const t = btn.dataset.t, c = card.cloneNode(true);
      c.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id")); c.removeAttribute("id");
      c.className = cardClass(t); c.setAttribute("aria-hidden", "true"); c.style.transform = `scale(${k})`;
      c.querySelector(".upi-logo").src = logoFor(t, state.accent);
      const fit = document.createElement("div"); fit.className = "thumb-fit"; fit.style.width = w * k + "px"; fit.style.height = h * k + "px";
      fit.appendChild(c); btn.querySelector(".thumb").replaceChildren(fit);
    });
  }
  const refreshThumbs = debounce(renderThumbs, 120);
  function applyClasses() {
    card.className = cardClass(state.template);
    $("upiLogo").src = logoFor(state.template, state.accent);
    const f = FONTS.find((x) => x.id === state.font);
    card.style.setProperty("--name-font", f.family); card.style.setProperty("--name-weight", f.weight); card.style.setProperty("--name-size", f.size);
    card.style.setProperty("--accent", state.accent);
    const rgb = [1, 3, 5].map((i) => parseInt(state.accent.slice(i, i + 2), 16)).join(",");
    card.style.setProperty("--tint-classic", mix(state.accent, "#ffffff", 0.1));
    card.style.setProperty("--tint-sunset", mix(state.accent, "#fff7f0", 0.22));
    card.style.setProperty("--glow", `rgba(${rgb},0.65)`);
    card.style.setProperty("--on", lum(state.accent) > 0.45 ? "#111827" : "#fff");
    fitCard(); refreshThumbs();
  }
  function renderPickers() {
    const L = $("layouts");
    LAYOUTS.forEach(([id, label, bg]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "lay"; b.dataset.t = id;
      b.innerHTML = `<span class="thumb"></span>${label}`;
      b.addEventListener("click", () => { state.template = id; applyClasses(); sync(); });
      L.appendChild(b);
    });
    const C = $("colors");
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "dot"; b.dataset.c = c; b.style.background = c; b.setAttribute("aria-label", "Colour " + c);
      b.addEventListener("click", () => { state.accent = c; applyClasses(); sync(); });
      C.appendChild(b);
    });
    const cu = document.createElement("label");
    cu.className = "custom"; cu.title = "Custom colour"; cu.style.margin = "0";
    cu.innerHTML = `<input type="color" value="${state.accent}" aria-label="Custom colour">`;
    cu.firstChild.addEventListener("input", (e) => { state.accent = e.target.value; applyClasses(); sync(); });
    C.appendChild(cu);
    $("orient").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { state.orientation = b.dataset.o; applyClasses(); sync(); }));
    FONTS.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "fnt"; b.dataset.f = f.id;
      b.innerHTML = `<span class="aa" style="font-family:${f.family};font-weight:${f.weight}">Aa</span>${f.label}`;
      b.addEventListener("click", () => { state.font = f.id; applyClasses(); sync(); });
      $("fonts").appendChild(b);
    });
    TOGGLES.forEach(([k, label]) => {
      const l = document.createElement("label"); l.className = "sw";
      l.innerHTML = `<span>${label}</span><input type="checkbox" role="switch" checked>`;
      l.querySelector("input").addEventListener("change", (e) => { state.show[k] = e.target.checked; applyClasses();
        const off = Object.values(state.show).filter((v) => !v).length;
        $("optCount").textContent = off ? `${off} hidden` : "All shown";
      });
      $("toggles").appendChild(l);
    });
  }
  function sync() {
    document.querySelectorAll(".fnt").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === state.font));
    document.querySelectorAll(".lay").forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === state.template));
    document.querySelectorAll(".dot").forEach((b) => b.setAttribute("aria-pressed", b.dataset.c === state.accent));
    $("orient").querySelectorAll("button").forEach((b) => {
      const on = b.dataset.o === state.orientation; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on);
    });
  }

  /* ---------- Responsive scaling of the preview ---------- */
  function fitCard() {
    const w = card.offsetWidth, h = card.offsetHeight;
    const avail = $("stage").clientWidth - 32;
    const maxH = window.innerWidth <= 940 ? 240 : Infinity;
    const s = Math.min(1, avail / w, maxH / h);
    $("scaler").style.transform = `scale(${s})`;
    $("fit").style.width = w * s + "px"; $("fit").style.height = h * s + "px";
  }
  window.addEventListener("resize", fitCard);

  /* ---------- Export ---------- */
  const toCanvas = (square = false) => {
    if (!window.html2canvas) throw new Error("Render library missing. Check your connection.");
    return html2canvas(card, {
      scale: 4, useCORS: true, backgroundColor: null,
      onclone: (doc) => {
        doc.getElementById("scaler").style.transform = "none";
        const c = doc.getElementById("paymentCard"); c.style.boxShadow = "none"; if (square) c.style.borderRadius = "0";
      }
    });
  };
  const toBlob = (canvas) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Image export failed."))), "image/png"));
  const fileBase = () => (currentName().normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "upi-card").slice(0, 48) + "-upi-card";
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function run(label, job) {
    if (!state.payload) return exportStatus("Add a valid UPI ID first.", true);
    exportBtns.forEach((b) => (b.disabled = true)); exportStatus(label);
    try { await job(); } catch (e) { exportStatus(e.message || "Export failed.", true); toast(e.message || "Export failed.", true); }
    syncExportButtons();
  }
  $("downloadPng").addEventListener("click", () => run("Rendering PNG…", async () => {
    download(await toBlob(await toCanvas()), fileBase() + ".png"); exportStatus("PNG downloaded."); toast("PNG saved");
  }));
  const jsPDF = () => { if (!window.jspdf) throw new Error("PDF library not loaded."); return window.jspdf.jsPDF; };
  const cardMM = () => (state.orientation === "landscape" ? { w: 85.6, h: 53.98 } : { w: 53.98, h: 85.6 });
  function pdfCard(canvas) {
    const { w, h } = cardMM(), doc = new (jsPDF())({ orientation: w > h ? "landscape" : "portrait", unit: "mm", format: [w, h], compress: true });
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h, undefined, "FAST");
    doc.save(fileBase() + ".pdf");
  }
  $("downloadPdf").addEventListener("click", () => run("Rendering PDF…", async () => {
    pdfCard(await toCanvas(true));
    exportStatus("PDF downloaded."); toast("PDF saved");
  }));
  $("verifyQr").addEventListener("change", updateExportState);
  if (navigator.share && navigator.canShare) {
    $("shareCard").hidden = false;
    $("shareCard").addEventListener("click", () => run("Preparing image…", async () => {
      const file = new File([await toBlob(await toCanvas())], fileBase() + ".png", { type: "image/png" });
      if (!navigator.canShare({ files: [file] })) throw new Error("Sharing images isn't supported here. Use Download PNG.");
      try { await navigator.share({ title: "My UPI payment card", files: [file] }); exportStatus("Shared."); toast("Card shared"); } catch { exportStatus("Ready to export."); }
    }));
  }

  /* ---------- Theme ---------- */
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';
  const root = document.documentElement, darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const theme = () => root.dataset.theme || (darkQuery.matches ? "dark" : "light");
  function paintThemeBtn() {
    const dark = theme() === "dark", b = $("themeBtn");
    b.innerHTML = (dark ? SUN : MOON) + `<span class="tl">${dark ? "Light mode" : "Dark mode"}</span>`;
    b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  }
  $("themeBtn").addEventListener("click", () => {
    root.dataset.theme = theme() === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
    paintThemeBtn();
  });
  darkQuery.addEventListener("change", paintThemeBtn);
  paintThemeBtn();

  [nameIn, upiIn, amtIn].forEach((i) => i.addEventListener("input", () => { $("verifyQr").checked = false; updateExportState(); }));

  $("mainBtn").addEventListener("click", () => {
    if ($("tab-design").classList.contains("active")) { updateExportState(); $("dlDlg").showModal(); }
    else { showTab("design"); window.scrollTo({ top: 0 }); }
  });
  $("backBtn").addEventListener("click", () => { showTab("details"); window.scrollTo({ top: 0 }); });
  $("dlClose").addEventListener("click", () => $("dlDlg").close());
  $("dlDlg").addEventListener("click", (e) => { if (e.target === $("dlDlg")) $("dlDlg").close(); });

  /* ---------- Init ---------- */
  inputs.forEach((i) => i.addEventListener("input", () => { updateText(); validate(); generateQr(); }));
  renderPickers(); validate(); updateExportState(); updateText(); updatePhoto(); applyClasses(); sync(); clearQr();
})();