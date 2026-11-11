const fs = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp } = require("firebase/firestore");

const projectId = "demo-campushub";
let testEnv;

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

describe("CampusHub Firestore security rules", function () {
  this.timeout(15000);

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: { rules: fs.readFileSync("firestore.rules", "utf8") }
    });
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seed("students/alice", {
      fullName: "Alice Student", phone: "255700000001", regNo: "DIT/001",
      course: "Computer Engineering", year: "Year 1", email: "alice@example.test",
      role: "student"
    });
    await seed("students/bob", {
      fullName: "Bob Student", phone: "255700000002", regNo: "DIT/002",
      course: "Computer Engineering", year: "Year 1", email: "bob@example.test",
      role: "student"
    });
  });

  it("allows a student to read their own private record", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "students/alice")));
  });

  it("blocks a student from reading another student's private record", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "students/bob")));
  });

  it("allows authenticated users to read directory-safe public profiles", async () => {
    await seed("publicProfiles/bob", {
      fullName: "Bob Student", course: "Computer Engineering",
      year: "Year 1", bio: "", social: {}
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "publicProfiles/bob")));
  });

  it("prevents students from promoting their own role", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(updateDoc(doc(db, "students/alice"), { role: "admin" }));
  });

  it("allows valid self-enrolment only against the module's actual lecturer", async () => {
    await seed("modules/networks", {
      code: "CE101", name: "Networks", teacherId: "lecturer1",
      teacherName: "Lecturer One", description: "", resource: ""
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "moduleEnrollments/alice_networks"), {
      studentId: "alice", moduleId: "networks", moduleName: "CE101 Networks",
      teacherId: "lecturer1", studentName: "Alice Student", regNo: "DIT/001",
      phone: "255700000001", year: "Year 1", course: "Computer Engineering",
      enrolledAt: serverTimestamp()
    }));
  });

  it("rejects forged lecturer IDs in enrolment records", async () => {
    await seed("modules/networks", {
      code: "CE101", name: "Networks", teacherId: "lecturer1",
      teacherName: "Lecturer One", description: "", resource: ""
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "moduleEnrollments/alice_networks"), {
      studentId: "alice", moduleId: "networks", moduleName: "CE101 Networks",
      teacherId: "attacker", studentName: "Alice Student", regNo: "DIT/001",
      phone: "255700000001", year: "Year 1", course: "Computer Engineering",
      enrolledAt: serverTimestamp()
    }));
  });

  it("prevents a lecturer from publishing work for another lecturer's module", async () => {
    await seed("students/lecturer1", {
      fullName: "Lecturer One", role: "teacher"
    });
    await seed("modules/networks", {
      code: "CE101", name: "Networks", teacherId: "lecturer2",
      teacherName: "Lecturer Two"
    });
    const db = testEnv.authenticatedContext("lecturer1").firestore();
    await assertFails(addDoc(collection(db, "work"), {
      moduleId: "networks", moduleName: "CE101 Networks", type: "assignment",
      title: "Lab 1", date: "", details: "", link: "",
      teacherId: "lecturer2", createdAt: serverTimestamp()
    }));
  });

  it("allows an enrolled student to read module notes but blocks an unregistered student", async () => {
    await seed("students/teacher1", { fullName: "Teacher One", role: "teacher" });
    await seed("modules/networks", { code: "CE101", name: "Networks", teacherId: "teacher1" });
    await seed("moduleEnrollments/alice_networks", {
      studentId: "alice", moduleId: "networks", teacherId: "teacher1"
    });
    await seed("notes/note1", {
      moduleId: "networks", moduleName: "CE101 Networks", title: "Chapter 1",
      fileName: "chapter1.pdf", storagePath: "moduleNotes/networks/chapter1.pdf",
      contentType: "application/pdf", size: 1200, teacherId: "teacher1",
      createdAt: new Date()
    });
    const alice = testEnv.authenticatedContext("alice").firestore();
    const bob = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(getDoc(doc(alice, "notes/note1")));
    await assertFails(getDoc(doc(bob, "notes/note1")));
  });

  it("allows only the module's lecturer to publish notes", async () => {
    await seed("students/teacher1", { fullName: "Teacher One", role: "teacher" });
    await seed("students/teacher2", { fullName: "Teacher Two", role: "teacher" });
    await seed("modules/networks", { code: "CE101", name: "Networks", teacherId: "teacher2" });
    const db = testEnv.authenticatedContext("teacher1").firestore();
    await assertFails(setDoc(doc(db, "notes/forged"), {
      moduleId: "networks", moduleName: "CE101 Networks", title: "Forged notes",
      fileName: "notes.pdf", storagePath: "moduleNotes/networks/forged.pdf",
      contentType: "application/pdf", size: 1200, teacherId: "teacher1",
      createdAt: serverTimestamp()
    }));
  });

  it("blocks non-participants from reading direct messages", async () => {
    await seed("chatRooms/alice_bob", {
      type: "dm", participants: ["alice", "bob"]
    });
    await seed("chatRooms/alice_bob/messages/message1", {
      senderId: "alice", senderName: "Alice Student",
      message: "Hello", createdAt: new Date()
    });
    const db = testEnv.authenticatedContext("mallory").firestore();
    await assertFails(getDoc(doc(db, "chatRooms/alice_bob/messages/message1")));
  });

  it("allows a student to read their own course room", async () => {
    await seed("chatRooms/course_computer_engineering", {
      type: "course", course: "Computer Engineering"
    });
    await seed("chatRooms/course_computer_engineering/messages/message1", {
      senderId: "bob", senderName: "Bob Student",
      message: "Course update", createdAt: new Date()
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(getDoc(doc(db, "chatRooms/course_computer_engineering/messages/message1")));
  });

  it("blocks a student from reading another course room", async () => {
    await seed("chatRooms/course_electrical", {
      type: "course", course: "Electrical Engineering"
    });
    await seed("chatRooms/course_electrical/messages/message1", {
      senderId: "bob", senderName: "Bob Student",
      message: "Private course update", createdAt: new Date()
    });
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(getDoc(doc(db, "chatRooms/course_electrical/messages/message1")));
  });

  it("prevents a user from sending a message as another account", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(addDoc(collection(db, "chatRooms/general/messages"), {
      senderId: "bob", senderName: "Bob Student",
      message: "Spoofed sender", createdAt: serverTimestamp()
    }));
  });
});
