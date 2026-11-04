'use strict';

/* ==========================================================================
   O'YIN HOLATI
   Holatlar: menu -> playing <-> paused -> over -> (qayta) playing
   ========================================================================== */

// Odatda sichqoncha qulflanadi (Pointer Lock). Agar brauzer bunga ruxsat bermasa,
// "erkin" rejim yoqiladi: kursor ekran chetiga yetganda kamera o'zi buriladi.
const pointer = { lockWorked: false, free: IS_TOUCH_DEVICE };

// Har bir tur uchun topshiriqda nechta ovlash kerakligi
const MISSION_GOALS = { rabbit: 3, deer: 2, fox: 1, boar: 2, duck: 1, wolf: 2, bear: 1, fish: 1 };

/** Raund uchun tasodifiy uchta topshiriq. */
function createMissions() {
  const pool = Object.entries(MISSION_GOALS).map(([kind, goal]) => ({
    kind,
    goal,
    text: `${SPECIES[kind].name}: ${goal} ta ovlash`,
    reward: Math.ceil((SPECIES[kind].points * goal) / 15) * 5,
  }));
  pool.push({ headshot: true, goal: 2, text: 'Boshga 2 marta urish', reward: 30 });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map((mission) => ({ ...mission, progress: 0 }));
}

const game = {
  state: 'menu',
  mode: 'free', // free: erkin ov, mission: yakka missiya, team: birga ov
  score: 0,
  kills: {},
  missions: [],
  shots: 0,
  hits: 0,
  timeLeft: CONFIG.roundSeconds,
};

function onAnimalKilled(animal, headshot) {
  const { spec, kind } = animal;
  const points = headshot ? spec.points * 2 : spec.points;
  game.score += points;
  game.kills[kind]++;
  updateScoreHud();
  showPopup(`+${points} ${spec.name}${headshot ? ' · boshga!' : ''}`);

  for (const mission of game.missions) {
    if (mission.progress >= mission.goal) continue;
    if (mission.kind === kind || (mission.headshot && headshot)) {
      mission.progress++;
      if (mission.progress === mission.goal) {
        showPopup(`Topshiriq bajarildi: +${mission.reward} tanga`);
        sound.chime();
      }
    }
  }
  updateMissionHud();
}

/** Dori ichish: H tugmasi. */
function useMedkit() {
  if (profile.medkits === 0 || player.hp >= CONFIG.player.maxHp) return;
  profile.medkits--;
  saveProfile();
  player.hp = Math.min(CONFIG.player.maxHp, player.hp + CONFIG.medkitHeal);
  sound.heal();
  updateHealthHud();
  updateMedkitHud();
}

function resetRound() {
  Object.assign(game, {
    score: 0,
    shots: 0,
    hits: 0,
    timeLeft: conditions.duration,
    kills: Object.fromEntries(Object.keys(SPECIES).map((kind) => [kind, 0])),
    missions: createMissions(),
  });

  player.pos.set(0, terrainHeight(0, 0) + CONFIG.player.eyeHeight, 0);
  player.velocity.set(0, 0, 0);
  player.pitch = 0;
  player.hp = CONFIG.player.maxHp;
  player.recoil = player.shake = player.aim = player.crouch = 0;
  player.crouching = false;

  Object.assign(weapon, { reloadLeft: 0, kick: 0, flashLeft: 0 });
  stockWeapons();
  for (const pool of Object.values(tracks)) pool.clear();
  nearbyTrackLabel = null;
  ui.reloadBar.classList.remove('active');

  player.lampOn = conditions.night;
  player.down = false;

  animals.forEach((animal) => {
    animal.spawned = false; // guruh a'zolari yangi joyda yo'lboshchisi yonida chiqishi uchun
    animal.state = 'graze';
    // Qishda issiqsevarlar yo'q, oson qiyinlikda yirtqichlar kamroq
    animal.dormant = (conditions.frozen && Boolean(animal.spec.warmOnly))
      || (Boolean(animal.spec.aggressive) && animal.rosterRank >= conditions.predators);
  });
  // Yirtqichlar boshlanishda uzoqroqda bo'ladi, o'yinchiga tayyorlanishga vaqt qoladi
  animals.forEach((animal) => {
    animal.spawn(animal.spec.aggressive ? 85 : 30);
    if (animal.dormant) animal.root.visible = false;
  });

  updateScoreHud();
  updateAmmoHud();
  updateHealthHud();
  updateTimeHud();
  updateMissionHud();
  updateMedkitHud();
  setHint(null);
}

/** Tanlangan ov sharoitini sahnaga qo'llaydi. */
function applySetup(setup) {
  applyConditions(buildConditions(setup));
  waterMaterial.uniforms.frozen.value = conditions.frozen ? 1 : 0;
  updateTileCounts();
  ui.conditionLine.textContent = conditions.name;
  sound.setRain(Boolean(conditions.rain));
}

