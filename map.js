// === 全局变量 ===
let currentTurn = 1;
const totalTurns = 12;
const timeforTurn = 2; // 每轮 90 天
let timeLeft = timeforTurn; // 每轮 90 天
let timer = null;

// 状态数值
let funding = 100;
let progress = 0;
let respect = 0;
let energy = {sumit: 100, phd: 0, postdoc: 0, coPI: 0};

let placement = {}; // 记录人物位置
// === 画布 & 背景 ===

// === UI更新 ===
function updateUI() {
  document.getElementById("currentTurn").textContent = currentTurn;
  document.getElementById("totalTurns").textContent = totalTurns;
  document.getElementById("time").textContent = timeLeft;
  document.getElementById("funding").textContent = funding;
  document.getElementById("progress").textContent = progress;
  document.getElementById("respect").textContent = respect;

  document.getElementById("energy-sumit").style.width = characters.sumit.energy + "%";
  document.getElementById("energy-shayne").style.width = characters.shayne.energy + "%";
}

// ======================
// 初始化拖拽
// ======================
document.querySelectorAll(".card").forEach(card => {
  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("character", e.target.dataset.character);
    e.dataTransfer.setData("origin", e.target.parentElement.dataset.slot || "building");
  });
});

document.querySelectorAll(".building, .card-slot").forEach(target => {
  target.addEventListener("dragover", e => e.preventDefault());

  target.addEventListener("drop", e => {
    e.preventDefault();
    const charId = e.dataTransfer.getData("character");
    const origin = e.dataTransfer.getData("origin");
    const card = document.querySelector(`[data-character="${charId}"]`);
    const slot = target.querySelector(".slot");

    // 如果有 Empty，占位隐藏
    if (slot) slot.style.display = "none";

    // 清空已有的卡片（一个格子最多 1 人）
    target.innerHTML = "";
    target.appendChild(card);

    // 如果原来的格子空了，显示 Empty
    if (origin && origin !== "building") {
      const originSlot = document.querySelector(`[data-slot="${charId}"]`);
      if (originSlot && !originSlot.querySelector("img")) {
        originSlot.innerHTML = "Empty";
        originSlot.classList.add("empty");
      }
    }

    // 在日志记录
    const buildingName = target.dataset.building;
    if (buildingName) {
      logAction(`${charId} moved to ${buildingName}`);
    } else {
      logAction(`${charId} returned to card area`);
    }
  });
});

function logAction(msg) {
  const log = document.getElementById("log");
  const entry = document.createElement("div");
  entry.textContent = msg;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// === 每天计算 ===
function simulateDay() {
  timeLeft--;

  for (let name in characters) {
    let c = characters[name];
    switch (c.location) {
      case "dorm":
        c.energy = Math.min(100, c.energy + 2);
        break;
      case "bar":
        respect += 1;
        c.energy = Math.max(0, c.energy - 1);
        break;
      case "lab":
        progress += 2;
        respect += 0.2;
        c.energy = Math.max(0, c.energy - 1);
        break;
      case "lecture":
        respect += 1.5;
        funding += 5;
        c.energy = Math.max(0, c.energy - 2);
        break;
    }
  }

  if (timeLeft <= 0) {
    clearInterval(timer);
    timer = null;
    currentTurn++;
    if (currentTurn <= totalTurns) {
      timeLeft = timeforTurn;
      alert(`Turn ${currentTurn - 1} finished! Starting Turn ${currentTurn}.`);
    } else {
      alert("🎉 Game Over! Happy Birthday Sumit!");
    }
  }

  updateUI();
  drawBackground();
}

function makeCharacterSpeak(characterId, message) {
  const bubble = document.getElementById("bubble-" + characterId);
  if (!bubble) return;

  bubble.textContent = message;
  bubble.style.display = "block";

  // 自动 3 秒后隐藏
  setTimeout(() => {
    bubble.style.display = "none";
  }, 3000);

  // 同时写入 log
  addLog(characterId + " says: \"" + message + "\"");
}

function addLog(message) {
  const logDiv = document.getElementById("log");
  if (!logDiv) return;

  const entry = document.createElement("div");
  const now = new Date().toLocaleTimeString();
  entry.textContent = `[${now}] ${message}`;
  logDiv.appendChild(entry);

  logDiv.scrollTop = logDiv.scrollHeight; // 保证总是滚到最底
}
// === 按钮 ===
document.getElementById("startBtn").addEventListener("click", () => {
  if (!timer && currentTurn <= totalTurns) {
    timer = setInterval(simulateDay, 1000); // 1秒=1天
  }
});
window.addEventListener("DOMContentLoaded", () => {
  // 开始的时候 sumit 说话
  makeCharacterSpeak("sumit", "Welcome to the campus!");
});
updateUI();


function showPhdChoices() {
  const recruitScreen = document.getElementById("recruit-screen");
  const container = document.getElementById("candidate-container");
  container.innerHTML = "";

  // 随机选3个（这里先固定用3个示例）
  const choices = phdCandidates;  

  choices.forEach(c => {
    const card = document.createElement("div");
    card.className = "candidate-card";
    card.innerHTML = `
      <img src="${c.photo}" alt="${c.name}">
      <h3>${c.name}</h3>
      <p>Energy: ${c.energy}</p>
      <p>Progress: +${c.progressRate}</p>
      <p>Funding: +${c.fundingRate}</p>
      <p>Teaching: +${c.teachingRate}</p>
      <p>Bar chance: ${(c.barProbability*100).toFixed(0)}%</p>
      <p>Dorm Recovery: +${c.dormRecovery}</p>
      <p><em>${c.special}</em></p>
    `;
    card.onclick = () => selectPhd(c);
    container.appendChild(card);
  });

  recruitScreen.style.display = "block";
}

function selectPhd(character) {
  // 加到全局人物池
  characters.push(character);

  // 重新渲染左边和卡牌区
  renderSidebar();
  renderCardArea();

  // 关闭招募界面
  document.getElementById("recruit-screen").style.display = "none";

  // 在日志里写入
  logMessage(`${character.name} 加入团队了！`);
}

function startNextRound() {
  currentRound++;
  logMessage(`第 ${currentRound} 轮开始！`);

  if (currentRound === 2) {
    showPhdChoices();  // 🎯 在第2轮开始时弹出选择界面
  }
}