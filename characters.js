// 全局人物池（游戏当前在用的角色）
const characters = [
  {
    id: "sumit",
    name: "Sumit",
    type: "PI",
    photo: "game/src/photo_raw/Sumit.png",
    energy: 100,
  }
  // 其他固定角色也可以放这里
];

const phdCandidates = [
    {
        id: "Andras",
        name: "Andras",
        photo: "game/src/photo_raw/Andras.png",
        energy: 100,
        progressRate: 1,
        fundingRate: 0,
        teachingRate: 1,
        barProbability: 0.1,
        dormRecoverRate: 2,
        special: "Python wizard if hired with hardware, progress +1",
        hired: false
    },  
    {
        id: "Sheng",
        name: "Sheng",
        photo: "game/src/photo_raw/Sheng.png",
        energy: 100,
        progressRate: 2,
        fundingRate: 0,
        teachingRate: 1,
        barProbability: 0.01,
        dormRecoverRate: 10,
        special: "Hard worker, progress +2 if energy > 50",
        hired: false
    },
    {   id: "Alex",
        name: "Alex",
        photo: "game/src/photo_raw/Alex.png",
        energy: 100,
        progressRate: 1,
        fundingRate: 1,
        teachingRate: 1,
        barProbability: 0.2,
        dormRecoverRate: 3,
        special: "Keep talking: if there is another PhD in lab, progress -1",
        hired: false
    }
];