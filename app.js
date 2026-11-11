// CAMPUSHUB 3.0 (fixed)

let currentUser = null;
let studentData = {};
let currentPage = "home";
let isRegistering = false;
let isSigningUp = false;
let chatUnsubscribe = null;

const $ = id => document.getElementById(id);

function message(text, type = "error") {
  const box = $("authMessage");
  if (box) {
    box.textContent = text;
    box.style.color = type === "success" ? "green" : "red";
  }
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

// SCREEN HELPERS (hizi ndizo zinazotatua white screen)

function showAuth() {
  $("portal").classList.add("hidden");
  $("authPage").classList.remove("hidden");
}

function showPortal() {
  $("authPage").classList.add("hidden");
  $("portal").classList.remove("hidden");
}

function fillPortal() {
  $("studentName").textContent = studentData.fullName || "Student";
  $("studentCourse").textContent = studentData.course || "";
  $("avatar").textContent =
    (studentData.fullName || "S").charAt(0).toUpperCase();
  showPortal();
  showPage("home", false);
}

// LOGIN / REGISTER

function setMode(register) {
  isRegistering = register;

  $("authTitle").textContent = register ? "Create Account" : "Welcome Back";
  $("submitBtn").textContent = register ? "Register" : "Login";
  $("switchText").textContent = register
    ? "Already have an account?"
    : "Don't have an account?";

  $("switchBtn").textContent = register ? "Login" : "Register";
  $("registerFields").classList.toggle("hidden", !register);
  message("");
}

$("switchBtn").addEventListener("click", () => {
  setMode(!isRegistering);
});

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;

  $("submitBtn").disabled = true;
  message("Please wait...", "success");

  try {
    if (isRegistering) {
      const fullName = $("fullName").value.trim();
      const phone = $("phone").value.trim();
      const regNo = $("regNo").value.trim();
      const course = $("course").value.trim();
      const year = $("year").value;

      if (!fullName || !phone || !regNo || !course || !year) {
        throw new Error("Fill in all registration details.");
      }

      isSigningUp = true;

      const result = await auth.createUserWithEmailAndPassword(email, password);

      const profile = {
        fullName, phone, regNo, course, year, email,
        role: "student"
      };

      await db.collection("students").doc(result.user.uid).set({
        ...profile,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      currentUser = result.user;
      studentData = profile;
      message("");
      fillPortal();
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    message(error.message);
  } finally {
    isSigningUp = false;
    $("submitBtn").disabled = false;
  }
});

// AUTHENTICATION

auth.onAuthStateChanged(async user => {
  if (isSigningUp) return;

  if (!user) {
    currentUser = null;
    showAuth();
    return;
  }

  currentUser = user;

  try {
    const doc = await db.collection("students").doc(user.uid).get();

    if (!doc.exists) {
      message("Student profile not found.");
      await auth.signOut();
      return;
    }

    studentData = doc.data();
    fillPortal();
  } catch (error) {
    alert("Could not load profile: " + error.message);
    showAuth();
  }
});

// NAVIGATION

function showPage(page, push = true) {
  if (!currentUser) return;

  currentPage = page;

  if (push) {
    history.pushState({ page }, "", "#" + page);
  }

  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  const titles = {
    home: "Dashboard",
    profile: "My Profile",
    modules: "My Modules",
    work: "Assignments & Tests",
    chat: "Class Chat"
  };

  $("pageTitle").textContent = titles[page] || "CampusHub";

  // funga menu ya simu baada ya kuchagua page
  document.querySelector(".sidebar")?.classList.remove("open");

  const content = $("pageContent");

  if (page === "home") renderHome(content);
  else if (page === "profile") renderProfile(content);
  else if (page === "modules") renderModules(content);
  else if (page === "work") renderWork(content);
  else if (page === "chat") renderChat(content);
}

window.addEventListener("popstate", event => {
  showPage(event.state?.page || "home", false);
});

// DASHBOARD

function renderHome(content) {
  content.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h2>Welcome, ${escapeHTML(studentData.fullName)}</h2>
      <p>Welcome to your CampusHub student portal.</p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3>Student Information</h3>
      <p>Registration: ${escapeHTML(studentData.regNo)}</p>
      <p>Programme: ${escapeHTML(studentData.course)}</p>
      <p>Academic Year: ${escapeHTML(studentData.year)}</p>
    </div>

    <div class="card">
      <h3>Quick Access</h3>
      <button class="primary" style="margin:4px" onclick="showPage('profile')">My Profile</button>
      <button class="primary" style="margin:4px" onclick="showPage('modules')">My Modules</button>
      <button class="primary" style="margin:4px" onclick="showPage('work')">Assignments & Tests</button>
      <button class="primary" style="margin:4px" onclick="showPage('chat')">Class Chat</button>
    </div>
  `;
}

// PROFILE

function renderProfile(content) {
  content.innerHTML = `
    <div class="card">
      <h2>My Profile</h2>

      <form id="profileForm">
        <label>Full Name</label>
        <input id="pName" value="${escapeHTML(studentData.fullName)}" required>

        <label>Phone Number</label>
        <input id="pPhone" value="${escapeHTML(studentData.phone)}">

        <label>Registration Number</label>
        <input value="${escapeHTML(studentData.regNo)}" disabled>

        <label>Course / Programme</label>
        <input id="pCourse" value="${escapeHTML(studentData.course)}">

        <label>Academic Year</label>
        <input id="pYear" value="${escapeHTML(studentData.year)}">

        <label>Instagram Profile</label>
        <input id="pInstagram" value="${escapeHTML(studentData.instagram || "")}">

        <label>Facebook Profile</label>
        <input id="pFacebook" value="${escapeHTML(studentData.facebook || "")}">

        <label>Other Social Link</label>
        <input id="pOther" value="${escapeHTML(studentData.socialLink || "")}">

        <button class="primary" style="margin-top:18px" type="submit">Save Profile</button>
        <p id="profileMessage"></p>
      </form>
    </div>
  `;

  $("profileForm").onsubmit = async event => {
    event.preventDefault();

    try {
      const updates = {
        fullName: $("pName").value.trim(),
        phone: $("pPhone").value.trim(),
        course: $("pCourse").value.trim(),
        year: $("pYear").value.trim(),
        instagram: $("pInstagram").value.trim(),
        facebook: $("pFacebook").value.trim(),
        socialLink: $("pOther").value.trim()
      };

      await db.collection("students").doc(currentUser.uid).update(updates);

      studentData = { ...studentData, ...updates };
      $("studentName").textContent = studentData.fullName;
      $("studentCourse").textContent = studentData.course;

      $("profileMessage").textContent = "Profile updated successfully.";
    } catch (error) {
      $("profileMessage").textContent = error.message;
    }
  };
}

// MODULES

async function renderModules(content) {
  content.innerHTML = `<div class="card"><h2>Available Modules</h2><p>Loading modules...</p></div>`;

  try {
    const snapshot = await db.collection("modules").get();

    if (snapshot.empty) {
      content.innerHTML = `<div class="card"><h2>My Modules</h2><p>No modules have been added yet.</p></div>`;
      return;
    }

    const enrollments = await Promise.all(
      snapshot.docs.map(doc =>
        db.collection("moduleEnrollments")
          .doc(currentUser.uid + "_" + doc.id).get()
      )
    );

    let html = `<div class="card"><h2>Available Modules</h2>`;

    snapshot.docs.forEach((doc, i) => {
      const mod = doc.data();

      html += `
        <div class="card" style="margin-top:12px">
          <h3>${escapeHTML(mod.name || mod.title || "Module")}</h3>
          <p>${escapeHTML(mod.code || "")}</p>
          <p>${escapeHTML(mod.description || "")}</p>
          ${
            enrollments[i].exists
              ? `<strong>Enrolled ✓</strong>`
              : `<button class="primary" onclick="enrollModule('${escapeHTML(doc.id)}')">Enroll</button>`
          }
        </div>
      `;
    });

    content.innerHTML = html + `</div>`;
  } catch (error) {
    content.innerHTML = `<div class="card">Could not load modules: ${escapeHTML(error.message)}</div>`;
  }
}

async function enrollModule(moduleId) {
  try {
    await db.collection("moduleEnrollments")
      .doc(currentUser.uid + "_" + moduleId)
      .set({
        studentId: currentUser.uid,
        moduleId,
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    alert("Enrollment successful!");
    showPage("modules", false);
  } catch (error) {
    alert("Enrollment failed: " + error.message);
  }
}

// ASSIGNMENTS AND TESTS

async function renderWork(content) {
  content.innerHTML = `<div class="card"><h2>Assignments & Tests</h2><p>Loading...</p></div>`;

  try {
    const enrollments = await db.collection("moduleEnrollments")
      .where("studentId", "==", currentUser.uid).get();

    const moduleIds = enrollments.docs.map(d => d.data().moduleId);

    if (!moduleIds.length) {
      content.innerHTML = `<div class="card">Enroll in a module first to view its assignments and tests.</div>`;
      return;
    }

    let html = `<div class="card"><h2>Assignments</h2>`;
    let count = 0;

    for (const id of moduleIds) {
      const assignments = await db.collection("assignments")
        .where("moduleId", "==", id).get();

      assignments.forEach(doc => {
        const a = doc.data();
        count++;
        html += `
          <div class="card" style="margin-top:12px">
            <h3>${escapeHTML(a.title || "Assignment")}</h3>
            <p>${escapeHTML(a.description || "")}</p>
            <p>Deadline: ${escapeHTML(a.deadline || "Not specified")}</p>
          </div>
        `;
      });
    }

    if (!count) html += `<p class="empty">No assignments yet.</p>`;

    html += `<h2 style="margin-top:24px">Tests</h2>`;
    count = 0;

    for (const id of moduleIds) {
      const tests = await db.collection("tests")
        .where("moduleId", "==", id).get();

      tests.forEach(doc => {
        const t = doc.data();
        count++;
        html += `
          <div class="card" style="margin-top:12px">
            <h3>${escapeHTML(t.title || "Test")}</h3>
            <p>${escapeHTML(t.description || "")}</p>
            <p>Date: ${escapeHTML(t.date || "Not specified")}</p>
          </div>
        `;
      });
    }

    if (!count) html += `<p class="empty">No tests yet.</p>`;

    content.innerHTML = html + `</div>`;
  } catch (error) {
    content.innerHTML = `<div class="card">Could not load work: ${escapeHTML(error.message)}</div>`;
  }
}

// CHAT

function renderChat(content) {
  const roomId = "course_" + (studentData.course || "general")
    .toLowerCase().replace(/[^a-z0-9]/g, "_");

  content.innerHTML = `
    <div class="card">
      <h2>Class Chat</h2>
      <div id="chatMessages" class="chat-box"></div>
      <form id="chatForm" class="chat-input">
        <input id="chatInput" placeholder="Write a message..." required>
        <button class="primary" type="submit">Send</button>
      </form>
    </div>
  `;

  const messages = $("chatMessages");

  chatUnsubscribe = db.collection("chatRooms")
    .doc(roomId)
    .collection("messages")
    .orderBy("createdAt")
    .limitToLast(100)
    .onSnapshot(snapshot => {
      messages.innerHTML = "";

      snapshot.forEach(doc => {
        const data = doc.data();
        const item = document.createElement("div");
        item.className = "bubble" + (data.senderId === currentUser.uid ? " mine" : "");
        item.textContent =
          (data.senderName || "Student") + ": " + (data.message || "");
        messages.appendChild(item);
      });

      messages.scrollTop = messages.scrollHeight;
    }, error => {
      messages.textContent = "Chat unavailable: " + error.message;
    });

  $("chatForm").onsubmit = async event => {
    event.preventDefault();

    const input = $("chatInput");
    const text = input.value.trim();

    if (!text || text.length > 1000) return;

    try {
      await db.collection("chatRooms")
        .doc(roomId)
        .collection("messages")
        .add({
          senderId: currentUser.uid,
          senderName: studentData.fullName,
          message: text,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      input.value = "";
    } catch (error) {
      alert("Message failed: " + error.message);
    }
  };
}

// LOGOUT

async function logout() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }
  await auth.signOut();
}

function toggleMenu() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}
