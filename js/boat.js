'use strict';

/* ==========================================================================
   QAYIQ: ko'l bo'yidagi va daryodagi ko'prikchalardan qayiqqa tushiladi
   Har o'yinchining qayig'i o'ziniki: tarmoqda faqat "qayiqda" belgisi yuboriladi.
   Ko'prikchalar dunyo qurilgandan keyin tasodifsiz hisoblanadi, urug'ga ta'sir qilmaydi.
   ========================================================================== */

const BOAT = {
  maxSpeed: 4,       // m/s, eshkak bilan
  turnRate: 1.3,     // rad/s
  draft: 0.35,       // shundan sayoz suvda qayiq to'xtaydi
  eyeHeight: 1.15,   // suv sathidan o'tirgan ovchining ko'zigacha
  dockRange: 4,      // ko'prikchaga shuncha yaqin bo'lsa, E bilan tushiladi
  landRange: 4.5,    // qirg'oq shuncha yaqin bo'lsa, E bilan chiqiladi
};

const docks = []; // { land, water, yaw, idle }
const boat = { heading: 0, speed: 0, dock: null, strokePhase: 0 };

/* Shakllar: qayiq tumshug'i -Z tomonda, ko'prikcha quruqlikdan suvga -Z bo'ylab ketadi */

function boatGeometry() {
  const wood = '#7a5230', dark = '#4f3520';
  return merge(
    box(0.9, 0.1, 2.5, dark, [0, 0.05, 0.1]),
    box(0.08, 0.34, 2.5, wood, [-0.48, 0.2, 0.1]),
    box(0.08, 0.34, 2.5, wood, [0.48, 0.2, 0.1]),
    box(1.04, 0.34, 0.08, wood, [0, 0.2, 1.35]),
    cone(0.53, 0.9, wood, [0, 0.2, -1.6], [-Math.PI / 2, Math.PI / 4, 0], 4),
    box(0.9, 0.05, 0.26, dark, [0, 0.3, 0.55]),
    box(0.9, 0.05, 0.26, dark, [0, 0.3, -0.45]),
    cylinder(0.025, 0.025, 2.2, '#9a7046', [0, 0.38, 0.05], [0, 0, Math.PI / 2 - 0.25], 5),
  );
}

function dockGeometry() {
  const planks = [];
  for (let z = 1.2; z > -3.4; z -= 0.42) planks.push(box(1.3, 0.07, 0.36, z > 0 ? '#86613b' : '#7a5733', [0, 0, z]));
  const post = (x, z) => cylinder(0.07, 0.08, 1.6, '#4e3825', [x, -0.75, z], [0, 0, 0], 5);
  return merge(planks, post(-0.6, -1), post(0.6, -1), post(-0.6, -3.2), post(0.6, -3.2));
}

const boatShape = boatGeometry();
const dockShape = dockGeometry();
const playerBoat = new THREE.Mesh(boatShape, gearMaterial);
playerBoat.castShadow = true;
playerBoat.visible = false;
scene.add(playerBoat);

/* Ko'prikchalar */

/** Ko'l markazidan har tomonga qirg'oqqa qarab yuriladi. Boshlang'ich nuqtaga yaqin qulay qirg'oq tanlanadi. */
function findLakeDock(lake) {
  let best = null;
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * TAU, dx = Math.cos(angle), dz = Math.sin(angle);
    let shore = null;
    for (let r = 2; r < lake.radius * 1.7 + 10 && !shore; r += 0.5) {
      if (isDryLand(lake.x + dx * r, lake.z + dz * r)) shore = { x: lake.x + dx * r, z: lake.z + dz * r };
    }
    const dock = shore && makeDock(shore, dx, dz);
    if (dock && (!best || Math.hypot(dock.land.x, dock.land.z) < Math.hypot(best.land.x, best.land.z))) best = dock;
  }
  return best;
}

