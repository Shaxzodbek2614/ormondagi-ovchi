'use strict';

/* ==========================================================================
   QUROLLAR VA OTISH
   ========================================================================== */

const position3 = (x, y, z) => new THREE.Vector3(x, y, z);

const WEAPONS = {
  rifle: {
    name: 'Miltiq', power: 1, magazine: 6, reserve: 24, fireDelay: 0.55, reloadTime: 1.8, range: 220,
    spread: 0.012, alarmRadius: 40, recoil: 0.035, kick: 1, sound: 'gunshot', upgradeBase: 160,
    note: 'Ishonchli asosiy qurol.',
    hip: position3(0.27, -0.25, -0.5), aim: position3(0, -0.082, -0.62), muzzle: [0, 0.04, -0.95],
  },
  // Sochma o'q: bir nechta mayda o'q sochiladi, yaqinda hammasi tegib, kuchli zarba beradi
  shotgun: {
    name: 'Ov miltig‘i', price: 120, power: 1, magazine: 2, reserve: 16, fireDelay: 0.4, reloadTime: 1.5, range: 75,
    spread: 0.05, aimSpread: 0.028, pellets: 9, alarmRadius: 55, recoil: 0.06, kick: 1.4, sound: 'shotgunBlast',
    note: 'Yaqinda juda kuchli, uzoqqa yetmaydi.',
    hip: position3(0.27, -0.25, -0.46), aim: position3(0, -0.066, -0.58), muzzle: [0, 0.04, -0.74],
  },
  // Kamon ovoz chiqarmaydi, lekin o'q uchib boradi va uzoqda pastga tushadi
  bow: {
    name: 'Kamon', price: 150, power: 1, magazine: 1, reserve: 20, fireDelay: 0.1, reloadTime: 0.85, range: 140,
    spread: 0.006, alarmRadius: 0, recoil: 0.004, kick: 0.4, sound: 'bowRelease', arrowSpeed: 60,
    note: 'Ovozsiz: atrofdagi hayvonlar cho‘chimaydi. O‘q pastga tushadi.',
    hip: position3(0.24, -0.1, -0.82), aim: position3(0.035, 0.005, -0.72), muzzle: null,
  },
  carbine: {
    name: 'Karabin', price: 300, power: 0.7, magazine: 12, reserve: 48, fireDelay: 0.2, reloadTime: 2.1, range: 180,
    spread: 0.016, alarmRadius: 42, recoil: 0.02, kick: 0.55, sound: 'gunshot',
    note: 'Tez otadi va magazini katta, lekin har o‘qi kuchsizroq.',
    hip: position3(0.27, -0.24, -0.46), aim: position3(0, -0.082, -0.56), muzzle: [0, 0.04, -0.7],
  },
  // Mergan miltig'ida optik nishon bor: mo'ljalga olganda ekran nishonga aylanadi
  sniper: {
    name: 'Mergan miltig‘i', price: 380, power: 1.6, magazine: 4, reserve: 20, fireDelay: 1.1, reloadTime: 2.4, range: 320,
    spread: 0.02, alarmRadius: 50, recoil: 0.05, kick: 1.2, sound: 'gunshot', aimFov: 16,
    note: 'Optik nishon bilan juda uzoqdan uradi, kuchli, lekin sekin.',
    hip: position3(0.27, -0.25, -0.52), aim: position3(0, -0.11, -0.5), muzzle: [0, 0.04, -1.12],
  },
  crossbow: {
    name: 'Arbalet', price: 340, power: 1.5, magazine: 1, reserve: 20, fireDelay: 0.1, reloadTime: 1.3, range: 190,
    spread: 0.004, alarmRadius: 0, recoil: 0.008, kick: 0.6, sound: 'bowRelease', arrowSpeed: 95,
    note: 'Ovozsiz, kamondan kuchli va o‘qi tezroq, sekinroq o‘qlanadi.',
    hip: position3(0.25, -0.24, -0.5), aim: position3(0, -0.08, -0.56), muzzle: null,
  },
  magnum: {
    name: 'Katta kalibr', price: 520, power: 2.6, magazine: 3, reserve: 15, fireDelay: 0.9, reloadTime: 2.5, range: 200,
    spread: 0.014, alarmRadius: 70, recoil: 0.09, kick: 1.8, sound: 'shotgunBlast',
    note: 'Ayiq uchun: juda kuchli, tepkisi katta, ovozi uzoqqa ketadi.',
    hip: position3(0.27, -0.25, -0.5), aim: position3(0, -0.082, -0.62), muzzle: [0, 0.04, -0.98],
  },
};

