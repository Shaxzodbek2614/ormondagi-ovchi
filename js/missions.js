'use strict';

/* ==========================================================================
   YAKKA MISSIYALAR
   Har bir missiya jadvalda: sharoit, ruxsat etilgan qurollar, maqsadlar va mukofot.
   prepare: raund boshida bir marta, tick: raund davomida har kadrda chaqiriladi.
   ========================================================================== */

/** Bo'sh quruqlikdagi tasodifiy nuqta: markazdan berilgan masofada. */
function nearbyPoint(centerX, centerZ, minDistance, maxDistance) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const angle = Math.random() * TAU, distance = randRange(minDistance, maxDistance);
    const x = centerX + Math.cos(angle) * distance, z = centerZ + Math.sin(angle) * distance;
    const inside = Math.hypot(x, z) < CONFIG.worldRadius - 6;
    if (inside && isDryLand(x, z) && isSpotFree(x, z, 1.2)) return { x, z };
  }
  return { x: centerX, z: centerZ };
}

function placeAnimal(animal, x, z) {
  animal.dormant = false;
  animal.pos.set(x, animal.groundLevel(x, z), z);
  animal.root.visible = true;
  animal.setState('graze', randRange(2, 7));
}

/** Berilgan turdagi hayvonlarni nuqta atrofiga olib keladi: maqsad topilmay qolmasligi uchun. */
function bringAnimals(kind, count, centerX, centerZ, minDistance, maxDistance) {
  const herd = animals.filter((animal) => animal.kind === kind).slice(0, count);
  for (const animal of herd) {
    const { x, z } = nearbyPoint(centerX, centerZ, minDistance, maxDistance);
    placeAnimal(animal, x, z);
  }
  return herd;
}

/** O'yinchini eng katta ko'l bo'yiga qo'yadi va ko'lga qaratadi. */
function startAtLake() {
  const lake = lakes.reduce((best, candidate) => (candidate.radius > best.radius ? candidate : best));
  const shore = shorePoints.reduce((best, point) => (
    Math.hypot(point.x - lake.x, point.z - lake.z) < Math.hypot(best.x - lake.x, best.z - lake.z) ? point : best));
  player.pos.x = shore.x;
  player.pos.z = shore.z;
  player.yaw = Math.atan2(shore.x - lake.x, shore.z - lake.z);
  return lake;
}

/** Bir nuqtadan ikkinchisiga ilon izi bo'lib boruvchi qon tomchilari. */
function layBloodTrail(fromX, fromZ, toX, toZ, label) {
  const length = Math.hypot(toX - fromX, toZ - fromZ);
  const sideX = (toZ - fromZ) / length, sideZ = -(toX - fromX) / length;
  for (let travelled = 0; travelled < length; travelled += 3.2) {
    const t = travelled / length;
    const swing = Math.sin(t * 9) * 7 * Math.sin(t * Math.PI);
    const x = lerp(fromX, toX, t) + sideX * swing, z = lerp(fromZ, toZ, t) + sideZ * swing;
    tracks.blood.add(x, z, 0, randRange(0.8, 1.4), label, { lasting: true });
  }
}

