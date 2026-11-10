try {
  console.log("CampusHub started");

  const auth = firebase.auth();
  const db = firebase.firestore();

  let currentUser = null;

  function showPage(page) {
    const content = document.getElementById("pageContent");
    const title = document.getElementById("pageTitle");

    if (!content || !title) return;

    title.textContent = page;
    content.innerHTML = `
      <div class="card">
        <h2>Welcome to CampusHub</h2>
        <p>Portal is working successfully.</p>
      </div>
    `;
  }

  window.showPage = showPage;

  window.logout = function () {
    auth.signOut();
  };

  window.toggleMenu = function () {
    document.querySelector(".sidebar")?.classList.toggle("open");
  };

  const form = document.getElementById("authForm");

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const register = document.getElementById("registerFields").style.display !== "none";

      const btn = document.getElementById("submitBtn");
      btn.disabled = true;

      try {
        if (register) {
          const result = await auth.createUserWithEmailAndPassword(email, password);

          await db.collection("students").doc(result.user.uid).set({
            fullName: document.getElementById("fullName").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            regNo: document.getElementById("regNo").value.trim(),
            course: document.getElementById("course").value.trim(),
            year: document.getElementById("year").value,
            email: email,
            role: "student",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } else {
          await auth.signInWithEmailAndPassword(email, password);
        }
      } catch (error) {
        alert(error.message);
      } finally {
        btn.disabled = false;
      }
    });
  }

  auth.onAuthStateChanged(async user => {
    const authPage = document.getElementById("authPage");
    const portal = document.getElementById("portal");

    if (!user) {
      authPage.style.display = "flex";
      portal.style.display = "none";
      return;
    }

    currentUser = user;

    try {
      const doc = await db.collection("students").doc(user.uid).get();

      if (!doc.exists) {
        alert("Student profile missing.");
        return;
      }

      const data = doc.data();

      authPage.style.display = "none";
      portal.style.display = "block";

      document.getElementById("studentName").textContent = data.fullName || "Student";
      document.getElementById("studentCourse").textContent = data.course || "";
      document.getElementById("avatar").textContent = (data.fullName || "S")[0];

      showPage("Dashboard");
    } catch (error) {
      alert("Dashboard error: " + error.message);
    }
  });

} catch (error) {
  alert("CampusHub error: " + error.message);
}
