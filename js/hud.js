'use strict';

/* ==========================================================================
   EKRANDAGI KO'RSATKICHLAR
   ========================================================================== */

const byId = (id) => document.getElementById(id);

const ui = {
  hud: byId('hud'),
  menu: byId('menu'),
  pause: byId('pause'),
  pauseNote: byId('pauseNote'),
  result: byId('result'),
  score: byId('scoreValue'),
  killLine: byId('killLine'),
  timePlate: byId('timePlate'),
  time: byId('timeValue'),
  hp: byId('hpValue'),
  hpBar: byId('hpBar'),
  hpFill: document.querySelector('#hpBar > i'),
  ammo: byId('ammoValue'),
  ammoPips: byId('ammoPips'),
  reloadBar: byId('reloadBar'),
  reloadFill: document.querySelector('#reloadBar > i'),
  crosshair: byId('crosshair'),
  hitMarker: byId('hitMarker'),
  feed: byId('feed'),
  hint: byId('hint'),
  warning: byId('warning'),
  vignette: byId('vignette'),
  hitArc: byId('hitArc'),
  compass: byId('compass'),
  mapScreen: byId('mapScreen'),
  mapCanvas: byId('mapCanvas'),
  rankLine: byId('rankLine'),
  trophies: byId('trophies'),
  trophiesBtn: byId('trophiesBtn'),
  trophiesBackBtn: byId('trophiesBackBtn'),
  trophyRank: byId('trophyRank'),
  trophyXp: byId('trophyXp'),
  trophyTable: byId('trophyTable'),
  trophyBadges: byId('trophyBadges'),
  brief: byId('brief'),
  briefTitle: byId('briefTitle'),
  briefText: byId('briefText'),
  briefConditions: byId('briefConditions'),
  briefStartBtn: byId('briefStartBtn'),
  briefBackBtn: byId('briefBackBtn'),
  teamSiteNote: byId('teamSiteNote'),
  teamSiteLink: byId('teamSiteLink'),
  teamLine: byId('teamLine'),
  missionsTitle: byId('missionsTitle'),
  markers: byId('markers'),
  downBanner: byId('downBanner'),
  team: byId('team'),
  teamBtn: byId('teamBtn'),
  teamBackBtn: byId('teamBackBtn'),
  teamError: byId('teamError'),
  nickInput: byId('nickInput'),
  roomInput: byId('roomInput'),
  createRoomBtn: byId('createRoomBtn'),
  joinRoomBtn: byId('joinRoomBtn'),
  lobby: byId('lobby'),
  lobbyCode: byId('lobbyCode'),
  lobbyLink: byId('lobbyLink'),
  lobbyPlayers: byId('lobbyPlayers'),
  lobbyStatus: byId('lobbyStatus'),
  lobbyHostTools: byId('lobbyHostTools'),
  lobbyConditions: byId('lobbyConditions'),
  lobbyConditionsBtn: byId('lobbyConditionsBtn'),
  lobbyTaskName: byId('lobbyTaskName'),
  lobbyTaskBtn: byId('lobbyTaskBtn'),
  lobbyStartBtn: byId('lobbyStartBtn'),
  lobbyLeaveBtn: byId('lobbyLeaveBtn'),
  copyLinkBtn: byId('copyLinkBtn'),
  tip: byId('tip'),
  missions: byId('missions'),
  missionCards: byId('missionCards'),
  missionsBtn: byId('missionsBtn'),
  missionsBackBtn: byId('missionsBackBtn'),
  nextMissionBtn: byId('nextMissionBtn'),
  setup: byId('setup'),
  setupRows: byId('setupRows'),
  setupNote: byId('setupNote'),
  setupStartBtn: byId('setupStartBtn'),
  setupRandomBtn: byId('setupRandomBtn'),
  setupBackBtn: byId('setupBackBtn'),
  touchControls: byId('touchControls'),
  touchButtons: byId('touchButtons'),
  joystick: byId('joystick'),
  joystickKnob: document.querySelector('#joystick > i'),
  weaponName: byId('weaponName'),
  missionList: byId('missionList'),
  conditionLine: byId('conditionLine'),
  medkitLine: byId('medkitLine'),
  binoculars: byId('binoculars'),
  shop: byId('shop'),
  shopCoins: byId('shopCoins'),
  shopList: byId('shopList'),
  shopCloseBtn: byId('shopCloseBtn'),
  windArrow: byId('windArrow'),
  noiseFill: document.querySelector('#noiseBar > i'),
  stanceLine: byId('stanceLine'),
  threat: byId('threat'),
  settings: byId('settings'),
  sensitivityInput: byId('sensitivityInput'),
  sensitivityValue: byId('sensitivityValue'),
  volumeInput: byId('volumeInput'),
  volumeValue: byId('volumeValue'),
  qualityButtons: byId('qualityButtons'),
  settingsCloseBtn: byId('settingsCloseBtn'),
  startBtn: byId('startBtn'),
  resumeBtn: byId('resumeBtn'),
  againBtn: byId('againBtn'),
  finalReason: byId('finalReason'),
  finalScore: byId('finalScore'),
  finalBest: byId('finalBest'),
  finalTable: byId('finalTable'),
};

