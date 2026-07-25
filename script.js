import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const MAX_ATTENDANCE = 30;

const form = document.querySelector("#checkinForm");
const loginSection = document.querySelector("#loginSection");
const resultSection = document.querySelector("#resultSection");
const checkinButton = document.querySelector("#checkinButton");
const resetButton = document.querySelector("#resetButton");
const nameInput = document.querySelector("#nameInput");
const birthInput = document.querySelector("#birthInput");
const resultBadge = document.querySelector("#resultBadge");
const resultTitle = document.querySelector("#resultTitle");
const resultMessage = document.querySelector("#resultMessage");
const memberName = document.querySelector("#memberName");
const attendanceCount = document.querySelector("#attendanceCount");
const progressText = document.querySelector("#progressText");
const progressFill = document.querySelector("#progressFill");
const acornGrid = document.querySelector("#acornGrid");
const reward5 = document.querySelector("#reward5");
const reward15 = document.querySelector("#reward15");
const toast = document.querySelector("#toast");

function normalizeName(value) {
  return value.trim().replace(/\s+/g, "");
}

function validateBirth(value) {
  if (!/^\d{4}$/.test(value)) return false;

  const month = Number(value.slice(0, 2));
  const day = Number(value.slice(2, 4));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const sampleYear = 2024;
  const date = new Date(sampleYear, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day;
}

function makeParticipantId(name, birth) {
  const source = `${normalizeName(name)}_${birth}`;
  return encodeURIComponent(source).replaceAll("%", "_");
}

function getKoreanDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 2600);
}

function setLoading(isLoading) {
  checkinButton.disabled = isLoading;
  checkinButton.textContent = isLoading ? "확인하고 있어요..." : "출석 콩콩!";
}

function renderAcorns(count) {
  acornGrid.innerHTML = "";
  for (let index = 1; index <= MAX_ATTENDANCE; index += 1) {
    const item = document.createElement("span");
    item.className = `acorn${index <= count ? " earned" : ""}`;
    item.textContent = "🌰";
    item.setAttribute("aria-label", `${index}번째 도토리${index <= count ? " 획득" : " 미획득"}`);
    acornGrid.appendChild(item);
  }
}

function renderResult({ name, count, alreadyChecked, capped }) {
  const safeCount = Math.min(count, MAX_ATTENDANCE);
  const percent = (safeCount / MAX_ATTENDANCE) * 100;

  memberName.textContent = `${name} 친구`;
  attendanceCount.textContent = `총 ${safeCount}회 출석`;
  progressText.textContent = `${safeCount} / ${MAX_ATTENDANCE}`;
  progressFill.style.width = `${percent}%`;
  progressFill.parentElement.setAttribute("aria-valuenow", String(safeCount));

  reward5.classList.toggle("achieved", safeCount >= 5);
  reward15.classList.toggle("achieved", safeCount >= 15);
  renderAcorns(safeCount);

  if (capped) {
    resultBadge.textContent = "🏆";
    resultTitle.textContent = "도토리를 모두 모았어요!";
    resultMessage.textContent = "30번의 멋진 도서관 방문을 완료했어요.";
  } else if (alreadyChecked) {
    resultBadge.textContent = "🌰";
    resultTitle.textContent = "오늘은 이미 출석했어요";
    resultMessage.textContent = "하루에 도토리는 한 개만 받을 수 있어요. 다음에 또 만나요!";
  } else {
    resultBadge.textContent = safeCount === 5 || safeCount === 15 ? "🎁" : "🎉";
    resultTitle.textContent = safeCount === 5 || safeCount === 15 ? "선물 받을 차례예요!" : "출석 완료!";
    resultMessage.textContent =
      safeCount === 5
        ? "도토리 5개를 모았어요. 직원에게 화면을 보여주세요!"
        : safeCount === 15
          ? "도토리 15개를 모았어요. 특별 선물을 받아요!"
          : "오늘의 도토리 한 개가 추가되었어요.";
  }

  loginSection.classList.add("hidden");
  resultSection.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function checkIn(name, birth) {
  const participantId = makeParticipantId(name, birth);
  const todayKey = getKoreanDateKey();
  const participantRef = doc(db, "participants", participantId);
  const checkinRef = doc(db, "participants", participantId, "checkins", todayKey);

  return runTransaction(db, async (transaction) => {
    const participantSnap = await transaction.get(participantRef);
    const checkinSnap = await transaction.get(checkinRef);

    const currentData = participantSnap.exists() ? participantSnap.data() : {};
    const currentCount = Number(currentData.attendanceCount || 0);

    if (checkinSnap.exists()) {
      return {
        count: currentCount,
        alreadyChecked: true,
        capped: currentCount >= MAX_ATTENDANCE
      };
    }

    if (currentCount >= MAX_ATTENDANCE) {
      return {
        count: MAX_ATTENDANCE,
        alreadyChecked: false,
        capped: true
      };
    }

    const nextCount = currentCount + 1;

    transaction.set(
      participantRef,
      {
        name,
        birth,
        normalizedName: normalizeName(name),
        attendanceCount: nextCount,
        lastCheckinDate: todayKey,
        updatedAt: serverTimestamp(),
        createdAt: currentData.createdAt || serverTimestamp(),
        reward5Eligible: nextCount >= 5,
        reward15Eligible: nextCount >= 15,
        reward5Claimed: Boolean(currentData.reward5Claimed),
        reward15Claimed: Boolean(currentData.reward15Claimed)
      },
      { merge: true }
    );

    transaction.set(checkinRef, {
      dateKey: todayKey,
      checkedAt: serverTimestamp(),
      countAfterCheckin: nextCount
    });

    return {
      count: nextCount,
      alreadyChecked: false,
      capped: nextCount >= MAX_ATTENDANCE
    };
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const birth = birthInput.value.trim();

  if (normalizeName(name).length < 2) {
    showToast("이름을 두 글자 이상 입력해 주세요.");
    nameInput.focus();
    return;
  }

  if (!validateBirth(birth)) {
    showToast("생일을 월일 4자리로 정확히 입력해 주세요.");
    birthInput.focus();
    return;
  }

  setLoading(true);

  try {
    const result = await checkIn(name, birth);
    renderResult({ name, ...result });
  } catch (error) {
    console.error(error);
    showToast("출석 저장에 실패했어요. 인터넷 연결과 Firebase 설정을 확인해 주세요.");
  } finally {
    setLoading(false);
  }
});

birthInput.addEventListener("input", () => {
  birthInput.value = birthInput.value.replace(/\D/g, "").slice(0, 4);
});

resetButton.addEventListener("click", () => {
  form.reset();
  resultSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  nameInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

renderAcorns(0);
