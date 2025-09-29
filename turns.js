let currentTurn = 1;
let turnTime = 30; // 每回合 30 秒
let timerId;

// ===== 工具函数 =====
function logMessage(msg) {
  const logDiv = document.getElementById("log");
  logDiv.innerHTML += msg + "<br>";
  logDiv.scrollTop = logDiv.scrollHeight;
}

function updateUI() {
  document.getElementById("turnNum").textContent = currentTurn;
  document.getElementById("sumitEnergy").textContent = `Sumit Energy: ${sumit.energy}`;
  document.getElementById("timeLeft").textContent = turnTime;
}

// ===== 回合推进 =====
function startTurn() {
  turnTime = 30; // 重置计时
  logMessage(`--- Round ${currentTurn} started ---`);

  // 开始计时器
  clearInterval(timerId);
  timerId = setInterval(() => {
    turnTime--;
    updateUI();

    if (turnTime <= 0) {
      clearInterval(timerId);
      nextTurn(); // 时间到自动进入下一回合
    }
  }, 1000);

  updateUI();
}

function nextTurn() {
  // 回合内数值结算
  sumit.loseEnergy(10); 
  logMessage(`${sumit.name} loses 10 energy, now ${sumit.energy}.`);

  currentTurn++;
  startTurn();
}

// 页面加载时启动第 1 回合
startTurn();