// stars.js
const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");

let stars = [];
const numStars = 300;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function createStars() {
  stars = [];
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      z: Math.random() * canvas.width
    });
  }
}
createStars();

function drawStars() {
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  for (let i = 0; i < numStars; i++) {
    const star = stars[i];
    star.z -= 2; // speed
    if (star.z <= 0) {
      star.x = Math.random() * canvas.width;
      star.y = Math.random() * canvas.height;
      star.z = canvas.width;
    }
    const k = 128.0 / star.z;
    const sx = star.x * k + canvas.width / 2;
    const sy = star.y * k + canvas.height / 2;

    if (sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height) {
      const size = (1 - star.z / canvas.width) * 2;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  requestAnimationFrame(drawStars);
}
drawStars();