const WEAPON_ORDER = Object.keys(WEAPONS); // 1-7 tugmalari shu tartibda

// Har kuchaytirish darajasi nima beradi
const UPGRADE = { maxLevel: 3, power: 0.34, reload: 0.12, spread: 0.2, reserve: 0.25 };

/** Qurolning hozirgi ko'rsatkichlari: jadvaldagi qiymat va kuchaytirish darajasi. */
function gunStats(id) {
  const base = WEAPONS[id];
  const level = profile.weaponLevels[id] ?? 0;
  return {
    ...base,
    level,
    power: base.power * (1 + level * UPGRADE.power),
    reloadTime: base.reloadTime * (1 - level * UPGRADE.reload),
    spread: base.spread * (1 - level * UPGRADE.spread),
    aimSpread: (base.aimSpread ?? 0) * (1 - level * UPGRADE.spread),
    reserve: Math.round(base.reserve * (1 + level * UPGRADE.reserve)),
  };
}

const upgradeCost = (id) => {
  const base = WEAPONS[id].price ?? WEAPONS[id].upgradeBase;
  return Math.round((base * 0.5 * ((profile.weaponLevels[id] ?? 0) + 1)) / 10) * 10;
};

const weapon = {
  current: 'rifle',
  slots: {},       // har bir qurolning o'z o'qi: { ammo, reserve }
  stats: {},       // raund boshida hisoblangan ko'rsatkichlar
  cooldown: 0,
  reloadLeft: 0,
  kick: 0,
  flashLeft: 0,
  swayX: 0,
  swayY: 0,
  swapLift: 0,     // qurol almashganda pastdan ko'tariladi
  get gun() { return this.stats[this.current]; },
  get ammo() { return this.slots[this.current].ammo; },
  set ammo(value) { this.slots[this.current].ammo = value; },
  get reserve() { return this.slots[this.current].reserve; },
  set reserve(value) { this.slots[this.current].reserve = value; },
};

/** Miltiq va uni ushlab turgan qo'llar (-Z tomonga qaraydi). */
function rifleGeometry() {
  const wood = '#70452a', woodDark = '#54321d', metal = '#2b2d31', steel = '#44474d';
  const sleeve = '#4b5a38', glove = '#3a2b20';
  return merge(
    box(0.06, 0.1, 0.34, wood, [0, -0.045, 0.3]),
    box(0.065, 0.15, 0.1, woodDark, [0, -0.07, 0.5]),
    box(0.058, 0.07, 0.42, wood, [0, -0.01, -0.2]),
    box(0.062, 0.08, 0.32, metal, [0, 0.015, 0.02]),
    cylinder(0.015, 0.02, 0.72, metal, [0, 0.038, -0.5], [Math.PI / 2, 0, 0], 8),
    box(0.012, 0.03, 0.02, steel, [0, 0.066, -0.84]),
    box(0.03, 0.022, 0.015, steel, [0, 0.066, -0.1]),
    cylinder(0.008, 0.008, 0.08, steel, [0.05, 0.03, 0.08], [0, 0, Math.PI / 2], 5),
    box(0.012, 0.04, 0.05, steel, [0, -0.06, 0.06]),
    // Chap qo'l miltiqni oldidan, o'ng qo'l tutqichidan ushlab turadi
    box(0.09, 0.05, 0.12, glove, [0, -0.05, -0.2]),
    cylinder(0.05, 0.06, 0.6, sleeve, [-0.14, -0.26, -0.03], [-0.85, 0, 0.5]),
    box(0.08, 0.08, 0.09, glove, [0.015, -0.08, 0.16]),
    cylinder(0.05, 0.06, 0.5, sleeve, [0.09, -0.28, 0.32], [-0.5, 0, -0.3]),
  );
}

