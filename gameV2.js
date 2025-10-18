// === 全局变量 ===
let currentTurn = 1;


// === Patched defaults/aliases ===
const currentPIId = (typeof window !== 'undefined' && window.currentPIId) ? window.currentPIId : 'sumit';
// let discipline = (typeof window !== 'undefined' && typeof window.discipline === 'number') ? window.discipline : 50;
let discipline = 75;
// Alias bubbleSpeak -> makeCharacterSpeak for calls later in the file
function bubbleSpeak(id, msg){ try { return makeCharacterSpeak(id, msg); } catch(e){} }

// === Dynamic team roster (6 generic members) ===
// === Dynamic team roster (6 generic members) ===
// function getTeamIds() {
//   // IDs used throughout the UI & left sidebar; adjust if you add more characters
//   return ['sumit','phd','postdoc','coPI','member1','member2'];
// }
function getTeamIds() {
  return ['member1','member2','member3','member4','member5','member6'];
}

// === Core game config & state ===
const totalTurns = 20;
const timeforTurn = 90; // 每轮 90 天
let timeLeft = timeforTurn; // 每轮 90 天
let timer = null;
// milliseconds per in-game day (configurable). Change this to speed up/slow down time.
let dayMs = 10; // default 1000ms = 1s per day
const MINFUNDINGTORECRUIT=100;
// === Recruitment weighting constants (edit as you like) ===
window.MAXPAPERS      = typeof window.MAXPAPERS      === 'number' ? window.MAXPAPERS      : 65;
window.TARGETFUNDING  = typeof window.TARGETFUNDING  === 'number' ? window.TARGETFUNDING  : 500;
window.TARGETSKILLS   = typeof window.TARGETSKILLS   === 'number' ? window.TARGETSKILLS   : 500;
const FUNDINGOK=500;
const MAXFUNDING=1000;
const MAXSKILLS=1000;
const MAXDISC=100;
const MAXPLATFORMS=105;
const TENUREPROGRESS=200;
const SUPERTEACHER=500;

// 状态数值
let funding = 100;
let progress = 0;
let skills = 0;
let platforms = 0;
let energy = Object.fromEntries(getTeamIds().map(id => [id, 100]));
let charHappiness = Object.fromEntries(getTeamIds().map(id => [id, 50]));

let placement = {}; // 记录人物位置

// let phdChosen = false; // deprecated role flag
// let postdocChosen = false; // deprecated role flag
// let coPIChosen = false; // deprecated role flag
// === 画布 & 背景 ===


// === UI更新 ===

// --- Ensure Sumit (PI) is bound to the first sidebar slot on startup ---
function initDefaultPI() {
  try {
    if (Array.isArray(window.characters)) {
      const sumit = window.characters.find(c => c && (c.id === 'sumit' || c.name === 'Sumit'));
      const slot = document.getElementById('char-member1');
      if (sumit && slot) {
        slot.dataset.character = sumit.id;
        const avatar = slot.querySelector('.character-avatar');
        if (avatar && sumit.photo) avatar.src = sumit.photo;
        const label = slot.querySelector('.character-label');
        if (label) label.textContent = sumit.name || sumit.id;

        // Sync energy & happiness baselines for the bound slot
        const et = document.getElementById('energy-text-member1');
        if (et) et.textContent = Math.round(sumit.energy || 0);
        const ht = document.getElementById('happiness-text-member1');
        if (ht) ht.textContent = Math.round(sumit.happiness || 50);

        // Keep global maps in sync so updateUI() shows correct bar immediately
        try {
          if (typeof energy === 'object') energy.member1 = Number(sumit.energy) || 0;
          if (typeof charHappiness === 'object') charHappiness.member1 = Number(sumit.happiness) || 50;
        } catch(e){}
      }
    }
  } catch(e){ console.warn('initDefaultPI failed', e); }
  updateUI();
}
let __updatingUI = false;

function getTeamAverageHappiness() {
  // Look only at the six sidebar slots
  const slots = ['member1','member2','member3','member4','member5','member6'];
  const values = [];

  for (const s of slots) {
    const slotEl = document.getElementById('char-' + s);
    if (!slotEl || !slotEl.dataset || !slotEl.dataset.character) continue;
    const id = slotEl.dataset.character.trim();
    if (!id) continue;

    // find the bound character object and read its happiness
    let h = null;
    try {
      if (Array.isArray(characters)) {
        const c = characters.find(x => x && (x.id === id || x.name === id));
        if (c && typeof c.happiness === 'number') h = c.happiness;
      } else if (characters && characters[id] && typeof characters[id].happiness === 'number') {
        h = characters[id].happiness;
      } else if (typeof charHappiness === 'object' && typeof charHappiness[id] === 'number') {
        h = charHappiness[id];
      }
    } catch(e){}

    if (typeof h === 'number') values.push(h);
  }

  // If no team members are bound yet, fallback to PI in member1 if present
  if (!values.length) {
    const m1 = document.getElementById('char-member1');
    const id = m1 && m1.dataset ? m1.dataset.character : null;
    if (id) {
      try {
        if (Array.isArray(characters)) {
          const c = characters.find(x => x && (x.id === id || x.name === id));
          if (c && typeof c.happiness === 'number') values.push(c.happiness);
        } else if (characters && characters[id] && typeof characters[id].happiness === 'number') {
          values.push(characters[id].happiness);
        }
      } catch(e){}
    }
  }

  if (!values.length) return 0;
  const avg = values.reduce((a,b)=>a+b, 0) / values.length;
  return Math.round(avg);
}

function classifyPct(pct) {
  if (pct == null || isNaN(pct)) return 'neutral';
  if (pct < 25) return 'bad';
  if (pct < 60) return 'warn';
  return 'ok';
}
function paintStatBox(wrapperEl, pct) {
  if (!wrapperEl) return;
  wrapperEl.classList.remove('bad','warn','ok','neutral');
  wrapperEl.classList.add(classifyPct(pct));
}
function setStat(elId, text, pct) {
  const span = document.getElementById(elId);
  if (span) span.textContent = text;
  const box = span ? span.closest('.stat') : null;
  paintStatBox(box, pct);
}

function classifyFunding(value, max) {
  if (value == null || isNaN(value)) return 'neutral';
  if (value < max*0.2) return 'bad';    // < 25% of MAXFUNDING
  if (value < max*0.5) return 'warn';   // 25–60% of MAXFUNDING
  return 'ok';                              // ≥ 60% of MAXFUNDING
}

function paintStatBoxByClass(wrapperEl, klass) {
  if (!wrapperEl) return;
  wrapperEl.classList.remove('bad','warn','ok','neutral');
  wrapperEl.classList.add(klass || 'neutral');
}

