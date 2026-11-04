'use strict';

/* ==========================================================================
   EFFEKTLAR: zarrachalar va havodagi changlar
   ========================================================================== */

const MAX_PARTICLES = 160;
const particleMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial(),
  MAX_PARTICLES,
);
particleMesh.frustumCulled = false;
scene.add(particleMesh);

const particles = Array.from({ length: MAX_PARTICLES }, (_, index) => {
  particleMesh.setColorAt(index, new THREE.Color('#ffffff'));
  return { position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, size: 0 };
});
let nextParticle = 0;

/** O'q tekkan joydan zarrachalar sochadi. */
function burst(point, hexColor, count, speed) {
  const color = new THREE.Color(hexColor);
  for (let i = 0; i < count; i++) {
    const index = nextParticle;
    const particle = particles[index];
    nextParticle = (nextParticle + 1) % MAX_PARTICLES;
    particle.position.copy(point);
    particle.velocity.set(randRange(-1, 1), randRange(0.2, 1.4), randRange(-1, 1)).multiplyScalar(speed);
    particle.life = randRange(0.3, 0.7);
    particle.size = randRange(0.04, 0.11);
    particleMesh.setColorAt(index, color);
  }
  particleMesh.instanceColor.needsUpdate = true;
}

function updateParticles(dt) {
  const dummy = updateParticles.dummy;
  particles.forEach((particle, index) => {
    if (particle.life > 0) {
      particle.life -= dt;
      particle.velocity.y -= 9 * dt;
      particle.position.addScaledVector(particle.velocity, dt);
    }
    dummy.position.copy(particle.position);
    dummy.scale.setScalar(particle.life > 0 ? particle.size : 0);
    dummy.updateMatrix();
    particleMesh.setMatrixAt(index, dummy.matrix);
  });
  particleMesh.instanceMatrix.needsUpdate = true;
}
updateParticles.dummy = new THREE.Object3D();

// Quyosh nurida uchib yurgan mayda changlar: o'yinchi atrofida aylanib turadi
const MOTE_BOX = 36;
const motePositions = new Float32Array(260 * 3).map(() => randRange(0, MOTE_BOX));
const motes = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(motePositions, 3)),
  new THREE.PointsMaterial({ color: '#fff4cf', size: 0.07, transparent: true, opacity: 0.7, depthWrite: false }),
);
motes.frustumCulled = false;
scene.add(motes);

function updateMotes(dt, time) {
  const origin = camera.position;
  for (let i = 0; i < motePositions.length; i += 3) {
    motePositions[i] += Math.sin(time * 0.3 + i) * 0.25 * dt;
    motePositions[i + 1] += Math.cos(time * 0.25 + i) * 0.12 * dt;
    // Har bir chang kameraga nisbatan quti ichida qoladi (chetdan chiqsa, narigi tomondan kiradi)
    const wrap = (value, center) => {
      const half = MOTE_BOX / 2;
      return ((value - center + half) % MOTE_BOX + MOTE_BOX) % MOTE_BOX - half + center;
    };
    motePositions[i] = wrap(motePositions[i], origin.x);
    motePositions[i + 1] = wrap(motePositions[i + 1], origin.y + 3);
    motePositions[i + 2] = wrap(motePositions[i + 2], origin.z);
  }
  motes.geometry.attributes.position.needsUpdate = true;
}

// Yomg'ir: o'yinchi atrofida aylanib yuruvchi ingichka chiziqlar
const RAIN_DROPS = 800;
const RAIN_BOX = 44;
const rainPositions = new Float32Array(RAIN_DROPS * 6);
const rain = new THREE.LineSegments(
  new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)),
  new THREE.LineBasicMaterial({ color: '#e2ecf0', transparent: true, opacity: 0.6 }),
);
rain.frustumCulled = false;
rain.visible = false;
scene.add(rain);
for (let i = 0; i < rainPositions.length; i += 6) {
  rainPositions[i] = randRange(0, RAIN_BOX);
  rainPositions[i + 1] = randRange(0, RAIN_BOX);
  rainPositions[i + 2] = randRange(0, RAIN_BOX);
}

function updateRain(dt) {
  rain.visible = Boolean(conditions.rain || conditions.snowfall);
  if (!rain.visible) return;

  // Qor sekin tushadi va shamolda ko'proq suzadi
  const falling = conditions.snowfall ? 3.4 : 26;
  const streak = conditions.snowfall ? 0.07 : 0.8;
  const drift = (conditions.snowfall ? 1.6 : 3) * conditions.windStrength;
  const origin = camera.position, half = RAIN_BOX / 2;
  const wrap = (value, center) => ((value - center + half) % RAIN_BOX + RAIN_BOX) % RAIN_BOX - half + center;
  const driftX = Math.sin(wind.angle) * drift, driftZ = Math.cos(wind.angle) * drift;
  for (let i = 0; i < rainPositions.length; i += 6) {
    const x = wrap(rainPositions[i] + driftX * dt, origin.x);
    const y = wrap(rainPositions[i + 1] - falling * dt, origin.y + 6);
    const z = wrap(rainPositions[i + 2] + driftZ * dt, origin.z);
    rainPositions[i] = x;
    rainPositions[i + 1] = y;
    rainPositions[i + 2] = z;
    rainPositions[i + 3] = x - driftX * 0.03;
    rainPositions[i + 4] = y + streak;
    rainPositions[i + 5] = z - driftZ * 0.03;
  }
  rain.geometry.attributes.position.needsUpdate = true;
}