/** Ikki stvolli ov miltig'i. */
function shotgunGeometry() {
  const wood = '#8a5a34', woodDark = '#5e3b22', metal = '#33353a', steel = '#54575e';
  const sleeve = '#4b5a38', glove = '#3a2b20';
  return merge(
    box(0.058, 0.1, 0.32, wood, [0, -0.045, 0.28]),
    box(0.064, 0.15, 0.1, woodDark, [0, -0.07, 0.47]),
    box(0.064, 0.085, 0.2, steel, [0, 0.008, 0.02]),
    box(0.058, 0.06, 0.28, wood, [0, -0.016, -0.2]),
    cylinder(0.017, 0.018, 0.62, metal, [-0.017, 0.04, -0.4], [Math.PI / 2, 0, 0], 8),
    cylinder(0.017, 0.018, 0.62, metal, [0.017, 0.04, -0.4], [Math.PI / 2, 0, 0], 8),
    box(0.01, 0.012, 0.02, steel, [0, 0.064, -0.68]),
    box(0.09, 0.05, 0.12, glove, [0, -0.05, -0.2]),
    cylinder(0.05, 0.06, 0.6, sleeve, [-0.14, -0.26, -0.03], [-0.85, 0, 0.5]),
    box(0.08, 0.08, 0.09, glove, [0.015, -0.08, 0.16]),
    cylinder(0.05, 0.06, 0.5, sleeve, [0.09, -0.28, 0.32], [-0.5, 0, -0.3]),
  );
}

/** Karabin, mergan miltig'i va katta kalibr uchun umumiy tuzilish. */
function longGunGeometry({ wood, woodDark, metal = '#2b2d31', steel = '#44474d', barrelLength, barrelRadius = 0.018, scope = false, clip = false }) {
  const sleeve = '#4b5a38', glove = '#3a2b20';
  const barrelCenter = -0.18 - barrelLength / 2;
  return merge(
    box(0.06, 0.1, 0.34, wood, [0, -0.045, 0.3]),
    box(0.065, 0.15, 0.1, woodDark, [0, -0.07, 0.5]),
    box(0.058, 0.07, 0.36, wood, [0, -0.01, -0.18]),
    box(0.062, 0.08, 0.32, metal, [0, 0.015, 0.02]),
    cylinder(barrelRadius * 0.85, barrelRadius, barrelLength, metal, [0, 0.038, barrelCenter], [Math.PI / 2, 0, 0], 8),
    box(0.012, 0.03, 0.02, steel, [0, 0.066, barrelCenter - barrelLength / 2 + 0.04]),
    box(0.012, 0.04, 0.05, steel, [0, -0.06, 0.06]),
    scope ? [
      cylinder(0.03, 0.03, 0.34, '#1a1b1e', [0, 0.1, 0], [Math.PI / 2, 0, 0], 10),
      cylinder(0.04, 0.03, 0.06, '#1a1b1e', [0, 0.1, -0.19], [Math.PI / 2, 0, 0], 10),
      box(0.02, 0.05, 0.03, steel, [0, 0.06, 0.08]),
      box(0.02, 0.05, 0.03, steel, [0, 0.06, -0.08]),
    ] : [],
    clip ? [box(0.04, 0.17, 0.08, metal, [0, -0.1, -0.04], [0.2, 0, 0])] : [],
    box(0.09, 0.05, 0.12, glove, [0, -0.05, -0.2]),
    cylinder(0.05, 0.06, 0.6, sleeve, [-0.14, -0.26, -0.03], [-0.85, 0, 0.5]),
    box(0.08, 0.08, 0.09, glove, [0.015, -0.08, 0.16]),
    cylinder(0.05, 0.06, 0.5, sleeve, [0.09, -0.28, 0.32], [-0.5, 0, -0.3]),
  );
}