function updateUI() {
  if (__updatingUI) return; __updatingUI = true;
  try {

  document.getElementById("currentTurn").textContent = currentTurn;
  document.getElementById("totalTurns").textContent = totalTurns;
  document.getElementById("time").textContent = timeLeft;

  // Percent bases (defined near top of file)
  /// MAXFUNDING, TENUREPROGRESS, MAXPLATFORMS, MAXDISC are already defined globally.
  // const fundingPct    = Math.max(0, Math.min(100, Math.round((funding    / MAXFUNDING)   * 100)));
  const papersPct     = Math.max(0, Math.min(100, Math.round((progress   / TENUREPROGRESS)  * 100)));
  const platformsPct  = Math.max(0, Math.min(100, Math.round((platforms  / 100) * 100)));
  const disciplinePct = Math.max(0, Math.min(100, Math.round(Number(discipline) || 0)));
  const happinessPct  = Math.max(0, Math.min(100, Math.round(Number(getTeamAverageHappiness()) || 0)));

  // Funding: show k€, color by ratio to MAXFUNDING
  const fundingBox = document.getElementById("funding");
  if (fundingBox) {
    fundingBox.textContent = `${Math.round(funding)} k€`;
    const klass = classifyFunding(funding, MAXFUNDING);
    paintStatBoxByClass(fundingBox.closest('.stat'), klass);
  }

  // Skills: show raw value, color by ratio to MAXSKILLS
  {
    const el = document.getElementById("skills");
    if (el) {
      el.textContent = Math.round(skills);
      const wrapper = el.closest('.stat');
      const klass = classifyFunding(skills, MAXSKILLS); // thresholds: <25% bad, <60% warn, else ok
      paintStatBoxByClass(wrapper, klass);
    }
  }

  // Format + colorize
  // setStat("funding",    `${Math.round(funding)} k€`, fundingPct);   // Funding in kEuro
  setStat("papers",     `${papersPct}%`,            papersPct);     // Papers in %
  setStat("platforms",  `${platformsPct}%`,         platformsPct);  // Platforms in %
  setStat("discipline", `${disciplinePct}%`,        disciplinePct); // Discipline in %
  setStat("happiness",  `${happinessPct}%`,         happinessPct);  // Happiness in %

  // (Optionally keep skills plain for now)
  // document.getElementById("skills").textContent = skills;

  // Update energy bars (width + color) for characters. Use multiple fallbacks

  // === Happiness bars (per-character) ===
  function getCharHappiness(id) {
    try {
      const slotEl = document.getElementById('char-' + id);
      if (slotEl && slotEl.dataset && slotEl.dataset.character) id = slotEl.dataset.character;
    } catch (e) {}
    if (typeof characters === 'object') {
      if (Array.isArray(characters)) {
        const c = characters.find(x => x && (x.id === id || x.name === id));
        if (c && typeof c.happiness === 'number') return c.happiness;
      } else if (characters[id] && typeof characters[id].happiness === 'number') {
        return characters[id].happiness;
      }
    }
    if (typeof charHappiness === 'object' && typeof charHappiness[id] === 'number') return charHappiness[id];
    return 50;
  }

  function getCharEnergy(id) {
    // If the UI uses role slots like 'phd' that map to a selected character,
    // check for a DOM element `#char-<id>` with a dataset.character mapping and use that id.
    try {
      let slotEl = document.getElementById('char-' + id);
      if (slotEl && slotEl.dataset && slotEl.dataset.character) {
        id = slotEl.dataset.character;
      }
    } catch (e) {
      // ignore DOM errors and continue with original id
    }
    // characters may be an object map or an array in different versions
    if (typeof characters === 'object') {
      if (Array.isArray(characters)) {
        let c = characters.find(x => x && (x.id === id || x.name === id));
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

  // Generic stat bar updater for energy/happiness
  // Scales width 0–100%, shows row only when value is valid, hides it when null/NaN
  function updateStatBar(kind, slug, value, options = {}) {
    const bar  = document.getElementById(`${kind}-${slug}`);
    if (!bar) return;
    const row  = bar.parentElement;                 // .character-energy / .character-happiness
    const text = document.getElementById(`${kind}-text-${slug}`);
    const num  = Number(value);

    if (value == null || isNaN(num)) {
      row.style.display = 'none';
      if (text) text.textContent = '';
      bar.style.width = '0%';
      return;
    }

    const v = Math.max(0, Math.min(100, Math.round(num)));
    row.style.display = 'flex';
    if (text) text.textContent = v;
    bar.style.width = v + '%';

    // Optional thresholds (keep your colors for energy)
    const low = options.colors?.low ?? 10;
    const mid = options.colors?.mid ?? 50;
    //if (kind === 'energy') {
    if (v >= mid) bar.style.background = 'green';
    else if (v >= low) bar.style.background = 'yellow';
    else bar.style.background = 'red';
    //}
  }

  // === Update visible sidebar cards ===
  try {
    const cards = document.querySelectorAll('.character-card[id^="char-"]');
    cards.forEach(card => {
      const slug = card.id.replace('char-','');
      const bound = (card.dataset && card.dataset.character) ? card.dataset.character.trim() : '';
      if (!bound) {
        const lbl = card.querySelector('.character-label');
        if (lbl) lbl.textContent = '';

        // Hide rows immediately and clear values
        updateStatBar('energy', slug, null);
        updateStatBar('happiness', slug, null);
        return;
      }
      // update from actual bound character id via getCharEnergy/Happiness which resolves dataset mapping
      const eVal = getCharEnergy(slug);
      updateStatBar('energy', slug, eVal);

      const hVal = getCharHappiness(slug);
      updateStatBar('happiness', slug, hVal);

    });
  } catch(_e) {}


  } finally { __updatingUI = false; }
}

// ======================
// 初始化拖拽
// ======================
initDefaultPI();
// === Ensure every character has a happiness field (default 50) ===
try {
  if (Array.isArray(window.characters)) {
    window.characters.forEach(c => { if (typeof c.happiness !== 'number') c.happiness = 50; });
  } else if (typeof window.characters === 'object' && window.characters) {
    Object.values(window.characters).forEach(c => { if (c && typeof c.happiness !== 'number') c.happiness = 50; });
  }
} catch(e) {}

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

function moveCharacterToBuilding(charId, buildingId) {
  const card = document.querySelector(`.card[data-character="${charId}"]`);
  const buildingEl = document.getElementById(buildingId);
  if (!card || !buildingEl) return false;

  const occ = buildingEl.querySelector('.occupants') || buildingEl;
  if (!occ.contains(card)) occ.appendChild(card);
  card.classList.add('in-building');

  // update character model
  let cObj = null;
  if (Array.isArray(window.characters)) {
    cObj = characters.find(x => x && (x.id === charId || x.name === charId));
  } else if (characters && characters[charId]) {
    cObj = characters[charId];
  }
  if (cObj) cObj.location = buildingEl.dataset.building || buildingId;

  logAction(`${charId} moved to ${cObj?.location || buildingId} (auto)`);
  if (typeof updateUI === 'function') updateUI();
  return true;
}

// 假设 characters 是全局数组或对象
document.querySelectorAll('.fire-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const charCard = e.target.closest('.character-card');
    if (!charCard) return;
    const charId = charCard.id.replace('char-', '');
    fireCharacter(charId);
  });
});

function fireCharacter(characterId) {
  if (!characterId) return;

  const confirmFire = confirm("Are you sure you want to fire this character?");
  if (!confirmFire) return;
  
  ['phdCandidates','postdocCandidates','coPICandidates'].forEach(poolName => {
    const pool = window[poolName] || [];
    const obj = pool.find(x => x && x.id === characterId);
    if (obj) obj.hired = false;
  });

  // 移除全局 characters 数据
  if (Array.isArray(characters)) {
    characters = characters.filter(c => c.id !== characterId);
  } else if (typeof characters === 'object') {
    delete characters[characterId];
  }

  // Unbind from sidebar and blank the slot visuals
  try { unbindCharacterFromSidebar(characterId); } catch(e) {}

  // 清空下方卡牌
  const cardSlots = document.querySelectorAll('#cardArea .card-slot');
  cardSlots.forEach(slot => {
    const card = slot.querySelector(`.card[data-character="${characterId}"]`);
    if (card) {
      card.remove();
      slot.classList.add('empty');
      slot.textContent = 'Empty';
      slot.removeAttribute('data-slot');
    }
  });

  // 更新 UI
  if (typeof updateUI === 'function') updateUI();
  addLog(`⚡ Character ${characterId} has been fired.`);
}



// === Sidebar binding helpers ===
function bindCharacterToFirstEmptySidebarSlot(character) {
  const targets = ['member2','member3','member4','member5','member6'];
  for (let t of targets) {
    const card = document.getElementById('char-' + t);
    if (!card) continue;
    const bound = (card.dataset && card.dataset.character) ? card.dataset.character.trim() : "";
    if (!bound) {
        let lbl = card.querySelector('.character-label'); if (lbl) lbl.textContent = '';

      // bind
      card.dataset.character = character.id;
      const avatar = card.querySelector('.character-avatar');
      if (avatar && character.photo) avatar.src = character.photo;
      const label = card.querySelector('.character-label');
      if (label) label.textContent = character.name || character.id;
      const eText = card.querySelector('.energy-text') || document.getElementById('energy-text-' + t);
      if (eText) eText.textContent = Math.round(character.energy || 100);
      const hText = card.querySelector('.happiness-text') || document.getElementById('happiness-text-' + t);
      if (hText) hText.textContent = Math.round(character.happiness || 50);
      return true;
    }
  }
  // no empty slot
  addLog('No empty sidebar slot available to display ' + (character.name || character.id) + '.');
  return false;
}

