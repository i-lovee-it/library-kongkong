import { db } from "./firebase.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_PASSWORD = "0509";

const loginSection = document.querySelector("#adminLoginSection");
const dashboardSection = document.querySelector("#dashboardSection");
const loginForm = document.querySelector("#adminLoginForm");
const passwordInput = document.querySelector("#adminPassword");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const exportButton = document.querySelector("#exportButton");
const logoutButton = document.querySelector("#logoutButton");
const tableBody = document.querySelector("#participantTableBody");
const totalParticipants = document.querySelector("#totalParticipants");
const todayCheckins = document.querySelector("#todayCheckins");
const reward5Count = document.querySelector("#reward5Count");
const reward15Count = document.querySelector("#reward15Count");
const visibleCount = document.querySelector("#visibleCount");
const toast = document.querySelector("#adminToast");

let participants = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 2400);
}

function getKoreanDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function setLoggedIn(loggedIn) {
  sessionStorage.setItem("kongkongAdmin", loggedIn ? "yes" : "no");
  loginSection.classList.toggle("hidden", loggedIn);
  dashboardSection.classList.toggle("hidden", !loggedIn);
  if (loggedIn) loadParticipants();
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(rows) {
  const header = ["이름", "생일", "출석횟수", "최근출석", "5회선물수령", "15회선물수령"];
  const lines = [
    header.map(escapeCsv).join(","),
    ...rows.map((item) =>
      [
        item.name,
        item.birth,
        item.attendanceCount,
        item.lastCheckinDate,
        item.reward5Claimed ? "수령" : "미수령",
        item.reward15Claimed ? "수령" : "미수령"
      ].map(escapeCsv).join(",")
    )
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `출석콩콩_${getKoreanDateKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderStats() {
  const today = getKoreanDateKey();
  totalParticipants.textContent = `${participants.length}명`;
  todayCheckins.textContent = `${participants.filter((p) => p.lastCheckinDate === today).length}명`;
  reward5Count.textContent = `${participants.filter((p) => p.attendanceCount >= 5).length}명`;
  reward15Count.textContent = `${participants.filter((p) => p.attendanceCount >= 15).length}명`;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function renderTable() {
  const keyword = searchInput.value.trim().toLowerCase();
  const filtered = participants.filter((item) =>
    `${item.name} ${item.birth}`.toLowerCase().includes(keyword)
  );

  visibleCount.textContent = `${filtered.length}명 표시`;
  tableBody.innerHTML = "";

  if (!filtered.length) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    row.innerHTML = `<td colspan="7">표시할 참여자가 없습니다.</td>`;
    tableBody.appendChild(row);
    return;
  }

  for (const item of filtered) {
    const row = document.createElement("tr");

    const values = [
      item.name || "-",
      item.birth || "-",
      `${item.attendanceCount || 0}회`,
      item.lastCheckinDate || "-"
    ];

    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const reward5Cell = document.createElement("td");
    const reward5Button = createButton(
      item.reward5Claimed ? "수령 완료" : "미수령",
      `claim-button${item.reward5Claimed ? " claimed" : ""}`,
      () => toggleClaim(item.id, "reward5Claimed", !item.reward5Claimed)
    );
    reward5Button.disabled = item.attendanceCount < 5;
    reward5Cell.appendChild(reward5Button);
    row.appendChild(reward5Cell);

    const reward15Cell = document.createElement("td");
    const reward15Button = createButton(
      item.reward15Claimed ? "수령 완료" : "미수령",
      `claim-button${item.reward15Claimed ? " claimed" : ""}`,
      () => toggleClaim(item.id, "reward15Claimed", !item.reward15Claimed)
    );
    reward15Button.disabled = item.attendanceCount < 15;
    reward15Cell.appendChild(reward15Button);
    row.appendChild(reward15Cell);

    const manageCell = document.createElement("td");
    manageCell.appendChild(
      createButton("삭제", "delete-button", () => removeParticipant(item))
    );
    row.appendChild(manageCell);

    tableBody.appendChild(row);
  }
}

async function loadParticipants() {
  tableBody.innerHTML = `<tr class="empty-row"><td colspan="7">불러오는 중...</td></tr>`;

  try {
    const snapshot = await getDocs(
      query(collection(db, "participants"), orderBy("attendanceCount", "desc"))
    );

    participants = snapshot.docs.map((snapshotDoc) => ({
      id: snapshotDoc.id,
      ...snapshotDoc.data()
    }));

    renderStats();
    renderTable();
  } catch (error) {
    console.error(error);
    showToast("데이터를 불러오지 못했습니다. Firebase 설정을 확인해 주세요.");
  }
}

async function toggleClaim(id, field, value) {
  try {
    await updateDoc(doc(db, "participants", id), { [field]: value });
    const target = participants.find((item) => item.id === id);
    if (target) target[field] = value;
    renderTable();
    showToast(value ? "선물 수령으로 표시했습니다." : "미수령으로 되돌렸습니다.");
  } catch (error) {
    console.error(error);
    showToast("선물 상태 변경에 실패했습니다.");
  }
}

async function removeParticipant(item) {
  const confirmed = window.confirm(
    `${item.name} 참여자의 기록을 삭제할까요?\n하위 출석 기록은 Firebase 콘솔에서 별도로 삭제해야 할 수 있습니다.`
  );
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "participants", item.id));
    participants = participants.filter((participant) => participant.id !== item.id);
    renderStats();
    renderTable();
    showToast("참여자 기록을 삭제했습니다.");
  } catch (error) {
    console.error(error);
    showToast("삭제에 실패했습니다.");
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (passwordInput.value === ADMIN_PASSWORD) {
    passwordInput.value = "";
    setLoggedIn(true);
  } else {
    showToast("비밀번호가 올바르지 않습니다.");
    passwordInput.select();
  }
});

searchInput.addEventListener("input", renderTable);
refreshButton.addEventListener("click", loadParticipants);
exportButton.addEventListener("click", () => downloadCsv(participants));
logoutButton.addEventListener("click", () => setLoggedIn(false));

if (sessionStorage.getItem("kongkongAdmin") === "yes") {
  setLoggedIn(true);
}