const MISSIONS = [
  {
    id: 'first-trail',
    title: 'Birinchi iz',
    brief: 'Quyon izlarini kuzatib, uchta quyon ovlang.',
    setup: { time: 'day', weather: 'clear', season: 'summer', wind: 'calm', difficulty: 'easy', duration: '240' },
    goals: [{ kind: 'rabbit', goal: 3, text: 'Quyon ovlash' }],
    reward: 40,
    fastLeft: 120,
    tips: [
      'Yerga qarang: yaqin atrofda iz bo‘lsa, pastda yozuv chiqadi.',
      'Sekin yuring. C tugmasi bilan egilsangiz, hayvon sizni kech sezadi.',
      'O‘ng tugma bilan mo‘ljalga oling, keyin chap tugma bilan oting.',
    ],
    prepare() {
      bringAnimals('rabbit', 6, player.pos.x, player.pos.z, 26, 52);
    },
  },
  {
    id: 'lake-ambush',
    title: 'Ko‘l bo‘yida pistirma',
    brief: 'Suv ichgani kelgan uchta bug‘uni ular sizni sezmasdan oting. Kamon ovoz chiqarmaydi.',
    setup: { time: 'dawn', weather: 'clear', season: 'summer', wind: 'breeze', difficulty: 'normal', duration: '300' },
    weapons: ['bow', 'rifle'],
    goals: [{ kind: 'deer', unaware: true, goal: 3, text: 'Sezmagan bug‘u' }],
    reward: 60,
    fastLeft: 150,
    tips: ['Qirg‘oqdagi butaga yashiring va kuting.', 'Cho‘chigan bug‘u hisobga o‘tmaydi.'],
    prepare() {
      // Bug'ular ko'lning narigi qirg'og'iga keladi: o'yinchini darrov sezmasligi uchun
      const lake = startAtLake();
      const farX = lake.x + (lake.x - player.pos.x), farZ = lake.z + (lake.z - player.pos.z);
      bringAnimals('deer', 9, farX, farZ, 6, 26);
    },
  },
  {
    id: 'silent-hunter',
    title: 'Jim ovchi',
    brief: 'Qalin tumanda faqat kamon bilan to‘rtta hayvon ovlang.',
    setup: { time: 'dawn', weather: 'mist', season: 'autumn', wind: 'calm', difficulty: 'normal', duration: '300' },
    weapons: ['bow'],
    ammo: { bow: [1, 14] },
    goals: [{ any: true, goal: 4, text: 'Kamon bilan ov' }],
    reward: 70,
    fastLeft: 140,
    tips: ['O‘q uzoqda pastga tushadi: bir oz yuqoriroq mo‘ljal oling.'],
    prepare() {
      bringAnimals('deer', 5, player.pos.x, player.pos.z, 30, 60);
      bringAnimals('rabbit', 6, player.pos.x, player.pos.z, 25, 55);
    },
  },
  {
    id: 'duck-season',
    title: 'O‘rdak mavsumi',
    brief: 'Beshta o‘rdakni havoda uring. Suzib yurganini otish hisobga o‘tmaydi.',
    setup: { time: 'day', weather: 'cloudy', season: 'autumn', wind: 'breeze', difficulty: 'normal', duration: '300' },
    world: { lakes: 11 },
    weapons: ['shotgun', 'rifle'],
    goals: [{ kind: 'duck', airborne: true, goal: 5, text: 'Havodagi o‘rdak' }],
    reward: 70,
    fastLeft: 130,
    tips: ['O‘rdakka yaqinlashing: cho‘chisa, uchib ketadi. Oldindan mo‘ljal oling.'],
    prepare() {
      const lake = startAtLake();
      for (const duck of animals.filter((animal) => animal.kind === 'duck')) {
        const { x, z } = randomLakePoint(lake);
        duck.pos.set(x, WATER_LEVEL, z);
      }
    },
  },
  {
    id: 'goose-flight',
    title: 'G‘oz ovi',
    brief: 'Ko‘llar o‘lkasida g‘ozlar gala bo‘lib yuradi. Bittasi cho‘chisa, hammasi birga uchadi. Oltita g‘ozni havoda uring.',
    setup: { time: 'dawn', weather: 'clear', season: 'autumn', wind: 'calm', difficulty: 'normal', duration: '300' },
    world: { lakes: 11 },
    weapons: ['shotgun', 'rifle'],
    goals: [{ kind: 'goose', airborne: true, goal: 6, text: 'Havodagi g‘oz' }],
    reward: 90,
    fastLeft: 120,
    tips: ['Gala V shaklida uchadi. Ov miltig‘i bilan bir o‘qda ikkitasini urish mumkin.'],
    prepare() {
      const lake = startAtLake();
      for (const goose of animals.filter((animal) => animal.kind === 'goose')) {
        const { x, z } = randomLakePoint(lake);
        goose.pos.set(x, WATER_LEVEL, z);
      }
    },
  },
  {
    id: 'wolf-evening',
    title: 'Bo‘ri oqshomi',
    brief: 'Bo‘rilar sizni qidirib keladi. Oltita bo‘rini ovlang va tirik qoling.',
    setup: { time: 'dusk', weather: 'clear', season: 'autumn', wind: 'breeze', difficulty: 'hard', duration: '300' },
    goals: [{ kind: 'wolf', goal: 6, text: 'Bo‘ri ovlash' }],
    reward: 90,
    fastLeft: 110,
    tips: ['To‘da sizni o‘raydi. Orqangiz daraxtga qarab tursa, kamroq tomondan kelishadi.'],
    prepare() {
      this.huntClock = 12;
    },
    tick(dt) {
      // Vaqti-vaqti bilan bo'rilarni o'yinchi tomon yo'naltiramiz
      this.huntClock -= dt;
      if (this.huntClock > 0) return;
      this.huntClock = 14;
      for (const wolf of animals.filter((animal) => animal.kind === 'wolf' && animal.alive && animal.spawned)) {
        if (wolf.state !== 'walk' && wolf.state !== 'graze') continue;
        wolf.target = { x: player.pos.x + randRange(-12, 12), z: player.pos.z + randRange(-12, 12) };
        wolf.setState('walk', 16);
      }
    },
  },
  {
    id: 'wounded-bear',
    title: 'Yarador ayiq',
    brief: 'Kimdir ayiqni yaralab qoldirgan. Qon izi bo‘ylab yurib, uni toping.',
    setup: { time: 'dusk', weather: 'rain', season: 'summer', wind: 'breeze', difficulty: 'normal', duration: '300' },
    goals: [{ kind: 'bear', goal: 1, text: 'Yarador ayiq' }],
    reward: 100,
    fastLeft: 170,
    tips: ['Qon izi yerda qizil dog‘lar bo‘lib ko‘rinadi.', 'Ayiq tik tursa, boshiga oting yoki qoching.'],
    prepare() {
      const bear = animals.find((animal) => animal.kind === 'bear');
      const { x, z } = nearbyPoint(player.pos.x, player.pos.z, 120, 150);
      placeAnimal(bear, x, z);
      bear.hp = 4;
      const start = nearbyPoint(player.pos.x, player.pos.z, 8, 12);
      layBloodTrail(start.x, start.z, x, z, 'Yarador ayiq qoni');
    },
  },
  {
    id: 'white-deer',
    title: 'Oq bug‘u',
    brief: 'O‘rmonda noyob oq bug‘u yuribdi. U uzoqdan sezadi va juda tez chopadi.',
    setup: { time: 'dawn', weather: 'mist', season: 'winter', wind: 'breeze', difficulty: 'normal', duration: '300' },
    uses: ['whiteDeer'],
    goals: [{ kind: 'whiteDeer', goal: 1, text: 'Oq bug‘u' }],
    reward: 130,
    fastLeft: 140,
    tips: ['Qorda izlar uzoq saqlanadi. Shamolga qarshi yaqinlashing.'],
    prepare() {
      const deer = animals.find((animal) => animal.kind === 'whiteDeer');
      const { x, z } = nearbyPoint(player.pos.x, player.pos.z, 85, 120);
      placeAnimal(deer, x, z);
    },
  },
  {
    id: 'under-ice',
    title: 'Muz ostidagi ov',
    brief: 'Ko‘l muzlagan. Muzni teshib, to‘rtta baliq tuting.',
    setup: { time: 'dawn', weather: 'clear', season: 'winter', wind: 'calm', difficulty: 'easy', duration: '240' },
    goals: [{ kind: 'fish', goal: 4, text: 'Baliq tutish' }],
    reward: 60,
    fastLeft: 90,
    tips: ['Muz ustida T tugmasini bosib turing. Po‘kak cho‘kkanda T ni tez bosing.'],
    prepare() {
      startAtLake();
    },
  },
  {
    id: 'winter-hunger',
    title: 'Qish ochligi',
    brief: 'Bor-yo‘g‘i 10 ta o‘q bilan beshta hayvon ovlang.',
    setup: { time: 'day', weather: 'snow', season: 'winter', wind: 'gale', difficulty: 'hard', duration: '300' },
    weapons: ['rifle'],
    ammo: { rifle: [6, 4] },
    goals: [{ any: true, goal: 5, text: 'Hayvon ovlash' }],
    reward: 120,
    fastLeft: 110,
    tips: ['Har bir o‘qni o‘ylab sarflang.'],
    prepare() {
      bringAnimals('deer', 6, player.pos.x, player.pos.z, 45, 80);
      bringAnimals('rabbit', 6, player.pos.x, player.pos.z, 35, 70);
    },
  },
];

