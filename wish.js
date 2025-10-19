// === 🖼️ 加载照片 ===
const photos = [];
for (let i = 1; i <= 58; i++) {
  photos.push(`game/src/photo_memory/${i}.jpg`);
}

const track = document.getElementById('photoTrack');

// 生成两遍照片，保证无缝循环播放
function loadPhotos() {
  for (let i = 0; i < 2; i++) {
    photos.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'birthday photo';
      img.loading = 'lazy';
      img.onerror = () => console.warn("Image failed to load:", src);
      track.appendChild(img);
    });
  }
}
loadPhotos();


// === ✨ 平滑滚动逻辑 ===
let scrollAnimation = null;
let scrollDuration = 200; // 秒数（调节速度，越大越慢）

function startSmoothScroll() {
  // 取消已有动画
  if (scrollAnimation) {
    try { scrollAnimation.cancel(); } catch (e) {}
    scrollAnimation = null;
  }

  const imgs = Array.from(track.querySelectorAll('img'));
  if (!imgs.length) return;

  // 确保图片都加载完
  const decodePromises = imgs.map(img => {
    if ('decode' in img) return img.decode().catch(()=>{});
    return new Promise(resolve => {
      if (img.complete) return resolve();
      img.addEventListener('load', resolve);
      img.addEventListener('error', resolve);
    });
  });

  Promise.all(decodePromises).then(() => {
    const totalWidth = track.scrollWidth;
    const singleWidth = totalWidth / 2; // 因为生成了两遍

    if (!singleWidth || singleWidth < 10) return;

    scrollAnimation = track.animate(
      [
        { transform: 'translateX(0px)' },
        { transform: `translateX(-${singleWidth}px)` }
      ],
      {
        duration: scrollDuration * 1000, // 毫秒
        iterations: Infinity,
        easing: 'linear'
      }
    );

    window.__photoScrollAnimation = scrollAnimation;
  });
}

// 监听窗口大小变化
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(startSmoothScroll, 200);
});

// 页面加载完毕后启动动画
window.addEventListener('load', startSmoothScroll);


// === 💌 总祝福语 ===
const mainMessage = document.getElementById('mainMessage');
if (mainMessage) {
  mainMessage.innerHTML = `
    <h1>🎉 Happy Birthday, Sumit Boss! 🎂</h1>
    <p>Wishing you a year full of laughter, discovery, and success!<br>
    May your journey ahead be as inspiring as your kindness.</p>
  `;
}


// === 💝 个人祝福卡片 ===
const wishes = [
  { author: "Shayne", text: "Sumit, your passion and warmth light up every room you walk into!" },
  { author: "Sheng", text: "Happy Birthday! I wish you will be a professor in the real world and live in the world where you want. If the world is not what you want, you will have the power to change it!" },
  { author: "Andras", text: "Keep being curious, humble, and brilliant — the world needs more people like you!" },
  { author: "Alex", text: "You make research look like magic. Keep shining, Sumit!" }
];

const wishesContainer = document.getElementById('wishesContainer');

function loadWishes() {
  wishes.forEach(wish => {
    const card = document.createElement('div');
    card.className = 'wish-card';
    card.innerHTML = `
      <div class="wish-author">${wish.author}</div>
      <div class="wish-text">${wish.text}</div>
    `;
    wishesContainer.appendChild(card);
  });
}
loadWishes();

// === 🕹️ 可选：修改滚动速度接口（调试用）===
function setScrollSpeed(seconds) {
  scrollDuration = seconds;
  startSmoothScroll();
}
window.setScrollSpeed = setScrollSpeed;