/** Sichqoncha qulflanganda yoki erkin rejimda o'yinni boshlaydi/davom ettiradi. */
function enterPlay() {
  game.state = 'playing';
  ui.menu.hidden = ui.pause.hidden = ui.result.hidden = ui.setup.hidden = true;
  ui.hud.hidden = false;
  viewModel.visible = true;
  document.body.classList.toggle('free-mouse', pointer.free);
  document.body.classList.add('playing');
  showTouchControls(true);
  sound.context?.resume();
}

/** Bosilgan tugmalar holatini tozalaydi: o'yin to'xtaganda hech narsa "yopishib" qolmasin. */
function releaseInput() {
  input.keys = {};
  input.aiming = input.fire = false;
  input.edgeTurn = input.stickX = input.stickY = 0;
  stopScoping();
  document.body.classList.remove('playing');
  showTouchControls(false);
}

function pauseRound() {
  game.state = 'paused';
  releaseInput();
  document.body.classList.remove('free-mouse');
  sound.context?.suspend();
  ui.pauseNote.textContent = '';
  ui.pause.hidden = false;
}

function requestLock() {
  if (pointer.free) {
    enterPlay();
    return;
  }
  canvas.requestPointerLock()?.catch?.(onLockFailed);
}

function onLockFailed() {
  if (game.state !== 'paused') return;
  if (pointer.lockWorked) {
    // Esc bosilgandan keyin brauzer taxminan bir soniya qayta qulflashga ruxsat bermaydi
    ui.pauseNote.textContent = 'Bir soniya kuting va yana bosing.';
    ui.pause.hidden = false;
  } else {
    // Sahifa qulflashni taqiqlaydigan oynada ochilgan: sichqonchani qulflamasdan o'ynaymiz
    pointer.free = true;
    enterPlay();
  }
}

/** O'yinni to'xtatib bosh menyuga qaytadi. */
function returnToMenu() {
  game.state = 'menu';
  player.noise = 0;
  releaseInput();
  viewModel.visible = false;
  sound.context?.resume();
  document.exitPointerLock?.();
  ui.hud.hidden = ui.pause.hidden = ui.result.hidden = true;
  ui.menu.hidden = false;
}

function startRound() {
  if (IS_TOUCH_DEVICE) document.documentElement.requestFullscreen?.().catch(() => {});
  sound.init();
  game.mode = 'free';
  applySetup(profile.setup);
  resetRound();
  game.state = 'paused'; // sichqoncha qulflangach "playing" ga o'tadi
  requestLock();
}

function resumeRound() {
  sound.init();
  requestLock();
}

function onPointerLockChange() {
  const locked = document.pointerLockElement === canvas;
  if (locked && game.state === 'paused') {
    pointer.lockWorked = true;
    enterPlay();
  } else if (!locked && game.state === 'playing') {
    pauseRound();
  }
}

function endRound(reason) {
  game.state = 'over';
  player.noise = 0;
  releaseInput();
  viewModel.visible = false;
  ui.hud.hidden = true;
  document.body.classList.remove('free-mouse');
  document.exitPointerLock?.();
  sound.horn();

  // Aniq otgan ovchi qo'shimcha ochko oladi
  const accuracy = game.shots ? game.hits / game.shots : 0;
  const accuracyBonus = game.hits >= 3 ? Math.round(game.score * accuracy * 0.25) : 0;
  game.score += accuracyBonus;

  // Tanga: ochkodan va bajarilgan topshiriqlardan
  const finished = game.missions.filter((mission) => mission.progress >= mission.goal);
  const earned = Math.round(game.score / 10) + finished.reduce((sum, mission) => sum + mission.reward, 0);
  const coins = Math.round(earned * conditions.reward); // qiyin sharoit ko'proq tanga beradi
  profile.coins += coins;

  const previousBest = profile.best;
  const isRecord = game.score > previousBest;
  if (isRecord) profile.best = game.score;
  saveProfile();

  ui.finalReason.textContent = reason;
  ui.finalScore.textContent = game.score;
  ui.finalBest.textContent = isRecord ? 'Yangi rekord!' : `Rekord: ${previousBest}`;

  const rows = Object.keys(SPECIES)
    .filter((kind) => game.kills[kind] > 0)
    .map((kind) => [SPECIES[kind].name, game.kills[kind]]);
  rows.push(['Aniqlik', `${Math.round(accuracy * 100)}% (${game.hits} / ${game.shots})`]);
  if (accuracyBonus) rows.push(['Aniqlik bonusi', `+${accuracyBonus}`]);
  rows.push(['Topshiriqlar', `${finished.length} / ${game.missions.length}`]);
  rows.push(['Tanga', `+${coins} (jami ${profile.coins})`]);
  ui.finalTable.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('tr');
    row.insertCell().textContent = label;
    row.insertCell().textContent = value;
    return row;
  }));
  ui.result.hidden = false;
}

function updateRound(dt) {
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  updateTimeHud();
  if (game.timeLeft === 0) endRound('Vaqt tugadi');
}
