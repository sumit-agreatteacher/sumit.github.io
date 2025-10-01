// === 全局变量 ===
let currentTurn = 1;
const totalTurns = 12;
const timeforTurn = 90; // 每轮 90 天
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

  // Update energy bars (width + color) for characters. Use multiple fallbacks
  function getCharEnergy(id) {
    // characters may be an object map or an array in different versions
    if (typeof characters === 'object') {
      if (Array.isArray(characters)) {
        const c = characters.find(x => x && (x.id === id || x.name === id));
        if (c && typeof c.energy === 'number') return c.energy;
      } else if (characters[id] && typeof characters[id].energy === 'number') {
        return characters[id].energy;
      }
    }
    // fallback to global energy map
    if (typeof energy === 'object' && typeof energy[id] === 'number') return energy[id];
    // fallback to text in DOM
    const txt = document.getElementById('energy-text-' + id);
    if (txt) return parseInt(txt.textContent) || 0;
    return 0;
  }

  function setEnergyBar(elemId, value) {
    const bar = document.getElementById(elemId);
    if (!bar) return;
    const v = Math.max(0, Math.min(100, Number(value || 0)));
    bar.style.width = v + "%";
    // color rules: 50-100 green, 10-49 yellow, 0-9 red
    if (v >= 50) {
      bar.style.background = 'green';
    } else if (v >= 10) {
      bar.style.background = 'yellow';
    } else {
      bar.style.background = 'red';
    }
  }

  setEnergyBar('energy-sumit', getCharEnergy('sumit'));
  setEnergyBar('energy-phd', getCharEnergy('phd'));
  setEnergyBar('energy-postdoc', getCharEnergy('postdoc'));
  setEnergyBar('energy-coPI', getCharEnergy('coPI'));

  // update the numeric energy text next to each bar if present
  function setEnergyText(elemId, value) {
    const el = document.getElementById(elemId);
    if (!el) return;
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    el.textContent = v;
  }

  setEnergyText('energy-text-sumit', getCharEnergy('sumit'));
  setEnergyText('energy-text-phd', getCharEnergy('phd'));
  setEnergyText('energy-text-postdoc', getCharEnergy('postdoc'));
  setEnergyText('energy-text-coPI', getCharEnergy('coPI'));
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

  // 如果有 Empty 占位（card-slot 的文字），在目标为卡槽时清除
  if (target.classList && target.classList.contains('card-slot')) {
    // remove empty placeholder text and class
    target.classList.remove('empty');
    target.textContent = '';
    // if a card already exists in this slot, remove it
    const existingCard = target.querySelector('.card');
    if (existingCard) existingCard.remove();
    // place the dragged card into the slot
    target.appendChild(card);
  } else {
    // for buildings: only remove an existing direct .card image (not labels)
    const existingCard = target.querySelector('.card');
    if (existingCard) existingCard.remove();
    const occ = target.querySelector('.occupants');
    if (occ) {
      occ.appendChild(card);
    } else {
      target.appendChild(card);
    }
  }

    // 如果放到建筑里，给卡片一个 class 以控制尺寸/缩放；放回卡牌区则移除
    if (target.classList && target.classList.contains('building')) {
      card.classList.add('in-building');
    } else {
      card.classList.remove('in-building');
    }

    // 如果原来的格子空了，显示 Empty（使用 origin 存储的 slot id）
    if (origin && origin !== "building") {
      const originSlot = document.querySelector(`[data-slot="${origin}"]`);
      if (originSlot && !originSlot.querySelector('.card')) {
        originSlot.textContent = "Empty";
        originSlot.classList.add("empty");
      }
    }

    // 在日志记录
    const buildingName = target.dataset.building;
    if (buildingName) {
        logAction(`${charId} moved to ${buildingName}`);
        // update character model
        if (Array.isArray(characters)) {
          const ch = characters.find(x => x && x.id === charId);
          if (ch) ch.location = buildingName;
        } else if (characters[charId]) {
          characters[charId].location = buildingName;
        }
        // update UI immediately so user sees placement effects if any
        if (typeof updateUI === 'function') updateUI();
    } else {
        logAction(`${charId} returned to card area`);
        // returned to card area -> clear location
        if (Array.isArray(characters)) {
          const ch = characters.find(x => x && x.id === charId);
          if (ch) ch.location = null;
        } else if (characters[charId]) {
          characters[charId].location = null;
        }
        if (typeof updateUI === 'function') updateUI();
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

  // If characters is an array, iterate items; if it's an object map, iterate values
  let charList = Array.isArray(characters) ? characters : Object.values(characters);
  for (let c of charList) {
    applyLocationEffects(c);
  }

  // helper: apply per-character effects depending on where they are
  function applyLocationEffects(c) {
    if (!c || !c.location) return;
    const loc = c.location;
    // helper random check
    const chance = p => Math.random() < (p || 0);

    switch (loc) {
      case 'dorm':
        // restore energy
        const gainDorm = (c.energyGainatDorm || c.dormRecoverRate || 2);
        c.energy = Math.min(100, (c.energy || 0) + gainDorm);
        addLog(`${c.name} rested in dorm +${gainDorm} energy`);
        break;
      case 'office':
        // funding chance and energy loss
        if (chance(c.fundingGainatOfficeProbability)) {
          const inc = (c.fundingGainatOffice || 1);
          funding += inc;
          addLog(`${c.name} secured funding +${inc}`);
        }
        const lossOff = (c.energyLossatOffice || 1);
        c.energy = Math.max(0, (c.energy || 0) - lossOff);
        break;
      case 'lab':
        // progress gain or small loss depending on probability
        if (chance(c.progressGainatLabProbability)) {
          const inc = (c.progressGainatLab || c.progressRate || 1);
          progress += inc;
          addLog(`${c.name} worked in lab +${inc} progress`);
        } else {
          const dec = (c.progressLossatLab || 0.1);
          progress = Math.max(0, progress - dec);
          addLog(`${c.name} had a setback in lab -${dec} progress`);
        }
        // energy and funding effects
        const lossLab = (c.energyLossatLab || 1);
        c.energy = Math.max(0, (c.energy || 0) - lossLab);
        if (typeof c.fundingLossatLab === 'number') {
          funding = Math.max(0, funding - c.fundingLossatLab);
          addLog(`${c.name} used funding -${c.fundingLossatLab}`);
        }
        break;
      case 'lecture':
        if (chance(c.respectGainatLectureProbability || 1)) {
          const incR = (c.respectGainatLecture || 1);
          respect += incR;
          addLog(`${c.name} gave a lecture +${incR} respect`);
        }
        c.energy = Math.max(0, (c.energy || 0) - (c.energyLossatLecture || 1));
        break;
      case 'bar':
        // bar outcomes: mostly small energy/respect gain, small chance of big loss
        if (chance(c.energyGainatBarProbability)) {
          const eg = (c.energyGainatBar || 1);
          c.energy = Math.min(100, (c.energy || 0) + eg);
          addLog(`${c.name} had a drink +${eg} energy`);
        } else if (chance(c.energyLossatBarProbability)) {
          const el = (c.energyLossatBar || 5);
          c.energy = Math.max(0, (c.energy || 0) - el);
          addLog(`${c.name} overdid it -${el} energy`);
        }
        if (chance(c.respectGainatBarProbability)) {
          const rg = (c.respectGainatBar || 1);
          respect += rg;
        } else if (chance(c.respectLossatBarProbability)) {
          const rl = (c.respectLossatBar || 0.1);
          respect = Math.max(0, respect - rl);
        }
        break;
      default:
        // unknown location: do nothing
        break;
    }

    // keep global numbers within reasonable bounds
    funding = Math.max(0, Math.round(funding * 100) / 100);
    progress = Math.max(0, Math.round(progress * 100) / 100);
    respect = Math.max(0, Math.round(respect * 100) / 100);
    c.energy = Math.max(0, Math.min(100, Math.round((c.energy || 0) * 100) / 100));
  }

  if (timeLeft <= 0) {
    clearInterval(timer);
    timer = null;
    startNextRound();
    currentTurn++;
    if (currentTurn <= totalTurns) {
      timeLeft = timeforTurn;
      alert(`Turn ${currentTurn - 1} finished! Starting Turn ${currentTurn}.`);
    } else {
      alert("🎉 Game Over! Happy Birthday Sumit!");
    }
  }
  // write a daily summary so changes are visible in the log
  addLog(`Day summary — Funding: ${funding}, Progress: ${progress}, Respect: ${respect}`);
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
  makeCharacterSpeak("sumit", "Welcome to the campus!");
  // short follow-up instructions from Sumit (in English) - speak sentence by sentence
  const introLines = [
    "Drag the cards from the bottom into buildings",
    "Different buildings have different effects.",
    "Dorm restores energy.",
    "Office for funding.",
    "Lab increases progress but using funding.",
    "Lecture brings respect.",
    "Bar can increase or decrease respect.",
    "You can drag anyone to anywhere at any time.",
    "Click Start to begin (1 second = 1 day).",
    "Each turn lasts 90 days.",
    "Before the end of turn 12, ",
    "Your goal is to raise Progress to 100%!"
  ];
  const initialDelay = 3000; // wait after the first welcome bubble
  const interval = 3500; // time between sentences (ms)
  introLines.forEach((line, i) => {
    setTimeout(() => {
      makeCharacterSpeak("sumit", line);
    }, initialDelay + i * interval);
  });
});
//updateUI();


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
      <p>Funding: +${c.usingfundingRate}</p>
      <p>Teaching: +${c.teachingRate}</p>
      <p>Bar chance: ${(c.barProbability*100).toFixed(0)}%</p>
      <p>Dorm Recovery: +${c.dormRecoveryRate}</p>
      <p><em>${c.special}</em></p>
    `;
    card.onclick = () => selectPhd(c);
    container.appendChild(card);
  });

  recruitScreen.style.display = "block";
}

function selectPhd(character) {
  // 加到全局人物池
  characters[character.id].push = character;

  // 重新渲染左边和卡牌区
  if (typeof renderSidebar === "function") renderSidebar();
  if (typeof renderCardArea === "function") renderCardArea();

  // 关闭招募界面
  document.getElementById("recruit-screen").style.display = "none";

  // 在日志里写入
  logMessage(`${character.name} 加入团队了！`);
}
function renderSidebar() {
  const teamDiv = document.getElementById("team");
  teamDiv.innerHTML = "";
  for (let id in characters) {
    const c = characters[id];
    const div = document.createElement("div");
    div.innerHTML = `<img src="${c.photo}" width="40"> ${c.name} (${c.type || "PhD"})`;
    teamDiv.appendChild(div);
  }
}


function startNextRound() {
  //currentTurn++;
  //logMessage(`第 ${currentTurn} 轮开始！`);

  if (currentTurn === 2) {
    showPhdChoices();  // 🎯 在第2轮开始时弹出选择界面
  }
}