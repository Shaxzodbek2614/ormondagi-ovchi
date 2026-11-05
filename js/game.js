'use strict';

/* ==========================================================================
   O'YIN HOLATI
   Holatlar: menu -> playing <-> paused -> over -> (qayta) playing
   ========================================================================== */

// Odatda sichqoncha qulflanadi (Pointer Lock). Agar brauzer bunga ruxsat bermasa,
// "erkin" rejim yoqiladi: kursor ekran chetiga yetganda kamera o'zi buriladi.
const pointer = { lockWorked: false, free: IS_TOUCH_DEVICE };

// Har bir tur uchun topshiriqda nechta ovlash kerakligi
const MISSION_GOALS = { rabbit: 3, deer: 2, fox: 1, boar: 2, duck: 1, goose: 2, wolf: 2, bear: 1, fish: 1 };

/** Raund uchun tasodifiy uchta topshiriq. */
function createMissions() {
  const activeKinds = new Set(animals.filter((animal) => !animal.dormant).map((animal) => animal.kind));
  const available = Object.entries(MISSION_GOALS).filter(([kind]) => activeKinds.has(kind));
  const pool = available.map(([kind, goal]) => ({
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
  activeMission: null,
  damageTaken: 0,
  score: 0,
  kills: {},
  missions: [],
  shots: 0,
  hits: 0,
  timeLeft: CONFIG.roundSeconds,
};

/** Topshiriq yoki maqsad shu ovga mos keladimi. */
function goalMatches(goal, animal, moment) {
  if (goal.custom) return false; // bunday maqsadni missiyaning o'zi hisoblaydi
  if (goal.kind && goal.kind !== animal.kind) return false;
  if (goal.inZone && !moment.inZone) return false;
  if (goal.marked && !moment.marked) return false;
  if (goal.headshot && !moment.headshot) return false;
  if (goal.unaware && !moment.unaware) return false;
  if (goal.airborne && !moment.airborne) return false;
  return true;
}

function onAnimalKilled(animal, moment) {
  const { spec, kind } = animal;
  const points = moment.headshot ? spec.points * 2 : spec.points;
  game.score += points;
  game.kills[kind]++;
  updateScoreHud();
  showPopup(`+${points} ${spec.name}${moment.headshot ? ' · boshga!' : ''}`);
  if (network.isHost) broadcast({ t: 'kill', name: spec.name, points, headshot: moment.headshot });

  for (const goal of game.missions) {
    if (goal.progress >= goal.goal || !goalMatches(goal, animal, moment)) continue;
    goal.progress++;
    if (goal.progress === goal.goal) {
      showPopup(goal.reward ? `Topshiriq bajarildi: +${goal.reward} tanga` : 'Maqsad bajarildi');
      sound.chime();
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
  // Topshiriqlar faqat shu raundda bor hayvonlardan tanlanishi uchun bu birinchi bajariladi.
  // Qishda issiqsevarlar yo'q, oson qiyinlikda yirtqichlar kamroq.
  for (const animal of animals) {
    animal.dormant = (conditions.frozen && Boolean(animal.spec.warmOnly))
      || (Boolean(animal.spec.aggressive) && animal.rosterRank >= conditions.predators)
      || Boolean(animal.spec.missionOnly);
  }

  Object.assign(game, {
    score: 0,
    shots: 0,
    hits: 0,
    timeLeft: conditions.duration,
    kills: Object.fromEntries(Object.keys(SPECIES).map((kind) => [kind, 0])),
    damageTaken: 0,
    winDelay: undefined,
    missions: game.activeMission
      ? game.activeMission.goals.map((goal) => ({ ...goal, progress: 0 }))
      : createMissions(),
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
  ui.downBanner.hidden = true;

  animals.forEach((animal) => {
    animal.spawned = false; // guruh a'zolari yangi joyda yo'lboshchisi yonida chiqishi uchun
    animal.state = 'graze';
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
  game.menuOpen = false;
  ui.menu.hidden = ui.pause.hidden = ui.result.hidden = ui.setup.hidden = ui.missions.hidden = true;
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
  releaseInput();
  document.body.classList.remove('free-mouse');
  ui.pause.hidden = false;
  // Birga o'ynaganda o'rmon to'xtamaydi: faqat shu o'yinchining boshqaruvi o'chadi
  if (game.mode === 'team') {
    game.menuOpen = true;
    ui.pauseNote.textContent = 'O‘yin davom etmoqda.';
    return;
  }
  game.state = 'paused';
  sound.context?.suspend();
  ui.pauseNote.textContent = '';
}

function requestLock() {
  if (pointer.free) {
    enterPlay();
    return;
  }
  canvas.requestPointerLock()?.catch?.(onLockFailed);
}

function onLockFailed() {
  if (game.state !== 'paused' && !game.menuOpen) return;
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
  if (network.active) {
    leaveRoom();
    return;
  }
  game.state = 'menu';
  player.noise = 0;
  releaseInput();
  viewModel.visible = false;
  sound.context?.resume();
  document.exitPointerLock?.();
  ui.hud.hidden = ui.pause.hidden = ui.result.hidden = true;
  ui.menu.hidden = false;
  applySetup(profile.setup);
}

/** Natija oynasidagi "Qayta o'ynash": xuddi shu rejimni boshidan boshlaydi. */
function restartRound() {
  if (game.mode === 'team') {
    game.state = 'menu';
    viewModel.visible = false;
    showLobby();
  } else if (game.mode === 'mission') {
    startMission(game.activeMission);
  } else {
    startRound();
  }
}

function startRound() {
  if (IS_TOUCH_DEVICE) document.documentElement.requestFullscreen?.().catch(() => {});
  sound.init();
  game.mode = 'free';
  game.activeMission = null;
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
  if (locked && (game.state === 'paused' || game.menuOpen)) {
    pointer.lockWorked = true;
    enterPlay();
  } else if (!locked && game.state === 'playing' && !game.menuOpen) {
    pauseRound();
  }
}

/**
 * Raundni tugatadi va natijani ko'rsatadi.
 * @param won missiyada g'alaba bo'ldimi (erkin ovda ahamiyati yo'q)
 */
function endRound(reason, won = false) {
  if (network.isHost && game.mode === 'team') {
    broadcast({ t: 'end', reason, won, score: game.score, kills: game.kills });
  }
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
  const accuracyBonus = game.hits >= 3 && game.mode !== 'team' ? Math.round(game.score * accuracy * 0.25) : 0;
  game.score += accuracyBonus;

  const rows = Object.keys(SPECIES)
    .filter((kind) => game.kills[kind] > 0)
    .map((kind) => [SPECIES[kind].name, game.kills[kind]]);
  rows.push(['Aniqlik', `${Math.round(accuracy * 100)}% (${game.hits} / ${game.shots})`]);
  if (accuracyBonus) rows.push(['Aniqlik bonusi', `+${accuracyBonus}`]);

  let coins, summary, nextMission = null;
  if (game.activeMission) {
    const outcome = settleMission(won);
    coins = outcome.coins;
    nextMission = outcome.next ?? null;
    summary = won ? starText(outcome.stars) : 'Missiya bajarilmadi';
    rows.push(...outcome.rows);
  } else {
    // Erkin ovda tanga ochkodan va topshiriqlardan keladi, qiyin sharoit ko'proq beradi
    const finished = game.missions.filter((goal) => goal.progress >= goal.goal);
    const earned = Math.round(game.score / 10) + finished.reduce((sum, goal) => sum + goal.reward, 0);
    coins = Math.round(earned * conditions.reward);
    rows.push(['Topshiriqlar', `${finished.length} / ${game.missions.length}`]);

    const isRecord = game.mode === 'free' && game.score > profile.best;
    summary = game.mode === 'team' ? 'Jamoa natijasi' : isRecord ? 'Yangi rekord!' : `Rekord: ${profile.best}`;
    if (isRecord) profile.best = game.score;
  }
  profile.coins += coins;
  saveProfile();
  rows.push(['Tanga', `+${coins} (jami ${profile.coins})`]);

  ui.finalReason.textContent = reason;
  ui.finalScore.textContent = game.score;
  ui.finalBest.textContent = summary;
  ui.finalTable.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement('tr');
    row.insertCell().textContent = label;
    row.insertCell().textContent = value;
    return row;
  }));
  ui.nextMissionBtn.hidden = !(won && nextMission);
  ui.nextMissionBtn.onclick = nextMission ? () => openMission(nextMission) : null;
  ui.againBtn.textContent = game.mode === 'team' ? 'Xonaga qaytish' : 'Qayta o‘ynash';
  ui.result.hidden = false;
}

function updateRound(dt) {
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  updateTimeHud();
  if (game.activeMission) updateMission(dt);
  if (game.state === 'playing' && game.timeLeft === 0) endRound('Vaqt tugadi');
}
