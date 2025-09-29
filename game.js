// ---------------------- Game state ----------------------
let currentTurn = 1;
let totalTurns = 12;
let timeLeft = 90; // days per turn
let timer = null;
let extensionApplied = false;

let funding = 500;
let progress = 0;
let respect = 20;
let accidents = 0; // experimental accidents count

const characters = {
  sumit: { energy: 100, location: "dorm" },
  shayne: { energy: 100, location: "dorm" }
};


// ---------------------- Utilities & UI ----------------------
function log(msg) {
  const logDiv = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logDiv.prepend(line);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function updateUI() {
  document.getElementById("currentTurn").textContent = currentTurn;
  document.getElementById("totalTurns").textContent = totalTurns;
  document.getElementById("time").textContent = timeLeft;
  document.getElementById("funding").textContent = Math.floor(funding);
  document.getElementById("progress").textContent = Math.floor(progress);
  document.getElementById("respect").textContent = Math.floor(respect);

  document.getElementById("energy-sumit").style.width = clamp(characters.sumit.energy,0,100) + "%";
  document.getElementById("energy-shayne").style.width = clamp(characters.shayne.energy,0,100) + "%";
}

// ---------------------- Avatar rendering helpers ----------------------
function removeAvatarFromAllBuildings(character) {
  document.querySelectorAll(`.building .avatar[data-character="${character}"]`).forEach(el => el.remove());
}

function placeCharacterAvatar(buildingElem, character) {
  // clean existing same-character avatar in that building (to avoid duplicates)
  buildingElem.querySelectorAll(`.avatar[data-character="${character}"]`).forEach(el => el.remove());

  // remove from other buildings (so avatar appears only once)
  removeAvatarFromAllBuildings(character);

  const avatar = document.createElement("div");
  avatar.classList.add("avatar");
  avatar.dataset.character = character;
  avatar.draggable = true;
  avatar.textContent = character === "sumit" ? "👨" : "👦";

  // allow dragging avatar to move to another building
  avatar.addEventListener("dragstart", (ev) => {
    ev.dataTransfer.setData("character", character);
    // mark source building (optional)
  });

  buildingElem.appendChild(avatar);
}

// place avatars for initial state
function renderAllAvatars() {
  // clear all
  document.querySelectorAll(".building .avatar").forEach(el => el.remove());
  for (const charName in characters) {
    const loc = characters[charName].location;
    const b = document.querySelector(`.building[data-building="${loc}"]`);
    if (b) placeCharacterAvatar(b, charName);
  }
}

// ---------------------- Drag & Drop wiring ----------------------
// enable dragging from card area
document.querySelectorAll(".card").forEach(card => {
  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("character", card.dataset.character);
  });
});

// buildings accept drops (cards or avatars)
document.querySelectorAll(".building").forEach(building => {
  building.addEventListener("dragover", e => e.preventDefault());
  building.addEventListener("drop", e => {
    e.preventDefault();
    const character = e.dataTransfer.getData("character");
    if (!character) return;
    // update model
    characters[character].location = building.dataset.building;
    // update UI
    placeCharacterAvatar(building, character);
    log(`${character} moved to ${building.dataset.building}`);
  });
});

// also allow dropping outside buildings to "unassign" (back to idle)
// drop on cardArea (puts them back to default dorm)
const cardArea = document.getElementById("cardArea");
cardArea.addEventListener("dragover", e => e.preventDefault());
cardArea.addEventListener("drop", e => {
  e.preventDefault();
  const character = e.dataTransfer.getData("character");
  if (!character) return;
  // put back to dorm (or initial)
  characters[character].location = "dorm";
  renderAllAvatars();
  log(`${character} returned to dorm`);
});

