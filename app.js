// CampusHub — student app (v2)
let me = null, profile = {}, unsub = null, signingUp = false, regMode = false, navTok = 0;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isStaff = () => ["teacher", "admin"].includes(profile.role);
const slug = s => "course_" + String(s || "general").toLowerCase().replace(/[^a-z0-9]+/g, "_");
const publicProfileData = p => ({ fullName: p.fullName || "", course: p.course || "", year: p.year || "", bio: p.bio || "", social: p.social || {} });
const view = html => { $("view").innerHTML = html; };
const head = (t, p) => `<div class="page-head"><h1>${t}</h1><p>${p}</p></div>`;
const safeUrl = u => (/^https?:\/\//i.test(u || "") ? esc(u) : "");

function toast(msg, err) {
  const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(t._t); t._t = setTimeout(() => (t.className = "toast"), 3800);
}
function authMsg(text, err = true) { const b = $("authMsg"); b.textContent = text; b.className = "notice" + (err ? " error" : ""); }
function friendly(e) {
  const m = { "auth/invalid-credential": "Wrong email or password.", "auth/invalid-email": "Enter a valid email address.", "auth/email-already-in-use": "This email is already registered. Please sign in.", "auth/weak-password": "Password must be at least 6 characters.", "auth/network-request-failed": "No internet connection.", "auth/too-many-requests": "Too many attempts. Try again later.", "auth/popup-closed-by-user": "The window was closed before finishing.", "auth/credential-already-in-use": "That account is already linked to another user.", "auth/operation-not-allowed": "This provider is not enabled in Firebase yet.", "auth/unauthorized-domain": "Add this website's domain in Firebase ▸ Authentication ▸ Settings ▸ Authorized domains.", "permission-denied": "Permission denied. Publish the latest firestore.rules in Firebase Console." };
  return m[e.code] || e.message;
}

/* ---------- AUTH ---------- */
const PERSIST = () => ($("remember").checked ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION);
function setMode(reg) {
  regMode = reg;
  $("submitBtn").textContent = reg ? "Create Account" : "Sign In";
  $("switchText").textContent = reg ? "Already have an account?" : "Don't have an account?";
  $("switchBtn").textContent = reg ? "Sign In" : "Register";
  $("regFields").classList.toggle("hidden", !reg);
  $("loginRow").classList.toggle("hidden", reg);
  $("password").autocomplete = reg ? "new-password" : "current-password";
  authMsg("");
}
$("switchBtn").onclick = () => setMode(!regMode);
$("eyeBtn").onclick = () => { const p = $("password"), show = p.type === "password"; p.type = show ? "text" : "password"; $("eyeBtn").innerHTML = `<i class="fa-solid ${show ? "fa-eye" : "fa-eye-slash"}"></i>`; };
$("forgotBtn").onclick = async () => {
  const email = $("email").value.trim();
  if (!email) return authMsg("Enter your email above first.");
  try { await auth.sendPasswordResetEmail(email); authMsg("Reset link sent. Check your email (and spam).", false); } catch (e) { authMsg(friendly(e)); }
};

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("email").value.trim(), password = $("password").value;
  $("submitBtn").disabled = true; authMsg("Please wait…", false);
  try {
    if (!email || !password) throw { message: "Enter your email and password." };
    await auth.setPersistence(PERSIST());
    if (regMode) {
      const p = { fullName: $("fullName").value.trim(), phone: $("phone").value.trim(), regNo: $("regNo").value.trim(), course: $("course").value.trim(), year: $("year").value, gender: $("gender").value, email, role: "student" };
      if (!p.fullName || !p.phone || !p.regNo || !p.course || !p.year) throw { message: "Fill in all registration details." };
      signingUp = true;
      const r = await auth.createUserWithEmailAndPassword(email, password, p);
      if (!r.session) {
        authMsg("Account created. Check your email to confirm it, then sign in.", false);
        return;
      }
      await db.collection("students").doc(r.user.uid).set({ ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      me = r.user; profile = p; authMsg(""); enter();
      // Create the directory-safe profile in the background. Firestore rules
      // validate it against the already-created private student record.
      db.collection("publicProfiles").doc(r.user.uid).set(publicProfileData(p))
        .catch(err => toast("Account created. Profile directory sync will retry later: " + friendly(err), true));
    } else await auth.signInWithEmailAndPassword(email, password);
  } catch (err) { authMsg(friendly(err)); }
  finally { signingUp = false; $("submitBtn").disabled = false; }
});

auth.onAuthStateChanged(async u => {
  if (signingUp) return;
  if (!u) { me = null; if (unsub) unsub(); $("app").classList.add("hidden"); $("authScreen").classList.remove("hidden"); return; }
  me = u;
  try {
    const d = await db.collection("students").doc(u.uid).get();
    if (!d.exists) { authMsg("Profile not found. Contact your administrator."); await auth.signOut(); return; }
    profile = d.data();
    // Avoid a Firestore write on every sign-in. Public profile sync is handled
    // during registration and by the administrator's one-time migration tool.
    enter();
  } catch (err) { authMsg(friendly(err)); $("authScreen").classList.remove("hidden"); }
});

let redirectChecked = false;
function enter() {
  $("authScreen").classList.add("hidden"); $("app").classList.remove("hidden");
  $("topName").textContent = profile.fullName;
  $("avatar").textContent = (profile.fullName || "S").charAt(0).toUpperCase();
  $("staffLink").classList.toggle("hidden", !isStaff());
  $("staffLink").href = profile.role === "admin" ? "admin.html" : "teacher.html";
  $("staffLink").querySelector("span").textContent = profile.role === "admin" ? "Admin portal" : "Teacher portal";
  $("roleLabel").textContent = isStaff() ? (profile.role === "admin" ? "Administrator" : "Teacher") : "Student";
  document.querySelectorAll("[data-student-only]").forEach(el => el.classList.toggle("hidden", isStaff()));
  if (!location.hash) history.replaceState(null, "", "#/home");
  route();
  if (!redirectChecked) {
    redirectChecked = true;
    auth.getRedirectResult().then(r => { const k = sessionStorage.getItem("linking"); if (r && r.user && k) { sessionStorage.removeItem("linking"); afterLink(k, r); } }).catch(e => toast(friendly(e), true));
  }
}
$("logoutBtn").onclick = () => auth.signOut();
$("menuBtn").onclick = () => (innerWidth > 800 ? $("app").classList.toggle("mini") : $("sidebar").classList.toggle("open"));
$("backBtn").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/home"));

/* ---------- ROUTER ---------- */
window.addEventListener("hashchange", route);
function route() {
  if (!me || !profile.fullName) return;
  if (unsub) { unsub(); unsub = null; }
  navTok++;
  const [page = "home", ...arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (isStaff() && ["home", "modules", "work"].includes(page)) {
    const portal = profile.role === "admin" ? "admin.html" : "teacher.html";
    return location.replace(portal + "#/" + (page === "home" ? "dashboard" : page));
  }
  const titles = { home: "Home", modules: "Modules", work: "Assignments & Tests", chat: "Chat", profile: "My Profile", student: "Student profile" };
  $("pageTitle").textContent = titles[page] || "Overview";
  document.querySelectorAll(".side-link[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  $("backBtn").style.visibility = page === "home" ? "hidden" : "visible";
  $("sidebar").classList.remove("open"); window.scrollTo(0, 0);
  view('<div class="empty">Loading…</div>');
  const pages = { home: homePage, modules: modulesPage, work: workPage, chat: chatPage, profile: profilePage, student: studentPage };
  return (pages[page] || homePage)(arg).catch(err => view(`<div class="panel empty">Could not load: ${esc(friendly(err))}</div>`));
}

/* ---------- SOCIAL ACCOUNTS ---------- */
// p = Firebase provider id (real OAuth link) · f = provider factory · b = public profile URL builder · login = app login page
const SOCIALS = {
  google: { n: "Google", i: "fa-google", c: "#DB4437", p: "google.com", f: () => new firebase.auth.GoogleAuthProvider() },
  facebook: { n: "Facebook", i: "fa-facebook-f", c: "#1877F2", p: "facebook.com", f: () => new firebase.auth.FacebookAuthProvider(), b: v => "https://facebook.com/" + v, ph: "profile name or full link" },
  x: { n: "X (Twitter)", i: "fa-x-twitter", c: "#111111", p: "twitter.com", f: () => new firebase.auth.TwitterAuthProvider(), b: v => "https://x.com/" + v, ph: "username" },
  github: { n: "GitHub", i: "fa-github", c: "#24292f", p: "github.com", f: () => new firebase.auth.GithubAuthProvider(), b: v => "https://github.com/" + v, ph: "username" },
  microsoft: { n: "Microsoft", i: "fa-microsoft", c: "#2F2F2F", p: "microsoft.com", f: () => new firebase.auth.OAuthProvider("microsoft.com") },
  instagram: { n: "Instagram", i: "fa-instagram", c: "#E1306C", login: "https://www.instagram.com/accounts/login/", b: v => "https://instagram.com/" + v, ph: "your username" },
  tiktok: { n: "TikTok", i: "fa-tiktok", c: "#010101", login: "https://www.tiktok.com/login", b: v => "https://tiktok.com/@" + v, ph: "your username" },
  linkedin: { n: "LinkedIn", i: "fa-linkedin-in", c: "#0A66C2", login: "https://www.linkedin.com/login", b: v => "https://linkedin.com/in/" + v, ph: "profile name or full link" },
  whatsapp: { n: "WhatsApp", i: "fa-whatsapp", c: "#25D366", login: "https://web.whatsapp.com/", b: v => "https://wa.me/" + v.replace(/\D/g, ""), ph: "your number e.g. 2557XXXXXXXX", raw: 1 },
  youtube: { n: "YouTube", i: "fa-youtube", c: "#FF0000", login: "https://accounts.google.com/ServiceLogin?service=youtube", b: v => "https://youtube.com/@" + v, ph: "your channel name" }
};
const socUrl = (k, v) => { v = String(v || "").trim(); const s = SOCIALS[k]; if (!v || !s?.b) return ""; if (/^https?:\/\//i.test(v)) return v; return s.b(s.raw ? v : encodeURIComponent(v.replace(/^@/, ""))); };
const socButtons = soc => Object.keys(SOCIALS).filter(k => soc?.[k] && socUrl(k, soc[k])).map(k => `<a class="soc" style="--c:${SOCIALS[k].c}" target="_blank" rel="noopener noreferrer" href="${esc(socUrl(k, soc[k]))}"><i class="fa-brands ${SOCIALS[k].i}"></i> ${SOCIALS[k].n}</a>`).join("");
async function saveSocial(k, val) {
  await db.collection("students").doc(me.uid).update({ ["social." + k]: val });
  await db.collection("publicProfiles").doc(me.uid).set({ social: { ...(profile.social || {}), [k]: val } }, { merge: true });
  profile.social = { ...(profile.social || {}), [k]: val };
}
async function oauthLink(k) {
  const prov = SOCIALS[k].f();
  try { afterLink(k, await me.linkWithPopup(prov)); }
  catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) { sessionStorage.setItem("linking", k); return me.linkWithRedirect(prov); }
    throw e;
  }
}
async function afterLink(k, r) {
  const s = SOCIALS[k], un = r?.additionalUserInfo?.username;
  if (un && s.b) await saveSocial(k, un);
  profileTab = "social"; toast(s.n + " connected.");
  if (location.hash.indexOf("#/profile") !== 0) location.hash = "#/profile";
  await route();
  if (!un && s.b) askHandle(k);
}
function askHandle(k) {
  const card = document.querySelector(`[data-card="${k}"]`); if (!card) return;
  const s = SOCIALS[k];
  card.innerHTML = `<div class="nm"><span class="ic" style="--c:${s.c}"><i class="fa-brands ${s.i}"></i></span>${s.n}</div><small>Enter your ${esc(s.ph)} to connect this profile.</small><input id="socIn" placeholder="${esc(s.ph)}"><div class="row-btns"><button class="btn-brand" style="--c:${s.c}" data-act="savesoc" data-k="${k}">Connect</button><button class="btn btn-light btn-sm" data-act="cancelsoc">Cancel</button></div>`;
  $("socIn").focus();
}

/* ---------- HOME ---------- */
async function homePage() {
  const n = (await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).size;
  const card = (c, ic, t, v) => `<div class="scard"><div class="sicon" style="background:${c}"><i class="fa-solid ${ic}"></i></div><div><b>${t}</b><small>${esc(v)}</small></div></div>`;
  view(`<div class="page-head"><div><h1><i class="fa-solid fa-gauge" style="color:var(--steel)"></i> Welcome, ${esc(profile.fullName.split(" ")[0])}</h1><p>Your academic space at a glance.</p></div></div>
  <div class="status-grid">${card("#325d73", "fa-book", "Registered Modules", n + (n === 1 ? " module" : " modules"))}${card("#dc3545", "fa-id-card", "Registration No.", profile.regNo || "—")}${card("#ffc107", "fa-forward-step", "Year of Study", profile.year || "—")}${card("#17a2b8", "fa-graduation-cap", "Programme", profile.course || "—")}</div>
  <div class="cols"><div class="panel"><h3>Quick access</h3><div class="row-btns">
    <a class="btn btn-light" href="#/modules"><i class="fa-solid fa-book-open"></i> Modules</a><a class="btn btn-light" href="#/work"><i class="fa-solid fa-file-pen"></i> Assignments</a>
    <a class="btn btn-light" href="#/chat"><i class="fa-solid fa-comments"></i> Chat</a><a class="btn btn-light" href="#/profile"><i class="fa-solid fa-circle-user"></i> Profile</a></div></div>
  <div class="panel"><h3>My social links</h3>${socButtons(profile.social) ? `<div class="soc-row">${socButtons(profile.social)}</div>` : '<p class="subtle">You have not connected any account yet. <a href="#/profile">Connect now</a></p>'}</div></div>`);
}

/* ---------- PROFILE (SOMA-style) ---------- */
let profileTab = "academic";
async function profilePage([mode]) {
  const n = (await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).size;
  const linked = Object.fromEntries(me.providerData.map(p => [p.providerId, p]));
  const kv = (a, b) => `<div class="kv"><b>${a}</b><span>${esc(b || "—")}</span></div>`;
  const left = `<div class="pcard"><div style="text-align:center"><span class="avatar" style="width:70px;height:70px;font-size:28px;margin:0 auto">${esc((profile.fullName || "S")[0].toUpperCase())}</span></div>
    <h2>${esc((profile.fullName || "").toUpperCase())}</h2><div class="reg">${esc(profile.regNo)}</div>
    ${kv("Gender", profile.gender)}${kv("Date of birth", profile.dob)}${kv("Programme", profile.course)}${kv("Year", profile.year)}${kv("Nationality", profile.nationality)}${kv("Phone", profile.phone)}${kv("Email", profile.email || me.email)}</div>`;
  const opt = (arr, v) => arr.map(y => `<option ${v === y ? "selected" : ""}>${y}</option>`).join("");
  const edit = `<div class="tabs-card"><div class="tabpane"><h3 style="margin-top:0">Edit profile</h3><form id="pf"><div class="form-grid">
    <div class="field"><label>Full name</label><input id="pName" value="${esc(profile.fullName)}"></div>
    <div class="field"><label>Phone number</label><input id="pPhone" type="tel" value="${esc(profile.phone)}"></div>
    <div class="field"><label>Gender</label><select id="pGender"><option value="">—</option>${opt(["Male", "Female"], profile.gender)}</select></div>
    <div class="field"><label>Date of birth</label><input id="pDob" type="date" value="${esc(profile.dob)}"></div>
    <div class="field"><label>Programme (contact administration to change)</label><input id="pCourse" value="${esc(profile.course)}" disabled></div>
    <div class="field"><label>Year of study (contact administration to change)</label><select id="pYear" disabled><option value="">—</option>${opt(["Year 1", "Year 2", "Year 3", "Year 4"], profile.year)}</select></div>
    <div class="field"><label>Nationality</label><input id="pNat" value="${esc(profile.nationality)}"></div>
    <div class="field"><label>Guardian / emergency phone</label><input id="pEmerg" type="tel" value="${esc(profile.emergency)}"></div>
    <div class="field"><label>Guardian name</label><input id="pGName" value="${esc(profile.guardianName)}"></div>
    <div class="field"><label>About me</label><input id="pBio" maxlength="160" value="${esc(profile.bio)}"></div></div>
    <div class="row-btns" style="margin-top:8px"><button class="btn btn-primary" type="submit">Save changes</button><a class="btn btn-light" href="#/profile">Cancel</a></div></form></div></div>`;
  const socCards = Object.entries(SOCIALS).map(([k, s]) => {
    const on = (s.p && linked[s.p]) || profile.social?.[k];
    const who = profile.social?.[k] || (s.p && linked[s.p] && (linked[s.p].displayName || linked[s.p].email)) || "";
    const head = `<div class="nm"><span class="ic" style="--c:${s.c}"><i class="fa-brands ${s.i}"></i></span>${s.n}</div>`;
    const openUrl = s.login || ("https://" + s.p);
    const connectButton = s.p
      ? (linked[s.p]
          ? `<button class="btn-brand" style="--c:${s.c}" data-act="alreadyconnected" data-k="${k}">Connect</button>`
          : `<button class="btn-brand" style="--c:${s.c}" data-act="oauth" data-k="${k}">Connect</button>`)
      : `<button class="btn-brand" style="--c:${s.c}" data-act="connecthandle" data-k="${k}">Connect</button>`;
    const status = on ? `<small><span class="tag green">CONNECTED</span> ${esc(who)}</small>` : `<small>Not connected</small>`;
    return `<div class="soc-card" data-card="${k}">${head}${status}<div class="row-btns"><a class="btn btn-light btn-sm" target="_blank" rel="noopener noreferrer" href="${esc(openUrl)}">Open</a>${connectButton}</div></div>`;
  }).join("");
  const tabs = `<div class="tabs-card"><div class="tabs">${[["academic", "Academic Details"], ["contact", "Contact & Guardian"], ["social", "Social Links"]].map(([id, t]) => `<button class="tab${profileTab === id ? " on" : ""}" data-tab="${id}">${t}</button>`).join("")}</div>
    <div class="tabpane" data-pane="academic" ${profileTab !== "academic" ? "hidden" : ""}>
      <div class="strip"><div><small style="color:#28a745">Reg. Number</small><b>${esc(profile.regNo || "—")}</b></div><div><small style="color:#e0a800">Year of Study</small><b>${esc(profile.year || "—")}</b></div><div><small style="color:#17a2b8">Modules</small><b>${n}</b></div><div><small style="color:#dc3545">Role</small><b>${esc(profile.role || "student")}</b></div></div>
      <div class="two"><div><div class="info-row"><b><i class="fa-solid fa-book"></i> Programme</b><span>${esc((profile.course || "—").toUpperCase())}</span></div><div class="info-row"><b><i class="fa-solid fa-location-dot"></i> Institution</b><span>Dar es Salaam Institute of Technology</span></div></div>
      <div><div class="scard" style="margin-bottom:12px"><div class="sicon" style="background:#325d73"><i class="fa-solid fa-book"></i></div><div><b>Modules</b><small>${n} registered</small></div></div><div class="scard"><div class="sicon" style="background:#dc3545"><i class="fa-solid fa-id-card"></i></div><div><b>Account Status</b><small>Active</small></div></div></div></div></div>
    <div class="tabpane" data-pane="contact" ${profileTab !== "contact" ? "hidden" : ""}>
      <div class="info-row"><b><i class="fa-solid fa-phone"></i> Phone</b><span>${esc(profile.phone || "—")}</span></div><div class="info-row"><b><i class="fa-solid fa-envelope"></i> Email</b><span>${esc(profile.email || me.email)}</span></div>
      <div class="info-row"><b><i class="fa-solid fa-user-shield"></i> Guardian</b><span>${esc(profile.guardianName || "—")} ${esc(profile.emergency || "")}</span></div><div class="info-row"><b><i class="fa-solid fa-quote-left"></i> About me</b><span>${esc(profile.bio || "—")}</span></div></div>
    <div class="tabpane" data-pane="social" ${profileTab !== "social" ? "hidden" : ""}><div class="soc-grid">${socCards}</div></div></div>`;
  view(`<div class="page-head"><h1><i class="fa-solid fa-users-viewfinder" style="color:var(--steel)"></i> Profile</h1>${edit && mode === "edit" ? "" : '<a class="btn btn-primary" href="#/profile/edit"><i class="fa-solid fa-pen"></i> Edit Profile</a>'}</div><div class="profile-grid">${left}${mode === "edit" ? edit : tabs}</div>`);
  document.querySelectorAll("[data-tab]").forEach(t => t.onclick = () => { profileTab = t.dataset.tab; document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === t)); document.querySelectorAll("[data-pane]").forEach(p => (p.hidden = p.dataset.pane !== profileTab)); });
  if ($("pf")) $("pf").onsubmit = async e => {
    e.preventDefault();
    const u = { fullName: $("pName").value.trim(), phone: $("pPhone").value.trim(), gender: $("pGender").value, dob: $("pDob").value, nationality: $("pNat").value.trim(), emergency: $("pEmerg").value.trim(), guardianName: $("pGName").value.trim(), bio: $("pBio").value.trim() };
    if (!u.fullName) return toast("Name is required.", true);
    try { await db.collection("students").doc(me.uid).update(u); await db.collection("publicProfiles").doc(me.uid).set(publicProfileData({ ...profile, ...u }), { merge: true }); profile = { ...profile, ...u }; $("topName").textContent = u.fullName; $("avatar").textContent = u.fullName[0].toUpperCase(); toast("Profile saved."); location.hash = "#/profile"; }
    catch (err) { toast(friendly(err), true); }
  };
}

/* ---------- OTHER STUDENT'S PROFILE ---------- */
async function studentPage([uid]) {
  const d = await db.collection("publicProfiles").doc(uid || "x").get();
  if (!d.exists) return view('<div class="panel empty">Profile not found.</div>');
  const s = d.data();
  view(head("Student profile", "") + `<div class="panel"><div class="profile-hero"><span class="avatar">${esc((s.fullName || "S")[0])}</span>
    <div><h2 style="margin:0;color:var(--navy)">${esc(s.fullName)}</h2><p class="subtle" style="margin:4px 0">${esc((s.course || "CampusHub member") + (s.year ? " · " + s.year : ""))}</p>
    <p class="subtle" style="margin:0">${esc(s.bio)}</p></div></div>
    
    ${socButtons(s.social) ? `<h3 style="margin-top:20px">Links</h3><div class="soc-row">${socButtons(s.social)}</div>` : ""}
    ${uid !== me.uid ? `<a class="btn btn-primary" style="margin-top:20px" href="#/chat/dm/${esc(uid)}"><i class="fa-solid fa-comment"></i> Send message</a>` : ""}</div>`);
}

/* ---------- MODULES (student) ---------- */
async function modulesPage() {
  const mods = (await db.collection("modules").get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const my = new Set((await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).docs.map(d => d.data().moduleId));
  const noteSnaps = await Promise.all([...my].map(id => db.collection("notes").where("moduleId", "==", id).get()));
  const notesByModule = {};
  noteSnaps.forEach(s => s.docs.forEach(d => { const n = d.data(); (notesByModule[n.moduleId] ||= []).push({ id: d.id, ...n }); }));
  view(head("Modules", "Register for the modules you take. Only you and the module lecturer can see your registration.") + `<div class="panel">${mods.map(m => {
    const notes = notesByModule[m.id] || [];
    return `
    <div class="list-item"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>Lecturer: ${esc(m.teacherName || "—")}</small><small>${esc(m.description)}</small>
    ${safeUrl(m.resource) ? `<small><a href="${safeUrl(m.resource)}" target="_blank" rel="noopener">Open learning resource</a></small>` : ""}
    ${my.has(m.id) && notes.length ? `<div class="module-notes"><small><b><i class="fa-solid fa-file-pdf"></i> Notes uploaded</b></small>${notes.map(n => `<div class="row-btns"><span>${esc(n.title)}</span><button class="btn btn-light btn-sm" data-act="downloadnote" data-path="${esc(n.storagePath)}" data-name="${esc(n.fileName)}"><i class="fa-solid fa-download"></i> Download PDF</button></div>`).join("")}</div>` : ""}
    </div>
    ${my.has(m.id) ? `<div class="row-btns"><span class="tag green">REGISTERED</span><button class="btn btn-danger btn-sm" data-act="drop" data-id="${m.id}">Drop</button></div>` : `<button class="btn btn-primary btn-sm" data-act="enroll" data-id="${m.id}" data-t="${esc(m.teacherId)}" data-n="${esc(m.code + " " + m.name)}">Register</button>`}</div>`;
  }).join("") || '<div class="empty">No modules have been published yet.</div>'}</div>`);
}

/* ---------- ASSIGNMENTS & TESTS (student) ---------- */
async function workPage() {
  const ids = (await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).docs.map(d => d.data().moduleId);
  if (!ids.length) return view(head("Assignments & Tests", "Work from your registered modules.") + '<div class="panel empty">Register for a module first to see its assignments and tests.</div>');
  const items = (await db.collection("work").where("moduleId", "in", ids.slice(0, 30)).get()).docs.map(d => d.data()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const list = t => items.filter(i => i.type === t).map(i => `<div class="list-item"><div><strong>${esc(i.title)}</strong><small>${esc(i.moduleName)}</small><small>${esc(i.details)}</small>${safeUrl(i.link) ? `<small><a href="${safeUrl(i.link)}" target="_blank" rel="noopener">Open material</a></small>` : ""}</div><span class="tag ${t === "test" ? "gold" : ""}">${esc(i.date || "No date")}</span></div>`).join("") || '<div class="empty">Nothing posted yet.</div>';
  view(head("Assignments & Tests", "Work from your registered modules.") + `<div class="cols"><div class="panel"><h3>Assignments</h3>${list("assignment")}</div><div class="panel"><h3>Tests &amp; Exams</h3>${list("test")}</div></div>`);
}

/* ---------- CHAT ---------- */
async function chatPage(arg) {
  const tok = navTok, [kind, other] = arg, inRoom = !!kind;
  let room = "general", title = "General room — all students";
  if (kind === "class") {
    room = slug(profile.course); title = (profile.course || "My class") + " — class room";
    await db.collection("chatRooms").doc(room).set({ type: "course", course: profile.course }, { merge: true });
  }
  if (kind === "dm" && other) {
    room = [me.uid, other].sort().join("_");
    await db.collection("chatRooms").doc(room).set({ type: "dm", participants: [me.uid, other].sort(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    const d = await db.collection("publicProfiles").doc(other).get();
    title = d.exists ? d.data().fullName : "Private chat";
  }
  if (tok !== navTok) return;
  const k = kind || "general", act = x => (k === x ? " active" : "");
  view(head("Chat", "Talk with everyone, your class, or one person privately.") + `<div class="chat-layout ${inRoom ? "in-room" : "no-room"}">
    <div class="panel rooms"><h3>Rooms</h3>
      <a class="nav-btn${act("general")}" href="#/chat/general"><i class="fa-solid fa-globe"></i> General (everyone)</a>
      <a class="nav-btn${act("class")}" href="#/chat/class"><i class="fa-solid fa-users"></i> My class</a>
      <h3 style="margin-top:18px">Private chat</h3>
      <input class="form-control" id="pSearch" placeholder="Search a person…">
      <div class="people" id="people"><div class="empty">Loading…</div></div></div>
    <div class="panel convo"><div class="convo-head"><div style="display:flex;gap:10px;align-items:center;min-width:0"><a class="btn btn-light btn-sm mob-only" href="#/chat"><i class="fa-solid fa-arrow-left"></i></a><h3 style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</h3></div>
      ${kind === "dm" ? `<a class="btn btn-light btn-sm" href="#/student/${esc(other)}">Profile</a>` : ""}</div>
      <div class="chatbox" id="cbox"><div class="empty">Loading…</div></div>
      <form class="chat-form" id="cf"><input id="cmsg" placeholder="Write a message…" maxlength="1000" autocomplete="off"><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button></form></div></div>`);

  const ref = db.collection("chatRooms").doc(room).collection("messages");
  const fmt = t => { if (!t) return "sending…"; const d = new Date(t), now = new Date(); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (d.toDateString() === now.toDateString() ? "" : " · " + d.toLocaleDateString([], { day: "numeric", month: "short" })); };
  unsub = ref.orderBy("createdAt").limitToLast(100).onSnapshot(s => {
    const b = $("cbox"); if (!b) return;
    b.innerHTML = s.docs.map(d => { const x = d.data(), mine = x.senderId === me.uid; return `<div class="chat-msg${mine ? " mine" : ""}"><div class="chat-meta">${mine ? "You" : esc(x.senderName || "Student")}<span class="chat-time">${fmt(x.createdAt)}</span></div>${esc(x.message)}</div>`; }).join("") || '<div class="empty">No messages yet. Say hello 👋</div>';
    b.scrollTop = b.scrollHeight;
  }, err => { const b = $("cbox"); if (b) b.innerHTML = `<div class="empty"><b>Chat unavailable</b><br>${esc(friendly(err))}</div>`; });

  $("cf").onsubmit = async e => {
    e.preventDefault();
    const t = $("cmsg").value.trim(); if (!t) return;
    $("cmsg").value = "";
    try { await ref.add({ senderId: me.uid, senderName: profile.fullName, message: t, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
    catch (err) { $("cmsg").value = t; toast("Message not sent: " + friendly(err), true); }
  };

  const all = (await db.collection("publicProfiles").limit(300).get()).docs.filter(d => d.id !== me.uid).map(d => ({ id: d.id, ...d.data() }));
  if (tok !== navTok) return;
  const draw = q => { const l = all.filter(s => (s.fullName || "").toLowerCase().includes(q.toLowerCase())).slice(0, 40); const p = $("people"); if (p) p.innerHTML = l.map(s => `<a class="nav-btn${other === s.id ? " active" : ""}" href="#/chat/dm/${s.id}"><span class="avatar" style="width:30px;height:30px;font-size:12px">${esc((s.fullName || "?")[0])}</span><span>${esc(s.fullName)}<br><small style="color:var(--muted);font-weight:500">${esc(s.course || "CampusHub member")}</small></span></a>`).join("") || '<div class="empty">No one found.</div>'; };
  draw(""); $("pSearch").oninput = e => draw(e.target.value);
}

/* ---------- BUTTON ACTIONS ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const { act, id } = b.dataset; b.disabled = true;
  try {
    if (act === "downloadnote") {
      const url = await firebase.storage().ref(b.dataset.path).getDownloadURL();
      const a = document.createElement("a"); a.href = url; a.download = b.dataset.name || "notes.pdf"; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    } else if (act === "enroll") {
      await db.collection("moduleEnrollments").doc(me.uid + "_" + id).set({ studentId: me.uid, moduleId: id, moduleName: b.dataset.n, teacherId: b.dataset.t, studentName: profile.fullName, regNo: profile.regNo || "", phone: profile.phone || "", year: profile.year || "", course: profile.course || "", enrolledAt: firebase.firestore.FieldValue.serverTimestamp() });
      toast("Registered successfully."); route();
    } else if (act === "drop") {
      if (!confirm("Drop this module?")) return (b.disabled = false);
      await db.collection("moduleEnrollments").doc(me.uid + "_" + id).delete(); toast("Module dropped."); route();
    } else if (act === "oauth") { await oauthLink(b.dataset.k); b.disabled = false; }
    else if (act === "ext") { window.open(SOCIALS[b.dataset.k].login, "_blank", "noopener"); askHandle(b.dataset.k); }
    else if (act === "addhandle") askHandle(b.dataset.k);
    else if (act === "cancelsoc") route();
    else if (act === "savesoc") { const v = $("socIn").value.trim(); if (!v) { toast("Enter your username or link first.", true); b.disabled = false; return; } await saveSocial(b.dataset.k, v); toast(SOCIALS[b.dataset.k].n + " connected."); route(); }
    else if (act === "unlink") {
      const k = b.dataset.k, s = SOCIALS[k];
      if (!confirm("Disconnect " + s.n + "?")) return (b.disabled = false);
      if (s.p && me.providerData.some(p => p.providerId === s.p)) await me.unlink(s.p);
      await db.collection("students").doc(me.uid).update({ ["social." + k]: firebase.firestore.FieldValue.delete() });
      await db.collection("publicProfiles").doc(me.uid).update({ ["social." + k]: firebase.firestore.FieldValue.delete() });
      if (profile.social) delete profile.social[k];
      toast("Disconnected."); route();
    }
  } catch (err) { toast(friendly(err), true); b.disabled = false; }
});
