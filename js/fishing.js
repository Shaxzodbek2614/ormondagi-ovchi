'use strict';

/* ==========================================================================
   BALIQ OVI
   Yozda qirg'oqdan qarmoq tashlanadi, qishda avval muz teshiladi. Baliq tortganda
   T tugmasini o'z vaqtida bosish kerak. Harakat qilsangiz, baliq ovi to'xtaydi.
   ========================================================================== */

const FISHING = { drillTime: 2, biteWindow: 1.2, wait: [3, 9], holes: 8 };

// idle: qarmoq yo'q, drilling: muz teshilmoqda, waiting: baliq kutilmoqda, bite: baliq tortdi
const fishing = { state: 'idle', timer: 0, progress: 0, spot: null };

/* Ko'rinish: qo'ldagi qarmoq, po'kak va muzdagi teshiklar */

const rodMesh = new THREE.Mesh(merge(
  cylinder(0.006, 0.016, 1.7, '#6d4426', [-0.12, 0.42, -0.72], [0.9, 0, 0.12], 6),
  cylinder(0.03, 0.03, 0.05, '#2b2d31', [-0.04, -0.08, -0.08], [0, 0, Math.PI / 2], 8),
  box(0.08, 0.08, 0.1, '#3a2b20', [-0.02, -0.14, -0.06]),
), gearMaterial);
rodMesh.visible = false;
viewModel.add(rodMesh);

const bobber = new THREE.Mesh(merge(
  blob(0.06, '#d8412e', [0, 0.04, 0]),
  blob(0.05, '#f5f0e6', [0, 0.1, 0]),
), gearMaterial);
bobber.visible = false;
scene.add(bobber);

const iceHoles = Array.from({ length: FISHING.holes }, () => {
  const hole = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), new THREE.MeshBasicMaterial({ color: '#0d1f29' }));
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 14), new THREE.MeshBasicMaterial({ color: '#e6eef2' }));
  water.rotation.x = rim.rotation.x = -Math.PI / 2;
  hole.add(water, rim);
  hole.visible = false;
  scene.add(hole);
  return hole;
});
let nextIceHole = 0;

function makeIceHole({ x, z }) {
  const hole = iceHoles[nextIceHole];
  nextIceHole = (nextIceHole + 1) % iceHoles.length;
  hole.position.set(x, WATER_LEVEL + 0.04, z);
  hole.visible = true;
}

/* Mantiq */

/** O'yinchi hozir qayerga qarmoq tashlay oladi. Suv bo'lmasa null qaytaradi. */
function fishingSpot() {
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const reach = conditions.frozen ? [1.2] : [4, 7];
  for (const distance of reach) {
    const x = player.pos.x - sin * distance, z = player.pos.z - cos * distance;
    if (waterDepth(x, z) > 0.5) return { x, z };
  }
  return null;
}

function startWaiting() {
  fishing.state = 'waiting';
  fishing.timer = randRange(...FISHING.wait);
}

function stopFishing() {
  fishing.state = 'idle';
  fishing.progress = 0;
  fishing.spot = null;
  bobber.visible = false;
}

function resetFishing() {
  stopFishing();
  for (const hole of iceHoles) hole.visible = false;
}

/** Baliq tutildi: hisob xostda yuritiladi. */
function catchFish() {
  sound.splash();
  sound.chime();
  burst(bobber.position, '#dcebf0', 10, 2.5);
  if (network.isClient) sendToHost({ t: 'catch' });
  else recordCatch(network.roster.get(HOST_ID));
  startWaiting();
}

/** Tutilgan baliqni oddiy ov kabi hisoblaymiz: topshiriqlar va ochko bir xil ishlaydi. */
function recordCatch(shooter) {
  onAnimalKilled({ spec: SPECIES.fish, kind: 'fish' }, { headshot: false, shooter });
}

/** T tugmasi bosildi. */
function pressFishKey() {
  if (fishing.state === 'bite') {
    catchFish();
  } else if (fishing.state === 'waiting') {
    stopFishing();
  } else if (fishing.state === 'idle' && !player.down && !player.onTower) {
    const spot = fishingSpot();
    if (!spot) return;
    fishing.spot = spot;
    if (conditions.frozen) {
      fishing.state = 'drilling';
      fishing.progress = 0;
    } else {
      sound.splash();
      startWaiting();
    }
  }
}

function updateFishing(dt) {
  const active = fishing.state !== 'idle';
  rodMesh.visible = active && fishing.state !== 'drilling';
  weaponMeshes[weapon.current].visible = !active;
  if (!active) return;

  // Yurish, yiqilish qarmoqni to'xtatadi
  if (player.down || Math.hypot(player.velocity.x, player.velocity.z) > 1.2) {
    stopFishing();
    return;
  }

  if (fishing.state === 'drilling') {
    if (!input.keys.KeyT) {
      stopFishing();
      return;
    }
    fishing.progress += dt;
    if (fishing.progress >= FISHING.drillTime) {
      makeIceHole(fishing.spot);
      sound.splash();
      startWaiting();
    }
    return;
  }

  fishing.timer -= dt;
  if (fishing.state === 'waiting' && fishing.timer <= 0) {
    fishing.state = 'bite';
    fishing.timer = FISHING.biteWindow;
    sound.splash();
    burst(bobber.position, '#dcebf0', 5, 1.4);
  } else if (fishing.state === 'bite' && fishing.timer <= 0) {
    showPopup('Baliq ketib qoldi');
    startWaiting();
  }

  // Po'kak suvda tebranib turadi, baliq tortganda cho'kadi
  const sink = fishing.state === 'bite' ? -0.12 : Math.sin(elapsed * 3) * 0.015;
  bobber.visible = true;
  bobber.position.set(fishing.spot.x, WATER_LEVEL + sink, fishing.spot.z);
}

/** Pastdagi yozuv: baliq ovi holati. */
function fishingHint() {
  if (fishing.state === 'drilling') return `Muz teshilmoqda: ${Math.round((fishing.progress / FISHING.drillTime) * 100)}%`;
  if (fishing.state === 'waiting') return 'Baliq kutilmoqda. To‘xtatish: T';
  if (fishing.state === 'bite') return 'Hozir! T tugmasini bosing';
  return null;
}

function fishingOffer() {
  if (!fishingSpot()) return null;
  return conditions.frozen ? 'T tugmasini bosib turing: muzni teshish' : 'T: qarmoq tashlash';
}