/** Arbalet: yotiq kamon va qo'ndoq. */
function crossbowGeometry() {
  const wood = '#5e3b22', metal = '#33353a', cord = '#e6dfca', sleeve = '#4b5a38', glove = '#3a2b20';
  return merge(
    box(0.06, 0.09, 0.62, wood, [0, -0.02, 0.06]),
    box(0.065, 0.14, 0.1, wood, [0, -0.06, 0.4]),
    box(0.05, 0.03, 0.42, metal, [0, 0.03, -0.2]),
    box(0.62, 0.03, 0.05, metal, [0, 0.03, -0.38]),
    box(0.2, 0.025, 0.04, metal, [0.34, 0.03, -0.33], [0, 0.5, 0]),
    box(0.2, 0.025, 0.04, metal, [-0.34, 0.03, -0.33], [0, -0.5, 0]),
    cylinder(0.003, 0.003, 0.6, cord, [0.2, 0.03, -0.14], [Math.PI / 2, 0.75, 0], 4),
    cylinder(0.003, 0.003, 0.6, cord, [-0.2, 0.03, -0.14], [Math.PI / 2, -0.75, 0], 4),
    box(0.09, 0.05, 0.12, glove, [0, -0.05, -0.16]),
    cylinder(0.05, 0.06, 0.6, sleeve, [-0.14, -0.26, -0.01], [-0.85, 0, 0.5]),
    box(0.08, 0.08, 0.09, glove, [0.015, -0.08, 0.22]),
    cylinder(0.05, 0.06, 0.5, sleeve, [0.09, -0.28, 0.36], [-0.5, 0, -0.3]),
  );
}

/** Kamon: egilgan yelkalar, tortilgan ip va uni ushlab turgan qo'l. */
function bowGeometry() {
  const wood = '#6d4426', grip = '#2d2019', cord = '#e6dfca', sleeve = '#4b5a38', glove = '#3a2b20';
  const stringTop = [0, 0.3, 0.2], stringBottom = [0, -0.3, 0.2];
  return merge(
    limb([
      [-0.58, 0.2, 0.012, 0.02], [-0.4, 0.03, 0.018, 0.03], [-0.12, -0.05, 0.022, 0.04],
      [0.12, -0.05, 0.022, 0.04], [0.4, 0.03, 0.018, 0.03], [0.58, 0.2, 0.012, 0.02],
    ], { top: wood, steps: 4, mottle: 0.02 }),
    cylinder(0.03, 0.03, 0.14, grip, [0, 0, -0.05], [0, 0, 0], 8),
    cylinder(0.004, 0.004, 0.62, cord, stringTop, [0.28, 0, 0], 4),
    cylinder(0.004, 0.004, 0.62, cord, stringBottom, [-0.28, 0, 0], 4),
    box(0.075, 0.09, 0.08, glove, [0, 0, -0.05]),
    cylinder(0.05, 0.06, 0.8, sleeve, [-0.1, -0.26, 0.22], [-0.87, 0, -0.25]),
  );
}

/** O'q (kamon uchun): uchi +Z tomonga qaraydi. */
function arrowGeometry() {
  return merge(
    cylinder(0.006, 0.006, 0.7, '#c8b48c', [0, 0, 0], [Math.PI / 2, 0, 0], 5),
    cone(0.014, 0.05, '#55585e', [0, 0, 0.37], [Math.PI / 2, 0, 0], 5),
    box(0.002, 0.04, 0.09, '#b23a2a', [0, 0, -0.3]),
    box(0.04, 0.002, 0.09, '#b23a2a', [0, 0, -0.3]),
  );
}

// Qurollar bitta guruh ichida: guruh qo'l harakatini beradi, ichida faqat tanlangani ko'rinadi
const viewModel = new THREE.Group();
viewModel.visible = false;
weaponScene.add(viewModel);

const weaponMeshes = {};
const weaponShapes = {
  rifle: rifleGeometry(),
  shotgun: shotgunGeometry(),
  bow: bowGeometry(),
  carbine: longGunGeometry({ wood: '#4a4f45', woodDark: '#35392f', barrelLength: 0.48, clip: true }),
  sniper: longGunGeometry({ wood: '#5b3b24', woodDark: '#3f2816', barrelLength: 0.92, barrelRadius: 0.02, scope: true }),
  crossbow: crossbowGeometry(),
  magnum: longGunGeometry({ wood: '#7a4f2c', woodDark: '#573518', barrelLength: 0.76, barrelRadius: 0.028 }),
};
for (const [id, geometry] of Object.entries(weaponShapes)) {
  weaponMeshes[id] = new THREE.Mesh(geometry, gearMaterial);
  weaponMeshes[id].visible = false;
  viewModel.add(weaponMeshes[id]);
}