function unbindCharacterFromSidebar(characterId) {
  const cards = document.querySelectorAll('.character-card[id^="char-"]');
  cards.forEach(card => {
    if (!card || !card.dataset) return;
    if ((card.dataset.character || '').trim() === characterId) {
      // clear binding and visuals
      card.dataset.character = '';
      const avatar = card.querySelector('.character-avatar');
      if (avatar) avatar.src = 'game/src/wanted2.png';
      const label = card.querySelector('.character-label');
      if (label) label.textContent = '';
      let eText = card.querySelector('.energy-text') || document.getElementById('energy-text-' + card.id.replace('char-',''));
      if (eText) eText.textContent = '';
      let hText = card.querySelector('.happiness-text') || document.getElementById('happiness-text-' + card.id.replace('char-',''));
      if (hText) hText.textContent = '';
      const eBar = document.getElementById('energy-' + card.id.replace('char-',''));
      if (eBar) eBar.style.width = '0%';
      const hBar = document.getElementById('happiness-' + card.id.replace('char-',''));
      if (hBar) hBar.style.width = '0%';
      const bubble = card.querySelector('.speech-bubble');
      if (bubble) bubble.textContent = '';
    }
  });
}

function stochasticGain(gain, gainprob, loss, lossprob) {
  // Stochastic approach: single random draw decides gain / loss / no-change
  let Gain = Number(gain ?? 0);
  let GainProb = Number(gainprob ?? 0);
  let Loss = Number(loss ?? 0);
  let LossProb = Number(lossprob ?? 0);
  // clamp probabilities to [0,1]
  GainProb = Math.max(0, Math.min(1, GainProb));
  LossProb = Math.max(0, Math.min(1, LossProb));
  let totprob=GainProb + LossProb
  // ensure combined threshold doesn't exceed 1
  if (totprob > 1) {
    // normalize loss so gain has priority
    LossProb = LossProb/totprob;
    GainProb = GainProb/totprob;
  }
  const r = Math.random();
  let inc = 0;
  if (r < GainProb) {
    inc = Gain;
  } else if (r < GainProb + LossProb) {
    inc = -Loss;
  }
  return inc;
}

