// CampusHub — role-specific teacher and administrator portals
let me = null, profile = {};
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAdmin = () => profile.role === "admin";
let teachersCache = new Map();
const portalRole = document.body.dataset.portal || "admin";
const view = h => { $("view").innerHTML = h; };
const head = (t, p) => `<div class="page-head"><h1>${t}</h1><p>${p}</p></div>`;
const ms = t => (t ? new Date(t).getTime() : 0);
const safeUrl = u => (/^https?:\/\//i.test(u || "") ? esc(u) : "");
const col = n => db.collection(n);
function toast(m, err) { const t = $("toast"); t.textContent = m; t.className = "toast show" + (err ? " err" : ""); clearTimeout(t._t); t._t = setTimeout(() => (t.className = "toast"), 3800); }
const fail = e => toast(e.code === "permission-denied" ? "Permission denied. Check the Supabase SQL policies and user role." : e.message, true);

auth.onAuthStateChanged(async u => {
  if (!u) return location.replace("index.html");
  me = u;
  try {
    const d = await col("students").doc(u.uid).get();
    profile = d.exists ? d.data() : {};
  } catch (e) { return location.replace("index.html"); }
  if (profile.role !== portalRole) {
    if (profile.role === "admin") return location.replace("admin.html");
    if (profile.role === "teacher") return location.replace("teacher.html");
    return location.replace("index.html");
  }
  $("topName").textContent = profile.fullName; $("avatar").textContent = (profile.fullName || "T")[0].toUpperCase();
  $("roleLabel").textContent = isAdmin() ? "Administrator" : "Teacher";
  const usersLink = $("usersLink");
  if (usersLink) usersLink.classList.toggle("hidden", !isAdmin());
  $("app").classList.remove("hidden");
  if (!location.hash) history.replaceState(null, "", "#/dashboard");
  route();
});
$("logoutBtn").onclick = () => auth.signOut();
$("menuBtn").onclick = () => (innerWidth > 800 ? $("app").classList.toggle("mini") : $("sidebar").classList.toggle("open"));
$("backBtn").onclick = () => (history.length > 1 ? history.back() : (location.hash = "#/dashboard"));
window.addEventListener("hashchange", route);

const myModules = async () => (await (isAdmin() ? col("modules") : col("modules").where("teacherId", "==", me.uid)).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const myEnr = async () => (await (isAdmin() ? col("moduleEnrollments") : col("moduleEnrollments").where("teacherId", "==", me.uid)).get()).docs.map(d => d.data());
const myWork = async () => (await (isAdmin() ? col("work") : col("work").where("teacherId", "==", me.uid)).get()).docs.map(d => ({ id: d.id, ...d.data() }));

function route() {
  if (!me) return;
  const [page = "dashboard", ...arg] = location.hash.replace(/^#\/?/, "").split("/");
  const titles = { dashboard: "Dashboard", modules: "Modules", module: "Module", work: "Assignments & Tests", students: "My Students", users: "Manage Users", results: "Results Management", timetable: "Timetable" };
  $("pageTitle").textContent = titles[page] || "Dashboard";
  document.querySelectorAll(".side-link[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === (page === "module" ? "modules" : page)));
  $("backBtn").style.visibility = page === "dashboard" ? "hidden" : "visible";
  $("sidebar").classList.remove("open"); window.scrollTo(0, 0);
  view('<div class="empty">Loading…</div>');
  const pages = { dashboard: isAdmin() ? adminDashboard : dashboard, modules, module: modulePage, work: workAll, students, users, results, timetable };
  (pages[page] || dashboard)(arg).catch(e => view(`<div class="panel empty">Could not load: ${esc(e.message)}</div>`));
}

/* ----- helpers ----- */
const stat = (ic, n, l) => `<div class="stat"><div class="stat-icon"><i class="fa-solid ${ic}"></i></div><div><strong>${n}</strong><span>${l}</span></div></div>`;
const workRow = (w, del = true) => `<div class="list-item"><div><strong>${esc(w.title)}</strong><small>${esc(w.moduleName)} · ${w.type === "test" ? "Test / Exam" : "Assignment"}</small><small>${esc(w.details)}</small>${safeUrl(w.link) ? `<small><a href="${safeUrl(w.link)}" target="_blank" rel="noopener">Material link</a></small>` : ""}</div>
  <div class="row-btns"><span class="tag ${w.type === "test" ? "gold" : ""}">${esc(w.date || "No date")}</span>${del ? `<button class="btn btn-danger btn-sm" data-act="delwork" data-id="${w.id}"><i class="fa-solid fa-trash"></i></button>` : ""}</div></div>`;
const workForm = mods => `<form id="wf"><div class="form-grid">
  <div class="field"><label>Module</label><select id="wMod">${mods.map(m => `<option value="${m.id}" data-n="${esc(m.code + " " + m.name)}" data-t="${esc(m.teacherId)}">${esc(m.code)} — ${esc(m.name)}</option>`).join("")}</select></div>
  <div class="field"><label>Type</label><select id="wType"><option value="assignment">Assignment</option><option value="test">Test / Exam</option></select></div>
  <div class="field"><label>Title</label><input id="wTitle"></div>
  <div class="field"><label>Date / deadline</label><input id="wDate" type="date"></div>
  <div class="field full"><label>Instructions / details</label><input id="wDet"></div>
  <div class="field full"><label>Material link (Google Drive, PDF, etc. — optional)</label><input id="wLink" type="url" placeholder="https://"></div></div>
  <button class="btn btn-primary" type="submit"><i class="fa-solid fa-upload"></i> Publish</button></form>`;
function noteRow(n) {
  return `<div class="list-item"><div><strong><i class="fa-solid fa-file-pdf"></i> ${esc(n.title)}</strong><small>${esc(n.fileName)} · ${(n.size / 1024 / 1024).toFixed(1)} MB</small></div><div class="row-btns"><button class="btn btn-light btn-sm" data-act="downloadnote" data-path="${esc(n.storagePath)}" data-name="${esc(n.fileName)}"><i class="fa-solid fa-download"></i> Download</button><button class="btn btn-danger btn-sm" data-act="delnote" data-id="${n.id}" data-path="${esc(n.storagePath)}"><i class="fa-solid fa-trash"></i></button></div></div>`;
}
function bindNotesForm(moduleId) {
  const form = $("notesForm"); if (!form) return;
  form.onsubmit = async e => {
    e.preventDefault();
    const input = $("notesFile"), file = input.files && input.files[0], title = $("notesTitle").value.trim();
    if (!file || !title) return toast("Enter a notes title and choose a PDF file.", true);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return toast("Only PDF notes are supported.", true);
    if (file.size > 20 * 1024 * 1024) return toast("PDF must be 20 MB or smaller.", true);
    const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "notes.pdf";
    const storagePath = `moduleNotes/${moduleId}/${me.uid}_${Date.now()}_${safeName}`;
    try {
      const uploaded = await firebase.storage().ref(storagePath).put(file, { contentType: "application/pdf", customMetadata: { moduleId, uploadedBy: me.uid } });
      try {
        await col("notes").add({ moduleId, moduleName: $("notesModuleName").value, title, fileName: file.name, storagePath, contentType: "application/pdf", size: file.size, teacherId: me.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      } catch (err) {
        await uploaded.ref.delete().catch(() => {});
        throw err;
      }
      toast("Notes uploaded successfully."); route();
    } catch (err) { fail(err); btn.disabled = false; }
  };
}
function bindWorkForm(modId) {
  const f = $("wf"); if (!f) return;
  if (modId) $("wMod").value = modId;
  f.onsubmit = async e => {
    e.preventDefault();
    const s = $("wMod"), title = $("wTitle").value.trim(), link = $("wLink").value.trim();
    if (!s.value || !title) return toast("Choose a module and enter a title.", true);
    if (link && !/^https?:\/\//i.test(link)) return toast("Link must start with https://", true);
    try { await col("work").add({ moduleId: s.value, moduleName: s.selectedOptions[0].dataset.n, type: $("wType").value, title, date: $("wDate").value, details: $("wDet").value.trim(), link, teacherId: s.selectedOptions[0].dataset.t, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); toast("Published. Registered students can see it now."); route(); }
    catch (err) { fail(err); }
  };
}

/* ----- dashboard ----- */
async function dashboard() {
  const [mods, enr, work] = await Promise.all([myModules(), myEnr(), myWork()]);
  const today = new Date().toISOString().slice(0, 10);
  const up = work.filter(w => w.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const recent = [...enr].sort((a, b) => ms(b.enrolledAt) - ms(a.enrolledAt)).slice(0, 6);
  view(head("Welcome, " + esc((profile.fullName || "").split(" ")[0]), "Monitor your modules, students and published work.") + `
  <div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">${stat("fa-book-open", mods.length, "Modules")}${stat("fa-user-graduate", new Set(enr.map(e => e.studentId)).size, "Students")}${stat("fa-file-pen", work.filter(w => w.type !== "test").length, "Assignments")}${stat("fa-clipboard-check", work.filter(w => w.type === "test").length, "Tests / Exams")}</div>
  <div class="cols"><div class="panel"><h3>Upcoming deadlines</h3>${up.map(w => workRow(w, false)).join("") || '<div class="empty">Nothing upcoming.</div>'}</div>
  <div class="panel"><h3>Latest registrations</h3>${recent.map(r => `<div class="list-item"><div><strong>${esc(r.studentName)}</strong><small>${esc(r.regNo)} · ${esc(r.moduleName)}</small></div></div>`).join("") || '<div class="empty">No registrations yet.</div>'}</div></div>`);
}

/* ----- administrator overview ----- */
async function adminDashboard() {
  const [mods, enr, work, usersSnap] = await Promise.all([
    myModules(), myEnr(), myWork(), col("students").get()
  ]);
  const users = usersSnap.docs.map(d => d.data());
  const teachers = users.filter(u => u.role === "teacher").length;
  const studentsCount = users.filter(u => u.role === "student").length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = work.filter(w => w.date && w.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  view(head("System overview", "Manage CampusHub users, academic modules and published work.") + `
    <div class="stats admin-stats">
      ${stat("fa-users", users.length, "Total accounts")}
      ${stat("fa-user-graduate", studentsCount, "Students")}
      ${stat("fa-chalkboard-user", teachers, "Teachers")}
      ${stat("fa-book-open", mods.length, "Modules")}
    </div>
    <div class="admin-shortcuts">
      <a class="admin-shortcut" href="#/users"><i class="fa-solid fa-user-gear"></i><span><b>Manage accounts</b><small>Assign student, teacher and admin roles</small></span><i class="fa-solid fa-arrow-right"></i></a>
      <a class="admin-shortcut" href="#/modules"><i class="fa-solid fa-book"></i><span><b>Academic modules</b><small>Review all modules and enrolments</small></span><i class="fa-solid fa-arrow-right"></i></a>
      <a class="admin-shortcut" href="#/students"><i class="fa-solid fa-users"></i><span><b>Student activity</b><small>View enrolments across the platform</small></span><i class="fa-solid fa-arrow-right"></i></a>
    </div>
    <div class="cols">
      <div class="panel"><h3>Upcoming academic deadlines</h3>${upcoming.map(w => workRow(w, false)).join("") || '<div class="empty">No upcoming deadlines.</div>'}</div>
      <div class="panel"><h3>Platform activity</h3>
        <div class="admin-metric"><span>Published assignments</span><b>${work.filter(w => w.type !== "test").length}</b></div>
        <div class="admin-metric"><span>Tests and exams</span><b>${work.filter(w => w.type === "test").length}</b></div>
        <div class="admin-metric"><span>Module registrations</span><b>${enr.length}</b></div>
      </div>
    </div>`);
}

/* ----- modules ----- */
async function modules() {
  const [mods, enr, teacherDocs] = await Promise.all([
    myModules(), myEnr(),
    isAdmin() ? col("students").where("role", "==", "teacher").get() : Promise.resolve({ docs: [] })
  ]);
  const teachers = teacherDocs.docs.map(d => ({ id: d.id, ...d.data() }));
  teachersCache = new Map(teachers.map(t => [t.id, t]));
  const teacherOptions = selected => teachers.map(t => `<option value="${esc(t.id)}" ${t.id === selected ? "selected" : ""}>${esc(t.fullName || t.email || t.id)}</option>`).join("");
  view(head("Modules", isAdmin() ? "Create modules and assign each module to its lecturer." : "Create modules for your classes. Students register themselves and appear under the module.") + `
  <div class="panel"><h3>Create a module</h3><form id="mf"><div class="form-grid">
    <div class="field"><label>Module code</label><input id="mCode" placeholder="e.g. ETU 07101" required></div><div class="field"><label>Module name</label><input id="mName" required></div>
    <div class="field full"><label>Description (optional)</label><input id="mDesc"></div>
    <div class="field full"><label>Learning resource link (optional)</label><input id="mLink" type="url" placeholder="https://"></div>
    ${isAdmin() ? `<div class="field full"><label>Assign lecturer</label><select id="mTeacher" required><option value="">Select a teacher</option>${teacherOptions("")}</select></div>` : ""}
  </div><button class="btn btn-primary" type="submit">Create module</button></form></div>
  <div class="panel"><h3>${isAdmin() ? "All modules" : "My modules"}</h3>${mods.map(m => `<div class="list-item"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>${esc(m.teacherName || "Lecturer not assigned")} · ${enr.filter(e => e.moduleId === m.id).length} students</small></div><div class="row-btns">${isAdmin() ? `<select data-module-teacher="${esc(m.id)}" aria-label="Assign lecturer">${teacherOptions(m.teacherId)}</select><button class="btn btn-light btn-sm" data-act="assignteacher" data-id="${esc(m.id)}">Save lecturer</button>` : ""}<a class="btn btn-light btn-sm" href="#/module/${esc(m.id)}">Open</a></div></div>`).join("") || '<div class="empty">No modules yet.</div>'}</div>`);
  $("mf").onsubmit = async e => {
    e.preventDefault();
    const code = $("mCode").value.trim(), name = $("mName").value.trim(), resource = $("mLink").value.trim();
    if (!code || !name) return toast("Module code and name are required.", true);
    if (resource && !/^https?:\/\//i.test(resource)) return toast("Link must start with https://", true);
    const assigned = isAdmin() ? teachers.find(t => t.id === $("mTeacher").value) : { id: me.uid, fullName: profile.fullName };
    if (!assigned) return toast("Select a registered teacher for this module.", true);
    try {
      await col("modules").add({ code, name, description: $("mDesc").value.trim(), resource, teacherId: assigned.id, teacherName: assigned.fullName || assigned.email || "Teacher", createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      toast("Module created and assigned to " + (assigned.fullName || "the selected teacher") + ".");
      route();
    } catch (err) { fail(err); }
  };
}


/* ----- assessment results ----- */
/* ----- module workspace, notes and student list ----- */
async function modulePage([moduleId]) {
  if (!moduleId) {
    const mods = await myModules();
    return view(head("Module workspace", "Choose one of your assigned modules.") +
      `<div class="panel">${mods.map(m => `<div class="list-item"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>${esc(m.teacherName || "")}</small></div><a class="btn btn-light btn-sm" href="#/module/${esc(m.id)}">Open</a></div>`).join("") || '<div class="empty">No modules assigned yet.</div>'}</div>`);
  }
  const [moduleSnap, notesSnap, enrollmentSnap] = await Promise.all([
    col("modules").doc(moduleId).get(),
    col("notes").where("moduleId", "==", moduleId).get(),
    col("moduleEnrollments").where("moduleId", "==", moduleId).get()
  ]);
  if (!moduleSnap.exists) throw new Error("Module not found.");
  const mod = moduleSnap.data();
  if (!isAdmin() && mod.teacherId !== me.uid) throw new Error("This module is not assigned to your account.");
  const notes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const enrollments = enrollmentSnap.docs.map(d => d.data());
  view(head(esc(mod.code) + " — " + esc(mod.name), "Module workspace: learning materials and registered students.") +
    `<div class="panel"><h3>Module information</h3><p>${esc(mod.description || "No description added.")}</p><small>Lecturer: ${esc(mod.teacherName || profile.fullName || "—")}</small>${safeUrl(mod.resource) ? `<p><a href="${safeUrl(mod.resource)}" target="_blank" rel="noopener">Open learning resource</a></p>` : ""}</div>
    <div class="panel"><h3><i class="fa-solid fa-file-pdf"></i> Upload notes</h3><p class="subtle">Upload PDF learning materials for students registered in this module. Maximum file size: 20 MB.</p>
      <form id="notesForm"><input type="hidden" id="notesModuleName" value="${esc(mod.code + " — " + mod.name)}"><div class="form-grid">
        <div class="field"><label>Notes title</label><input id="notesTitle" required placeholder="e.g. Chapter 1 — Introduction"></div>
        <div class="field"><label>PDF file</label><input id="notesFile" type="file" accept="application/pdf,.pdf" required></div>
      </div><button class="btn btn-primary" type="submit"><i class="fa-solid fa-upload"></i> Upload notes</button></form>
    </div>
    <div class="panel"><h3>Learning materials</h3>${notes.map(noteRow).join("") || '<div class="empty">No notes uploaded for this module yet.</div>'}</div>
    <div class="panel"><h3>Registered students (${enrollments.length})</h3>${enrollments.map(e => `<div class="list-item"><div><strong>${esc(e.studentName || "Student")}</strong><small>${esc(e.regNo || "")}</small></div></div>`).join("") || '<div class="empty">No students registered yet.</div>'}</div>`);
  bindNotesForm(moduleId);
}
async function workAll() {
  const [mods, work] = await Promise.all([myModules(), myWork()]);
  view(head("Assignments & Tests", "Create assignments and tests for students registered in your modules.") +
    `<div class="panel"><h3>Create assignment or test</h3>${mods.length ? workForm(mods) : '<div class="empty">Create or get assigned a module before publishing work.</div>'}</div>
    <div class="panel"><h3>Published work</h3>${work.map(w => workRow(w)).join("") || '<div class="empty">No assignments or tests published yet.</div>'}</div>`);
  if (mods.length) bindWorkForm();
}
/* ----- class timetable ----- */
async function timetable() {
  const [mods, snap] = await Promise.all([myModules(), isAdmin() ? col("timetable").get() : col("timetable").where("teacherId", "==", me.uid).get()]);
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => days.indexOf(a.day)-days.indexOf(b.day) || String(a.startTime).localeCompare(String(b.startTime)));
  const options = mods.map(m => `<option value="${esc(m.id)}">${esc(m.code)} — ${esc(m.name)}</option>`).join("");
  view(head("Class Timetable", "Schedule lessons for your modules. Students see sessions for modules they have registered for.") +
    (mods.length ? `<div class="panel"><h3>Add a class session</h3><form id="timetableForm"><div class="form-grid">
      <div class="field"><label>Module</label><select id="ttModule" required>${options}</select></div>
      <div class="field"><label>Day</label><select id="ttDay" required>${days.map(d=>`<option>${d}</option>`).join("")}</select></div>
      <div class="field"><label>Start time</label><input id="ttStart" type="time" required></div>
      <div class="field"><label>End time</label><input id="ttEnd" type="time" required></div>
      <div class="field full"><label>Room / venue</label><input id="ttVenue" required placeholder="e.g. Lab 2 or Room B12"></div>
    </div><button class="btn btn-primary" type="submit">Save timetable session</button></form></div>` : '<div class="panel empty">No modules are assigned to your account yet.</div>') +
    `<div class="panel"><h3>Scheduled sessions</h3>${entries.length ? entries.map(x=>`<div class="list-item"><div><strong>${esc(x.day)} · ${esc(x.startTime)}–${esc(x.endTime)}</strong><small>${esc(x.moduleName)} · ${esc(x.venue||"Venue not set")}</small><small>Lecturer: ${esc(x.teacherName||"—")}</small></div><button class="btn btn-danger btn-sm" data-act="deltimetable" data-id="${esc(x.id)}">Remove</button></div>`).join("") : '<div class="empty">No sessions have been scheduled yet.</div>'}</div>`);
  const form=$("timetableForm");
  if(form) form.onsubmit=async e=>{
    e.preventDefault();
    const mod=mods.find(m=>m.id===$("ttModule").value), day=$("ttDay").value, startTime=$("ttStart").value, endTime=$("ttEnd").value, venue=$("ttVenue").value.trim();
    if(!mod||!startTime||!endTime||endTime<=startTime||!venue) return toast("Check the module, venue and lesson times. End time must be after start time.",true);
    if(entries.some(x=>x.teacherId===mod.teacherId&&x.day===day&&x.startTime<endTime&&startTime<x.endTime)) return toast("This session overlaps another session in your timetable.",true);
    const btn=form.querySelector('button[type="submit"]'); btn.disabled=true;
    try{
      await col("timetable").add({moduleId:mod.id,moduleName:mod.code+" — "+mod.name,teacherId:mod.teacherId,teacherName:mod.teacherName||profile.fullName||"Teacher",day,startTime,endTime,venue,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      toast("Timetable session saved."); route();
    }catch(err){fail(err);btn.disabled=false;}
  };
}
async function students() {
  const enrollments = await myEnr();
  const unique = new Map();
  enrollments.forEach(e => unique.set(e.studentId, e));
  const rows = [...unique.values()];
  view(head(isAdmin() ? "All Students" : "My Students", "Students registered in your modules.") +
    `<div class="panel"><h3>Student directory (${rows.length})</h3>${rows.map(e => `<div class="list-item"><div><strong>${esc(e.studentName || "Student")}</strong><small>${esc(e.regNo || "")} · ${esc(e.moduleName || "")}</small></div></div>`).join("") || '<div class="empty">No student registrations found.</div>'}</div>`);
}

async function results() {
  const [mods, enr, snap] = await Promise.all([
    myModules(), myEnr(), isAdmin() ? col("results").get() : col("results").where("teacherId", "==", me.uid).get()
  ]);
  const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pending = records.filter(r => r.status === "submitted");
  const approved = records.filter(r => r.status === "approved");
  const returned = records.filter(r => r.status === "returned");
  const statusTag = s => `<span class="tag ${s === "published" ? "green" : s === "returned" ? "gold" : ""}">${esc(s)}</span>`;
  const resultRow = r => `<div class="list-item"><div><strong>${esc(r.studentName || r.regNo)} · ${esc(r.assessmentTitle)}</strong><small>${esc(r.moduleName)} · ${Number(r.score)} / ${Number(r.maxScore)} (${Number(r.percentage).toFixed(1)}%)</small><small>Teacher: ${esc(r.teacherName || "—")} · ${statusTag(r.status)}</small>${r.feedback ? `<small>Admin feedback: ${esc(r.feedback)}</small>` : ""}</div><div class="row-btns">${isAdmin() && r.status === "submitted" ? `<button class="btn btn-light btn-sm" data-act="approve-result" data-id="${r.id}">Approve</button><button class="btn btn-danger btn-sm" data-act="return-result" data-id="${r.id}">Return</button>` : ""}${isAdmin() && r.status === "approved" ? `<button class="btn btn-primary btn-sm" data-act="publish-result" data-id="${r.id}">Publish</button>` : ""}</div></div>`;
  const moduleOptions = mods.map(m => `<option value="${esc(m.id)}" data-name="${esc(m.code + " — " + m.name)}">${esc(m.code)} — ${esc(m.name)}</option>`).join("");
  const enrolledFor = moduleId => enr.filter(e => e.moduleId === moduleId);
  const returnedRows = returned.map(r => `<div class="list-item"><div><strong>${esc(r.studentName)} · ${esc(r.assessmentTitle)}</strong><small>${esc(r.moduleName)} · Returned: ${esc(r.feedback || "Please review the mark.")}</small><div class="row-btns"><label>Score <input type="number" min="0" max="${Number(r.maxScore)}" step="0.01" id="rev-${r.id}" value="${Number(r.score)}" style="width:100px"></label><button class="btn btn-primary btn-sm" data-act="resubmit-result" data-id="${r.id}">Resubmit</button></div></div></div>`).join("");
  view(head("Results Management", isAdmin() ? "Review submitted marks, approve them and publish verified results." : "Enter marks for students registered in your modules and submit them for approval.") +
    (isAdmin() ? `<div class="stats">${stat("fa-hourglass-half", pending.length, "Awaiting review")}${stat("fa-circle-check", approved.length, "Approved")}${stat("fa-eye", records.filter(r => r.status === "published").length, "Published")}</div><div class="panel"><h3>Submitted for review</h3>${pending.map(resultRow).join("") || '<div class="empty">No results awaiting review.</div>'}</div><div class="panel"><h3>Approved — ready to publish</h3>${approved.map(resultRow).join("") || '<div class="empty">No approved results.</div>'}</div><div class="panel"><h3>Published results</h3>${records.filter(r => r.status === "published").map(resultRow).join("") || '<div class="empty">No published results.</div>'}</div>` :
    `<div class="panel"><h3>Enter assessment results</h3>${mods.length ? `<form id="resultForm"><div class="form-grid"><div class="field"><label>Module</label><select id="resultModule" required>${moduleOptions}</select></div><div class="field"><label>Assessment title</label><input id="assessmentTitle" required placeholder="e.g. CAT 1"></div><div class="field"><label>Maximum score</label><input id="maxScore" type="number" min="1" step="0.01" value="100" required></div></div><div id="resultStudents" class="panel"><p class="subtle">Choose a module to load its registered students.</p></div><button class="btn btn-primary" type="submit">Submit marks for admin review</button></form>` : '<div class="empty">No modules assigned to you yet. Ask Admin to assign your modules first.</div>'}</div><div class="panel"><h3>Returned for correction</h3>${returnedRows || '<div class="empty">No returned results.</div>'}</div><div class="panel"><h3>Submission history</h3>${records.filter(r => r.status !== "returned").map(resultRow).join("") || '<div class="empty">No submissions yet.</div>'}</div>`));
  if (!isAdmin() && $("resultForm")) {
    const loadStudents = () => {
      const id = $("resultModule").value, list = enrolledFor(id);
      $("resultStudents").innerHTML = list.length ? `<h4>Registered students (${list.length})</h4>${list.map((e,i) => `<div class="list-item"><div><strong>${esc(e.studentName || "Student")}</strong><small>${esc(e.regNo || "")}</small></div><label>Score <input type="number" name="score_${esc(e.studentId)}" min="0" step="0.01" required style="width:110px"></label></div>`).join("")}` : '<div class="empty">No students are registered in this module.</div>';
    };
    $("resultModule").onchange = loadStudents; loadStudents();
    $("resultForm").onsubmit = async e => {
      e.preventDefault();
      const moduleId = $("resultModule").value, mod = mods.find(m => m.id === moduleId);
      const title = $("assessmentTitle").value.trim(), maxScore = Number($("maxScore").value);
      const list = enrolledFor(moduleId);
      if (!mod || !title || !(maxScore > 0) || !list.length) return toast("Check the assessment details and module registrations.", true);
      const entries = list.map(student => ({ student, score: Number(e.target.elements["score_" + student.studentId].value) }));
      if (entries.some(x => !Number.isFinite(x.score) || x.score < 0 || x.score > maxScore)) return toast("Each score must be between 0 and the maximum score.", true);
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting marks…";
      try {
        const submittedAt = firebase.firestore.FieldValue.serverTimestamp();
        const payload = entries.map(({student,score}) => ({
          moduleId, moduleName: mod.code + " — " + mod.name,
          teacherId: me.uid, teacherName: profile.fullName || "",
          studentId: student.studentId, studentName: student.studentName || "",
          regNo: student.regNo || "", assessmentTitle: title, score, maxScore,
          percentage: score / maxScore * 100, status: "submitted", feedback: "", submittedAt
        }));
        // One database insert keeps the class assessment together if a request fails.
        await col("results").addMany(payload);
        toast("Marks submitted to Admin for review."); route();
      } catch (err) {
        fail(err);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit marks for admin review";
      }
    };
  }
}

async function users() {
  if (!isAdmin()) return view('<div class="panel empty">Administrators only.</div>');
  const all = (await col("students").get()).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
  const rows = q => all.filter(s => ((s.fullName || "") + (s.email || "") + (s.regNo || "")).toLowerCase().includes(q.toLowerCase())).map(s => `<tr><td>${esc(s.fullName)}</td><td>${esc(s.email)}</td><td>${esc(s.regNo)}</td><td><select data-role="${s.id}" ${s.id === me.uid ? "disabled" : ""}>${["student", "teacher", "admin"].map(r => `<option ${s.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></td></tr>`).join("");
  view(head("Manage Users", "Promote a registered account to lecturer or administrator.") + `<div class="panel"><div class="row-btns" style="margin-bottom:14px"><button class="btn btn-light" id="syncProfiles"><i class="fa-solid fa-rotate"></i> Sync public profiles</button></div><p class="subtle">Run this once after deploying the new rules to copy existing directory-safe fields into publicProfiles. It does not copy private contact or guardian details.</p><div class="toolbar"><input class="form-control" id="uq" placeholder="Search name, email or reg no…"></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Reg no</th><th>Role</th></tr></thead><tbody id="urows">${rows("")}</tbody></table></div></div>`);
  $("uq").oninput = e => { $("urows").innerHTML = rows(e.target.value); };
  $("syncProfiles").onclick = async () => {
    const btn = $("syncProfiles"); btn.disabled = true;
    try {
      const batchLimit = 400;
      for (let i = 0; i < all.length; i += batchLimit) {
        const batch = db.batch();
        all.slice(i, i + batchLimit).forEach(s => batch.set(db.collection("publicProfiles").doc(s.id), {
          fullName: s.fullName || "", course: s.course || "", year: s.year || "",
          bio: s.bio || "", social: s.social || {}
        }, { merge: true }));
        await batch.commit();
      }
      toast("Public profiles synchronized.");
    } catch (err) { fail(err); }
    finally { btn.disabled = false; }
  };
}
document.addEventListener("change", async e => {
  const id = e.target.dataset.role; if (!id) return;
  try { await col("students").doc(id).update({ role: e.target.value }); toast("Role updated."); } catch (err) { fail(err); route(); }
});

/* ----- actions ----- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const { act, id } = b.dataset;
  try {
    if (act === "assignteacher") {
      if (!isAdmin()) throw new Error("Only administrators can assign lecturers.");
      const select = document.querySelector(`[data-module-teacher="${CSS.escape(id)}"]`);
      const teacher = teachersCache.get(select?.value);
      if (!select?.value || !teacher) throw new Error("Choose a valid teacher account.");
      const moduleDoc = await col("modules").doc(id).get();
      if (!moduleDoc.exists) throw new Error("Module not found.");
      await col("modules").doc(id).update({ teacherId: teacher.id, teacherName: teacher.fullName || teacher.email || "Teacher" });
      const [enrollments, workItems, notesItems, timetableItems] = await Promise.all([
        col("moduleEnrollments").where("moduleId", "==", id).get(),
        col("work").where("moduleId", "==", id).get(),
        col("notes").where("moduleId", "==", id).get(),
        col("timetable").where("moduleId", "==", id).get()
      ]);
      await Promise.all([
        ...enrollments.docs.map(d => col("moduleEnrollments").doc(d.id).update({ teacherId: teacher.id })),
        ...workItems.docs.map(d => col("work").doc(d.id).update({ teacherId: teacher.id })),
        ...notesItems.docs.map(d => col("notes").doc(d.id).update({ teacherId: teacher.id })),
        ...timetableItems.docs.map(d => col("timetable").doc(d.id).update({ teacherId: teacher.id, teacherName: teacher.fullName || teacher.email || "Teacher" }))
      ]);
      toast("Lecturer assigned. Existing module records were transferred.");
      route();
    }
    if (act === "approve-result" || act === "publish-result" || act === "return-result") {
      if (!isAdmin()) throw new Error("Only Admin can review or publish results.");
      const d = await col("results").doc(id).get();
      if (!d.exists) throw new Error("Result record not found.");
      const current = d.data();
      if (act === "approve-result" && current.status !== "submitted") throw new Error("Only submitted results can be approved.");
      if (act === "publish-result" && current.status !== "approved") throw new Error("Approve the result before publishing.");
      let patch = { reviewedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (act === "approve-result") patch.status = "approved";
      if (act === "publish-result") { patch.status = "published"; patch.publishedAt = firebase.firestore.FieldValue.serverTimestamp(); }
      if (act === "return-result") {
        const feedback = prompt("Reason for returning this result to the teacher:");
        if (!feedback || !feedback.trim()) return;
        patch.status = "returned"; patch.feedback = feedback.trim();
      }
      await col("results").doc(id).update(patch);
      toast(act === "publish-result" ? "Result published to the student." : act === "approve-result" ? "Result approved." : "Result returned to teacher.");
      route();
    }
    if (act === "resubmit-result") {
      if (isAdmin()) throw new Error("Only the teacher can resubmit returned marks.");
      const d = await col("results").doc(id).get();
      if (!d.exists || d.data().teacherId !== me.uid || d.data().status !== "returned") throw new Error("This result cannot be resubmitted.");
      const current = d.data(), score = Number($("rev-" + id).value);
      if (!Number.isFinite(score) || score < 0 || score > Number(current.maxScore)) throw new Error("Enter a valid score.");
      await col("results").doc(id).update({ score, percentage: score / Number(current.maxScore) * 100, status: "submitted", feedback: "", submittedAt: firebase.firestore.FieldValue.serverTimestamp() });
      toast("Corrected result resubmitted."); route();
    }
    if (act === "downloadnote") {
      const url = await firebase.storage().ref(b.dataset.path).getDownloadURL();
      const a = document.createElement("a"); a.href = url; a.download = b.dataset.name || "notes.pdf"; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    }
    if (act === "delnote") {
      if (!confirm("Delete this notes file?")) return;
      await firebase.storage().ref(b.dataset.path).delete();
      await col("notes").doc(id).delete();
      toast("Notes deleted."); route();
    }
    if (act === "deltimetable") { if (!confirm("Remove this timetable session?")) return; await col("timetable").doc(id).delete(); toast("Timetable session removed."); route(); }
    if (act === "delwork") { if (!confirm("Delete this item?")) return; await col("work").doc(id).delete(); toast("Deleted."); route(); }
    if (act === "delmod") {
      if (!confirm("Delete this module with all its registrations and work?")) return;
      const [a, w, n, t] = await Promise.all([col("moduleEnrollments").where("moduleId", "==", id).where("teacherId", "==", b.dataset.t).get(), col("work").where("moduleId", "==", id).get(), col("notes").where("moduleId", "==", id).get(), col("timetable").where("moduleId", "==", id).get()]);
      await Promise.all(n.docs.map(d => firebase.storage().ref(d.data().storagePath).delete().catch(() => {})));
      const batch = db.batch(); a.docs.concat(w.docs, n.docs, t.docs).forEach(d => batch.delete(d.ref)); batch.delete(col("modules").doc(id)); await batch.commit();
      toast("Module deleted."); location.hash = "#/modules";
    }
  } catch (err) { fail(err); }
});