/** Qirg'oq nuqtasi va suvdan tashqariga qaragan yo'nalishdan ko'prikcha yasaydi. Joy yaroqsiz bo'lsa, null. */
function makeDock(shore, outX, outZ) {
  const land = { x: shore.x + outX * 1.5, z: shore.z + outZ * 1.5 };
  const water = { x: shore.x - outX * 6, z: shore.z - outZ * 6 };
  const inside = Math.hypot(land.x, land.z) < CONFIG.worldRadius - 10;
  if (!inside || waterDepth(water.x, water.z) < 0.6 || !isSpotFree(land.x, land.z, 0.8)) return null;
  return { land, water, shore, yaw: Math.atan2(outX, outZ) };
}

/** Daryoda ikkita ko'prikcha: chuqur joyda, o'tish joylaridan uzoqda. */
function findRiverDocks() {
  const found = [];
  for (let i = 1; i < riverPoints.length && found.length < 2; i++) {
    const point = riverPoints[i], previous = riverPoints[i - 1];
    const awayFromFords = fords.every((ford) => Math.hypot(ford.x - point.x, ford.z - point.z) > 30);
    const spaced = found.every((dock) => Math.hypot(dock.water.x - point.x, dock.water.z - point.z) > 90);
    if (Math.hypot(point.x, point.z) > CONFIG.worldRadius - 40 || !awayFromFords || !spaced || waterDepth(point.x, point.z) < 1.2) continue;
    const length = Math.hypot(point.x - previous.x, point.z - previous.z) || 1;
    // Daryoga ko'ndalang, markaz tomondagi qirg'oqqa
    let outX = -(point.z - previous.z) / length, outZ = (point.x - previous.x) / length;
    if (outX * point.x + outZ * point.z > 0) [outX, outZ] = [-outX, -outZ];
    let shore = null;
    for (let r = 1; r < 16 && !shore; r += 0.5) {
      if (isDryLand(point.x + outX * r, point.z + outZ * r)) shore = { x: point.x + outX * r, z: point.z + outZ * r };
    }
    const dock = shore && makeDock(shore, outX, outZ);
    if (dock) found.push(dock);
  }
  return found;
}

/** Dunyo qurilgandan keyin bir marta: ko'prikchalar va ular yonidagi bo'sh qayiqlar. */
function createDocks() {
  for (const dock of [...lakes.map(findLakeDock), ...findRiverDocks()]) {
    if (!dock) continue;
    const pier = new THREE.Mesh(dockShape, gearMaterial);
    pier.position.set(dock.shore.x, WATER_LEVEL + 0.45, dock.shore.z);
    pier.rotation.y = dock.yaw;
    pier.castShadow = true;
    scene.add(pier);
    dock.idle = new THREE.Mesh(boatShape, gearMaterial);
    dock.idle.position.set(dock.water.x, WATER_LEVEL - 0.08, dock.water.z);
    dock.idle.rotation.y = dock.yaw + 0.3;
    dock.idle.castShadow = true;
    scene.add(dock.idle);
    docks.push(dock);
  }
}

/** Qishda ko'l muzlaydi: qayiqlar ko'rinmaydi. */
function updateDockSeason() {
  for (const dock of docks) dock.idle.visible = !conditions.frozen && dock !== boat.dock;
}

/* Tushish va chiqish */

function nearestDock() {
  return docks.find((dock) => Math.hypot(dock.land.x - player.pos.x, dock.land.z - player.pos.z) < BOAT.dockRange
    || Math.hypot(dock.shore.x - player.pos.x, dock.shore.z - player.pos.z) < BOAT.dockRange) ?? null;
}

/** Qirg'oqqa chiqish uchun yaqin quruq joy. */
function landingSpot() {
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * TAU;
    for (const reach of [1.5, 3, BOAT.landRange]) {
      const x = player.pos.x + Math.cos(angle) * reach, z = player.pos.z + Math.sin(angle) * reach;
      if (isDryLand(x, z) && isSpotFree(x, z, 0.6)) return { x, z };
    }
  }
  return null;
}