function logAction(msg) {
  const log = document.getElementById("log");
  const entry = document.createElement("div");
  entry.textContent = msg;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function hasCardInDOM(id) {
  return !!document.querySelector(`.card[data-character="${id}"]`);
}

// === 每天计算 ===
let __simulatingDay = false;
function simulateDay() {
  if (__simulatingDay) return; __simulatingDay = true;
  try {

  timeLeft--;
  // If characters is an array, iterate items; if it's an object map, iterate values
  let charList = Array.isArray(characters) ? characters : Object.values(characters);
  for (let c of charList) {
    applyLocationEffects(c);
  }
  // Track presence for firing/quitting decisions
  (Array.isArray(characters) ? characters : Object.values(characters)).forEach(c => {
    if (!c) return;
    const id = c.id || c.name;
    if (!id) return;

    // Only track people who actually appear on the board at least once
    const onBoardNow = hasCardInDOM(id);
    if (onBoardNow) {
      if (typeof wasEverOnBoard === 'undefined') { window.wasEverOnBoard = {}; }
      wasEverOnBoard[id] = true;
      if (!c.location) {
        if (typeof daysInNull === 'undefined') { window.daysInNull = {}; }
        if (daysInNull[id] === undefined) daysInNull[id] = 0;
        daysInNull[id] += 1;
      }
    }
  });



  // helper: apply per-character effects depending on where they are
  function applyLocationEffects(c) {
    if (!c || !c.location) return;
    const loc = c.location;
    // helper random check
    const chance = p => Math.random() < (p || 0);
    let dgain=0;
    let platgain=0;
    let pgain=0;

    switch (loc) {
      case 'dorm':
        // restore energy
        const gainDorm = (c.energyGainatDorm || 2);
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
        if (platforms > 100) {
          if (chance(c.progressGainatOfficeProbability)) {
            const inc = (c.progressGainatOffice || 1);
            progress += inc;
            addLog(`${c.name} wrote papers +${inc}`);
          }
        }
        dgain=stochasticGain(Number(c.disciplineGain ?? 0), Number(c.disciplineGainProbability ?? 0), Number(c.disciplineLoss ?? 0), Number(c.disciplineLossProbability ?? 0))
        discipline += dgain;
        if (dgain > 0) {
          addLog(`${c.name} supervised in office +${dgain} discipline`);
        } else if (dgain < 0) {
          addLog(`${c.name} conspired in office -${dgain} discipline`);
        }
        break;
      case 'lab':
        // If there's no funding, the lab cannot produce progress
        if (funding <= 0) {
          addLog(`${c.name} couldn't make papers in the lab due to lack of funding`);
          if(c.type === 'PhD') {
            makeCharacterSpeak('phd', "No funding, hard to make papers!");
          } else if(c.type === 'Postdoc') {
            makeCharacterSpeak('postdoc', "No funding, hard to make papers!");
          } else if(c.type === 'coPI') {
            makeCharacterSpeak('coPI', "I am going to get some money!");
          } else {
            makeCharacterSpeak('sumit', "I am going to get some money!");
          }
        } else {
          if (platforms > 100) {
            // papers path
            pgain = stochasticGain(Number(c.progressGainatLab ?? 0), Number(c.progressGainatLabProbability ?? 0), Number(c.progressLossatLab ?? 0), Number(c.progressLossatLabProbability ?? 0));
            progress += pgain;
            if (pgain > 0) {
              addLog(`${c.name} succeeded in lab +${pgain} papers`);
            } else if (pgain < 0) {                // <-- was dgain
              addLog(`${c.name} had a setback in lab ${pgain} papers`);
            }
          } else {
            // platforms path
            platgain = stochasticGain(Number(c.platformGainatLab ?? 0), Number(c.platformGainatLabProbability ?? 0), Number(c.platformLossatLab ?? 0), Number(c.platformLossatLabProbability ?? 0));
            platforms += platgain;
            if (platgain > 0) {
              addLog(`${c.name} succeeded in lab +${platgain} platforms`);
            } else if (platgain < 0) {             // <-- was dgain
              addLog(`${c.name} had a setback in lab ${platgain} platforms`);
            }
          }
        }
        // energy and funding effects
        const lossLab = (c.energyLossatLab || 1);
        c.energy = Math.max(0, (c.energy || 0) - lossLab);
        if (typeof c.fundingLossatLab === 'number') {
          funding = Math.max(0, funding - c.fundingLossatLab);
          //addLog(`${c.name} used funding -${c.fundingLossatLab}`);
        }
        dgain=stochasticGain(Number(c.disciplineGain ?? 0), Number(c.disciplineGainProbability ?? 0), Number(c.disciplineLoss ?? 0), Number(c.disciplineLossProbability ?? 0))
        discipline += dgain;
        if (dgain > 0) {
          addLog(`${c.name} supervised in lab +${dgain} discipline`);
        } else if (dgain < 0) {
          addLog(`${c.name} conspired in lab -${dgain} discipline`);
        }
        break;
      case 'lecture':
        if (chance(c.skillsGainatLectureProbability || 1)) {
          const incR = (c.skillsGainatLecture || 1);
          skills += incR;
          addLog(`${c.name} gave a lecture +${incR} skills`);
        }
        c.energy = Math.max(0, (c.energy || 0) - (c.energyLossatLecture || 1));
        dgain=stochasticGain(Number(c.disciplineGain ?? 0), Number(c.disciplineGainProbability ?? 0), Number(c.disciplineLoss ?? 0), Number(c.disciplineLossProbability ?? 0))
        discipline += dgain;
        if (dgain > 0) {
          addLog(`${c.name} supervised in office +${dgain} discipline`);
        } else if (dgain < 0) {
          addLog(`${c.name} conspired in office -${dgain} discipline`);
        }
        break;
      case 'bar':
        // bar outcomes: mostly small energy/skills gain, small chance of big loss
        if (chance(c.energyGainatBarProbability)) {
          const eg = (c.energyGainatBar || 1);
          c.energy = Math.min(100, (c.energy || 0) + eg);
          addLog(`${c.name} had a drink +${eg} energy`);
        } else if (chance(c.energyLossatBarProbability)) {
          const el = (c.energyLossatBar || 5);
          c.energy = Math.max(0, (c.energy || 0) - el);
          addLog(`${c.name} overdid it -${el} energy`);
        }
        // if (chance(c.skillsGainatBarProbability)) {
        //   const rg = (c.skillsGainatBar || 1);
        //   skills += rg;
        // } else if (chance(c.skillsLossatBarProbability)) {
        //   const rl = (c.skillsLossatBar || 0.1);
        //   skills = Math.max(0, skills - rl);
        // }
        dgain=stochasticGain(0, 0, Number(c.disciplineLoss ?? 0), Number(c.disciplineLossProbability ?? 0))
        discipline += dgain;
        if (dgain < 0) {
          addLog(`${c.name} conspired in bar -${dgain} discipline`);
        }
        break;
      default:
        // unknown location: same effect as bar

        if (chance(c.energyGainatBarProbability)) {
          const eg = (c.energyGainatBar || 1);
          c.energy = Math.min(100, (c.energy || 0) + eg);
          addLog(`${c.name} had a drink +${eg} energy`);
        } else if (chance(c.energyLossatBarProbability)) {
          const el = (c.energyLossatBar || 5);
          c.energy = Math.max(0, (c.energy || 0) - el);
          addLog(`${c.name} overdid it -${el} energy`);
        }
        dgain=stochasticGain(0, 0, Number(c.disciplineLoss ?? 0), Number(c.disciplineLossProbability ?? 0))
        discipline += dgain;
        if (dgain < 0) {
          addLog(`${c.name} conspired in bar -${dgain} discipline`);
        }

        break;
    }

    // --- Simple happiness model (0..100) bound and updated per day ---
    // Base small drift toward 50 to avoid stagnation
    //c.happiness = (typeof c.happiness === 'number') ? c.happiness : 50;
    let dh = 0;
    switch (loc) {
      case 'dorm':
        dh += c.happinessGainatDorm; // rest makes people happier
        break;
      case 'office':
        dh += c.happinessGainatOffice; // grant writing is draining
        break;
      case 'lab':
        // happy when productive; if energy is low, it's frustrating
        if ((c.energy || 0) > 60) dh += c.happinessGainatLab;
        if ((c.energy || 0) < 20) dh += (c.happinessGainatLab-1);
        break;
      case 'lecture':
        dh += c.happinessGainatLecture; // public recognition feels good
        break;
      case 'bar':
        // mirror energy outcome roughly
        dh += c.happinessGainatBar;
        //if ((c.energy || 0) > 0 && (c.energy || 0) < 100) dh += 0.1;
        break;
    }
    // Additional penalties
    if ((c.energy || 0) <= 0) dh -= 0.2;
    // Apply and clamp
    c.happiness = Math.max(0, Math.min(100, Math.round((c.happiness + dh) * 100) / 100));

    // const fundingcosts = (c.Cost || 1);
    funding -= c.Cost;

    // Auto-move to bar at end of day with gotobarProbability
    const pBar = Number(c.gotobarProbability || 0);
    if (pBar > 0 && Math.random() < pBar) {
      if (c.location !== 'bar') {
        moveCharacterToBuilding(c.id || c.name, 'bar');
        try { makeCharacterSpeak(c.id || c.name, "🍻 Heading to the bar!"); } catch(_) {}
      }
    }


    // keep global numbers within reasonable bounds
    funding = Math.max(-1000, Math.min(MAXFUNDING, Math.round(funding * MAXFUNDING) / MAXFUNDING));
    progress = Math.max(-1000, Math.min(TENUREPROGRESS, Math.round(progress * TENUREPROGRESS) / TENUREPROGRESS));
    discipline = Math.max(0, Math.min(MAXDISC, Math.round(discipline * MAXDISC) / MAXDISC)); // fixed variable
    platforms = Math.max(-1000, Math.min(MAXPLATFORMS, Math.round(platforms * MAXPLATFORMS) / MAXPLATFORMS)); // fixed variable
    skills = Math.max(-1000, Math.min(MAXSKILLS, Math.round(skills * MAXSKILLS) / MAXSKILLS));
    c.energy = Math.max(0, Math.min(100, Math.round((c.energy || 0) * 100) / 100));
  }

  checkEnding();
  
// Resolve voluntary quits (by happiness) and attempted firings (by discipline)
// Must run BEFORE recruitment screen shows.


// Resolve voluntary quits (by happiness) and attempted firings (by discipline)
// Must run BEFORE recruitment screen shows.
// function resolveTurnDepartures() {
//   const disc = Math.max(0, Math.min(100, Number(typeof discipline !== 'undefined' ? discipline : 0)));
//   const ids = getTeamIds();

//   // Handle individual quit/fire first
//   ids.forEach(id => {
//     const nullDays = Number(daysInNull[id] || 0);
//     const satNullAllTurn = nullDays >= timeforTurn || wasEverOnBoard[id] === false;
//     let fired = false, quit = false;

//     // Happiness lookup
//     let h = 50;
//     try {
//       if (Array.isArray(characters)) {
//         let c = characters.find(x => x && (x.id === id || x.name === id));
//         if (c && typeof c.happiness === 'number') h = c.happiness;
//       } else if (characters && characters[id] && typeof characters[id].happiness === 'number') {
//         h = characters[id].happiness;
//       } else if (typeof charHappiness === 'object' && typeof charHappiness[id] === 'number') {
//         h = charHappiness[id];
//       }
//     } catch (e) {}

//     const pQuit = h < 50 ? (50 - h) / 100 : 0;
//     if (Math.random() < pQuit) quit = true;

//     if (satNullAllTurn) {
//       const pFire = disc / 100;
//       if (Math.random() < pFire) fired = true;
//     }

//     if (fired || quit) {
//       if (quit) {
//         bubbleSpeak(id, "I'm out of here.");
//         showToast(id + " quit due to low happiness.");
//       } else {
//         bubbleSpeak(id, "You're fired! Get out!");
//         showToast(id + " was fired (discipline enabled it).");
//       }
//       try {
//         if (typeof fireCharacter === 'function') {
//           fireCharacter(id);
//         } else {
//           if (Array.isArray(characters)) {
//             characters = characters.filter(c => !(c && (c.id === id || c.name === id)));
//           } else if (characters && characters[id]) {
//             delete characters[id];
//           }
//           const card = document.getElementById('char-' + id);
//           if (card && card.parentElement) card.parentElement.removeChild(card);
//         }
//       } catch (e) {}
//       addLog(`Team change: ${id} ${quit ? 'quit' : 'fired'}.`);
//     }
//   });

//   // PI firing rule if discipline is very low
//   if (disc < 10) {
//     const pPI = (10 - disc) / 10; // 0..1
//     if (Math.random() < pPI) {
//       // pick highest happiness member to promote
//       const remaining = getTeamIds().filter(id => id !== currentPIId);
//       let bestId = remaining[0] || currentPIId;
//       let bestH = -1;
//       remaining.forEach(id => {
//         let h = 50;
//         try {
//           if (Array.isArray(characters)) {
//             let c = characters.find(x => x && (x.id === id || x.name === id));
//             if (c && typeof c.happiness === 'number') h = c.happiness;
//           } else if (characters && characters[id] && typeof characters[id].happiness === 'number') {
//             h = characters[id].happiness;
//           } else if (typeof charHappiness === 'object' && typeof charHappiness[id] === 'number') {
//             h = charHappiness[id];
//           }
//         } catch(e){}
//         if (h > bestH) { bestH = h; bestId = id; }
//       });

//       const msg = "An anonymous complaint sparked a secret investigation and discipline hearing. The secret DEI committee has decided you are toxic and you are hereby fired. " + bestId + " has been promoted to PI and will take over our lab.";
//       bubbleSpeak(currentPIId, "You're fired! Get out!");
//       showToast(msg, 6000);
//       addLog("PI removed due to low discipline. " + msg);

//       // End the game with a PI firing scene
//       endGameDueToPIFiring(bestId, msg);
//       return; // prevent further steps this turn
//     }
//   }

//   // Reset for next turn
//   resetTurnPresenceTracking();
// }

// Resolve end-of-turn firings (discipline threshold) and quits (happiness)
// This version only allows firing if the member stayed in the *bottom area*
// for the ENTIRE turn (never in any building), AND discipline >= 80.
function resolveTurnDepartures() {
  const disc = Math.max(0, Math.min(100, Number(typeof discipline !== 'undefined' ? discipline : 0)));

  // ——— Voluntary quits first (same logic) ———
  // Walk actual characters by id (not sidebar slot ids)
  const charList = Array.isArray(characters) ? characters : Object.values(characters);
  charList.forEach(c => {
    if (!c || !c.id) return;
    const id = c.id;
    
    const wasOnBoard = window.wasEverOnBoard && window.wasEverOnBoard[id] === true;
    if (!wasOnBoard) return; // skip non-recruited / never-visible people

    // Skip the PI completely (spec says "team members")
    if (id === currentPIId || id === 'sumit') return;

    // --- quits by low happiness (unchanged) ---
    let h = 50;
    if (typeof c.happiness === 'number') h = c.happiness;
    const pQuit = h < 50 ? (50 - h) / 100 : 0;
    if (Math.random() < pQuit) {
      bubbleSpeak(id, "I'm out of here.");
      showToast(`${c.name} quit due to low happiness.`);
      try { fireCharacter(id); } catch(_) {}
      addLog(`Team change: ${id} quit.`);
    }
  });

  // ——— Firings by discipline & bottom-idle behavior ———
  if (disc >= 80) {
    // Probability rises from 0 at 80 to 1 at 100
    const pFireBase = Math.min(1, Math.max(0, (disc - 80) / 20));

    (Array.isArray(characters) ? characters : Object.values(characters)).forEach(c => {
      if (!c || !c.id) return;
      const id = c.id;

      // Skip the PI
      if (id === currentPIId || id === 'sumit') return;

      // Stayed in bottom area the whole turn? We track this with daysInNull[id]
      // (Incremented once per in-game day when c.location is null.)
      const nullDays = (window.daysInNull && typeof window.daysInNull[id] === 'number') ? window.daysInNull[id] : 0;
      const stayedBottomAllTurn = nullDays >= timeforTurn;

      if (stayedBottomAllTurn) {
        // Only consider firing if still in bottom (not currently in a building)
        const currentlyBottom = !c.location;
        if (currentlyBottom) {
          if (Math.random() < pFireBase) {
            bubbleSpeak(id, "You're fired! Get out!");
            showToast(`${c.name} was fired for idling all turn (discipline ${disc}).`);
            try { fireCharacter(id); } catch(_) {}
            addLog(`Team change: ${id} fired (idle all turn; discipline ${disc}).`);
          } else {
            addLog(`${c.name} narrowly avoided being fired (discipline ${disc}).`);
          }
        }
      }
    });
  } else {
    addLog(`Discipline ${disc} — firings disabled (need ≥ 80).`);
  }

  // Reset per-turn presence trackers for the next turn
  resetTurnPresenceTracking();
}


function endGameDueToPIFiring(newPIId, narrative) {
  try { clearInterval(timer); } catch(e){}
  timer = null;
  // Create overlay
  const ov = document.createElement('div');
  ov.id = 'game-over-overlay';
  ov.innerHTML = '<div class="game-over-card"><h2>Game Over</h2><p>' + (narrative||'The PI was removed.') + '</p></div>';
  document.body.appendChild(ov);
  setTimeout(() => { ov.classList.add('show'); }, 30);
  // Lock turns
  try {
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.disabled = true;
  } catch(e){}
}

if (timeLeft <= 0) {
    clearInterval(timer);
    timer = null;
    setStartBtnRunning(false);
    // advance to next turn first so startNextRound() runs at the beginning of that turn
    if (currentTurn < totalTurns) {
      const finishedTurn = currentTurn;
      currentTurn++;
      timeLeft = timeforTurn;
      // now start the next round (this will e.g. show PhD choices when currentTurn === 2)
      resolveTurnDepartures();
      startNextRound();
      alert(`Turn ${finishedTurn} finished! Starting Turn ${currentTurn}.`);
    } else {
      // no more turns
      checkEndingintheEnd();
      alert("🎉 Game Over! Happy Birthday Sumit!");
    }
  }
  // write a daily summary so changes are visible in the log
  
  //addLog(`Day summary — Funding: ${funding}, Papers: ${progress}, Platforms: ${platforms}, Skills: ${skills}, Discipline: ${discipline}`);
  
  updateUI();
  drawBackground();

} finally { __simulatingDay = false; }
} // <-- ensure simulateDay closes

const ENDINGS = {
  TENURE_PASS: 1,
  NOBEL_WINNER: 2,
  TEACHING_HERO: 3,
  EXPERIMENTAL_CHAOS: 4,
};

function checkEnding() {
  if (progress >= TENUREPROGRESS) {
    if (skills >= SUPERTEACHER) {
      endGame(ENDINGS.NOBEL_WINNER);
    } else {
    endGame(ENDINGS.TENURE_PASS);
    }
  }
  else return;
}

function checkEndingintheEnd() {
  if (skills >= SUPERTEACHER) {
    endGame(ENDINGS.TEACHING_HERO);
  } else {
    endGame(ENDINGS.EXPERIMENTAL_CHAOS);
  }
}

function endGame(stats) {
    // 停止模拟
  clearInterval(timer);
  timeLeft = 0;
  try {
    const btn = document.getElementById('startBtn');
    if (btn) {
      setStartBtnRunning(false);
      btn.disabled = true;
      btn.textContent = 'Game Over';
      btn.style.background = '#777';
    }
  } catch(e){}

  switch (stats) {
  // 弹出蛋糕
    case ENDINGS.TENURE_PASS:{
      showTenurePassEnding();
      break;
    } 
    case ENDINGS.NOBEL_WINNER: {
      showNobelWinnerEnding();
      break;
    }
    case ENDINGS.TEACHING_HERO: {
      showTeachingHeroEnding();
      break;
    }
    case ENDINGS.EXPERIMENTAL_CHAOS: {
      showExperimentalChaosEnding();
      break;
    }
    default: {
      //showTenurePassEnding();
      console.log("⚠️ 未定义的结局: " + stats);
      break;
    }
      
  }
}

function showTenurePassEnding() {
  const cake = document.createElement('img');
      cake.src = 'game/src/happy_birthday.jpg'; // 你的蛋糕图片路径
      cake.id = 'birthday-cake';
      cake.style.position = 'absolute';
      cake.style.top = '40%';
      cake.style.left = '50%';
      cake.style.transform = 'translate(-50%, -50%)';
      cake.style.width = '800px';
      cake.style.zIndex = '1000'; // 确保在最上层
      document.body.appendChild(cake);

      // 弹出祝贺信
      const letter = document.createElement('div');
      letter.id = 'congrats-letter';
      letter.innerHTML = `
        <h2>Professor Sumit, your project is complete. Tenure granted!</h2>
        <h1>What more important, Happy Birthday!🎉</h1>
      `;
      letter.style.position = 'absolute';
      letter.style.top = '10%';
      letter.style.left = '50%';
      letter.style.transform = 'translate(-50%, -50%)';
      letter.style.background = '#d75a49ff';
      letter.style.padding = '20px';
      letter.style.border = '3px solid #ff69b4';
      letter.style.borderRadius = '10px';
      letter.style.textAlign = 'center';
      letter.style.fontSize = '20px';
      letter.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      letter.style.zIndex = '1001'; // 确保在蛋糕上层
      document.body.appendChild(letter);

    addLog('🎉 Game over：pass Tenure review and happy birthday!');
}

function showNobelWinnerEnding() {
  const winner = document.createElement('img');
      winner.src = 'game/src/nobel_winner.png'; //
      winner.id = 'nobel_winner';
      winner.style.position = 'absolute';
      winner.style.top = '55%';
      winner.style.left = '50%';
      winner.style.transform = 'translate(-50%, -50%)';
      winner.style.width = '600px';
      winner.style.zIndex = '1000'; // 确保在最上层
      document.body.appendChild(winner);

      // 弹出祝贺信
      const letter = document.createElement('div');
      letter.id = 'congrats-letter_nobel';
      letter.innerHTML = `
        <h2>This is not just tenure… this is Nobel-worthy!</h2>
        <h2>Congratulations! Professor Sumit!</h2>
        <h1>What more important, Happy Birthday!🎉</h1>
      `;
      letter.style.position = 'absolute';
      letter.style.top = '10%';
      letter.style.left = '50%';
      letter.style.transform = 'translate(-50%, -50%)';
      letter.style.background = '#d75a49ff';
      letter.style.padding = '20px';
      letter.style.border = '3px solid #ff69b4';
      letter.style.borderRadius = '10px';
      letter.style.textAlign = 'center';
      letter.style.fontSize = '20px';
      letter.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      letter.style.zIndex = '1001'; 
      document.body.appendChild(letter);

    addLog('🎉 Game over：Nobel winner and happy birthday!');
}

function showTeachingHeroEnding() {
    const teacher = document.createElement('img');
      teacher.src = 'game/src/great_teacher.png'; //
      teacher.id = 'great_teacher';
      teacher.style.position = 'absolute';
      teacher.style.top = '55%';
      teacher.style.left = '50%';
      teacher.style.transform = 'translate(-50%, -50%)';
      teacher.style.width = '600px';
      teacher.style.zIndex = '1000'; // 确保在最上层
      document.body.appendChild(teacher);

      // 弹出祝贺信
      const letter = document.createElement('div');
      letter.id = 'congrats-letter_teacher';
      letter.innerHTML = `
        <h2>Great Teacher!</h2>
        <h2>Students admire your dedication to teaching!</h2>
        <h1>What more important, Happy Birthday!🎉</h1>
      `;
      letter.style.position = 'absolute';
      letter.style.top = '10%';
      letter.style.left = '50%';
      letter.style.transform = 'translate(-50%, -50%)';
      letter.style.background = '#d75a49ff';
      letter.style.padding = '20px';
      letter.style.border = '3px solid #ff69b4';
      letter.style.borderRadius = '10px';
      letter.style.textAlign = 'center';
      letter.style.fontSize = '20px';
      letter.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      letter.style.zIndex = '1001'; 
      document.body.appendChild(letter);

    addLog('🎉 Game over：Great teacher!');
}

function showExperimentalChaosEnding() {
    const chaos = document.createElement('img');
      chaos.src = 'game/src/chaos.png'; //
      chaos.id = 'chaos-ending';
      chaos.style.position = 'absolute';
      chaos.style.top = '55%';
      chaos.style.left = '50%';
      chaos.style.transform = 'translate(-50%, -50%)';
      chaos.style.width = '1200px';
      chaos.style.zIndex = '1000'; // 确保在最上层
      document.body.appendChild(chaos);

      // 弹出祝贺信
      const letter = document.createElement('div');
      letter.id = 'congrats-letter_chaos';
      letter.innerHTML = `
        <h2>Cats in lab coats fill the screen, meowing.</h2>
        <h2>They hold up signs that say: “Happy Birthday, Professor Sumit! 🐱🎂”</h2>
        <h1>Happy Birthday, Boss!🎉</h1>
      `;
      letter.style.position = 'absolute';
      letter.style.top = '10%';
      letter.style.left = '50%';
      letter.style.transform = 'translate(-50%, -50%)';
      letter.style.background = '#d75a49ff';
      letter.style.padding = '20px';
      letter.style.border = '3px solid #ff69b4';
      letter.style.borderRadius = '10px';
      letter.style.textAlign = 'center';
      letter.style.fontSize = '20px';
      letter.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
      letter.style.zIndex = '1001'; 
      document.body.appendChild(letter);

    addLog('🎉 Game over：Expermental Chaos!');
}

function getProgressEffect(character, baseProgress) {
  if (character.energy >50) {return baseProgress;}
  else {return baseProgress * character.energy /100;}
}


// --- Helper: find which sidebar slot currently shows a given character id ---
function findSlotIdForCharacter(charId) {
  const slots = ['member1','member2','member3','member4','member5','member6'];
  for (const s of slots) {
    const el = document.getElementById('char-' + s);
    if (el && el.dataset && (el.dataset.character || '').trim() === charId) return s;
  }
  return null;
}
function makeCharacterSpeak(characterId, message) {
  // Try direct bubble id first (for member slots)
  let bubble = document.getElementById(`bubble-${characterId}`);

  // If not found, map character id to whichever slot currently displays it
  if (!bubble) {
    const mappedSlot = findSlotIdForCharacter(characterId) || (characterId === 'sumit' ? 'member1' : null);
    if (mappedSlot) bubble = document.getElementById(`bubble-${mappedSlot}`);
  }

  if (bubble) {
    bubble.textContent = message;
    bubble.style.display = "block";
    setTimeout(() => { bubble.style.display = "none"; }, 4000);
  } else {
    // Fallback toast/log so messages are still visible
    try { showToast && showToast(`${characterId}: ${message}`, 2500); } catch(e) {}
  }
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

// --- Start/Pause toggle helpers ---
function setStartBtnRunning(isRunning) {
  const btn = document.getElementById('startBtn');
  if (!btn) return;
  if (isRunning) {
    btn.textContent = '⏸ Pause';
    btn.setAttribute('data-state', 'running');
    btn.style.background = '#f39c12'; // orange-ish for pause state
  } else {
    btn.textContent = '▶ Start';
    btn.setAttribute('data-state', 'paused');
    btn.style.background = '#4caf50'; // original green
  }
}

function startTimer() {
  if (timer || currentTurn > totalTurns) return;
  resetTurnPresenceTracking();
  timer = setInterval(simulateDay, dayMs);
  setStartBtnRunning(true);
}

function pauseTimer() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  setStartBtnRunning(false);
}

// Attach the toggle behavior
(function wireStartPauseButton(){
  const btn = document.getElementById('startBtn');
  if (!btn) return;
  setStartBtnRunning(false); // initial state
  btn.addEventListener('click', () => {
    if (!timer && currentTurn <= totalTurns) startTimer();
    else pauseTimer();
  });
})();


// Ensure daily presence trackers exist and reset at turn start
function resetTurnPresenceTracking() {
  if (typeof window.daysInNull === 'undefined' || !window.daysInNull) window.daysInNull = {};
  if (typeof window.wasEverOnBoard === 'undefined' || !window.wasEverOnBoard) window.wasEverOnBoard = {};
  // clear previous turn counters
  Object.keys(window.daysInNull).forEach(k => delete window.daysInNull[k]);
  Object.keys(window.wasEverOnBoard).forEach(k => delete window.wasEverOnBoard[k]);
}

// === 按钮 ===
// document.getElementById("startBtn").addEventListener("click", () => {
//   if (!timer && currentTurn <= totalTurns) { resetTurnPresenceTracking();
//     timer = setInterval(simulateDay, dayMs);
//   }
// });
// Seed the left sidebar: attach 'sumit' model to member1 if present
window.addEventListener('DOMContentLoaded', () => {
  
// === Ensure every character has a happiness field (default 50) ===
try {
  if (Array.isArray(window.characters)) {
    window.characters.forEach(c => { if (typeof c.happiness !== 'number') c.happiness = 50; });
  } else if (typeof window.characters === 'object' && window.characters) {
    Object.values(window.characters).forEach(c => { if (c && typeof c.happiness !== 'number') c.happiness = 50; });
  }
} catch(e) {}

  try {
    if (Array.isArray(window.characters)) {
      const sumit = window.characters.find(c => c && (c.id === 'sumit' || c.name === 'Sumit'));
      const slot = document.getElementById('char-member1');
      if (sumit && slot) {
        slot.dataset.character = sumit.id;
        const avatar = slot.querySelector('.character-avatar');
        if (avatar && sumit.photo) avatar.src = sumit.photo;
        const label = slot.querySelector('.character-label');
        if (label) label.textContent = sumit.name || sumit.id;
        // initialize displayed values
        const et = document.getElementById('energy-text-member1');
        if (et) et.textContent = Math.round(sumit.energy || 0);
        const ht = document.getElementById('happiness-text-member1');
        if (ht) ht.textContent = Math.round(sumit.happiness || 50);
      }
    }
  } catch(e){}


  // Startup tutorial bubbles & logs
    makeCharacterSpeak("sumit", "Welcome to the campus!");
    // short follow-up instructions from Sumit (in English) - speak sentence by sentence
    const introLines = [
      "Drag the bottom cards into buildings.",
      "Different buildings have different effects.",
      "Dorm restores energy.",
      "Office for funding.",
      "Lab increases papers and machines but using funding.",
      "No machines, no papers.",
      "Lecture brings skills.",
      "Bar can increase or decrease happiness.",
      "You can drag anyone to anywhere at any time.",
      "Drag to bottom for entire turn to try to fire.",
      "No discipline = no firing.",
      "No discipline = rebellion risk.",
      "No energy = no work.",
      "Click Start to begin (1 second = 1 day).",
      "Each turn lasts 90 days.",
      "Before the end of 7 years (turn 28), ",
      "Your goal is to raise Papers to 100%!",
      "Good luck!"
    ];
    const initialDelay = 1000; // wait after the first welcome bubble 3000
    const interval = 3000; // time between sentences (ms) 3500
    introLines.forEach((line, i) => {
      setTimeout(() => {
        makeCharacterSpeak("sumit", line);
      }, initialDelay + i * interval);
    });
}); // end DOMContentLoaded (wiring)

function selectTopCandidatesByAffinity(pool, k = 3) {
  // Normalize max() terms across the *available* pool
  const maxes = pool.reduce((acc, c) => {
    const LGP = Number(c.LoveGettingPaid  ?? 0);
    const LFN = Number(c.LoveFunding      ?? 0);
    const LPR = Number(c.LoveProgress     ?? 0);
    const LSK = Number(c.Loveskills       ?? 0);
    if (LGP > acc.LGP) acc.LGP = LGP;
    if (LFN > acc.LFN) acc.LFN = LFN;
    if (LPR > acc.LPR) acc.LPR = LPR;
    if (LSK > acc.LSK) acc.LSK = LSK;
    return acc;
  }, { LGP: 0, LFN: 0, LPR: 0, LSK: 0 });

  // Avoid division by zero by falling back to 1
  const d = {
    LGP: maxes.LGP || 1,
    LFN: maxes.LFN || 1,
    LPR: maxes.LPR || 1,
    LSK: maxes.LSK || 1,
  };

  // Global scaling by current lab state
  const fundingFactor = Math.max((typeof funding  === 'number' ? funding  : 0) / window.TARGETFUNDING, 1);
  const papersFactor  = Math.max((typeof progress === 'number' ? progress : 0) / window.MAXPAPERS,      1);
  const skillsFactor  = Math.max((typeof skills   === 'number' ? skills   : 0) / window.TARGETSKILLS,   1);

  // Score each candidate
  const scored = pool.map(c => {
    const LGP = Number(c.LoveGettingPaid  ?? 0);
    const LFN = Number(c.LoveFunding      ?? 0);
    const LPR = Number(c.LoveProgress     ?? 0);
    const LSK = Number(c.Loveskills       ?? 0);

    // random(0-1) per component
    const rPaid     = Math.random();
    const rFunding  = Math.random();
    const rProgress = Math.random();
    const rSkills   = Math.random();

    const score =
      (LGP / d.LGP) * rPaid +
      (LFN / d.LFN) * rFunding  * fundingFactor +
      (LPR / d.LPR) * rProgress * papersFactor  +
      (LSK / d.LSK) * rSkills   * skillsFactor;

    return { c, score };
  });

  // Sort by score desc (random tiebreak)
  scored.sort((a, b) => (b.score - a.score) || (Math.random() - 0.5));

  return scored.slice(0, k).map(x => x.c);
}


function showRecruitChoices() {
  const recruitScreen = document.getElementById("recruit-screen");
  const container = document.getElementById("candidate-container");
  container.innerHTML = "";

  const pool = getUnhiredCandidatesAcrossPools();
  if (!pool.length) {
    addLog('No available candidates to recruit.');
    return;
  }

  // Pick top 3 by affinity score
  const choices = selectTopCandidatesByAffinity(pool, 3);

  // Render simple cards (you can keep your richer card UI if you prefer)
  choices.forEach(c => {
    const card = document.createElement("div");
    card.className = "candidate-card";

    // Small helper: show their love-weights for transparency
    const LGP = Number(c.LoveGettingPaid  ?? 0);
    const LFN = Number(c.LoveFunding      ?? 0);
    const LPR = Number(c.LoveProgress     ?? 0);
    const LSK = Number(c.Loveskills       ?? 0);

    card.innerHTML = `
      <img src="${c.photo}" alt="${c.name}">
      <h3>${c.name}</h3>
      <p>Energy (start): ${Number(c.energy ?? 100)}</p>
      <p>LoveGettingPaid: ${LGP} | LoveFunding: ${LFN}</p>
      <p>LoveProgress: ${LPR} | Loveskills: ${LSK}</p>
      <p><em>${c.special ?? ''}</em></p>
    `;
    card.onclick = () => selectMember(c);
    container.appendChild(card);
  });

  // Skip button (optional)
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
    document.getElementById('recruit-screen').style.display = 'none';
    addLog('Player skipped recruitment this round.');
  };
  skipWrap.appendChild(skipBtn);
  container.appendChild(skipWrap);

  recruitScreen.style.display = "block";
}