/** Missiya ochiqmi: nechta missiya bajarilgan bo'lsa, ro'yxatda shuncha pog'ona ochiq. */
function isMissionUnlocked(index) {
  const completed = Object.values(profile.missions).filter((stars) => stars > 0).length;
  return index <= completed;
}

const starText = (stars) => '★'.repeat(stars) + '☆'.repeat(3 - stars);

/** Missiyani tanlaydi. Dunyoda ko'l yetmasa, sahifa shu talab bilan qayta yuklanadi. */
function openMission(mission) {
  if (lakes.length < (mission.world?.lakes ?? 0)) {
    try {
      sessionStorage.setItem(PENDING_MISSION_KEY, JSON.stringify({ id: mission.id, lakes: mission.world.lakes }));
      location.reload();
      return;
    } catch {
      // Saqlab bo'lmasa, oddiy dunyoda o'ynaladi
    }
  }
  showMissionBrief(mission);
}

function showMissionBrief(mission) {
  applySetup(mission.setup);
  ui.briefTitle.textContent = mission.title;
  ui.briefText.textContent = mission.brief;
  ui.briefConditions.textContent = conditions.name;
  renderLoadouts();
  ui.briefStartBtn.onclick = () => startMission(mission);
  ui.menu.hidden = ui.missions.hidden = ui.result.hidden = true;
  ui.brief.hidden = false;
}

