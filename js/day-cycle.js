'use strict';

/* ==========================================================================
   KUN O'TISHI: "Tongdan tungacha" tanlansa, raund davomida osmon va yorug'lik o'zgaradi
   Vaqt game.timeLeft bo'yicha hisoblanadi. Mijozda u xostdan keladi,
   shuning uchun hammada bir xil payt bo'ladi.
   ========================================================================== */

// Raund ulushi bo'yicha paytlar: oralig'ida silliq o'tiladi
const DAY_PHASES = [
  { at: 0, time: 'dawn' },
  { at: 0.2, time: 'day' },
  { at: 0.55, time: 'day' },
  { at: 0.75, time: 'dusk' },
  { at: 0.88, time: 'night' },
  { at: 1, time: 'night' },
];
const NIGHT_FROM = 0.85;   // shu ulushdan keyin tun hisoblanadi: chiroq, yirtqich sergakligi
const DAWN_UNTIL = 0.15;   // tongda hayvonlar suv bo'yiga ko'proq keladi

const dayCycle = {
  frames: null,  // har payt uchun bir marta hisoblangan sharoit
  phase: null,   // ekranda ko'rsatiladigan payt nomi
  sky: new THREE.Color(),
  horizon: new THREE.Color(),
  sunColor: new THREE.Color(),
  sun: new THREE.Vector3(),
  sunTo: new THREE.Vector3(),
  from: new THREE.Color(),
  to: new THREE.Color(),
};

/** Raund boshida: har payt uchun sharoit bir marta hisoblanadi, keyin faqat aralashtiriladi. */
function prepareDayCycle(setup) {
  if (!conditions.cycle) {
    dayCycle.frames = null;
    return;
  }
  dayCycle.frames = Object.fromEntries(['dawn', 'day', 'dusk', 'night']
    .map((time) => [time, buildConditions({ ...setup, time })]));
  dayCycle.phase = null;
  conditions.sky = dayCycle.sky;
  conditions.horizon = dayCycle.horizon;
  conditions.sunColor = dayCycle.sunColor;
  updateDayCycle(0); // raund tongdan boshlanadi: eski raund vaqti hisobga olinmaydi
}

/** Hozirgi payt: ikki qo'shni payt va ular orasidagi ulush. */
function currentDayPhase(progress) {
  const next = DAY_PHASES.findIndex((phase) => phase.at > progress);
  const after = DAY_PHASES[next === -1 ? DAY_PHASES.length - 1 : next];
  const before = DAY_PHASES[Math.max(0, (next === -1 ? DAY_PHASES.length : next) - 1)];
  const span = after.at - before.at;
  const blend = span > 0 ? smoothstep((progress - before.at) / span, 0, 1) : 0;
  return { a: dayCycle.frames[before.time], b: dayCycle.frames[after.time], blend, name: (blend < 0.5 ? before : after).time };
}

function updateDayCycle(progress = clamp(1 - game.timeLeft / conditions.duration, 0, 1)) {
  if (!dayCycle.frames || !conditions.cycle) return;
  const { a, b, blend, name } = currentDayPhase(progress);
  const mix = (key) => lerp(a[key], b[key], blend);

  dayCycle.sky.lerpColors(a.sky, b.sky, blend);
  dayCycle.horizon.lerpColors(a.horizon, b.horizon, blend);
  dayCycle.sunColor.lerpColors(dayCycle.from.set(a.sunColor), dayCycle.to.set(b.sunColor), blend);
  dayCycle.sun.set(...a.sun).lerp(dayCycle.sunTo.set(...b.sun), blend);
  conditions.sun = dayCycle.sun.toArray();
  conditions.sunPower = mix('sunPower');
  conditions.ambient = mix('ambient');
  conditions.fog = mix('fog');
  conditions.stars = mix('stars');
  conditions.predatorSense = mix('predatorSense');
  conditions.drinkChance = progress < DAWN_UNTIL ? 0.6 : 0.3;
  applyDaylight(conditions);
  scene.fog.density = conditions.fog * (ROLE_INFO[game.myRole]?.fog ?? 1); // kuzatuvchi roli tumani saqlansin

  const night = progress >= NIGHT_FROM;
  if (night && !conditions.night && game.state === 'playing') onNightfall();
  conditions.night = night;
  if (name !== dayCycle.phase) {
    dayCycle.phase = name;
    ui.conditionLine.textContent = [SETUP_OPTIONS.time.choices[name].name, ...conditions.name.split(' · ').slice(1)].join(' · ');
  }
}

/** Qorong'i tushdi: maslahat va xostda yana bitta bo'ri to'dasi uyg'onadi. */
function onNightfall() {
  showTip('Qorong‘i tushdi: F bilan bosh chirog‘ini yoqing. Gulxan yirtqichni yaqinlashtirmaydi.');
  if (network.isClient || game.activeMission?.pvp) return;
  const sleeper = animals.find((animal) => animal.spec.pack && animal.dormant && !animal.spec.missionOnly);
  for (const wolf of sleeper?.group?.members ?? []) {
    wolf.dormant = false;
    wolf.spawn(85);
  }
}