function selectMember(character) {
  // --- normalize candidate (union of fields used by the three old selectors) ---
  function normalizeCandidate(src) {
    const o = { ...src };

    if (typeof o.energy !== 'number') o.energy = 100;
    if (typeof o.happiness !== 'number') o.happiness = 50;
    if (typeof o.level !== 'number') o.level = 1;
    o.hired = !!o.hired;
    o.location = null;
    return o;
  }

  const c = normalizeCandidate(character);
  // --- mark as hired on the canonical object & remove from pools ---
  {
    const id = c.id;

    // mark hired in the master list (characters)
    try {
      if (Array.isArray(window.characters)) {
        const ref = window.characters.find(x => x && x.id === id);
        if (ref) ref.hired = true;
      } else if (window.characters && window.characters[id]) {
        window.characters[id].hired = true;
      }
    } catch (e) {}

    // also mark this object (usually same ref as pool)
    c.hired = true;

    // prune from candidate pools so they won't be offered again
    ['phdCandidates', 'postdocCandidates', 'coPICandidates'].forEach(listName => {
      if (Array.isArray(window[listName])) {
        window[listName] = window[listName].filter(x => x && x.id !== id);
      }
    });
  }

  ['phdCandidates','postdocCandidates','coPICandidates'].forEach(poolName => {
    const pool = window[poolName] || [];
    const obj = pool.find(x => x && x.id === character.id);
    if (obj) obj.hired = true;
  });
  if (Array.isArray(window.characters)) {
    const obj = window.characters.find(x => x && x.id === character.id);
    if (obj) obj.hired = true;
  } else if (window.characters && window.characters[character.id]) {
    window.characters[character.id].hired = true;
  }
  // ---- place one bottom card (existing logic kept; just not duplicated) ----
  const slots = Array.from(document.querySelectorAll('.card-slot'));
  let placed = false;
  for (let s of slots) {
    if (!s.querySelector('.card')) {
      s.classList.remove('empty');
      s.textContent = '';

      const cardImg = document.createElement('img');
      cardImg.src = c.photo;
      cardImg.className = 'card';
      cardImg.draggable = true;
      cardImg.dataset.character = c.id;
      cardImg.alt = (c.name || c.id) + ' card';
      s.dataset.slot = c.id;
      s.appendChild(cardImg);

      cardImg.addEventListener('dragstart', e => {
        e.dataTransfer.setData('character', e.target.dataset.character);
        e.dataTransfer.setData('origin', e.target.parentElement.dataset.slot || 'building');
      });

      placed = true;
      break; // exactly one card
    }
  }
  if (!placed) addLog(`No empty card slot available to place ${c.name}'s card.`);

  // ---- close UI & refresh once ----
  document.getElementById('recruit-screen').style.display = 'none';
  if (typeof renderSidebar === 'function') renderSidebar();
  if (typeof updateUI === 'function') updateUI();

  // ---- sidebar bind: once, and never into member1 (Sumit reserved) ----
  try {
    // guard: if already visible, do nothing
    if (typeof findSlotIdForCharacter === 'function') {
      const already = findSlotIdForCharacter(c.id);
      if (already) {
        addLog(`${c.name} is already on the sidebar.`);
        return;
      }
    }
    // custom binder that skips member1
    const targets = ['member2','member3','member4','member5','member6'];
    let bound = false;
    for (let t of targets) {
      const card = document.getElementById('char-' + t);
      if (!card) continue;
      const has = (card.dataset && card.dataset.character || '').trim();
      if (!has) {
        card.dataset.character = c.id;
        const avatar = card.querySelector('.character-avatar');
        if (avatar && c.photo) avatar.src = c.photo;
        const label = card.querySelector('.character-label');
        if (label) label.textContent = c.name || c.id;
        const eText = card.querySelector('.energy-text') || document.getElementById('energy-text-' + t);
        if (eText) eText.textContent = Math.round(c.energy || 0);
        const hText = card.querySelector('.happiness-text') || document.getElementById('happiness-text-' + t);
        if (hText) hText.textContent = Math.round(c.happiness ?? 50);
        bound = true;
        break;
      }
    }
    if (!bound) addLog('No empty sidebar slot available.');
  } catch(e){}

  addLog(`${c.name} joined the team.`);
}

