// game.js — compatible with characters.js (single array export)

import { characters as rawCharacters } from "./characters.js";

const num = (v, d = 0) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (s !== "" && !Number.isNaN(Number(s))) return Number(s);
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return d;
};

const prob = (v, d = 0) => {
  const n = num(v, d);
  return n < 0 ? 0 : n > 1 ? 1 : n;
};

const str = (v, d = "") => (v == null ? d : String(v));

function sanitizeCharacter(c) {
  return {
    ...c,
    id: str(c.id),
    name: str(c.name),
    type: str(c.type),
    photo: str(c.photo),
    special: str(c.special, ""),
    energy: num(c.energy, 100),
    energyGainatDorm: num(c.energyGainatDorm, 0),
    energyLossatOffice: num(c.energyLossatOffice, 0),
    energyLossatLab: num(c.energyLossatLab, 0),
    energyLossatLecture: num(c.energyLossatLecture, 0),
    energyGainatBar: num(c.energyGainatBar, 0),
    energyGainatBarProbability: prob(c.energyGainatBarProbability, 0),
    energyLossatBar: num(c.energyLossatBar, 0),
    energyLossatBarProbability: prob(c.energyLossatBarProbability, 0),
    fundingGainatOffice: num(c.fundingGainatOffice, 0),
    fundingGainatOfficeProbability: prob(c.fundingGainatOfficeProbability, 0),
    fundingLossatLab: num(c.fundingLossatLab, 0),
    fundingLossatLabProbability: prob(c.fundingLossatLabProbability, 0),
    progressGainatLab: num(c.progressGainatLab, 0),
    progressGainatLabProbability: prob(c.progressGainatLabProbability, 0),
    progressLossatLab: num(c.progressLossatLab, 0),
    progressLossatLabProbability: prob(c.progressLossatLabProbability, 0),
    respectGainatLecture: num(c.respectGainatLecture, 0),
    respectGainatLectureProbability: prob(c.respectGainatLectureProbability, 0),
    respectGainatBar: num(c.respectGainatBar, 0),
    respectGainatBarProbability: prob(c.respectGainatBarProbability, 0),
    respectLossatBar: num(c.respectLossatBar, 0),
    respectLossatBarProbability: prob(c.respectLossatBarProbability, 0),
    gotobarProbability: prob(c.gotobarProbability, 0),
    level: num(c.level, 0),
    hired: Boolean(c.hired),
    location: c.location == null ? null : str(c.location),
  };
}

const characters = rawCharacters.map(sanitizeCharacter);

const typeKey = (t) => str(t).toLowerCase();
const byType = (t) => characters.filter((c) => typeKey(c.type) === t);

const piList = byType("pi");
const phdCandidates = byType("phd").filter((c) => !c.hired);
const postdocCandidates = byType("postdoc").filter((c) => !c.hired);
const coPICandidates = byType("copi").filter((c) => !c.hired);

export function applyEnergyBarStep(ch, player) {
  if (Math.random() < prob(ch.energyGainatBarProbability, 0)) {
    player.energy += num(ch.energyGainatBar, 0);
  }
  if (Math.random() < prob(ch.energyLossatBarProbability, 0)) {
    player.energy -= num(ch.energyLossatBar, 0);
  }
  if (player.energy > 100) player.energy = 100;
  if (player.energy < 0) player.energy = 0;
}

export function getLevel(ch) {
  return num(ch.level, 0);
}

export function getLocationLabel(ch) {
  return ch.location == null ? "Unknown" : str(ch.location);
}

export function getPhotoSrc(ch) {
  return str(ch.photo, "");
}

export {
  characters,
  piList,
  phdCandidates,
  postdocCandidates,
  coPICandidates,
};
