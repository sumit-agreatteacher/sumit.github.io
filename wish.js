const photos = [];
for (let i = 1; i <= 58; i++) {
  photos.push(`game/src/photo_memory/${i}.jpg`);
}
const track = document.getElementById('photoTrack');

// 生成两遍照片，保证循环播放时无缝衔接
function loadPhotos() {
  for (let i = 0; i < 2; i++) {
    photos.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'birthday photo';
      track.appendChild(img);
    });
  }
}

loadPhotos();

// === 💌 祝福区 ===
const wishes = [
  { author: "Shayne", text: "Sumit, your passion and warmth light up every room you walk into!" },
  { author: "Sheng", text: "Happy Birthday! I wish you will be a professor in the real world and live in the world where you want. If the world is not what you want, you will have the power to change it!" }
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