function renderSidebar() {
  const teamDiv = document.getElementById("team");
  if (!teamDiv) return;
  teamDiv.innerHTML = "";
  const _chars = Array.isArray(characters) ? characters : Object.values(characters);
  for (let i=0; i<_chars.length; i++) { const c = _chars[i];
    
    const div = document.createElement("div");
    div.innerHTML = `<img src="${c.photo}" width="40"> ${c.name} (${c.type || "PhD"})`;
    teamDiv.appendChild(div);
  }
}


// member1 is Sumit (reserved). Recruits can use member2..member6.
function hasEmptyRecruitSlot() {
  const slots = ['member2','member3','member4','member5','member6'];
  for (const s of slots) {
    const el = document.getElementById('char-' + s);
    const bound = (el && el.dataset && el.dataset.character || '').trim();
    if (!bound) return true;
  }
  return false;
}

// // Combine all candidate pools and remove anyone already hired or already on the team.
// function getUnhiredCandidatesAcrossPools() {
//   const pools = []
//     .concat(Array.isArray(window.phdCandidates) ? window.phdCandidates : [])
//     .concat(Array.isArray(window.postdocCandidates) ? window.postdocCandidates : [])
//     .concat(Array.isArray(window.coPICandidates) ? window.coPICandidates : []);

