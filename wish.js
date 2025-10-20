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
    {
    author: "Shayne",
    type: "letter", // ✅ 标记为信件类型
    text: `
    <p><strong>Dear Sumit,</strong></p>
    <p>“Professor” signifies a teacher — a guide and mentor who illuminates the path of knowledge. You embody that word in its truest sense.</p>
    <p>Wise, passionate, brilliant, and endlessly creative, you have an unparalleled gift for inspiring and nurturing young minds toward their fullest potential. Beyond being an extraordinary teacher, you are a visionary physicist whose curiosity, rigor, and imagination have the power to reshape our understanding of the world.</p>
    <p>I feel deeply fortunate and honored to have shared these past few years learning from you, experiencing the joy of discovery alongside you, and — most importantly — calling you my friend.</p>
    <p>I look forward with great excitement to all that you will achieve in the years ahead. I hope we will continue to work together always, and that I may be among the first to witness the truly exceptional wonders you will create.</p>
    <p>One day, I hope to attend your prize ceremony in Sweden — a celebration not only of your brilliance but of the spirit of curiosity and mentorship you so beautifully embody.</p>
    <p>With deepest respect and lasting friendship,</p>
    <p><em>Forever your friend,<br>Shayne</em></p>
    <p><strong>Happy Birthday, Professor Sumit Boss!</strong></p>
    `
  },
  { author: "Gentle", text: "May this new orbit around the sun be as precise and extraordinary as the quantum clock you are building. May Your wisdom inspire, your principles guide, and your dedication motivate the people around you. Your kindness always make every moment filled with joy." },
  
  { author: "Ilango", text: "Happy birthday, Man!" },
  
  { author: "Mehrdad", text: "Wishing you happy birthday filled with joy and success!" },

  { author: "Sheng", 
    type: "letter",
    text: `
    <p> Dear Sumit Boss, </p>
    <p> Happy Birthday! I wish you will be a professor in the real world in a few years (sooner is better!). </p>
    <p> Why so? Because I believe you can make a better world with what is in your mind and your knowledge, your experience. I have seen and feel your teaching, which is a wonderful experience for me. It inspires me everytime even though some knowledge I had learned before.</p>
    <p> I should not be the only person who is benefited from your teaching. More people should be able to learn from you, and more people will be inspired by you. </p>
    <p> As a professor, you can teach more students, and you can guide more researchers. Your ideas will be spread more widely, and your influence will be larger. </p>
    <p> That is how I want to see the world changes with your ideas, which will 200% improve the current world. </p>
    <p> So, I wish you will have the power to change the world! </p>
    <p> Today I wish you happy birthday first, </p>
    <p> Sheng </p>
    `
    }
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