// ---------------------- Core daily simulation ----------------------
function simulateDay() {
  // one day passes
  timeLeft--;

  // For each character, apply location effects
  for (let name in characters) {
    let c = characters[name];
    switch (c.location) {
      case "dorm":
        c.energy = clamp(c.energy + 2, 0, 100);
        break;
      case "bar":
        respect += 1;
        c.energy = clamp(c.energy - 1, 0, 100);
        break;
      case "lab":
        // experiments: progress & chance of accident
        progress += 2;
        respect += 0.2;
        c.energy = clamp(c.energy - 1, 0, 100);
        if (Math.random() < 0.08) { // 8% chance daily per-person in lab
          accidents++;
          progress = Math.max(0, progress - 5);
          log(`⚠️ Accident in lab! Progress -5 (accidents=${accidents})`);
        }
        break;
      case "lecture":
        respect += 1.5;
        funding += 5;
        c.energy = clamp(c.energy - 2, 0, 100);
        break;
      default:
        break;
    }
  }

  // check for burnout (Sumit)
  if (characters.sumit.energy <= 0) {
    // immediate Burnout ending
    stopTimer();
    showEnding("Burnout", "Sumit burned out during the tenure scramble... but you still get this!");
    return;
  }

  // check funding immediate fail
  if (funding < 0) {
    stopTimer();
    showEnding("Funding Disaster", "Funding went negative. Oops! But Happy Birthday anyway!");
    return;
  }

  // turn end check
  if (timeLeft <= 0) {
    // end-of-turn
    stopTimer(); // stop daily ticks until user restarts
    log(`--- Turn ${currentTurn} ended. ---`);

    // extension chance if at or after turn 9 and not applied
    if (!extensionApplied && currentTurn >= 9 && currentTurn <= 12) {
      const probs = {9:0.6, 10:0.4, 11:0.2, 12:0.1};
      const p = probs[currentTurn] || 0;
      if (Math.random() < p) {
        totalTurns += 4;
        extensionApplied = true;
        log(`🔁 Extension granted! +4 turns (now total ${totalTurns})`);
        alert(`Extension granted! You received extra 4 turns.`);
      } else {
        log(`No extension this time (chance ${Math.round(p*100)}%).`);
      }
    }

    currentTurn++;
    if (currentTurn > totalTurns) {
      // game over -> evaluate ending
      evaluateEndings();
      return;
    } else {
      // prepare next turn
      timeLeft = 90;
      updateUI();
      log(`Starting Turn ${currentTurn}. Press Start to continue.`);
      return;
    }
  }

  updateUI();
}

// ---------------------- Timer controls ----------------------
function startTimer() {
  if (timer) return;
  timer = setInterval(simulateDay, 1000); // 1 second = 1 day
  document.getElementById("startBtn").textContent = "⏸ Pause";
  document.getElementById("startBtn").style.background = "#f39c12";
  log("⏳ Timer started");
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    document.getElementById("startBtn").textContent = "▶ Start";
    document.getElementById("startBtn").style.background = "#4caf50";
    log("⏸ Timer stopped");
  }
}

// Start/pause toggle
document.getElementById("startBtn").addEventListener("click", () => {
  if (!timer) startTimer();
  else stopTimer();
});

// ---------------------- End / evaluation ----------------------
function evaluateEndings() {
  // Check conditions in priority:
  // - Funding negative handled earlier
  // - Burnout handled earlier
  // - Experimental chaos: accidents >= 5
  if (accidents >= 5) {
    showEnding("Experimental Chaos", "The lab was chaotic (cats?). Still... Happy Birthday!");
    return;
  }

  // True Tenure: progress >= 100 & funding >= 0 & Sumit not burned out
  if (progress >= 100 && funding >= 0 && characters.sumit.energy > 0) {
    // Nobel secret: extra conditions
    if (respect >= 50 && funding >= 10000) {
      showEnding("Nobel Prize", "You exceeded expectations — Nobel-level! And... Happy Birthday!");
    } else {
      showEnding("True Tenure", "The No-Zero-Deadtime Clock works! Tenure granted. Happy Birthday!");
    }
    return;
  }

  // Teaching Hero
  if (progress < 100 && respect >= 70) {
    showEnding("Teaching Hero", "Your students rallied and won it for you! Tenure via teaching. Happy Birthday!");
    return;
  }

  // Default fallback: Funding disaster or incomplete
  showEnding("Incomplete", "You didn't finish the clock in time, but here's a birthday surprise anyway!");
}

// overlay
function showEnding(title, msg) {
  const overlay = document.getElementById("overlay");
  document.getElementById("overlay-title").textContent = title;
  document.getElementById("overlay-msg").textContent = msg + " 🎂";
  overlay.classList.remove("hidden");
  // stop timer if running
  stopTimer();
}

document.getElementById("overlay-close").addEventListener("click", () => {
  const ov = document.getElementById("overlay");
  ov.classList.add("hidden");
});

// ---------------------- Init ----------------------
renderAllAvatars();
updateUI();
log("Game initialized. Drag characters onto buildings, then press Start.");

// ensure initial placement visuals
for (const ch in characters) {
  const b = document.querySelector(`.building[data-building="${characters[ch].location}"]`);
  if (b) placeCharacterAvatar(b, ch);
}
