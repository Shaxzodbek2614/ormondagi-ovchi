'use strict';

/* ==========================================================================
   MINORA VA TUZOQ
   Birga o'ynaganda ro'yxatni xost yuritadi va hammaga tarqatadi.
   ========================================================================== */

const TOWER_HEIGHT = 5.2;
const TRAP_RANGE = 1.5;
const TRAP_HOLD = { normal: 8, big: 4 };

const placeables = new Map(); // id -> { id, kind, x, z, mesh }
let nextPlaceableId = 1;
let trapClock = 0;

function towerGeometry() {
  const wood = '#6d4a2c', plank = '#8a6238';
  const post = (x, z) => cylinder(0.09, 0.12, TOWER_HEIGHT, wood, [x, TOWER_HEIGHT / 2, z], [0, 0, 0], 6);
  const rail = (x, z, w, d) => box(w, 0.08, d, wood, [x, TOWER_HEIGHT + 0.9, z]);
  const rungs = [];
  for (let y = 0.5; y < TOWER_HEIGHT; y += 0.55) rungs.push(box(0.6, 0.05, 0.06, plank, [0, y, 1.08]));
  return merge(
    post(-0.95, -0.95), post(0.95, -0.95), post(-0.95, 0.95), post(0.95, 0.95),
    box(2.3, 0.1, 2.3, plank, [0, TOWER_HEIGHT, 0]),
    rail(0, -1.1, 2.3, 0.08), rail(0, 1.1, 2.3, 0.08), rail(-1.1, 0, 0.08, 2.3), rail(1.1, 0, 0.08, 2.3),
    rungs,
  );
}

function trapGeometry() {
  const teeth = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU;
    teeth.push(cone(0.05, 0.16, '#6b6f75', [Math.cos(angle) * 0.42, 0.1, Math.sin(angle) * 0.42], [0, 0, 0], 4));
  }
  return merge(
    cylinder(0.5, 0.5, 0.05, '#3a3d42', [0, 0.03, 0], [0, 0, 0], 14),
    cylinder(0.3, 0.3, 0.06, '#7a5a34', [0, 0.05, 0], [0, 0, 0], 12),
    teeth,
  );
}

const placeableShapes = { tower: towerGeometry(), trap: trapGeometry() };

function showPlaceable({ id, kind, x, z }) {
  const mesh = new THREE.Mesh(placeableShapes[kind], gearMaterial);
  mesh.position.set(x, terrainHeight(x, z), z);
  mesh.castShadow = true;
  scene.add(mesh);
  placeables.set(id, { id, kind, x, z, mesh });
}

function hidePlaceable(id) {
  const item = placeables.get(id);
  if (!item) return;
  scene.remove(item.mesh);
  placeables.delete(id);
}

function clearPlaceables() {
  for (const id of [...placeables.keys()]) hidePlaceable(id);
}

/** Xost yoki yakka o'yin: narsani joylaydi va sheriklarga xabar beradi. */
function buildPlaceable(kind, x, z) {
  const item = { id: nextPlaceableId++, kind, x, z };
  showPlaceable(item);
  if (network.isHost) broadcast({ t: 'built', ...item });
}

function requestBuild(kind, x, z) {
  if (network.isClient) sendToHost({ t: 'build', kind, x, z });
  else buildPlaceable(kind, x, z);
}

/** Y tugmasi: minoraga chiqish, tushish yoki yangisini qurish. */
function useTower() {
  if (player.onTower) {
    player.onTower = null;
    return;
  }
  const nearby = [...placeables.values()].find((item) => item.kind === 'tower'
    && Math.hypot(item.x - player.pos.x, item.z - player.pos.z) < 3.5);
  if (nearby) {
    player.onTower = { x: nearby.x, z: nearby.z };
  } else if (isEquipped('tower') && !game.towerBuilt) {
    game.towerBuilt = true;
    requestBuild('tower', player.pos.x, player.pos.z);
    player.onTower = { x: player.pos.x, z: player.pos.z };
    showPopup('Minora qurildi');
  }
}

/** U tugmasi: oldingizga tuzoq qo'yadi. */
function useTrap() {
  if (!isEquipped('trap') || player.onTower) return;
  profile.traps--;
  saveProfile();
  updateMedkitHud();
  const x = player.pos.x - Math.sin(player.yaw) * 1.6, z = player.pos.z - Math.cos(player.yaw) * 1.6;
  requestBuild('trap', x, z);
  showPopup('Tuzoq qo‘yildi');
}

/** Xost: tuzoq ustidan o'tgan hayvonni ushlaydi. Tuzoq bir marta ishlaydi. */
function updateTraps(dt) {
  if (network.isClient) return;
  trapClock -= dt;
  if (trapClock > 0) return;
  trapClock = 0.1;

  for (const trap of placeables.values()) {
    if (trap.kind !== 'trap') continue;
    const prey = animals.find((animal) => animal.alive && animal.spawned && !animal.dormant
      && !animal.spec.warmOnly && animal.state !== 'trapped'
      && Math.hypot(animal.pos.x - trap.x, animal.pos.z - trap.z) < TRAP_RANGE);
    if (!prey) continue;
    prey.setState('trapped', prey.spec.rears ? TRAP_HOLD.big : TRAP_HOLD.normal);
    prey.speed = 0;
    hidePlaceable(trap.id);
    if (network.isHost) broadcast({ t: 'unbuilt', id: trap.id });
    showPopup(`${prey.spec.name} tuzoqqa tushdi`);
  }
}
