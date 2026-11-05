'use strict';

/* ==========================================================================
   DARAJA VA TROFEYLAR
   ========================================================================== */

const RANKS = [
  { name: 'Yangi ovchi', xp: 0 },
  { name: 'Izchi', xp: 400 },
  { name: 'Mergan', xp: 1200 },
  { name: 'Usta ovchi', xp: 3000 },
  { name: 'Afsona', xp: 7000 },
];

const ACHIEVEMENTS = [
  { name: 'Oq bug‘u ovchisi', done: () => (profile.trophies.kills.whiteDeer ?? 0) > 0 },
  { name: 'Ulkan ayiqni yenggan', done: () => (profile.teamMissions['giant-bear'] ?? 0) > 0 },
  { name: 'Lager himoyachisi', done: () => (profile.teamMissions['camp-defense'] ?? 0) > 0 },
  { name: '150 metrdan urish', done: () => profile.trophies.longestShot >= 150 },
  { name: '10 ta baliq', done: () => (profile.trophies.kills.fish ?? 0) >= 10 },
  { name: 'Barcha missiyalar', done: () => MISSIONS.every((mission) => (profile.missions[mission.id] ?? 0) > 0) },
];

function currentRank() {
  return [...RANKS].reverse().find((rank) => profile.xp >= rank.xp);
}

function nextRank() {
  return RANKS.find((rank) => profile.xp < rank.xp) ?? null;
}

/** Tajriba qo'shadi. Unvon oshsa, yangi unvon nomini qaytaradi. */
function addExperience(amount) {
  const before = currentRank();
  profile.xp += amount;
  const after = currentRank();
  return after === before ? null : after.name;
}

/** Shu o'yinchi ovlagan hayvonni trofeyga yozadi. */
function recordTrophy(kind, headshot, distance) {
  const { trophies } = profile;
  trophies.kills[kind] = (trophies.kills[kind] ?? 0) + 1;
  if (headshot) trophies.headshots++;
  trophies.longestShot = Math.max(trophies.longestShot, Math.round(distance));
}

function updateRankLine() {
  ui.rankLine.textContent = `${currentRank().name} · ${profile.xp} tajriba`;
}

function showTrophies() {
  const { trophies } = profile;
  const next = nextRank();
  ui.trophyRank.textContent = currentRank().name;
  ui.trophyXp.textContent = next ? `${profile.xp} / ${next.xp} tajriba, keyingisi: ${next.name}` : `${profile.xp} tajriba`;

  const killed = Object.entries(trophies.kills).map(([kind, count]) => [SPECIES[kind]?.name ?? kind, count]);
  const rows = [
    ...killed,
    ['Boshga urishlar', trophies.headshots],
    ['Eng uzoq o‘q', `${trophies.longestShot} m`],
  ];
  ui.trophyTable.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('tr');
    row.insertCell().textContent = label;
    row.insertCell().textContent = value;
    return row;
  }));

  ui.trophyBadges.replaceChildren(...ACHIEVEMENTS.map(({ name, done }) => {
    const badge = document.createElement('li');
    badge.textContent = name;
    badge.classList.toggle('earned', done());
    return badge;
  }));
  ui.menu.hidden = true;
  ui.trophies.hidden = false;
}
