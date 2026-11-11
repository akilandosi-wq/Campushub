// CampusHub — student app (v2)
let me = null, profile = {}, unsub = null, signingUp = false, regMode = false, navTok = 0;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isStaff = () => ["teacher", "admin"].includes(profile.role);
const slug = s => "course_" + String(s || "general").toLowerCase().replace(/[^a-z0-9]+/g, "_");
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
function setMode(reg) {
  regMode = reg;
  $("authTitle").textContent = reg ? "Create your account" : "Sign in";
  $("authSub").textContent = reg ? "Fill in your student details to get started." : "Use your email and password to continue.";
  $("submitBtn").textContent = reg ? "Register" : "Sign in";
  $("switchText").textContent = reg ? "Already registered?" : "New student?";
  $("switchBtn").textContent = reg ? "Sign in" : "Create account";
  $("regFields").classList.toggle("hidden", !reg);
  authMsg("");
}
$("switchBtn").onclick = () => setMode(!regMode);

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("email").value.trim(), password = $("password").value;
  $("submitBtn").disabled = true; authMsg("Please wait…", false);
  try {
    if (!email || !password) throw { message: "Enter your email and password." };
    if (regMode) {
      const p = { fullName: $("fullName").value.trim(), phone: $("phone").value.trim(), regNo: $("regNo").value.trim(), course: $("course").value.trim(), year: $("year").value, email, role: "student" };
      if (!p.fullName || !p.phone || !p.regNo || !p.course || !p.year) throw { message: "Fill in all registration details." };
      signingUp = true;
      const r = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection("students").doc(r.user.uid).set({ ...p, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      me = r.user; profile = p; authMsg(""); enter();
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
    profile = d.data(); enter();
  } catch (err) { authMsg(friendly(err)); $("authScreen").classList.remove("hidden"); }
});

function enter() {
  $("authScreen").classList.add("hidden"); $("app").classList.remove("hidden");
  $("topName").textContent = profile.fullName;
  $("avatar").textContent = (profile.fullName || "S").charAt(0).toUpperCase();
  $("roleLabel").textContent = isStaff() ? "Staff account" : (profile.course || "Student portal");
  $("staffLink").classList.toggle("hidden", !isStaff());
  if (!location.hash) history.replaceState(null, "", "#/home");
  route();
}
$("logoutBtn").onclick = () => auth.signOut();
$("menuBtn").onclick = () => $("sidebar").classList.toggle("open");
$("backBtn").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/home"));

/* ---------- ROUTER ---------- */
window.addEventListener("hashchange", route);
function route() {
  if (!me || !profile.fullName) return;
  if (unsub) { unsub(); unsub = null; }
  navTok++;
  const [page = "home", ...arg] = location.hash.replace(/^#\/?/, "").split("/");
  if (isStaff() && ["home", "modules", "work"].includes(page)) return location.replace("admin.html#/" + (page === "home" ? "dashboard" : page));
  const titles = { home: "Overview", modules: "Modules", work: "Assignments & Tests", chat: "Chat", profile: "My Profile", student: "Student profile" };
  $("pageTitle").textContent = titles[page] || "Overview";
  document.querySelectorAll(".nav-btn[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  $("backBtn").style.visibility = page === "home" ? "hidden" : "visible";
  $("sidebar").classList.remove("open"); window.scrollTo(0, 0);
  view('<div class="empty">Loading…</div>');
  const pages = { home: homePage, modules: modulesPage, work: workPage, chat: chatPage, profile: profilePage, student: studentPage };
  (pages[page] || homePage)(arg).catch(err => view(`<div class="panel empty">Could not load: ${esc(friendly(err))}</div>`));
}

/* ---------- SOCIAL LINKS ---------- */
// key: [label, icon, brand colour, url builder, placeholder]
const SOC = {
  instagram: ["Instagram", "fa-instagram", "#E1306C", v => "https://instagram.com/" + v, "username"],
  facebook: ["Facebook", "fa-facebook-f", "#1877F2", v => "https://facebook.com/" + v, "profile name or full link"],
  x: ["X", "fa-x-twitter", "#111111", v => "https://x.com/" + v, "username"],
  tiktok: ["TikTok", "fa-tiktok", "#010101", v => "https://tiktok.com/@" + v, "username"],
  linkedin: ["LinkedIn", "fa-linkedin-in", "#0A66C2", v => "https://linkedin.com/in/" + v, "profile name or full link"],
  whatsapp: ["WhatsApp", "fa-whatsapp", "#25D366", v => "https://wa.me/" + v.replace(/\D/g, ""), "phone number e.g. 2557…"],
  github: ["GitHub", "fa-github", "#24292f", v => "https://github.com/" + v, "username"],
  youtube: ["YouTube", "fa-youtube", "#FF0000", v => "https://youtube.com/@" + v, "channel name"]
};
const socUrl = (k, v) => { v = String(v || "").trim(); if (!v) return ""; if (/^https?:\/\//i.test(v)) return v; return SOC[k][3](k === "whatsapp" ? v : encodeURIComponent(v.replace(/^@/, ""))); };
const socButtons = s => Object.keys(SOC).filter(k => s?.[k]).map(k => `<a class="soc" style="--c:${SOC[k][2]}" target="_blank" rel="noopener noreferrer" href="${esc(socUrl(k, s[k]))}"><i class="fa-brands ${SOC[k][1]}"></i> ${SOC[k][0]}</a>`).join("");
const PROVIDERS = { "google.com": ["Google", "fa-google", "#DB4437", () => new firebase.auth.GoogleAuthProvider()], "facebook.com": ["Facebook", "fa-facebook-f", "#1877F2", () => new firebase.auth.FacebookAuthProvider()], "twitter.com": ["X", "fa-x-twitter", "#111111", () => new firebase.auth.TwitterAuthProvider()] };

/* ---------- HOME ---------- */
async function homePage() {
  const n = (await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).size;
  view(head("Welcome, " + esc(profile.fullName.split(" ")[0]), "Here is a summary of your academic space.") + `
  <div class="stats">
    <div class="stat"><div class="stat-icon"><i class="fa-solid fa-book-open"></i></div><div><strong>${n}</strong><span>Registered modules</span></div></div>
    <div class="stat"><div class="stat-icon"><i class="fa-solid fa-id-card"></i></div><div><strong style="font-size:15px">${esc(profile.regNo || "—")}</strong><span>Registration number</span></div></div>
    <div class="stat"><div class="stat-icon"><i class="fa-solid fa-calendar"></i></div><div><strong style="font-size:15px">${esc(profile.year || "—")}</strong><span>Year of study</span></div></div>
  </div>
  <div class="cols">
    <div class="panel"><h3>My details</h3>
      <div class="list-item"><div><strong>Programme</strong><small>${esc(profile.course || "—")}</small></div></div>
      <div class="list-item"><div><strong>Phone</strong><small>${esc(profile.phone || "—")}</small></div></div>
      <div class="list-item"><div><strong>Email</strong><small>${esc(profile.email || me.email)}</small></div></div></div>
    <div class="panel"><h3>Quick access</h3><div class="row-btns">
      <a class="btn btn-light" href="#/modules"><i class="fa-solid fa-book-open"></i> Modules</a>
      <a class="btn btn-light" href="#/work"><i class="fa-solid fa-list-check"></i> Assignments</a>
      <a class="btn btn-light" href="#/chat"><i class="fa-solid fa-comments"></i> Chat</a>
      <a class="btn btn-light" href="#/profile"><i class="fa-solid fa-user"></i> Profile</a></div>
      ${socButtons(profile.social) ? `<h3 style="margin-top:20px">My links</h3><div class="soc-row">${socButtons(profile.social)}</div>` : ""}</div>
  </div>`);
}

/* ---------- PROFILE ---------- */
async function profilePage() {
  const linked = Object.fromEntries(me.providerData.map(p => [p.providerId, p]));
  const opt = ["Year 1", "Year 2", "Year 3", "Year 4"].map(y => `<option ${profile.year === y ? "selected" : ""}>${y}</option>`).join("");
  const s = profile.social || {};
  view(head("My Profile", "Keep your details up to date so lecturers and classmates can find you.") + `
  <form id="pf">
  <div class="panel"><h3>Student details</h3><div class="form-grid">
    <div class="field"><label>Full name</label><input id="pName" value="${esc(profile.fullName)}"></div>
    <div class="field"><label>Phone number</label><input id="pPhone" type="tel" value="${esc(profile.phone)}"></div>
    <div class="field"><label>Registration number</label><input value="${esc(profile.regNo)}" disabled></div>
    <div class="field"><label>Email</label><input value="${esc(profile.email || me.email)}" disabled></div>
    <div class="field"><label>Programme</label><input id="pCourse" value="${esc(profile.course)}"></div>
    <div class="field"><label>Year of study</label><select id="pYear"><option value="">Select</option>${opt}</select></div>
    <div class="field"><label>Emergency contact phone</label><input id="pEmerg" type="tel" value="${esc(profile.emergency)}"></div>
    <div class="field"><label>About me</label><input id="pBio" maxlength="160" value="${esc(profile.bio)}" placeholder="A short line about you"></div></div></div>
  <div class="panel"><h3>Social profiles</h3><p class="subtle" style="margin-top:-6px">Add your username or paste the full link. These buttons show on your profile.</p>
    ${Object.entries(SOC).map(([k, v]) => `<div class="soc-field"><span class="ic" style="--c:${v[2]}"><i class="fa-brands ${v[1]}"></i></span><input data-soc="${k}" placeholder="${v[0]} — ${v[4]}" value="${esc(s[k])}"></div>`).join("")}
    <button class="btn btn-primary" type="submit" style="margin-top:8px">Save profile</button></div></form>
  <div class="panel"><h3>Verified accounts</h3><p class="subtle" style="margin-top:-6px">Connect your real account so you can also sign in with it.</p>
  <div class="social-grid">${Object.entries(PROVIDERS).map(([id, [nm, ic, col]]) => { const l = linked[id]; return `<div class="social-card"><div class="nm"><span class="avatar" style="background:${col};color:#fff;width:34px;height:34px"><i class="fa-brands ${ic}"></i></span> ${nm}</div>
    ${l ? `<small><span class="tag green">CONNECTED</span> ${esc(l.displayName || l.email || "")}</small><button class="btn btn-danger btn-sm" data-act="unlink" data-id="${id}">Disconnect</button>` : `<small>Not connected</small><button class="btn btn-light btn-sm" data-act="link" data-id="${id}">Connect</button>`}</div>`; }).join("")}</div></div>`);
  $("pf").onsubmit = async e => {
    e.preventDefault();
    const social = {}; document.querySelectorAll("[data-soc]").forEach(i => { if (i.value.trim()) social[i.dataset.soc] = i.value.trim(); });
    const u = { fullName: $("pName").value.trim(), phone: $("pPhone").value.trim(), course: $("pCourse").value.trim(), year: $("pYear").value, emergency: $("pEmerg").value.trim(), bio: $("pBio").value.trim(), social };
    if (!u.fullName) return toast("Name is required.", true);
    try { await db.collection("students").doc(me.uid).update(u); profile = { ...profile, ...u }; $("topName").textContent = u.fullName; $("avatar").textContent = u.fullName[0].toUpperCase(); toast("Profile saved."); }
    catch (err) { toast(friendly(err), true); }
  };
}

/* ---------- OTHER STUDENT'S PROFILE ---------- */
async function studentPage([uid]) {
  const d = await db.collection("students").doc(uid || "x").get();
  if (!d.exists) return view('<div class="panel empty">Profile not found.</div>');
  const s = d.data();
  view(head("Student profile", "") + `<div class="panel"><div class="profile-hero"><span class="avatar">${esc((s.fullName || "S")[0])}</span>
    <div><h2 style="margin:0;color:var(--navy)">${esc(s.fullName)}</h2><p class="subtle" style="margin:4px 0">${esc(s.role === "student" ? (s.course || "") + (s.year ? " · " + s.year : "") : "Lecturer")}</p>
    <p class="subtle" style="margin:0">${esc(s.bio)}</p></div></div>
    ${isStaff() ? `<div class="list-item"><div><strong>Reg no / Phone</strong><small>${esc(s.regNo)} · ${esc(s.phone)} · ${esc(s.email)}</small></div></div>` : ""}
    ${socButtons(s.social) ? `<h3 style="margin-top:20px">Links</h3><div class="soc-row">${socButtons(s.social)}</div>` : ""}
    ${uid !== me.uid ? `<a class="btn btn-primary" style="margin-top:20px" href="#/chat/dm/${esc(uid)}"><i class="fa-solid fa-comment"></i> Send message</a>` : ""}</div>`);
}

/* ---------- MODULES (student) ---------- */
async function modulesPage() {
  const mods = (await db.collection("modules").get()).docs.map(d => ({ id: d.id, ...d.data() }));
  const my = new Set((await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).docs.map(d => d.data().moduleId));
  view(head("Modules", "Register for the modules you take. Only you and the module lecturer can see your registration.") + `<div class="panel">${mods.map(m => `
    <div class="list-item"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>Lecturer: ${esc(m.teacherName || "—")}</small><small>${esc(m.description)}</small>
    ${safeUrl(m.resource) ? `<small><a href="${safeUrl(m.resource)}" target="_blank" rel="noopener">Open learning resource</a></small>` : ""}</div>
    ${my.has(m.id) ? `<div class="row-btns"><span class="tag green">REGISTERED</span><button class="btn btn-danger btn-sm" data-act="drop" data-id="${m.id}">Drop</button></div>` : `<button class="btn btn-primary btn-sm" data-act="enroll" data-id="${m.id}" data-t="${esc(m.teacherId)}" data-n="${esc(m.code + " " + m.name)}">Register</button>`}</div>`).join("") || '<div class="empty">No modules have been published yet.</div>'}</div>`);
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
  if (kind === "class") { room = slug(profile.course); title = (profile.course || "My class") + " — class room"; }
  if (kind === "dm" && other) {
    room = [me.uid, other].sort().join("_");
    const d = await db.collection("students").doc(other).get();
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
  const fmt = t => { if (!t) return "sending…"; const d = t.toDate(), now = new Date(); return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (d.toDateString() === now.toDateString() ? "" : " · " + d.toLocaleDateString([], { day: "numeric", month: "short" })); };
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

  const all = (await db.collection("students").limit(300).get()).docs.filter(d => d.id !== me.uid).map(d => ({ id: d.id, ...d.data() }));
  if (tok !== navTok) return;
  const draw = q => { const l = all.filter(s => (s.fullName || "").toLowerCase().includes(q.toLowerCase())).slice(0, 40); const p = $("people"); if (p) p.innerHTML = l.map(s => `<a class="nav-btn${other === s.id ? " active" : ""}" href="#/chat/dm/${s.id}"><span class="avatar" style="width:30px;height:30px;font-size:12px">${esc((s.fullName || "?")[0])}</span><span>${esc(s.fullName)}<br><small style="color:var(--muted);font-weight:500">${esc(s.role === "student" ? s.course : "Lecturer")}</small></span></a>`).join("") || '<div class="empty">No one found.</div>'; };
  draw(""); $("pSearch").oninput = e => draw(e.target.value);
}

/* ---------- BUTTON ACTIONS ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const { act, id } = b.dataset; b.disabled = true;
  try {
    if (act === "enroll") {
      await db.collection("moduleEnrollments").doc(me.uid + "_" + id).set({ studentId: me.uid, moduleId: id, moduleName: b.dataset.n, teacherId: b.dataset.t, studentName: profile.fullName, regNo: profile.regNo || "", phone: profile.phone || "", year: profile.year || "", course: profile.course || "", enrolledAt: firebase.firestore.FieldValue.serverTimestamp() });
      toast("Registered successfully."); route();
    } else if (act === "drop") {
      if (!confirm("Drop this module?")) return (b.disabled = false);
      await db.collection("moduleEnrollments").doc(me.uid + "_" + id).delete(); toast("Module dropped."); route();
    } else if (act === "link") { await me.linkWithPopup(PROVIDERS[id][3]()); toast(PROVIDERS[id][0] + " connected."); route(); }
    else if (act === "unlink") { await me.unlink(id); toast("Disconnected."); route(); }
  } catch (err) { toast(friendly(err), true); b.disabled = false; }
});