const arrowShape = arrowGeometry();
const nockedArrow = new THREE.Mesh(arrowShape, gearMaterial);
nockedArrow.position.set(0, 0, 0.02);
nockedArrow.rotation.y = Math.PI; // kamonda uchi oldinga (-Z) qaraydi
weaponMeshes.bow.add(nockedArrow);

/** Yumaloq yorug'lik dog'i: og'iz olovi uchun kod bilan chiziladi. */
function createFlashTexture() {
  const paper = document.createElement('canvas');
  paper.width = paper.height = 128;
  const pen = paper.getContext('2d');
  const glow = pen.createRadialGradient(64, 64, 2, 64, 64, 62);
  glow.addColorStop(0, 'rgba(255,250,220,1)');
  glow.addColorStop(0.25, 'rgba(255,200,90,.9)');
  glow.addColorStop(1, 'rgba(255,120,20,0)');
  pen.fillStyle = glow;
  pen.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(paper);
}

const muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createFlashTexture(),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
}));
muzzleFlash.visible = false;
viewModel.add(muzzleFlash);

// O'q uzganda atrofni bir lahza yoritadi. Doim sahnada turadi, aks holda shader qayta kompilyatsiya bo'ladi.
const muzzleLight = new THREE.PointLight('#ffc27a', 0, 28, 2);
scene.add(muzzleLight);

/** Raund boshida har bir qurol o'qlar bilan to'ldiriladi. */
function stockWeapons() {
  const pouch = isEquipped('ammoPouch') ? 1.5 : 1;
  weapon.stats = Object.fromEntries(WEAPON_ORDER.map((id) => [id, gunStats(id)]));
  weapon.slots = Object.fromEntries(Object.entries(weapon.stats).map(([id, gun]) => (
    [id, { ammo: gun.magazine, reserve: Math.round(gun.reserve * pouch) }]
  )));
  const custom = game.mode === 'mission' ? game.activeMission.ammo : null;
  for (const [id, [ammo, reserve]] of Object.entries(custom ?? {})) weapon.slots[id] = { ammo, reserve };
  equipWeapon(availableWeapons()[0]);
}

/** Hozir ishlatish mumkin bo'lgan qurollar: missiya cheklashi yoki sotib olinganlar. */
function availableWeapons() {
  const allowed = game.mode === 'mission' ? game.activeMission.weapons : null;
  return allowed ?? Object.keys(WEAPONS).filter((id) => id === 'rifle' || owns(id));
}

function equipWeapon(id) {
  weapon.current = id;
  weapon.reloadLeft = 0;
  weapon.cooldown = 0.25;
  weapon.swapLift = 1;
  ui.reloadBar.classList.remove('active');
  for (const [meshId, mesh] of Object.entries(weaponMeshes)) mesh.visible = meshId === id;
  if (weapon.gun.muzzle) muzzleFlash.position.set(...weapon.gun.muzzle);
  updateAmmoHud();
}

/** 1, 2, 3 tugmalari: faqat sotib olingan qurolga o'tadi. */
function trySwitchWeapon(id) {
  if (id === weapon.current || !availableWeapons().includes(id)) return;
  sound.dryFire();
  equipWeapon(id);
}

const raycaster = new THREE.Raycaster();

/** Nur yerga yoki suv yuzasiga qaysi masofada tegishini bosqichma-bosqich tekshiradi. */
function rayToGround(origin, direction, maxDistance) {
  for (let t = 1; t < maxDistance; t += 1) {
    const x = origin.x + direction.x * t, z = origin.z + direction.z * t;
    const y = origin.y + direction.y * t;
    if (y < WATER_LEVEL || y < terrainHeight(x, z)) return t;
  }
  return Infinity;
}

/** Nur daraxt tanasi yoki toshga qayerda tegishini topadi (tepadan qaraganda doira bilan kesishish). */
function rayToObstacle(origin, direction, maxDistance) {
  const planar = direction.x * direction.x + direction.z * direction.z;
  if (planar < 1e-6) return Infinity;

  let nearest = Infinity;
  const checked = new Set();
  for (let t = 0; t < Math.min(maxDistance, nearest); t += GRID_CELL / 2) {
    for (const o of cellAt(origin.x + direction.x * t, origin.z + direction.z * t)) {
      if (checked.has(o)) continue;
      checked.add(o);
      const ox = o.x - origin.x, oz = o.z - origin.z;
      const along = ox * direction.x + oz * direction.z;
      const discriminant = along * along - planar * (ox * ox + oz * oz - o.radius * o.radius);
      if (discriminant < 0) continue;
      const hit = (along - Math.sqrt(discriminant)) / planar;
      if (hit > 0 && hit < nearest && origin.y + direction.y * hit < o.top) nearest = hit;
    }
  }
  return nearest;
}

