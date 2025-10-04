const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

let player;

const game = new Phaser.Game(config);

function preload() {
  this.load.image('map', 'assets/map.png');      // 地图
  this.load.spritesheet('player', 'assets/player.png', {
    frameWidth: 32,
    frameHeight: 48
  }); // 小人精灵表
}

function create() {
  // 背景地图
  this.add.image(config.width/2, config.height/2, 'map')
    .setDisplaySize(config.width, config.height);

  // 小人
  player = this.physics.add.sprite(200, 200, 'player');

  // 动画（行走）
  this.anims.create({
    key: 'walk',
    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
    frameRate: 8,
    repeat: -1
  });

  player.play('walk');

  // 设置移动速度
  player.vx = 100; // 向右速度
  player.vy = 50;  // 向下速度
}

function update(time, delta) {
  player.x += player.vx * delta / 1000;
  player.y += player.vy * delta / 1000;

  // 碰到边界反弹
  if (player.x < 0 || player.x > config.width) {
    player.vx *= -1;
  }
  if (player.y < 0 || player.y > config.height) {
    player.vy *= -1;
  }
}
