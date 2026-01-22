// === 🖼️ 三张照片 ===
const photos = [
  "game/src/photo_memory_shayne/1.jpeg",
  "game/src/photo_memory_shayne/2.jpeg",
  "game/src/photo_memory_shayne/3.jpeg"
];

const track = document.getElementById("photoTrack");

photos.forEach(src => {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "birthday memory";
  track.appendChild(img);
});