const liveHitBoxes = () => animals.filter((a) => a.alive && a.root.visible).flatMap((a) => a.hitBoxes);

/** Jamoa jangida raqib ovchilar ham nishon. */
const enemyHitBoxes = () => (game.activeMission?.pvp
  ? hunters.filter((h) => h.hitBoxes && !h.down && !sameTeam(h.id, myRosterId())).flatMap((h) => h.hitBoxes)
  : []);
const shotTargets = () => [...liveHitBoxes(), ...enemyHitBoxes()];

/** Tarqalish: yo'nalishga kichik tasodifiy og'ish qo'shadi. */
function scatterDirection(direction, spread) {
  return direction.clone().add(position3(randRange(-spread, spread), randRange(-spread, spread), randRange(-spread, spread))).normalize();
}

/** Daraxt, yer yoki suvga tekkan o'q izi. */
function showImpact(point, hitsTree) {
  const hitsWater = !hitsTree && point.y < WATER_LEVEL + 0.5 && waterDepth(point.x, point.z) > 0;
  if (hitsWater) {
    point.y = WATER_LEVEL;
    burst(point, '#dcebf0', 14, 3);
    if (!conditions.frozen) sound.splash();
  } else {
    burst(point, hitsTree ? '#6b4a2e' : '#6f6a45', 8, 2.5);
  }
}

/** Nishonga tekkan zarba: hayvon yoki raqib ovchi. Qarorni xost qiladi. */
function registerHit(target, part, power, point) {
  burst(point, '#7a1f14', 12, 3.5);
  sound.impact();
  ui.hitMarker.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
  if (!target.spec) sendToHost({ t: 'hitHunter', id: target.id, part, power });
  else if (network.isClient) sendToHost({ t: 'hit', id: target.id, part, power });
  else applyHit(target, part, power, network.roster.get(HOST_ID));
}

/** Zarbani hayvonga qo'llaydi: yakka o'yinda shu yerda, birga o'ynaganda xostda. */
function applyHit(animal, part, power, shooter) {
  const mission = game.activeMission;
  if (mission?.onHit?.(animal, part, shooter)) return;

  // Missiya shartlari uchun hayvon o'q tekkan paytda nima qilayotgani eslab qolinadi
  const moment = {
    headshot: part === 'head',
    unaware: animal.state === 'graze' || animal.state === 'walk',
    airborne: animal.state === 'fly',
    shooter,
  };
  mission?.annotate?.(moment, animal);
  const finalPower = mission?.adjustPower?.(animal, power, shooter) ?? power;
  if (animal.takeHit(part, finalPower)) onAnimalKilled(animal, moment);
}

/** O'q ovozi berilgan masofadagi hayvonlarni cho'chitadi. */
function alarmAnimals(x, z, radius) {
  for (const animal of animals) {
    const inRange = Math.hypot(animal.pos.x - x, animal.pos.z - z) < radius;
    if (inRange && animal.alive && animal.spawned && !animal.dormant) animal.startle();
  }
}

/** Bitta o'q yo'lini kuzatadi. Hayvonga tekkan bo'lsa, natija struck ro'yxatiga yoziladi. */
function traceShot(origin, direction, range, targets, struck) {
  const obstacleAt = rayToObstacle(origin, direction, range);
  const groundAt = rayToGround(origin, direction, range);
  raycaster.set(origin, direction);
  raycaster.far = Math.min(range, obstacleAt, groundAt);
  const [hit] = raycaster.intersectObjects(targets, false);

  if (hit) {
    const { part } = hit.object.userData;
    const target = hit.object.userData.animal ?? hit.object.userData.hunter;
    const record = struck.get(target) ?? { count: 0, part: 'body', point: hit.point };
    record.count++;
    if (part === 'head') record.part = 'head';
    struck.set(target, record);
  } else if (Math.min(obstacleAt, groundAt) < range) {
    showImpact(origin.clone().addScaledVector(direction, Math.min(obstacleAt, groundAt)), obstacleAt < groundAt);
  }
}

