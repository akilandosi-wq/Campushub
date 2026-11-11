// CampusHub — role-specific teacher and administrator portals
let me = null, profile = {};
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAdmin = () => profile.role === "admin";
const portalRole = document.body.dataset.portal || "admin";
const view = h => { $("view").innerHTML = h; };
const head = (t, p) => `<div class="page-head"><h1>${t}</h1><p>${p}</p></div>`;
const ms = t => (t && t.toMillis ? t.toMillis() : 0);
const safeUrl = u => (/^https?:\/\//i.test(u || "") ? esc(u) : "");
const col = n => db.collection(n);
function toast(m, err) { const t = $("toast"); t.textContent = m; t.className = "toast show" + (err ? " err" : ""); clearTimeout(t._t); t._t = setTimeout(() => (t.className = "toast"), 3800); }
const fail = e => toast(e.code === "permission-denied" ? "Permission denied. Publish the latest firestore.rules in Firebase Console." : e.message, true);

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
  const titles = { dashboard: "Dashboard", modules: "Modules", module: "Module", work: "Assignments & Tests", students: "My Students", users: "Manage Users" };
  $("pageTitle").textContent = titles[page] || "Dashboard";
  document.querySelectorAll(".side-link[data-page]").forEach(a => a.classList.toggle("active", a.dataset.page === (page === "module" ? "modules" : page)));
  $("backBtn").style.visibility = page === "dashboard" ? "hidden" : "visible";
  $("sidebar").classList.remove("open"); window.scrollTo(0, 0);
  view('<div class="empty">Loading…</div>');
  const pages = { dashboard: isAdmin() ? adminDashboard : dashboard, modules, module: modulePage, work: workAll, students, users };
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
  const [mods, enr] = await Promise.all([myModules(), myEnr()]);
  view(head("Modules", "Create modules. Students register themselves and appear under the module.") + `
  <div class="panel"><h3>Create a module</h3><form id="mf"><div class="form-grid">
    <div class="field"><label>Module code</label><input id="mCode" placeholder="e.g. ETU 07101"></div><div class="field"><label>Module name</label><input id="mName"></div>
    <div class="field full"><label>Description (optional)</label><input id="mDesc"></div>
    <div class="field full"><label>Learning resource link (optional)</label><input id="mLink" type="url" placeholder="https://"></div></div>
    <button class="btn btn-primary" type="submit">Create module</button></form></div>
  <div class="panel"><h3>${isAdmin() ? "All modules" : "My modules"}</h3>${mods.map(m => `<div class="list-item"><div><strong>${esc(m.code)} — ${esc(m.name)}</strong><small>${esc(m.teacherName)} · ${enr.filter(e => e.moduleId === m.id).length} students</small></div><a class="btn btn-light btn-sm" href="#/module/${m.id}">Open</a></div>`).join("") || '<div class="empty">No modules yet.</div>'}</div>`);
  $("mf").onsubmit = async e => {
    e.preventDefault();
    const code = $("mCode").value.trim(), name = $("mName").value.trim(), resource = $("mLink").value.trim();
    if (!code || !name) return toast("Module code and name are required.", true);
    if (resource && !/^https?:\/\//i.test(resource)) return toast("Link must start with https://", true);
    try { await col("modules").add({ code, name, description: $("mDesc").value.trim(), resource, teacherId: me.uid, teacherName: profile.fullName, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); toast("Module created."); route(); }
    catch (err) { fail(err); }
  };
}

/* ----- single module: monitor students + post work ----- */
async function modulePage([id]) {
  const md = await col("modules").doc(id || "x").get();
  if (!md.exists) return view('<div class="panel empty">Module not found.</div>');
  const m = { id, ...md.data() };
  const [enrS, workS] = await Promise.all([col("moduleEnrollments").where("moduleId", "==", id).where("teacherId", "==", m.teacherId).get(), col("work").where("moduleId", "==", id).get()]);
  const st = enrS.docs.map(d => d.data()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  const wk = workS.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const rows = q => st.filter(s => (s.studentName + s.regNo).toLowerCase().includes(q.toLowerCase())).map(s => `<tr><td><a href="index.html#/student/${esc(s.studentId)}">${esc(s.studentName)}</a></td><td>${esc(s.regNo)}</td><td>${esc(s.phone)}</td><td>${esc(s.course)}</td><td>${esc(s.year)}</td><td><a href="index.html#/chat/dm/${esc(s.studentId)}"><i class="fa-solid fa-comment"></i></a></td></tr>`).join("") || '<tr><td colspan="6" class="empty">No students found.</td></tr>';
  view(head(esc(m.code) + " — " + esc(m.name), esc(m.description || "Module overview")) + `
  <div class="stats">${stat("fa-user-graduate", st.length, "Registered students")}${stat("fa-file-pen", wk.filter(w => w.type !== "test").length, "Assignments")}${stat("fa-clipboard-check", wk.filter(w => w.type === "test").length, "Tests / Exams")}</div>
  <div class="panel"><h3>Publish assignment or test</h3>${workForm([m])}</div>
  <div class="panel"><h3>Published work</h3>${wk.map(w => workRow(w)).join("") || '<div class="empty">Nothing published yet.</div>'}</div>
  <div class="panel"><h3>Registered students</h3><div class="toolbar"><input class="form-control" id="sq" placeholder="Search by name or reg no…"><button class="btn btn-light" id="csv"><i class="fa-solid fa-download"></i> Export CSV</button></div>
  <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Reg no</th><th>Phone</th><th>Programme</th><th>Year</th><th></th></tr></thead><tbody id="srows">${rows("")}</tbody></table></div></div>
  <div class="panel"><h3>Module settings</h3><div class="row-btns"><button class="btn btn-danger" data-act="delmod" data-id="${id}" data-t="${esc(m.teacherId)}"><i class="fa-solid fa-trash"></i> Delete this module</button></div><p class="subtle">Deleting a module also removes its registrations and published work.</p></div>`);
  bindWorkForm(id);
  $("sq").oninput = e => { $("srows").innerHTML = rows(e.target.value); };
  $("csv").onclick = () => {
    const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const t = [["Name", "Reg no", "Phone", "Programme", "Year"], ...st.map(s => [s.studentName, s.regNo, s.phone, s.course, s.year])].map(r => r.map(q).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + t], { type: "text/csv" })); a.download = m.code.replace(/\W+/g, "_") + "_students.csv"; a.click();
  };
}

/* ----- all work ----- */
async function workAll() {
  const [mods, wk] = await Promise.all([myModules(), myWork()]);
  wk.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  view(head("Assignments & Tests", "Publish work for your modules. Only students registered in the module can see it.") +
    (mods.length ? `<div class="panel"><h3>Publish new</h3>${workForm(mods)}</div>` : '<div class="panel empty">Create a module first.</div>') +
    `<div class="panel"><h3>Published</h3>${wk.map(w => workRow(w)).join("") || '<div class="empty">Nothing published yet.</div>'}</div>`);
  bindWorkForm();
}

/* ----- students across modules ----- */
async function students() {
  const enr = await myEnr(), map = {};
  enr.forEach(e => { (map[e.studentId] ||= { ...e, mods: [] }).mods.push(e.moduleName.split(" ")[0] + " " + (e.moduleName.split(" ")[1] || "")); });
  const all = Object.entries(map).map(([id, s]) => ({ id, ...s })).sort((a, b) => a.studentName.localeCompare(b.studentName));
  const rows = q => all.filter(s => (s.studentName + s.regNo).toLowerCase().includes(q.toLowerCase())).map(s => `<tr><td><a href="index.html#/student/${esc(s.id)}">${esc(s.studentName)}</a></td><td>${esc(s.regNo)}</td><td>${esc(s.phone)}</td><td>${esc(s.course)} ${esc(s.year)}</td><td>${s.mods.map(x => `<span class="tag">${esc(x)}</span>`).join(" ")}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No students found.</td></tr>';
  view(head("My Students", `${all.length} student${all.length === 1 ? "" : "s"} registered in your modules.`) + `<div class="panel"><div class="toolbar"><input class="form-control" id="sq" placeholder="Search by name or reg no…"></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Reg no</th><th>Phone</th><th>Programme</th><th>Modules</th></tr></thead><tbody id="srows">${rows("")}</tbody></table></div></div>`);
  $("sq").oninput = e => { $("srows").innerHTML = rows(e.target.value); };
}

/* ----- admin: manage users ----- */
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
    if (act === "delwork") { if (!confirm("Delete this item?")) return; await col("work").doc(id).delete(); toast("Deleted."); route(); }
    if (act === "delmod") {
      if (!confirm("Delete this module with all its registrations and work?")) return;
      const [a, w] = await Promise.all([col("moduleEnrollments").where("moduleId", "==", id).where("teacherId", "==", b.dataset.t).get(), col("work").where("moduleId", "==", id).get()]);
      const batch = db.batch(); a.docs.concat(w.docs).forEach(d => batch.delete(d.ref)); batch.delete(col("modules").doc(id)); await batch.commit();
      toast("Module deleted."); location.hash = "#/modules";
    }
  } catch (err) { fail(err); }
});
