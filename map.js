// === 全局变量 ===
let currentTurn = 1;
const totalTurns = 12;
const timeforTurn = 90; // 每轮 90 天
let timeLeft = timeforTurn; // 每轮 90 天
let timer = null;
// milliseconds per in-game day (configurable). Change this to speed up/slow down time.
let dayMs = 100; // default 1000ms = 1s per day

// 状态数值
let funding = 10000;
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
    // If the UI uses role slots like 'phd' that map to a selected character,
    // check for a DOM element `#char-<id>` with a dataset.character mapping and use that id.
    try {
      const slotEl = document.getElementById('char-' + id);
      if (slotEl && slotEl.dataset && slotEl.dataset.character) {
        id = slotEl.dataset.character;
      }
    } catch (e) {
      // ignore DOM errors and continue with original id
    }
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
  // Only select draggable card images (class .card) so we don't pick left-side avatars
  const card = document.querySelector(`.card[data-character="${charId}"]`);
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
    // for buildings: append to the occupants container so multiple people can occupy the same building
    const occ = target.querySelector('.occupants');
    if (occ) {
      // avoid re-appending if the card is already inside
      if (!occ.contains(card)) occ.appendChild(card);
    } else {
      // no occupants container; just append to building but don't remove other cards
      if (!target.contains(card)) target.appendChild(card);
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
        // If there's no funding, the lab cannot produce progress
        if (funding <= 0) {
          addLog(`${c.name} couldn't make progress in the lab due to lack of funding`);
        } else {
          // Stochastic approach: single random draw decides gain / loss / no-change
          const gain = Number(c.progressGainatLab ?? c.progressRate ?? 0);
          let pGain = Number(c.progressGainatLabProbability ?? 1);
          let pLoss = Number(c.progressLossatLabProbability ?? 0);
          // clamp probabilities to [0,1]
          pGain = Math.max(0, Math.min(1, pGain));
          pLoss = Math.max(0, Math.min(1, pLoss));
          // ensure combined threshold doesn't exceed 1
          if (pGain + pLoss > 1) {
            // normalize loss so gain has priority
            pLoss = Math.max(0, 1 - pGain);
          }

          const r = Math.random();
          if (r < pGain) {
            progress += gain;
            addLog(`${c.name} randomly worked in lab +${gain} progress`);
          } else if (r < pGain + pLoss) {
            const dec = Number(c.progressLossatLab ?? 0);
            progress = Math.max(0, progress - dec);
            addLog(`${c.name} randomly had a setback in lab -${dec} progress`);
          } else {
            addLog(`${c.name} had no progress change in lab today`);
          }
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
    // advance to next turn first so startNextRound() runs at the beginning of that turn
    if (currentTurn < totalTurns) {
      const finishedTurn = currentTurn;
      currentTurn++;
      timeLeft = timeforTurn;
      // now start the next round (this will e.g. show PhD choices when currentTurn === 2)
      startNextRound();
      alert(`Turn ${finishedTurn} finished! Starting Turn ${currentTurn}.`);
    } else {
      // no more turns
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
    // start interval using the configurable dayMs
    timer = setInterval(simulateDay, dayMs);
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
document.getElementById("startBtn").addEventListener("click", () => {
  if (!timer && currentTurn <= totalTurns) {
    timer = setInterval(simulateDay, dayMs);
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

  // choose 3 candidates based on current respect
  function sampleRandom(arr, n) {
    const out = [];
    if (!Array.isArray(arr) || arr.length === 0) return out;
    const copy = arr.slice();
    // shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    for (let i = 0; i < Math.min(n, copy.length); i++) out.push(copy[i]);
    // if not enough unique items, fill by random picks (allow duplicates)
    while (out.length < n) {
      out.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    return out;
  }

  const level1 = phdCandidates.filter(p => Number(p.level) === 1);
  const level2 = phdCandidates.filter(p => Number(p.level) === 2);
  let choices = [];
  if (respect >= 0 && respect < 10) {
    // 2 from level1, 1 from level2
    choices = sampleRandom(level1, 2).concat(sampleRandom(level2, 1));
  } else if (respect >= 10 && respect < 20) {
    // 2 from level2, 1 from level1
    choices = sampleRandom(level2, 2).concat(sampleRandom(level1, 1));
  } else {
    // fallback: pick any 3
    choices = sampleRandom(level2, 3);
  }

  choices.forEach(c => {
    // compute average expected values (per day) for display
    const progGain = Number(c.progressGainatLab ?? c.progressRate ?? 0);
    const pGain = Number(c.progressGainatLabProbability ?? c.progressGainatLabProbability ?? 1) || 0;
    const progLoss = Number(c.progressLossatLab ?? 0);
    const pLoss = Number(c.progressLossatLabProbability ?? 0) || 0;
    const expectedProgress = progGain * pGain - progLoss * pLoss;

    const fundGain = Number(c.fundingGainatOffice ?? c.usingfundingRate ?? c.getfundingRate ?? 0);
    const fundP = Number(c.fundingGainatOfficeProbability ?? 0) || 0;
    const expectedFunding = fundGain * fundP;

    const dormGain = Number(c.energyGainatDorm ?? c.dormRecoverRate ?? 0);
    const officeLoss = Number(c.energyLossatOffice ?? 0);
    const labLoss = Number(c.energyLossatLab ?? 0);
    const lectureLoss = Number(c.energyLossatLecture ?? 0);
    const barGain = Number(c.energyGainatBar ?? 0);
    const barPGain = Number(c.energyGainatBarProbability ?? c.barProbability ?? 0) || 0;
    const barLoss = Number(c.energyLossatBar ?? 0);
    const barPLoss = Number(c.energyLossatBarProbability ?? 0) || 0;
    const expectedBarEnergy = barGain * barPGain - barLoss * barPLoss;
    const teachingRate = Number(c.respectGainatLecture);

    const card = document.createElement("div");
    card.className = "candidate-card";
    card.innerHTML = `
      <img src="${c.photo}" alt="${c.name}">
      <h3>${c.name}</h3>
      <p>Energy (start): ${c.energy}</p>
      <p>Avg progress/day (lab): ${expectedProgress.toFixed(2)}</p>
      <p>Avg funding/day (office): ${expectedFunding.toFixed(2)}</p>
      <p>Energy Δ — Dorm: +${dormGain}, Lab: -${labLoss}, Office: -${officeLoss}</p>
      <p>Avg bar energy/day: ${expectedBarEnergy.toFixed(2)} (chance ${(barPGain*100).toFixed(0)}%)</p>
      <p>Teaching: +${teachingRate ?? 0}</p>
      <p><em>${c.special ?? ''}</em></p>
    `;
    card.onclick = () => selectPhd(c);
    container.appendChild(card);
  });

  // add a skip button so the player can choose none
  // remove existing skip button if present
  let existingSkip = document.getElementById('recruit-skip-btn');
  if (existingSkip) existingSkip.remove();
  const skipWrap = document.createElement('div');
  skipWrap.style.textAlign = 'center';
  skipWrap.style.marginTop = '12px';
  const skipBtn = document.createElement('button');
  skipBtn.id = 'recruit-skip-btn';
  skipBtn.textContent = 'None of these';
  skipBtn.style.padding = '8px 12px';
  skipBtn.style.fontSize = '16px';
  skipBtn.style.cursor = 'pointer';
  skipBtn.onclick = () => {
    // close the recruit screen and log the skip
    document.getElementById('recruit-screen').style.display = 'none';
    addLog('Player skipped recruitment this round.');
  };
  skipWrap.appendChild(skipBtn);
  container.appendChild(skipWrap);

  recruitScreen.style.display = "block";
}

function selectPhd(character) {
  // Add the selected candidate to the global characters pool
  function normalizeCandidate(src) {
    const o = Object.assign({}, src);
    // canonicalize field names with sensible fallbacks
    o.energy = Number(o.energy ?? 100);
    o.energyGainatDorm = Number(o.energyGainatDorm ?? o.dormRecoverRate ?? 0);
    o.energyLossatOffice = Number(o.energyLossatOffice ?? o.usingEnergyRate ?? 1);
    o.energyLossatLab = Number(o.energyLossatLab ?? o.usingEnergyRate ?? 1);
    o.energyLossatLecture = Number(o.energyLossatLecture ?? 1);
    o.energyGainatBar = Number(o.energyGainatBar ?? 0);
    o.energyGainatBarProbability = Number(o.energyGainatBarProbability ?? o.barProbability ?? 0);
    o.energyLossatBar = Number(o.energyLossatBar ?? 0);
    o.energyLossatBarProbability = Number(o.energyLossatBarProbability ?? 0);

    o.fundingGainatOffice = Number(o.fundingGainatOffice ?? o.usingfundingRate ?? o.getfundingRate ?? 0);
    o.fundingGainatOfficeProbability = Number(o.fundingGainatOfficeProbability ?? 0);
    o.fundingLossatLab = Number(o.fundingLossatLab ?? 0);

    o.progressGainatLab = Number(o.progressGainatLab ?? o.progressRate ?? 0);
    o.progressGainatLabProbability = Number(o.progressGainatLabProbability ?? 0);
    o.progressLossatLab = Number(o.progressLossatLab ?? 0);
    o.progressLossatLabProbability = Number(o.progressLossatLabProbability ?? 0);

    o.respectGainatLecture = Number(o.respectGainatLecture ?? 0);
    o.respectGainatLectureProbability = Number(o.respectGainatLectureProbability ?? 0);
    o.respectGainatBar = Number(o.respectGainatBar ?? 0);
    o.respectGainatBarProbability = Number(o.respectGainatBarProbability ?? 0);
    o.respectLossatBar = Number(o.respectLossatBar ?? 0);
    o.respectLossatBarProbability = Number(o.respectLossatBarProbability ?? 0);

    o.level = o.level ?? 1;
    o.hired = !!o.hired;
    o.location = null;
    return o;
  }

  if (Array.isArray(characters)) {
    const exists = characters.find(c => c && c.id === character.id);
    if (!exists) {
      const newChar = normalizeCandidate(character);
      characters.push(newChar);
    }
  } else {
    characters[character.id] = normalizeCandidate(character);
  }

  // Update the left-side PhD slot card (if present)
  const phdCard = document.getElementById('char-phd');
  if (phdCard) {
    const avatar = phdCard.querySelector('.character-avatar');
    if (avatar) avatar.src = character.photo;
    const label = phdCard.querySelector('.character-label');
    if (label) label.textContent = character.name;
    const energyText = document.getElementById('energy-text-phd');
    if (energyText) energyText.textContent = character.energy || 0;
    // make the phd card reference this character id so lookups can map 'phd' -> actual id
    phdCard.dataset.character = character.id;
    // also populate the global energy fallback so updateUI/getCharEnergy finds a value for 'phd'
    if (typeof energy === 'object') energy.phd = Number(character.energy) || 0;
  }

  // Place a draggable card in the first available card-slot at the bottom
  const slots = Array.from(document.querySelectorAll('.card-slot'));
  let placed = false;
  for (let s of slots) {
    if (!s.querySelector('.card')) {
      // clear empty placeholder text/class
      s.classList.remove('empty');
      s.textContent = '';

      const cardImg = document.createElement('img');
      cardImg.src = character.photo;
      cardImg.className = 'card';
      cardImg.draggable = true;
      cardImg.dataset.character = character.id;
      cardImg.alt = character.name + ' card';

      // set the slot id so drag origin is tracked
      s.dataset.slot = character.id;
      s.appendChild(cardImg);

      // attach dragstart handler for the newly created card
      cardImg.addEventListener('dragstart', e => {
        e.dataTransfer.setData('character', e.target.dataset.character);
        e.dataTransfer.setData('origin', e.target.parentElement.dataset.slot || 'building');
      });

      placed = true;
      break;
    }
  }

  if (!placed) {
    addLog(`No empty card slot available to place ${character.name}'s card.`);
  }

  // Close the recruit UI and refresh UI
  document.getElementById('recruit-screen').style.display = 'none';
  if (typeof renderSidebar === 'function') renderSidebar();
  if (typeof updateUI === 'function') updateUI();

  addLog(`${character.name} joined the team.`);
}

function showPostdocChoices() {
  const recruitScreen = document.getElementById("recruit-screen");
  const container = document.getElementById("candidate-container");
  container.innerHTML = "";

  // choose 3 candidates based on current respect
  function sampleRandom(arr, n) {
    const out = [];
    if (!Array.isArray(arr) || arr.length === 0) return out;
    const copy = arr.slice();
    // shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    for (let i = 0; i < Math.min(n, copy.length); i++) out.push(copy[i]);
    // if not enough unique items, fill by random picks (allow duplicates)
    while (out.length < n) {
      out.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    return out;
  }

  const level1 = postdocCandidates.filter(p => Number(p.level) === 1);
  const level2 = postdocCandidates.filter(p => Number(p.level) === 2);
  let choices = [];
  if (respect >= 10 && respect < 20) {
    // 2 from level1, 1 from level2
    choices = sampleRandom(level1, 2).concat(sampleRandom(level2, 1));
  } else if (respect >= 30 && respect < 40) {
    // 2 from level2, 1 from level1
    choices = sampleRandom(level2, 2).concat(sampleRandom(level1, 1));
  } else {
    // fallback: pick any 3
    choices = sampleRandom(level2, 3);
  }

  choices.forEach(c => {
    // compute average expected values (per day) for display
    const progGain = Number(c.progressGainatLab ?? c.progressRate ?? 0);
    const pGain = Number(c.progressGainatLabProbability ?? c.progressGainatLabProbability ?? 1) || 0;
    const progLoss = Number(c.progressLossatLab ?? 0);
    const pLoss = Number(c.progressLossatLabProbability ?? 0) || 0;
    const expectedProgress = progGain * pGain - progLoss * pLoss;

    const fundGain = Number(c.fundingGainatOffice ?? c.usingfundingRate ?? c.getfundingRate ?? 0);
    const fundP = Number(c.fundingGainatOfficeProbability ?? 0) || 0;
    const expectedFunding = fundGain * fundP;

    const dormGain = Number(c.energyGainatDorm ?? c.dormRecoverRate ?? 0);
    const officeLoss = Number(c.energyLossatOffice ?? 0);
    const labLoss = Number(c.energyLossatLab ?? 0);
    const lectureLoss = Number(c.energyLossatLecture ?? 0);
    const barGain = Number(c.energyGainatBar ?? 0);
    const barPGain = Number(c.energyGainatBarProbability ?? c.barProbability ?? 0) || 0;
    const barLoss = Number(c.energyLossatBar ?? 0);
    const barPLoss = Number(c.energyLossatBarProbability ?? 0) || 0;
    const expectedBarEnergy = barGain * barPGain - barLoss * barPLoss;
    const teachingRate = Number(c.respectGainatLecture);

    const card = document.createElement("div");
    card.className = "candidate-card";
    card.innerHTML = `
      <img src="${c.photo}" alt="${c.name}">
      <h3>${c.name}</h3>
      <p>Energy (start): ${c.energy}</p>
      <p>Avg progress/day (lab): ${expectedProgress.toFixed(2)}</p>
      <p>Avg funding/day (office): ${expectedFunding.toFixed(2)}</p>
      <p>Energy Δ — Dorm: +${dormGain}, Lab: -${labLoss}, Office: -${officeLoss}</p>
      <p>Avg bar energy/day: ${expectedBarEnergy.toFixed(2)} (chance ${(barPGain*100).toFixed(0)}%)</p>
      <p>Teaching: +${teachingRate ?? 0}</p>
      <p><em>${c.special ?? ''}</em></p>
    `;
    card.onclick = () => selectPostdoc(c);
    container.appendChild(card);
  });

  // add a skip button so the player can choose none
  // remove existing skip button if present
  let existingSkip = document.getElementById('recruit-skip-btn');
  if (existingSkip) existingSkip.remove();
  const skipWrap = document.createElement('div');
  skipWrap.style.textAlign = 'center';
  skipWrap.style.marginTop = '12px';
  const skipBtn = document.createElement('button');
  skipBtn.id = 'recruit-skip-btn';
  skipBtn.textContent = 'None of these';
  skipBtn.style.padding = '8px 12px';
  skipBtn.style.fontSize = '16px';
  skipBtn.style.cursor = 'pointer';
  skipBtn.onclick = () => {
    // close the recruit screen and log the skip
    document.getElementById('recruit-screen').style.display = 'none';
    addLog('Player skipped recruitment this round.');
  };
  skipWrap.appendChild(skipBtn);
  container.appendChild(skipWrap);

  recruitScreen.style.display = "block";
}

function selectPostdoc(character) {
  // Add the selected candidate to the global characters pool
  function normalizeCandidate(src) {
    const o = Object.assign({}, src);
    // canonicalize field names with sensible fallbacks
    o.energy = Number(o.energy ?? 100);
    o.energyGainatDorm = Number(o.energyGainatDorm ?? o.dormRecoverRate ?? 0);
    o.energyLossatOffice = Number(o.energyLossatOffice ?? o.usingEnergyRate ?? 1);
    o.energyLossatLab = Number(o.energyLossatLab ?? o.usingEnergyRate ?? 1);
    o.energyLossatLecture = Number(o.energyLossatLecture ?? 1);
    o.energyGainatBar = Number(o.energyGainatBar ?? 0);
    o.energyGainatBarProbability = Number(o.energyGainatBarProbability ?? o.barProbability ?? 0);
    o.energyLossatBar = Number(o.energyLossatBar ?? 0);
    o.energyLossatBarProbability = Number(o.energyLossatBarProbability ?? 0);

    o.fundingGainatOffice = Number(o.fundingGainatOffice ?? o.usingfundingRate ?? o.getfundingRate ?? 0);
    o.fundingGainatOfficeProbability = Number(o.fundingGainatOfficeProbability ?? 0);
    o.fundingLossatLab = Number(o.fundingLossatLab ?? 0);

    o.progressGainatLab = Number(o.progressGainatLab ?? o.progressRate ?? 0);
    o.progressGainatLabProbability = Number(o.progressGainatLabProbability ?? 0);
    o.progressLossatLab = Number(o.progressLossatLab ?? 0);
    o.progressLossatLabProbability = Number(o.progressLossatLabProbability ?? 0);

    o.respectGainatLecture = Number(o.respectGainatLecture ?? 0);
    o.respectGainatLectureProbability = Number(o.respectGainatLectureProbability ?? 0);
    o.respectGainatBar = Number(o.respectGainatBar ?? 0);
    o.respectGainatBarProbability = Number(o.respectGainatBarProbability ?? 0);
    o.respectLossatBar = Number(o.respectLossatBar ?? 0);
    o.respectLossatBarProbability = Number(o.respectLossatBarProbability ?? 0);

    o.level = o.level ?? 1;
    o.hired = !!o.hired;
    o.location = null;
    return o;
  }

  if (Array.isArray(characters)) {
    const exists = characters.find(c => c && c.id === character.id);
    if (!exists) {
      const newChar = normalizeCandidate(character);
      characters.push(newChar);
    }
  } else {
    characters[character.id] = normalizeCandidate(character);
  }

  // Update the left-side PhD slot card (if present)
  // Update the left-side Postdoc slot card (if present)
  const postdocCard = document.getElementById('char-postdoc');
  if (postdocCard) {
    const avatar = postdocCard.querySelector('.character-avatar');
    if (avatar) avatar.src = character.photo;
    const label = postdocCard.querySelector('.character-label');
    if (label) label.textContent = character.name;
    const energyText = document.getElementById('energy-text-postdoc');
    if (energyText) energyText.textContent = character.energy || 0;
    // make the postdoc card reference this character id so lookups can map 'postdoc' -> actual id
    postdocCard.dataset.character = character.id;
    // also populate the global energy fallback so updateUI/getCharEnergy finds a value for 'postdoc'
    if (typeof energy === 'object') energy.postdoc = Number(character.energy) || 0;
  }

  // Place a draggable card in the first available card-slot at the bottom
  const slots = Array.from(document.querySelectorAll('.card-slot'));
  let placed = false;
  for (let s of slots) {
    if (!s.querySelector('.card')) {
      // clear empty placeholder text/class
      s.classList.remove('empty');
      s.textContent = '';

      const cardImg = document.createElement('img');
      cardImg.src = character.photo;
      cardImg.className = 'card';
      cardImg.draggable = true;
      cardImg.dataset.character = character.id;
      cardImg.alt = character.name + ' card';

      // set the slot id so drag origin is tracked
      s.dataset.slot = character.id;
      s.appendChild(cardImg);

      // attach dragstart handler for the newly created card
      cardImg.addEventListener('dragstart', e => {
        e.dataTransfer.setData('character', e.target.dataset.character);
        e.dataTransfer.setData('origin', e.target.parentElement.dataset.slot || 'building');
      });

      placed = true;
      break;
    }
  }

  if (!placed) {
    addLog(`No empty card slot available to place ${character.name}'s card.`);
  }

  // Close the recruit UI and refresh UI
  document.getElementById('recruit-screen').style.display = 'none';
  if (typeof renderSidebar === 'function') renderSidebar();
  if (typeof updateUI === 'function') updateUI();

  addLog(`${character.name} joined the team.`);
}

function showcoPIChoices() {
  const recruitScreen = document.getElementById("recruit-screen");
  const container = document.getElementById("candidate-container");
  container.innerHTML = "";

  // choose 3 candidates based on current respect
  function sampleRandom(arr, n) {
    const out = [];
    if (!Array.isArray(arr) || arr.length === 0) return out;
    const copy = arr.slice();
    // shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    for (let i = 0; i < Math.min(n, copy.length); i++) out.push(copy[i]);
    // if not enough unique items, fill by random picks (allow duplicates)
    while (out.length < n) {
      out.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    return out;
  }

  const level1 = coPICandidates.filter(p => Number(p.level) === 1);
  const level2 = coPICandidates.filter(p => Number(p.level) === 2);
  let choices = [];
  if (respect >= 10 && respect < 20) {
    // 2 from level1, 1 from level2
    choices = sampleRandom(level1, 2).concat(sampleRandom(level2, 1));
  } else if (respect >= 30 && respect < 40) {
    // 2 from level2, 1 from level1
    choices = sampleRandom(level2, 2).concat(sampleRandom(level1, 1));
  } else {
    // fallback: pick any 3
    choices = sampleRandom(level2, 3);
  }

  choices.forEach(c => {
    // compute average expected values (per day) for display
    const progGain = Number(c.progressGainatLab ?? c.progressRate ?? 0);
    const pGain = Number(c.progressGainatLabProbability ?? c.progressGainatLabProbability ?? 1) || 0;
    const progLoss = Number(c.progressLossatLab ?? 0);
    const pLoss = Number(c.progressLossatLabProbability ?? 0) || 0;
    const expectedProgress = progGain * pGain - progLoss * pLoss;

    const fundGain = Number(c.fundingGainatOffice ?? c.usingfundingRate ?? c.getfundingRate ?? 0);
    const fundP = Number(c.fundingGainatOfficeProbability ?? 0) || 0;
    const expectedFunding = fundGain * fundP;

    const dormGain = Number(c.energyGainatDorm ?? c.dormRecoverRate ?? 0);
    const officeLoss = Number(c.energyLossatOffice ?? 0);
    const labLoss = Number(c.energyLossatLab ?? 0);
    const lectureLoss = Number(c.energyLossatLecture ?? 0);
    const barGain = Number(c.energyGainatBar ?? 0);
    const barPGain = Number(c.energyGainatBarProbability ?? c.barProbability ?? 0) || 0;
    const barLoss = Number(c.energyLossatBar ?? 0);
    const barPLoss = Number(c.energyLossatBarProbability ?? 0) || 0;
    const expectedBarEnergy = barGain * barPGain - barLoss * barPLoss;
    const teachingRate = Number(c.respectGainatLecture);

    const card = document.createElement("div");
    card.className = "candidate-card";
    card.innerHTML = `
      <img src="${c.photo}" alt="${c.name}">
      <h3>${c.name}</h3>
      <p>Energy (start): ${c.energy}</p>
      <p>Avg progress/day (lab): ${expectedProgress.toFixed(2)}</p>
      <p>Avg funding/day (office): ${expectedFunding.toFixed(2)}</p>
      <p>Energy Δ — Dorm: +${dormGain}, Lab: -${labLoss}, Office: -${officeLoss}</p>
      <p>Avg bar energy/day: ${expectedBarEnergy.toFixed(2)} (chance ${(barPGain*100).toFixed(0)}%)</p>
      <p>Teaching: +${teachingRate ?? 0}</p>
      <p><em>${c.special ?? ''}</em></p>
    `;
    card.onclick = () => selectcoPI(c);
    container.appendChild(card);
  });

  // add a skip button so the player can choose none
  // remove existing skip button if present
  let existingSkip = document.getElementById('recruit-skip-btn');
  if (existingSkip) existingSkip.remove();
  const skipWrap = document.createElement('div');
  skipWrap.style.textAlign = 'center';
  skipWrap.style.marginTop = '12px';
  const skipBtn = document.createElement('button');
  skipBtn.id = 'recruit-skip-btn';
  skipBtn.textContent = 'None of these';
  skipBtn.style.padding = '8px 12px';
  skipBtn.style.fontSize = '16px';
  skipBtn.style.cursor = 'pointer';
  skipBtn.onclick = () => {
    // close the recruit screen and log the skip
    document.getElementById('recruit-screen').style.display = 'none';
    addLog('Player skipped recruitment this round.');
  };
  skipWrap.appendChild(skipBtn);
  container.appendChild(skipWrap);

  recruitScreen.style.display = "block";
}

function selectcoPI(character) {
  // Add the selected candidate to the global characters pool
  function normalizeCandidate(src) {
    const o = Object.assign({}, src);
    // canonicalize field names with sensible fallbacks
    o.energy = Number(o.energy ?? 100);
    o.energyGainatDorm = Number(o.energyGainatDorm ?? o.dormRecoverRate ?? 0);
    o.energyLossatOffice = Number(o.energyLossatOffice ?? o.usingEnergyRate ?? 1);
    o.energyLossatLab = Number(o.energyLossatLab ?? o.usingEnergyRate ?? 1);
    o.energyLossatLecture = Number(o.energyLossatLecture ?? 1);
    o.energyGainatBar = Number(o.energyGainatBar ?? 0);
    o.energyGainatBarProbability = Number(o.energyGainatBarProbability ?? o.barProbability ?? 0);
    o.energyLossatBar = Number(o.energyLossatBar ?? 0);
    o.energyLossatBarProbability = Number(o.energyLossatBarProbability ?? 0);

    o.fundingGainatOffice = Number(o.fundingGainatOffice ?? o.usingfundingRate ?? o.getfundingRate ?? 0);
    o.fundingGainatOfficeProbability = Number(o.fundingGainatOfficeProbability ?? 0);
    o.fundingLossatLab = Number(o.fundingLossatLab ?? 0);

    o.progressGainatLab = Number(o.progressGainatLab ?? o.progressRate ?? 0);
    o.progressGainatLabProbability = Number(o.progressGainatLabProbability ?? 0);
    o.progressLossatLab = Number(o.progressLossatLab ?? 0);
    o.progressLossatLabProbability = Number(o.progressLossatLabProbability ?? 0);

    o.respectGainatLecture = Number(o.respectGainatLecture ?? 0);
    o.respectGainatLectureProbability = Number(o.respectGainatLectureProbability ?? 0);
    o.respectGainatBar = Number(o.respectGainatBar ?? 0);
    o.respectGainatBarProbability = Number(o.respectGainatBarProbability ?? 0);
    o.respectLossatBar = Number(o.respectLossatBar ?? 0);
    o.respectLossatBarProbability = Number(o.respectLossatBarProbability ?? 0);

    o.level = o.level ?? 1;
    o.hired = !!o.hired;
    o.location = null;
    return o;
  }

  if (Array.isArray(characters)) {
    const exists = characters.find(c => c && c.id === character.id);
    if (!exists) {
      const newChar = normalizeCandidate(character);
      characters.push(newChar);
    }
  } else {
    characters[character.id] = normalizeCandidate(character);
  }

  // Update the left-side PhD slot card (if present)
  // Update the left-side coPI slot card (if present)
  const coPICard = document.getElementById('char-coPI');
  if (coPICard) {
    const avatar = coPICard.querySelector('.character-avatar');
    if (avatar) avatar.src = character.photo;
    const label = coPICard.querySelector('.character-label');
    if (label) label.textContent = character.name;
    const energyText = document.getElementById('energy-text-coPI');
    if (energyText) energyText.textContent = character.energy || 0;
    // make the coPI card reference this character id so lookups can map 'coPI' -> actual id
    coPICard.dataset.character = character.id;
    // also populate the global energy fallback so updateUI/getCharEnergy finds a value for 'coPI'
    if (typeof energy === 'object') energy.coPI = Number(character.energy) || 0;
  }

  // Place a draggable card in the first available card-slot at the bottom
  const slots = Array.from(document.querySelectorAll('.card-slot'));
  let placed = false;
  for (let s of slots) {
    if (!s.querySelector('.card')) {
      // clear empty placeholder text/class
      s.classList.remove('empty');
      s.textContent = '';

      const cardImg = document.createElement('img');
      cardImg.src = character.photo;
      cardImg.className = 'card';
      cardImg.draggable = true;
      cardImg.dataset.character = character.id;
      cardImg.alt = character.name + ' card';

      // set the slot id so drag origin is tracked
      s.dataset.slot = character.id;
      s.appendChild(cardImg);

      // attach dragstart handler for the newly created card
      cardImg.addEventListener('dragstart', e => {
        e.dataTransfer.setData('character', e.target.dataset.character);
        e.dataTransfer.setData('origin', e.target.parentElement.dataset.slot || 'building');
      });

      placed = true;
      break;
    }
  }

  if (!placed) {
    addLog(`No empty card slot available to place ${character.name}'s card.`);
  }

  // Close the recruit UI and refresh UI
  document.getElementById('recruit-screen').style.display = 'none';
  if (typeof renderSidebar === 'function') renderSidebar();
  if (typeof updateUI === 'function') updateUI();

  addLog(`${character.name} joined the team.`);
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
  else if (currentTurn === 5) {
    showPostdocChoices();  // 🎯 在第5轮开始时弹出选择界面
  }
  else if (currentTurn === 8) {
    showcoPIChoices();  // 🎯 在第8轮开始时弹出选择界面
  }
}