function fire() {
  const { gun } = weapon;
  weapon.ammo--;
  weapon.cooldown = gun.fireDelay;
  weapon.kick = gun.kick;
  weapon.flashLeft = gun.muzzle ? 0.05 : 0;
  player.recoil += gun.recoil * lerp(1, 0.62, player.aim);
  game.shots++;
  sound[gun.sound]();
  updateAmmoHud();

  // O'q yo'nalishi: mo'ljalga olinmagan bo'lsa va yurib otsa, tarqalish kattaroq
  camera.updateMatrixWorld();
  const origin = camera.position.clone();
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const moveFactor = 1 + Math.hypot(player.velocity.x, player.velocity.z) / CONFIG.player.walkSpeed;
  const spread = lerp(gun.spread * moveFactor, gun.aimSpread ?? 0, player.aim);

  if (gun.arrowSpeed) {
    launchArrow(origin, scatterDirection(direction, spread), gun);
    return;
  }

  const targets = shotTargets();
  const struck = new Map();
  for (let pellet = 0; pellet < (gun.pellets ?? 1); pellet++) {
    traceShot(origin, scatterDirection(direction, spread), gun.range, targets, struck);
  }
  if (struck.size) game.hits++;
  // Sochma o'qda har uchta tekkan mayda o'q bir zarbaga teng
  for (const [target, { count, part, point }] of struck) {
    registerHit(target, part, Math.max(1, Math.round(count / 3)) * gun.power, point);
  }

  // O'q ovozi atrofdagi hayvonlarni cho'chitadi. Guldurak paytida ovoz bosilib ketadi.
  const alarmRadius = gun.alarmRadius * (storm.thunderLeft > 0 ? 0.35 : 1);
  if (network.active) sendToHost({ t: 'shot', radius: alarmRadius });
  else alarmAnimals(player.pos.x, player.pos.z, alarmRadius);
}

/* Kamon o'qlari: sekin uchadi, shuning uchun har kadrda yo'lini tekshiramiz */

const ARROW_GRAVITY = 9;
const arrows = Array.from({ length: 8 }, () => {
  const mesh = new THREE.Mesh(arrowShape, gearMaterial);
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, velocity: new THREE.Vector3(), flying: false, stuckFor: 0 };
});

function launchArrow(origin, direction, gun) {
  const arrow = arrows.find((candidate) => !candidate.flying && !candidate.mesh.visible) ?? arrows[0];
  arrow.mesh.position.copy(origin).addScaledVector(direction, 0.5);
  arrow.velocity.copy(direction).multiplyScalar(gun.arrowSpeed);
  arrow.power = gun.power;
  arrow.flying = true;
  arrow.mesh.visible = true;
}

function stopArrow(arrow, stayFor) {
  arrow.flying = false;
  arrow.stuckFor = stayFor;
  arrow.mesh.visible = stayFor > 0;
}

function updateArrows(dt) {
  const direction = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  for (const arrow of arrows) {
    if (!arrow.mesh.visible) continue;
    if (!arrow.flying) {
      arrow.stuckFor -= dt;
      if (arrow.stuckFor <= 0) arrow.mesh.visible = false;
      continue;
    }

    const { position } = arrow.mesh;
    arrow.velocity.y -= ARROW_GRAVITY * dt;
    const step = arrow.velocity.length() * dt;
    direction.copy(arrow.velocity).normalize();

    // Shu kadrda bosib o'tiladigan kesmada biror narsa bormi
    const obstacleAt = rayToObstacle(position, direction, step);
    raycaster.set(position, direction);
    raycaster.far = Math.min(step, obstacleAt);
    const [hit] = raycaster.intersectObjects(shotTargets(), false);

    if (hit) {
      const { animal, hunter, part } = hit.object.userData;
      game.hits++;
      registerHit(animal ?? hunter, part, arrow.power, hit.point);
      stopArrow(arrow, 0);
      continue;
    }

    position.addScaledVector(direction, Math.min(step, obstacleAt));
    lookTarget.copy(position).add(arrow.velocity);
    arrow.mesh.lookAt(lookTarget);

    const groundLevel = Math.max(terrainHeight(position.x, position.z), WATER_LEVEL);
    if (obstacleAt < step) {
      showImpact(position.clone(), true);
      stopArrow(arrow, 8);
    } else if (position.y < groundLevel) {
      position.y = groundLevel;
      showImpact(position.clone(), false);
      stopArrow(arrow, position.y > WATER_LEVEL ? 8 : 0);
    } else if (position.distanceTo(player.pos) > weapon.gun.range + 60) {
      stopArrow(arrow, 0);
    }
  }
}