/** E tugmasi: ko'prikcha yonida qayiqqa tushadi, qirg'oq yonida chiqadi. */
function toggleBoat() {
  if (player.inBoat) {
    const spot = landingSpot();
    if (spot) leaveBoat(spot);
    else showPopup('Qirg‘oqqa yaqinlashing');
    return;
  }
  const dock = nearestDock();
  if (!dock || player.onTower || player.down) return;
  if (conditions.frozen) {
    showPopup('Ko‘l muzlagan: qayiq yo‘q');
    return;
  }
  if (fishing.state !== 'idle') stopFishing();
  player.inBoat = true;
  player.crouching = false;
  boat.dock = dock;
  boat.heading = dock.yaw;
  boat.speed = 0;
  player.yaw = dock.yaw;
  player.pos.x = dock.water.x;
  player.pos.z = dock.water.z;
  player.velocity.set(0, 0, 0);
  dock.idle.visible = false;
  playerBoat.visible = true;
  dog.staying = true; // it qirg'oqda kutadi
  showPopup('Qayiqdasiz');
}

/** Qayiqdan chiqadi. spot berilmasa, faqat holat tozalanadi (raund boshi, lagerda turish). */
function leaveBoat(spot) {
  if (!player.inBoat) return;
  player.inBoat = false;
  playerBoat.visible = false;
  boat.speed = 0;
  if (boat.dock) boat.dock.idle.visible = !conditions.frozen;
  boat.dock = null;
  if (spot) {
    player.pos.x = spot.x;
    player.pos.z = spot.z;
  }
  player.velocity.set(0, 0, 0);
  if (dog.active) dog.staying = false;
}

/* Eshkak eshish: updatePlayer chaqiradi */

/** W/S oldinga va orqaga, A/D burilish. Qarash yo'nalishi qayiqdan alohida: yon tomonga ham otish mumkin. */
function rowBoat(dt, forward, strafe) {
  boat.heading -= strafe * BOAT.turnRate * dt;
  const wanted = forward * BOAT.maxSpeed * (forward < 0 ? 0.5 : 1);
  boat.speed = damp(boat.speed, wanted, forward ? 1.4 : 0.5, dt);

  const vx = -Math.sin(boat.heading) * boat.speed, vz = -Math.cos(boat.heading) * boat.speed;
  const nextX = player.pos.x + vx * dt, nextZ = player.pos.z + vz * dt;
  if (waterDepth(nextX, nextZ) >= BOAT.draft) {
    player.pos.x = nextX;
    player.pos.z = nextZ;
  } else {
    boat.speed *= -0.2; // qirg'oqqa urilib, biroz orqaga qaytadi
  }
  player.velocity.set(vx, 0, vz);

  const before = Math.floor(boat.strokePhase);
  boat.strokePhase += Math.abs(forward) * dt * 0.9;
  if (Math.floor(boat.strokePhase) !== before) sound.splash();
}

/** Qayiq tanasi va ko'z balandligi: suvda sekin chayqaladi. */
function placeBoat() {
  const sway = Math.sin(elapsed * 1.6) * 0.03;
  playerBoat.position.set(player.pos.x, WATER_LEVEL - 0.08 + sway, player.pos.z);
  playerBoat.rotation.set(Math.sin(elapsed * 1.1) * 0.02, boat.heading, Math.sin(elapsed * 1.3) * 0.03);
  return WATER_LEVEL + BOAT.eyeHeight + sway;
}

function boatHint() {
  if (player.inBoat) {
    return landingSpot() ? 'W/S eshkak, A/D burilish · E: qirg‘oqqa chiqish' : 'W/S eshkak, A/D burilish';
  }
  if (nearestDock() && !conditions.frozen) return 'E: qayiqqa tushish';
  return null;
}
