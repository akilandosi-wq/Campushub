// CAMPUSHUB 3.0

let currentUser = null;
let studentData = {};
let currentPage = "home";
let isRegistering = false;
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

// LOGIN / REGISTER

function setMode(register) {
  isRegistering = register;

  $("authTitle").textContent = register ? "Create Account" : "Welcome Back";
  $("submitBtn").textContent = register ? "Register" : "Login";
  $("switchText").textContent = register
    ? "Already have an account?"
    : "Don't have an account?";

  $("switchBtn").textContent = register ? "Login" : "Register";
  $("registerFields").style.display = register ? "block" : "none";
  message("");
}

$("switchBtn")?.addEventListener("click", () => {
  setMode(!isRegistering);
});

$("authForm")?.addEventListener("submit", async event => {
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

      const result = await auth.createUserWithEmailAndPassword(
        email, password
      );

      await db.collection("students").doc(result.user.uid).set({
        fullName,
        phone,
        regNo,
        course,
        year,
        email,
        role: "student",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      message("Account created successfully!", "success");
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
  } catch (error) {
    message(error.message);
  } finally {
    $("submitBtn").disabled = false;
  }
});

// AUTHENTICATION

auth.onAuthStateChanged(async user => {
  if (!user) {
    currentUser = null;
    $("portal").style.display = "none";
    $("authPage").style.display = "flex";
    return;
  }

  currentUser = user;

  try {
    const doc = await db.collection("students").doc(user.uid).get();

    if (!doc.exists) {
      message("Student profile not found.");
      return;
    }

    studentData = doc.data();

    $("authPage").style.display = "none";
    $("portal").style.display = "block";

    $("studentName").textContent = studentData.fullName || "Student";
    $("studentCourse").textContent = studentData.course || "";
    $("avatar").textContent =
      (studentData.fullName || "S").charAt(0).toUpperCase();

    showPage("home", false);
  } catch (error) {
    alert("Could not load profile: " + error.message);
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

  document.querySelectorAll(".nav button").forEach(button => {
    button.classList.remove("active");
  });

  const content = $("pageContent");

  if (page === "home") renderHome(content);
  if (page === "profile") renderProfile(content);
  if (page === "modules") renderModules(content);
  if (page === "work") renderWork(content);
  if (page === "chat") renderChat(content);
}

window.addEventListener("popstate", event => {
  showPage(event.state?.page || "home", false);
});

// DASHBOARD

function renderHome(content) {
  content.innerHTML = `
    <div class="card">
      <h2>Welcome, ${escapeHTML(studentData.fullName)}</h2>
      <p>Welcome to your CampusHub student portal.</p>
    </div>

    <div class="card">
      <h3>Student Information</h3>
      <p>Registration: ${escapeHTML(studentData.regNo)}</p>
      <p>Programme: ${escapeHTML(studentData.course)}</p>
      <p>Academic Year: ${escapeHTML(studentData.year)}</p>
    </div>

    <div class="card">
      <h3>Quick Access</h3>
      <button onclick="showPage('profile')">My Profile</button>
      <button onclick="showPage('modules')">My Modules</button>
      <button onclick="showPage('work')">Assignments & Tests</button>
      <button onclick="showPage('chat')">Class Chat</button>
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

        <button type="submit">Save Profile</button>
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

    let html = `<div class="card"><h2>Available Modules</h2>`;

    for (const doc of snapshot.docs) {
      const module = doc.data();
      const enrollment = await db.collection("moduleEnrollments")
        .doc(currentUser.uid + "_" + doc.id).get();

      html += `
        <div class="card">
          <h3>${escapeHTML(module.name || module.title || "Module")}</h3>
          <p>${escapeHTML(module.code || "")}</p>
          <p>${escapeHTML(module.description || "")}</p>
          ${
            enrollment.exists
              ? `<strong>Enrolled ✓</strong>`
              : `<button onclick="enrollModule('${doc.id}')">Enroll</button>`
          }
        </div>
      `;
    }

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

    for (const id of moduleIds) {
      const assignments = await db.collection("assignments")
        .where("moduleId", "==", id).get();

      assignments.forEach(doc => {
        const a = doc.data();
        html += `
          <div class="card">
            <h3>${escapeHTML(a.title || "Assignment")}</h3>
            <p>${escapeHTML(a.description || "")}</p>
            <p>Deadline: ${escapeHTML(a.deadline || "Not specified")}</p>
          </div>
        `;
      });
    }

    html += `<h2>Tests</h2>`;

    for (const id of moduleIds) {
      const tests = await db.collection("tests")
        .where("moduleId", "==", id).get();

      tests.forEach(doc => {
        const t = doc.data();
        html += `
          <div class="card">
            <h3>${escapeHTML(t.title || "Test")}</h3>
            <p>${escapeHTML(t.description || "")}</p>
            <p>Date: ${escapeHTML(t.date || "Not specified")}</p>
          </div>
        `;
      });
    }

    content.innerHTML = html + `</div>`;
  } catch (error) {
    content.innerHTML = `<div class="card">Could not load work: ${escapeHTML(error.message)}</div>`;
  }
}

// CHAT

async function renderChat(content) {
  const roomId = "course_" + (studentData.course || "general")
    .toLowerCase().replace(/[^a-z0-9]/g, "_");

  content.innerHTML = `
    <div class="card">
      <h2>Class Chat</h2>
      <div id="chatMessages" style="height:300px;overflow:auto;"></div>
      <form id="chatForm">
        <input id="chatInput" placeholder="Write a message..." required>
        <button type="submit">Send</button>
      </form>
    </div>
  `;

  const messages = $("chatMessages");

  chatUnsubscribe = db.collection("chatRooms")
    .doc(roomId)
    .collection("messages")
    .orderBy("createdAt")
    .limit(100)
    .onSnapshot(snapshot => {
      messages.innerHTML = "";

      snapshot.forEach(doc => {
        const data = doc.data();
        const item = document.createElement("p");
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
  if (chatUnsubscribe) chatUnsubscribe();
  await auth.signOut();
}

function toggleMenu() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}