function startReload() {
  const { gun } = weapon;
  if (weapon.reloadLeft > 0 || weapon.ammo === gun.magazine || weapon.reserve === 0) return;
  weapon.reloadLeft = gun.reloadTime;
  ui.reloadBar.classList.add('active');
  sound.reload(gun.reloadTime);
}

function updateWeapon(dt) {
  const { gun } = weapon;
  const unarmed = player.down || ROLE_INFO[game.myRole]?.unarmed;
  if (fishing.state !== 'idle') input.fire = false;
  viewModel.visible = !unarmed;
  if (unarmed) input.fire = false;
  weapon.cooldown = Math.max(0, weapon.cooldown - dt);

  if (input.fire) {
    input.fire = false;
    if (weapon.reloadLeft <= 0 && weapon.cooldown <= 0 && !input.scoping) {
      if (weapon.ammo > 0) fire();
      else sound.dryFire();
    }
  }

  let reloadLift = 0;
  if (weapon.reloadLeft > 0) {
    weapon.reloadLeft -= dt;
    const progress = 1 - Math.max(weapon.reloadLeft, 0) / gun.reloadTime;
    ui.reloadFill.style.transform = `scaleX(${progress})`;
    reloadLift = Math.sin(progress * Math.PI);
    if (weapon.reloadLeft <= 0) {
      const taken = Math.min(gun.magazine - weapon.ammo, weapon.reserve);
      weapon.ammo += taken;
      weapon.reserve -= taken;
      ui.reloadBar.classList.remove('active');
      updateAmmoHud();
    }
  }

  // Qurol holati: mo'ljal, sichqonchaga kechikib ergashish, tepki va qadam tebranishi
  weapon.kick = damp(weapon.kick, 0, 11, dt);
  weapon.swapLift = damp(weapon.swapLift, 0, 9, dt);
  weapon.swayX = damp(weapon.swayX, clamp(-input.lookX * 0.0006, -0.04, 0.04), 9, dt);
  weapon.swayY = damp(weapon.swayY, clamp(input.lookY * 0.0006, -0.04, 0.04), 9, dt);
  input.lookX = input.lookY = 0;

  const relaxed = 1 - player.aim;
  viewModel.position.lerpVectors(gun.hip, gun.aim, player.aim);
  viewModel.position.x += weapon.swayX * relaxed + Math.cos(player.stepPhase) * 0.008 * relaxed;
  viewModel.position.y += weapon.swayY * relaxed - Math.abs(Math.sin(player.stepPhase)) * 0.01 * relaxed
    - reloadLift * 0.2 - weapon.swapLift * 0.35 - player.scope * 0.5;
  viewModel.position.z += weapon.kick * 0.11;
  viewModel.rotation.set(weapon.kick * 0.09 + reloadLift * 0.7, relaxed * 0.05, reloadLift * 0.5);
  if (weapon.current === 'bow') viewModel.rotation.z += relaxed * -0.32;
  nockedArrow.visible = weapon.ammo > 0;

  // Optik nishon: mo'ljalga olganda qurol o'rniga nishon doirasi ko'rinadi
  const scoped = Boolean(gun.aimFov) && player.aim > 0.85 && viewModel.visible;
  ui.opticScope.hidden = !scoped;
  ui.crosshair.hidden = scoped;
  if (scoped) viewModel.visible = false;

  weapon.flashLeft -= dt;
  const flashing = weapon.flashLeft > 0;
  muzzleFlash.visible = flashing;
  if (flashing) {
    muzzleFlash.scale.setScalar(randRange(0.28, 0.42));
    muzzleFlash.material.rotation = Math.random() * TAU;
  }
  muzzleLight.position.copy(camera.position);
  muzzleLight.intensity = flashing ? 60 : 0;
}