function updateScoreHud() {
  ui.score.textContent = game.score;
  ui.killLine.textContent = Object.keys(SPECIES)
    .filter((kind) => game.kills[kind] > 0)
    .map((kind) => `${SPECIES[kind].name} ${game.kills[kind]}`)
    .join(' · ');
}

function updateAmmoHud() {
  const { magazine, name } = weapon.gun;
  ui.weaponName.textContent = name;
  ui.ammo.textContent = `${weapon.ammo} / ${weapon.reserve}`;
  if (ui.ammoPips.children.length !== magazine) {
    ui.ammoPips.replaceChildren(...Array.from({ length: magazine }, () => document.createElement('i')));
  }
  [...ui.ammoPips.children].forEach((pip, index) => pip.classList.toggle('spent', index >= weapon.ammo));
}

/** Joni kam qolganda ekran chetlari doimiy ravishda biroz qizarib turadi. */
function lowHealthGlow() {
  return player.hp <= 40 ? 0.35 : 0;
}

function updateHealthHud() {
  const share = player.hp / CONFIG.player.maxHp;
  ui.hp.textContent = player.hp;
  ui.hpFill.style.transform = `scaleX(${share})`;
  ui.hpBar.classList.toggle('low', player.hp <= 40);
  ui.vignette.style.opacity = lowHealthGlow();
}

function updateMissionHud() {
  ui.missionList.replaceChildren(...game.missions.map((mission) => {
    const item = document.createElement('li');
    item.classList.toggle('done', mission.progress >= mission.goal);
    item.append(mission.text, document.createElement('span'));
    item.lastChild.textContent = `${mission.progress}/${mission.goal}`;
    return item;
  }));
}

function updateMedkitHud() {
  const items = [];
  if (profile.medkits) items.push(`Dori: ${profile.medkits} (H)`);
  if (isEquipped('trap')) items.push(`Tuzoq: ${profile.traps} (U)`);
  ui.medkitLine.textContent = items.join(' · ');
}

function updateTimeHud() {
  const seconds = Math.ceil(game.timeLeft);
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  if (text === ui.time.textContent) return;
  ui.time.textContent = text;
  ui.timePlate.classList.toggle('urgent', seconds <= 30);
  if (seconds <= 10 && seconds > 0) sound.tick();
}

function setHint(text) {
  ui.hint.hidden = !text;
  if (text && ui.hint.textContent !== text) ui.hint.textContent = text;
}

/** Shamol ko'rsatkichi, shovqin darajasi va o'yinchining holati. */
function updateFieldHud(hidden) {
  const windAngle = angleFromView(player.pos.x + Math.sin(wind.angle), player.pos.z + Math.cos(wind.angle));
  ui.windArrow.style.transform = `rotate(${windAngle}rad)`;
  ui.noiseFill.style.transform = `scaleX(${clamp(player.noise / 1.5, 0.03, 1)})`;
  const stance = [player.crouching && 'Egilgan', hidden && 'Butada', player.onTower && 'Minorada', player.lampOn && 'Chiroq']
    .filter(Boolean).join(' · ');
  if (ui.stanceLine.textContent !== stance) ui.stanceLine.textContent = stance;
}

/** Nuqta o'yinchining qarash yo'nalishidan qaysi burchakda: 0 = oldinda, + = o'ngda. */
function angleFromView(x, z) {
  const dx = x - player.pos.x, dz = z - player.pos.z;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  return Math.atan2(cos * dx - sin * dz, -sin * dx - cos * dz);
}

/** Hujum qilayotgan eng yaqin hayvonni ogohlantirish yozuvi va yo'nalish belgisi bilan ko'rsatadi. */
function updateThreatHud(attacker) {
  ui.warning.hidden = !attacker;
  ui.threat.hidden = true;
  if (!attacker) return;

  const text = `${attacker.spec.name} hujum qilmoqda!`;
  if (ui.warning.textContent !== text) ui.warning.textContent = text;
  const angle = angleFromView(attacker.pos.x, attacker.pos.z);
  if (Math.abs(angle) > 0.5) {
    ui.threat.hidden = false;
    ui.threat.style.transform = `rotate(${angle}rad)`;
  }
}

/** Missiya maslahati: bir necha soniya ekranda turadi. */
function showTip(text) {
  ui.tip.textContent = text;
  ui.tip.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }],
    { duration: 8000 },
  );
}

function showPopup(text) {
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.textContent = text;
  ui.feed.append(popup);
  popup.animate(
    [
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)', offset: 0.12 },
      { opacity: 1, offset: 0.7 },
      { opacity: 0, transform: 'translateY(-16px)' },
    ],
    { duration: 1500 },
  ).onfinish = () => popup.remove();
}