//   // active team ids (characters may be array or map)
//   const teamIds = new Set(
//     Array.isArray(window.characters)
//       ? window.characters.map(c => c && c.id).filter(Boolean)
//       : Object.keys(window.characters || {})
//   );

//   // de-dup by id and filter out hired or already on team
//   const seen = new Set();
//   const out = [];
//   for (const c of pools) {
//     if (!c || !c.id) continue;
//     if (seen.has(c.id)) continue;
//     seen.add(c.id);
//     if (c.hired) continue;
//     if (teamIds.has(c.id)) continue;
//     out.push(c);
//   }
//   return out;
// }

function getUnhiredCandidatesAcrossPools() {
  const pools = []
    .concat(Array.isArray(window.phdCandidates) ? window.phdCandidates : [])
    .concat(Array.isArray(window.postdocCandidates) ? window.postdocCandidates : [])
    .concat(Array.isArray(window.coPICandidates) ? window.coPICandidates : []);

  const seen = new Set();
  const out = [];
  for (const c of pools) {
    if (!c || !c.id) continue;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (c.hired) continue;
    if (hasCardInDOM(c.id)) continue; // extra guard: already on team
    out.push(c);
  }
  return out;
}

function startNextRound() {
  // Show recruit UI only if we have money and at least one open sidebar slot
  if (funding > MINFUNDINGTORECRUIT && hasEmptyRecruitSlot() && getUnhiredCandidatesAcrossPools().length > 0) {
    // no role → range over all unhired candidates
    showRecruitChoices(); 
  } else {
    // optional: helpful log so you can see why nothing popped up
    const reasons = [];
    if (!(funding > MINFUNDINGTORECRUIT)) reasons.push('funding ≤ 100');
    if (!hasEmptyRecruitSlot()) reasons.push('no empty team slot');
    if (!(getUnhiredCandidatesAcrossPools().length > 0)) reasons.push('no unhired candidates');
    addLog('Recruitment skipped: ' + (reasons.join(', ') || 'conditions not met'));
  }
}