// Momaqaldiroq: chaqmoq osmonni yoritadi, guldurak bir lahza o'q ovozini bosadi
const storm = { nextFlash: 6, flash: 0, thunderLeft: 0 };

function updateStorm(dt) {
  if (!conditions.lightning) return;
  storm.nextFlash -= dt;
  storm.thunderLeft = Math.max(0, storm.thunderLeft - dt);
  storm.flash = damp(storm.flash, 0, 8, dt);
  if (storm.nextFlash <= 0) {
    storm.nextFlash = randRange(7, 18);
    storm.flash = 1;
    storm.thunderLeft = 2.2;
    sound.thunder();
  }
  skyLight.intensity = conditions.ambient + storm.flash * 2.8;
}

// Bosh chirog'i doim sahnada turadi, faqat kuchi o'zgaradi: aks holda shader qayta kompilyatsiya bo'ladi
const headlamp = new THREE.SpotLight('#fff1d6', 0, 75, 0.46, 0.6, 1.15);
scene.add(headlamp, headlamp.target);

function updateHeadlamp() {
  headlamp.intensity = player.lampOn ? 110 : 0;
  headlamp.position.copy(camera.position);
  camera.getWorldDirection(headlamp.target.position).multiplyScalar(10).add(camera.position);
}

/* --------------------------------------------------------------------------
   Izlar: bitta InstancedMesh ichida aylanma xotira. Eski izlar asta o'chadi.
   -------------------------------------------------------------------------- */

const TRACK_LIFETIME = 50; // odatdagi umr, yomg'irda qisqaradi, qorda uzayadi
const trackLifetime = () => TRACK_LIFETIME * conditions.trackLife;

class TrackPool {
  constructor(geometry, color, capacity) {
    this.records = [];
    this.capacity = capacity;
    this.next = 0;
    this.mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2 }),
      capacity,
    );
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.dummy = new THREE.Object3D();
    scene.add(this.mesh);
    this.clear();
  }

  clear() {
    this.records = [];
    this.next = 0;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.capacity; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  write(index, record, scale) {
    const { dummy } = this;
    dummy.position.set(record.x, terrainHeight(record.x, record.z) + 0.05, record.z);
    dummy.rotation.set(0, record.angle, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(index, dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  add(x, z, angle, size, label) {
    const record = { x, z, angle, size, label, born: elapsed };
    this.records[this.next] = record;
    this.write(this.next, record, size);
    this.next = (this.next + 1) % this.capacity;
  }

  /** Oxirgi soniyalarda iz kichrayib yo'qoladi. */
  fade() {
    this.records.forEach((record, index) => {
      const left = trackLifetime() - (elapsed - record.born);
      if (left < 12) this.write(index, record, record.size * clamp(left / 12, 0, 1));
    });
  }

  /** O'yinchi yonidagi eng yangi izni topadi. */
  freshestNear(x, z, radius) {
    let freshest = null;
    for (const record of this.records) {
      if (elapsed - record.born > trackLifetime()) continue;
      if (Math.abs(record.x - x) > radius || Math.abs(record.z - z) > radius) continue;
      if (!freshest || record.born > freshest.born) freshest = record;
    }
    return freshest;
  }
}

function hoofprintGeometry() {
  const half = (side) => painted(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 7), '#ffffff', [side * 0.1, 0, 0.03], [0, 0, 0], [0.8, 1, 2]);
  return merge(half(-1), half(1));
}

function pawprintGeometry() {
  const pad = (x, z, radius) => painted(new THREE.CylinderGeometry(radius, radius, 0.01, 7), '#ffffff', [x, 0, z]);
  return merge(pad(0, -0.03, 0.12), pad(-0.14, 0.1, 0.05), pad(-0.05, 0.17, 0.05), pad(0.05, 0.17, 0.05), pad(0.14, 0.1, 0.05));
}

const tracks = {
  hoof: new TrackPool(hoofprintGeometry(), '#2f2619', 900),
  paw: new TrackPool(pawprintGeometry(), '#2f2619', 900),
  blood: new TrackPool(painted(new THREE.CylinderGeometry(0.11, 0.11, 0.01, 7), '#ffffff'), '#8c1a10', 300),
};

let trackClock = 0;
let nearbyTrackLabel = null;

/** Izlarni sekin yangilaydi: bu ishni har kadrda qilish shart emas. */
function updateTracks(dt) {
  trackClock -= dt;
  if (trackClock > 0) return;
  trackClock = 0.35;
  for (const pool of Object.values(tracks)) pool.fade();
  // Qon izi muhimroq: u yarador hayvonga olib boradi
  const nearby = tracks.blood.freshestNear(player.pos.x, player.pos.z, 2.6)
    ?? tracks.hoof.freshestNear(player.pos.x, player.pos.z, 2.6)
    ?? tracks.paw.freshestNear(player.pos.x, player.pos.z, 2.6);
  nearbyTrackLabel = nearby ? nearby.label : null;
}
