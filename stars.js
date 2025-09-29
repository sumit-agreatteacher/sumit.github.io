const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");

let stars = [];
let numStars;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // 星星数量随屏幕面积变化
  numStars = Math.floor(window.innerWidth * window.innerHeight / 2000);
  createStars();
}
window.addEventListener("resize", resize);
resize();

// ⭐ 给星星设置速度方向（70% 往右）
function setStarVelocity(star) {
  const speed = Math.random() * 3 + 1;
  let targetX, targetY;

  if (Math.random() < 0.7) {
    targetX = canvas.width * (0.5 + Math.random() * 0.5); // 偏右
    targetY = Math.random() * canvas.height;
  } else {
    targetX = Math.random() * canvas.width;
    targetY = Math.random() * canvas.height;
  }

  const angle = Math.atan2(targetY, targetX);
  star.vx = speed * Math.cos(angle);
  star.vy = speed * Math.sin(angle);
}

function createStars() {
  stars = [];
  for (let i = 0; i < numStars; i++) {
    let star = { x: 0, y: 0, life: 0, maxLife: 200 + Math.random() * 100 };
    setStarVelocity(star);
    stars.push(star);
  }
}

function drawStars() {
  ctx.fillStyle = "rgba(0,0,0,0.1)"; // 拖尾效果
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let star of stars) {
    star.x += star.vx;
    star.y += star.vy;
    star.life++;

    // 颜色渐变 蓝 → 红
    let t = star.life / star.maxLife;
    if (t > 1) t = 1;
    ctx.fillStyle = `rgb(${Math.floor(255 * t)}, 0, ${Math.floor(255 * (1 - t))})`;

    ctx.beginPath();
    ctx.arc(star.x, star.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // 出界或寿命结束，重置
    if (star.x > canvas.width || star.y > canvas.height || star.life > star.maxLife) {
      star.x = 0;
      star.y = 0;
      star.life = 0;
      setStarVelocity(star);
    }
  }

  requestAnimationFrame(drawStars);
}
drawStars();
