// CampusHub — application logic
let me = null, profile = {}, unsub = null, signingUp = false, regMode = false;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isStaff = () => ["teacher", "admin"].includes(profile.role);
const slug = s => "course_" + String(s || "general").toLowerCase().replace(/[^a-z0-9]+/g, "_");
const view = html => { $("view").innerHTML = html; };
const head = (t, p) => `<div class="page-head"><h1>${t}</h1><p>${p}</p></div>`;

function toast(msg, err) {
  const t = $("toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(t._t); t._t = setTimeout(() => (t.className = "toast"), 3500);
}
function authMsg(text, err = true) { const b = $("authMsg"); b.textContent = text; b.className = "notice" + (err ? " error" : ""); }
function friendly(e) {
  const m = { "auth/invalid-credential": "Wrong email or password.", "auth/invalid-email": "Enter a valid email address.", "auth/email-already-in-use": "This email is already registered. Please sign in.", "auth/weak-password": "Password must be at least 6 characters.", "auth/network-request-failed": "No internet connection.", "auth/too-many-requests": "Too many attempts. Try again later.", "auth/popup-closed-by-user": "Window was closed before finishing.", "auth/credential-already-in-use": "This account is already linked to another user.", "auth/operation-not-allowed": "This sign-in provider is not enabled yet in Firebase." };
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
  $("password").autocomplete = reg ? "new-password" : "current-password";
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
    if (!d.exists) { authMsg("Student profile not found."); await auth.signOut(); return; }
    profile = d.data(); enter();
  } catch (err) { authMsg(friendly(err)); $("authScreen").classList.remove("hidden"); }
});

function enter() {
  $("authScreen").classList.add("hidden"); $("app").classList.remove("hidden");
  $("topName").textContent = profile.fullName;
  $("avatar").textContent = (profile.fullName || "S").charAt(0).toUpperCase();
  $("roleLabel").textContent = isStaff() ? "Lecturer portal" : (profile.course || "Student portal");
  if (!location.hash) history.replaceState(null, "", "#/home");
  route();
}
$("logoutBtn").onclick = () => auth.signOut();
$("menuBtn").onclick = () => $("sidebar").classList.toggle("open");
$("backBtn").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/home"));