function startMission(mission) {
  if (IS_TOUCH_DEVICE) document.documentElement.requestFullscreen?.().catch(() => {});
  sound.init();
  game.mode = 'mission';
  game.activeMission = mission;
  applySetup(mission.setup);
  resetRound();
  mission.prepare?.();
  player.pos.y = terrainHeight(player.pos.x, player.pos.z) + CONFIG.player.eyeHeight;
  game.tipIndex = 0;
  game.tipClock = 1.5;
  ui.missions.hidden = ui.brief.hidden = true;
  game.state = 'paused'; // sichqoncha qulflangach "playing" ga o'tadi
  requestLock();
}

/** Har kadrda: maslahatlar, missiyaning o'z mantiqi va g'alaba tekshiruvi. */
function updateMission(dt) {
  const mission = game.activeMission;
  mission.tick?.(dt);
  if (game.state !== 'playing') return;

  game.tipClock -= dt;
  if (game.tipClock <= 0 && game.tipIndex < (mission.tips?.length ?? 0)) {
    showTip(mission.tips[game.tipIndex++]);
    game.tipClock = 13;
  }

  const allDone = game.missions.every((goal) => goal.progress >= goal.goal);
  if (allDone) {
    // G'alaba bir lahza kechikadi: o'yinchi oxirgi ovini ko'rib olsin
    game.winDelay = (game.winDelay ?? 1.4) - dt;
    if (game.winDelay <= 0) endRound('Missiya bajarildi', true);
  }
}

/** Yulduz va mukofotni hisoblaydi. Mukofot birinchi bajarilganda, yulduzlar uchun esa faqat yangilari beriladi. */
function settleMission(won) {
  const mission = game.activeMission;
  if (!won) return { stars: 0, coins: 0, rows: [] };

  const fast = game.timeLeft >= mission.fastLeft;
  const unhurt = game.damageTaken === 0;
  const stars = 1 + (fast ? 1 : 0) + (unhurt ? 1 : 0);
  const record = game.mode === 'team' ? profile.teamMissions : profile.missions;
  const previous = record[mission.id] ?? 0;
  const coins = (previous === 0 ? mission.reward : 0) + Math.max(0, stars - previous) * 10;
  record[mission.id] = Math.max(stars, previous);

  const index = MISSIONS.indexOf(mission);
  return {
    stars,
    coins,
    next: index >= 0 ? MISSIONS[index + 1] : null,
    rows: [['Tez bajarildi', fast ? 'Ha' : 'Yo‘q'], ['Zarar olinmadi', unhurt ? 'Ha' : 'Yo‘q']],
  };
}

function showMissions() {
  ui.missionsTitle.textContent = 'Missiyalar';
  ui.missionCards.replaceChildren(...MISSIONS.map((mission, index) => {
    const unlocked = isMissionUnlocked(index);
    const row = document.createElement('li');
    row.classList.toggle('locked', !unlocked);

    const title = document.createElement('b');
    title.textContent = mission.title;
    const stars = document.createElement('span');
    stars.className = 'stars';
    stars.textContent = starText(profile.missions[mission.id] ?? 0);
    title.append(' ', stars);

    const brief = document.createElement('small');
    brief.textContent = unlocked ? mission.brief : 'Oldingi missiyani bajaring.';

    const button = document.createElement('button');
    button.textContent = unlocked ? 'Boshlash' : 'Yopiq';
    button.disabled = !unlocked;
    button.addEventListener('click', () => openMission(mission));

    row.append(title, brief, button);
    return row;
  }));
  ui.menu.hidden = true;
  ui.missions.hidden = false;
}