// Lightweight toast helper (only if not already defined)
(function(){
  if (typeof window.showToast !== 'function') {
    window.showToast = function(msg, dur){
      var t = document.createElement('div');
      t.className = 'toast-message';
      t.textContent = msg || '';
      document.body.appendChild(t);
      // force reflow to enable transition
      void t.offsetWidth;
      t.classList.add('show');
      setTimeout(function(){
        t.classList.remove('show');
        setTimeout(function(){ if (t && t.parentNode) t.parentNode.removeChild(t); }, 300);
      }, Math.max(1000, Number(dur)||2000));
    };
  }
})();

/* ===== runtime hotfixes (added by ChatGPT) ===== */
(function(){
  // Ensure updateUI doesn't lock itself forever even if it early-returns
  try {
    var _oldUpdateUI = (typeof updateUI === 'function') ? updateUI : null;
    if (_oldUpdateUI) {
      window.updateUI = function(){
        try { return _oldUpdateUI.apply(this, arguments); }
        finally { try { window.__updatingUI = false; } catch(_e){} }
      };
    }
  } catch(_e) { console && console.warn && console.warn("updateUI patch warn:", _e); }

  // Provide a no-op background renderer to avoid ReferenceError
  if (typeof window.drawBackground !== "function") {
    window.drawBackground = function(){ /* no-op */ };
  }
})(); 
/* ===== end hotfixes ===== */

// expose a simple flag so we know the script loaded
if (typeof window !== 'undefined') { window.__GAME_JS_LOADED__ = true; };
// EOF