/* ---------- ROUTER (browser back button works) ---------- */
window.addEventListener("hashchange", route);
function route() {
  if (!me || !profile.fullName) return;
  if (unsub) { unsub(); unsub = null; }
  const [page = "home", ...arg] = location.hash.replace(/^#\/?/, "").split("/");
  const titles = { home: "Overview", modules: "Modules", work: "Assignments & Tests", chat: "Chat", profile: "My Profile" };
  $("pageTitle").textContent = titles[page] || "Overview";
  document.querySelectorAll(".nav-btn[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === page));
  $("backBtn").style.visibility = page === "home" ? "hidden" : "visible";
  $("sidebar").classList.remove("open"); window.scrollTo(0, 0);
  view('<div class="empty">Loading…</div>');
  const pages = { home: homePage, modules: modulesPage, work: workPage, chat: chatPage, profile: profilePage };
  (pages[page] || homePage)(arg).catch(err => view(`<div class="panel empty">Could not load: ${esc(err.message)}</div>`));
}

/* ---------- HOME ---------- */
async function homePage() {
  const q = isStaff() ? db.collection("modules").where("teacherId", "==", me.uid) : db.collection("moduleEnrollments").where("studentId", "==", me.uid);
  const n = (await q.get()).size;
  view(head("Welcome, " + esc(profile.fullName.split(" ")[0]), "Here is a summary of your academic space.") + `
  <div class="stats">
    <div class="stat"><div class="stat-icon"><i class="fa-solid fa-book-open"></i></div><div><strong>${n}</strong><span>${isStaff() ? "Modules you teach" : "Registered modules"}</span></div></div>
    <div class="stat"><div class="stat-icon"><i class="fa-solid fa-id-card"></i></div><div><strong style="font-size:15px">${esc(profile.regNo || "—")}</strong><span>Registration number</span></div></div>
    <div class="stat"><div class="stat-icon"><i class="fa-solid fa-calendar"></i></div><div><strong style="font-size:15px">${esc(profile.year || (isStaff() ? "Staff" : "—"))}</strong><span>Year / Role</span></div></div>
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
      <a class="btn btn-light" href="#/profile"><i class="fa-solid fa-user"></i> Profile</a></div></div>
  </div>`);
}

/* ---------- PROFILE + ACCOUNT LINKING ---------- */
const PROVIDERS = { "google.com": ["Google", "fa-google", () => new firebase.auth.GoogleAuthProvider()], "facebook.com": ["Facebook", "fa-facebook", () => new firebase.auth.FacebookAuthProvider()], "twitter.com": ["X (Twitter)", "fa-x-twitter", () => new firebase.auth.TwitterAuthProvider()] };

async function profilePage() {
  const linked = Object.fromEntries(me.providerData.map(p => [p.providerId, p]));
  const opt = ["Year 1", "Year 2", "Year 3", "Year 4"].map(y => `<option ${profile.year === y ? "selected" : ""}>${y}</option>`).join("");
  view(head("My Profile", "Keep your details up to date so lecturers and classmates can reach you.") + `
  <div class="panel"><h3>Student details</h3>
  <form id="pf"><div class="form-grid">
    <div class="field"><label>Full name</label><input id="pName" value="${esc(profile.fullName)}"></div>
    <div class="field"><label>Phone number</label><input id="pPhone" type="tel" value="${esc(profile.phone)}"></div>
    <div class="field"><label>Registration number</label><input value="${esc(profile.regNo)}" disabled></div>
    <div class="field"><label>Email</label><input value="${esc(profile.email || me.email)}" disabled></div>
    <div class="field"><label>Programme</label><input id="pCourse" value="${esc(profile.course)}"></div>
    <div class="field"><label>Year of study</label><select id="pYear"><option value="">Select</option>${opt}</select></div>
    <div class="field"><label>Guardian / emergency phone</label><input id="pEmerg" type="tel" value="${esc(profile.emergency)}"></div>
    <div class="field"><label>Instagram username</label><input id="pInsta" placeholder="username" value="${esc(profile.instagram)}"></div>
    <div class="field full"><label>About me</label><input id="pBio" maxlength="160" value="${esc(profile.bio)}" placeholder="A short line about you"></div>
  </div><button class="btn btn-primary" type="submit">Save changes</button></form></div>
  <div class="panel"><h3>Connected accounts</h3>
  <p class="subtle" style="margin-top:-6px">Link your own social accounts to your CampusHub profile.</p>
  <div class="social-grid">${Object.entries(PROVIDERS).map(([id, [nm, ic]]) => { const l = linked[id]; return `<div class="social-card"><div class="nm"><i class="fa-brands ${ic}"></i> ${nm}</div>
    ${l ? `<small>Connected as ${esc(l.displayName || l.email || "your account")}</small><button class="btn btn-danger btn-sm" data-act="unlink" data-id="${id}">Disconnect</button>` : `<small>Not connected</small><button class="btn btn-light btn-sm" data-act="link" data-id="${id}">Connect</button>`}</div>`; }).join("")}
    ${profile.instagram ? `<div class="social-card"><div class="nm"><i class="fa-brands fa-instagram"></i> Instagram</div><small>@${esc(profile.instagram)}</small><a class="btn btn-light btn-sm" target="_blank" rel="noopener" href="https://instagram.com/${encodeURIComponent(profile.instagram)}">Open profile</a></div>` : ""}
  </div></div>`);
  $("pf").onsubmit = async e => {
    e.preventDefault();
    const u = { fullName: $("pName").value.trim(), phone: $("pPhone").value.trim(), course: $("pCourse").value.trim(), year: $("pYear").value, emergency: $("pEmerg").value.trim(), instagram: $("pInsta").value.trim().replace(/^@/, ""), bio: $("pBio").value.trim() };
    if (!u.fullName) return toast("Name is required.", true);
    try { await db.collection("students").doc(me.uid).update(u); profile = { ...profile, ...u }; $("topName").textContent = u.fullName; $("avatar").textContent = u.fullName[0].toUpperCase(); toast("Profile saved."); }
    catch (err) { toast(friendly(err), true); }
  };
}

/* ---------- MODULES ---------- */
async function modulesPage() {
  const mods = (await db.collection("modules").get()).docs.map(d => ({ id: d.id, ...d.data() }));
  if (isStaff()) {
    const mine = mods.filter(m => m.teacherId === me.uid);
    const enr = (await db.collection("moduleEnrollments").where("teacherId", "==", me.uid).get()).docs.map(d => d.data());
    view(head("Modules", "Create your modules. Only students who register will appear under them.") + `
    <div class="panel"><h3>Create a module</h3><form id="mf"><div class="form-grid">
      <div class="field"><label>Module code</label><input id="mCode" placeholder="e.g. ETU 07101"></div>
      <div class="field"><label>Module name</label><input id="mName"></div>
      <div class="field full"><label>Description (optional)</label><input id="mDesc"></div>
      <div class="field full"><label>Learning resource link (optional)</label><input id="mLink" type="url" placeholder="https://"></div>
    </div><button class="btn btn-primary" type="submit">Create module</button></form></div>
    <div class="panel"><h3>My modules</h3>${mine.map(m => { const st = enr.filter(x => x.moduleId === m.id); return `<div class="list-item" style="display:block">
      <div style="display:flex;justify-content:space-between;gap:10px"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>${esc(m.description)}</small></div><span class="tag green">${st.length} student${st.length === 1 ? "" : "s"}</span></div>
      <details style="margin-top:10px"><summary style="cursor:pointer;font-size:12px;color:var(--blue);font-weight:700">View registered students</summary>
      ${st.length ? `<div style="overflow:auto"><table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse">${st.map(s => `<tr><td style="padding:7px 4px;border-bottom:1px solid #edf1f4"><b>${esc(s.studentName)}</b></td><td>${esc(s.regNo)}</td><td>${esc(s.phone)}</td><td>${esc(s.year)}</td></tr>`).join("")}</table></div>` : '<div class="empty">No student has registered yet.</div>'}</details></div>`; }).join("") || '<div class="empty">You have not created any module yet.</div>'}</div>`);
    $("mf").onsubmit = async e => {
      e.preventDefault();
      const code = $("mCode").value.trim(), name = $("mName").value.trim();
      if (!code || !name) return toast("Module code and name are required.", true);
      try { await db.collection("modules").add({ code, name, description: $("mDesc").value.trim(), resource: $("mLink").value.trim(), teacherId: me.uid, teacherName: profile.fullName, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); toast("Module created."); route(); }
      catch (err) { toast(friendly(err), true); }
    };
    return;
  }
  const my = new Set((await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).docs.map(d => d.data().moduleId));
  view(head("Modules", "Register for the modules you take. Only you and your module lecturer can see the registration.") + `<div class="panel">${mods.map(m => `
    <div class="list-item"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>Lecturer: ${esc(m.teacherName || "—")}</small><small>${esc(m.description)}</small>
    ${m.resource ? `<small><a href="${esc(m.resource)}" target="_blank" rel="noopener">Open learning resource</a></small>` : ""}</div>
    ${my.has(m.id) ? `<div class="row-btns"><span class="tag green">REGISTERED</span><button class="btn btn-danger btn-sm" data-act="drop" data-id="${m.id}">Drop</button></div>` : `<button class="btn btn-primary btn-sm" data-act="enroll" data-id="${m.id}" data-t="${esc(m.teacherId)}" data-n="${esc(m.code + " " + m.name)}">Register</button>`}</div>`).join("") || '<div class="empty">No modules have been published yet.</div>'}</div>`);
}

/* ---------- ASSIGNMENTS & TESTS ---------- */
async function workPage() {
  let items = [], mine = [];
  if (isStaff()) {
    mine = (await db.collection("modules").where("teacherId", "==", me.uid).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    items = (await db.collection("work").where("teacherId", "==", me.uid).get()).docs.map(d => d.data());
  } else {
    const ids = (await db.collection("moduleEnrollments").where("studentId", "==", me.uid).get()).docs.map(d => d.data().moduleId);
    if (!ids.length) return view(head("Assignments & Tests", "Work from your registered modules.") + '<div class="panel empty">Register for a module first to see its assignments and tests.</div>');
    items = (await db.collection("work").where("moduleId", "in", ids.slice(0, 30)).get()).docs.map(d => d.data());
  }
  items.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const form = isStaff() ? `<div class="panel"><h3>Post assignment or test</h3><form id="wf"><div class="form-grid">
    <div class="field"><label>Module</label><select id="wMod">${mine.map(m => `<option value="${m.id}" data-n="${esc(m.code + " " + m.name)}">${esc(m.code)} — ${esc(m.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Type</label><select id="wType"><option value="assignment">Assignment</option><option value="test">Test / Exam</option></select></div>
    <div class="field"><label>Title</label><input id="wTitle"></div><div class="field"><label>Date / deadline</label><input id="wDate" type="date"></div>
    <div class="field full"><label>Details</label><input id="wDet"></div></div><button class="btn btn-primary" type="submit">Publish</button></form></div>` : "";
  const list = t => items.filter(i => i.type === t).map(i => `<div class="list-item"><div><strong>${esc(i.title)}</strong><small>${esc(i.moduleName)}</small><small>${esc(i.details)}</small></div><span class="tag ${t === "test" ? "gold" : ""}">${esc(i.date || "No date")}</span></div>`).join("") || '<div class="empty">Nothing posted yet.</div>';
  view(head("Assignments & Tests", isStaff() ? "Publish work for your own modules." : "Work from your registered modules.") + form + `<div class="cols"><div class="panel"><h3>Assignments</h3>${list("assignment")}</div><div class="panel"><h3>Tests &amp; Exams</h3>${list("test")}</div></div>`);
  if (isStaff()) $("wf").onsubmit = async e => {
    e.preventDefault();
    const sel = $("wMod"), title = $("wTitle").value.trim();
    if (!sel.value || !title) return toast("Choose a module and enter a title.", true);
    try { await db.collection("work").add({ moduleId: sel.value, moduleName: sel.selectedOptions[0].dataset.n, type: $("wType").value, title, date: $("wDate").value, details: $("wDet").value.trim(), teacherId: me.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); toast("Published."); route(); }
    catch (err) { toast(friendly(err), true); }
  };
}

/* ---------- CHAT: general room, class room, private ---------- */
async function chatPage(arg) {
  const [kind = "general", other] = arg;
  const cls = slug(profile.course);
  let room = "general", title = "General room — all students";
  if (kind === "class") { room = cls; title = (profile.course || "My class") + " — class room"; }
  if (kind === "dm" && other) { room = [me.uid, other].sort().join("_"); const d = await db.collection("students").doc(other).get(); title = "Private chat with " + (d.exists ? d.data().fullName : "student"); }
  const act = k => (kind === k ? " active" : "");
  view(head("Chat", "Talk with everyone, your class, or one person privately.") + `<div class="chat-layout">
    <div class="panel rooms"><h3>Rooms</h3>
      <a class="nav-btn${act("general")}" href="#/chat/general"><i class="fa-solid fa-globe"></i> General (everyone)</a>
      <a class="nav-btn${act("class")}" href="#/chat/class"><i class="fa-solid fa-users"></i> My class</a>
      <h3 style="margin-top:18px">Private chat</h3>
      <input class="form-control" id="pSearch" placeholder="Search a person…">
      <div class="people" id="people"><div class="empty">Loading…</div></div></div>
    <div class="panel"><h3>${esc(title)}</h3><div class="chatbox" id="cbox"></div>
      <form class="chat-form" id="cf"><input id="cmsg" placeholder="Write a message…" maxlength="1000" autocomplete="off"><button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button></form></div></div>`);

  const ref = db.collection("chatRooms").doc(room).collection("messages");
  unsub = ref.orderBy("createdAt").limitToLast(100).onSnapshot(s => {
    const b = $("cbox"); if (!b) return;
    b.innerHTML = s.docs.map(d => { const x = d.data(), mine = x.senderId === me.uid; return `<div class="chat-msg${mine ? " mine" : ""}"><div class="chat-meta">${mine ? "You" : esc(x.senderName || "Student")}</div>${esc(x.message)}</div>`; }).join("") || '<div class="empty">No messages yet. Say hello 👋</div>';
    b.scrollTop = b.scrollHeight;
  }, err => { $("cbox").innerHTML = `<div class="empty">Chat unavailable: ${esc(err.message)}</div>`; });

  $("cf").onsubmit = async e => {
    e.preventDefault();
    const t = $("cmsg").value.trim(); if (!t) return;
    $("cmsg").value = "";
    try { await ref.add({ senderId: me.uid, senderName: profile.fullName, message: t, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
    catch (err) { toast("Message failed: " + friendly(err), true); }
  };

  const all = (await db.collection("students").limit(200).get()).docs.filter(d => d.id !== me.uid).map(d => ({ id: d.id, ...d.data() }));
  const draw = q => { const l = all.filter(s => (s.fullName || "").toLowerCase().includes(q.toLowerCase())).slice(0, 40); const p = $("people"); if (p) p.innerHTML = l.map(s => `<a class="nav-btn${other === s.id ? " active" : ""}" href="#/chat/dm/${s.id}"><span class="avatar" style="width:30px;height:30px;font-size:12px">${esc(s.fullName[0])}</span><span>${esc(s.fullName)}<br><small style="color:var(--muted);font-weight:500">${esc(s.role === "student" ? s.course : "Lecturer")}</small></span></a>`).join("") || '<div class="empty">No one found.</div>'; };
  draw(""); $("pSearch").oninput = e => draw(e.target.value);
}

/* ---------- ACTIONS (buttons) ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const { act, id } = b.dataset; b.disabled = true;
  try {
    if (act === "enroll") {
      await db.collection("moduleEnrollments").doc(me.uid + "_" + id).set({ studentId: me.uid, moduleId: id, moduleName: b.dataset.n, teacherId: b.dataset.t, studentName: profile.fullName, regNo: profile.regNo || "", phone: profile.phone || "", year: profile.year || "", course: profile.course || "", enrolledAt: firebase.firestore.FieldValue.serverTimestamp() });
      toast("Registered successfully."); route();
    } else if (act === "drop") {
      if (!confirm("Drop this module?")) return b.disabled = false;
      await db.collection("moduleEnrollments").doc(me.uid + "_" + id).delete(); toast("Module dropped."); route();
    } else if (act === "link") { await me.linkWithPopup(PROVIDERS[id][2]()); toast(PROVIDERS[id][0] + " connected."); route(); }
    else if (act === "unlink") { await me.unlink(id); toast("Disconnected."); route(); }
  } catch (err) { toast(friendly(err), true); b.disabled = false; }
});
