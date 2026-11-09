'use strict';

/* ==========================================================================
   DUNYO XARITASI: yer balandligi, daryo va ko'llar
   Hammasi o'yin boshida bir marta hisoblanib jadvalga yoziladi. Keyin balandlikni
   so'rash juda arzon, chunki u shunchaki jadvaldan o'qiladi.
   ========================================================================== */

const WATER_LEVEL = -1.5;     // barcha suvlar uchun bitta sath
const MAX_WADE_DEPTH = 1.15;  // o'yinchi kechib o'ta oladigan eng katta chuqurlik
const SHORE_WIDTH = 16;       // qirg'oq balandligi shu masofada asta tepalikka qo'shiladi

const FIELD_CELL = 2;
const FIELD_HALF = CONFIG.worldRadius + 92;
const FIELD_SIDE = (FIELD_HALF * 2) / FIELD_CELL + 1;

/** Dunyo bo'ylab tekis taqsimlangan tasodifiy nuqta. */
function randomPoint(maxRadius) {
  const angle = Math.random() * TAU;
  const radius = Math.sqrt(Math.random()) * maxRadius;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

/** Daryo dunyoning bir chetidan ikkinchisiga ilon izi bo'lib oqadi va boshlang'ich nuqtadan uzoqdan o'tadi. */
function planRiver() {
  const angle = Math.random() * TAU;
  const dirX = Math.cos(angle), dirZ = Math.sin(angle);
  const offset = randRange(75, 105) * pick([-1, 1]);
  const phaseA = Math.random() * TAU, phaseB = Math.random() * TAU;
  const reach = FIELD_HALF + 60;
  const points = [];
  for (let along = -reach; along <= reach; along += 14) {
    const drift = offset + Math.sin(along * 0.012 + phaseA) * 26 + Math.sin(along * 0.031 + phaseB) * 9;
    points.push({ x: dirX * along - dirZ * drift, z: dirZ * along + dirX * drift });
  }
  return points;
}

/** Bitta ko'l daryo ustida turadi, qolganlari o'rmon ichida tarqaladi. */
function planLakes(riverPoints) {
  const onRiver = riverPoints.filter(({ x, z }) => {
    const distance = Math.hypot(x, z);
    return distance > 90 && distance < CONFIG.worldRadius - 60;
  });
  const lakes = [{ ...pick(onRiver), radius: randRange(30, 40), seed: Math.random() * 50 }];

  const gap = LAKE_COUNT > 6 ? 22 : 45; // ko'llar o'lkasida ular bir-biriga yaqinroq
  for (let attempt = 0; attempt < 2000 && lakes.length < LAKE_COUNT; attempt++) {
    const point = randomPoint(CONFIG.worldRadius - 40);
    const radius = randRange(20, 36);
    const nearSpawn = Math.hypot(point.x, point.z) < radius + 50;
    const nearLake = lakes.some((lake) => Math.hypot(lake.x - point.x, lake.z - point.z) < lake.radius + radius + gap);
    if (!nearSpawn && !nearLake) lakes.push({ ...point, radius, seed: Math.random() * 50 });
  }
  return lakes;
}

/** Daryodan o'tish joylari: bu nuqtalarda daryo albatta sayoz bo'ladi. Xaritada ham ko'rsatiladi. */
function planFords(points, lakeList) {
  const fords = [];
  for (const point of points) {
    const inside = Math.hypot(point.x, point.z) < CONFIG.worldRadius - 14;
    const clearOfLakes = lakeList.every((lake) => Math.hypot(lake.x - point.x, lake.z - point.z) > lake.radius * 1.3 + 12);
    const spaced = fords.every((ford) => Math.hypot(ford.x - point.x, ford.z - point.z) > 70);
    if (inside && clearOfLakes && spaced) fords.push({ x: point.x, z: point.z });
  }
  return fords;
}

const riverPoints = planRiver();
const lakes = planLakes(riverPoints);
const fords = planFords(riverPoints, lakes);

/** Tog' va botqoq uchun joy: markazdan, daryodan, ko'llardan va bir-biridan uzoqda. Topilmasa, kichikroq urinadi. */
function planRegion(sizes, minFromCenter, maxFromCenter, others) {
  for (const radius of sizes) {
    for (let attempt = 0; attempt < 150; attempt++) {
      const angle = Math.random() * TAU, distance = randRange(minFromCenter, maxFromCenter);
      const x = Math.cos(angle) * distance, z = Math.sin(angle) * distance;
      const clear = lakes.every((lake) => Math.hypot(lake.x - x, lake.z - z) > lake.radius + radius + 10)
        && riverPoints.every((point) => Math.hypot(point.x - x, point.z - z) > radius + 16)
        && others.every((other) => Math.hypot(other.x - x, other.z - z) > other.radius + radius + 20);
      if (clear) return { x, z, radius, peak: radius * 0.55 };
    }
  }
  return null;
}

const mountain = planRegion([70, 58, 46], 140, 190, []);
const swamp = planRegion([45, 36], 80, 200, mountain ? [mountain] : []);

/** Tog' ulushi: markazida 1, chetida 0. */
function mountainWeight(x, z) {
  if (!mountain) return 0;
  return 1 - smoothstep(Math.hypot(x - mountain.x, z - mountain.z) / mountain.radius, 0.55, 1);
}

function swampWeight(x, z) {
  if (!swamp) return 0;
  return 1 - smoothstep(Math.hypot(x - swamp.x, z - swamp.z) / swamp.radius, 0.6, 1);
}

/** Tog' balandligi: cho'qqiga qarab tiklashadi, yonbag'ri notekis. */
function mountainLift(x, z) {
  if (!mountain) return 0;
  const reach = Math.hypot(x - mountain.x, z - mountain.z) / mountain.radius;
  if (reach >= 1) return 0;
  const shape = Math.pow(1 - smoothstep(reach, 0, 1), 1.4);
  const rough = 0.75 + layeredNoise(x * 0.05 + 500, z * 0.05 + 500) * 0.5;
  return mountain.peak * shape * rough;
}

/** Botqoq sathi: suvga yaqin, sayoz ko'lmaklar va loy orolchalar almashib keladi. */
function swampLevel(x, z) {
  return WATER_LEVEL + (valueNoise(x * 0.09 + 520, z * 0.09 + 520) - 0.55) * 1.7;
}

/** Nuqtadan daryo o'rta chizig'igacha bo'lgan masofa. */
function distanceToRiver(x, z) {
  let nearest = Infinity;
  for (let i = 1; i < riverPoints.length; i++) {
    const a = riverPoints[i - 1], b = riverPoints[i];
    const abX = b.x - a.x, abZ = b.z - a.z;
    const t = clamp(((x - a.x) * abX + (z - a.z) * abZ) / (abX * abX + abZ * abZ), 0, 1);
    nearest = Math.min(nearest, Math.hypot(x - a.x - abX * t, z - a.z - abZ * t));
  }
  return nearest;
}

/** Nuqtadan eng yaqin ko'l qirg'og'igacha masofa (ko'l ichida manfiy). Qirg'oq chizig'i notekis. */
function distanceToLake(x, z) {
  let nearest = Infinity;
  for (const lake of lakes) {
    const dx = x - lake.x, dz = z - lake.z;
    const length = Math.hypot(dx, dz) || 1;
    const wobble = valueNoise((dx / length) * 1.6 + lake.seed, (dz / length) * 1.6 + lake.seed);
    nearest = Math.min(nearest, length - lake.radius * (0.72 + wobble * 0.56));
  }
  return nearest;
}

/** Ikki sonning silliq maksimumi: tepaliklar suv sathiga yetmasdan asta tekislanadi. */
function smoothMax(a, b, softness) {
  const blend = clamp(0.5 + (0.5 * (a - b)) / softness, 0, 1);
  return lerp(b, a, blend) + softness * blend * (1 - blend);
}

/** Bir nuqtaning yer balandligini noldan hisoblaydi. Dunyo chetida yer ko'tarilib, tabiiy devor hosil qiladi. */
function computeHeight(x, z) {
  const hills = (layeredNoise(x * 0.014 + 10, z * 0.014 + 10) - 0.5) * 14;
  let land = smoothMax(hills + 3, WATER_LEVEL + 1.7, 1.5) + mountainLift(x, z);
  const marsh = swampWeight(x, z);
  if (marsh > 0) land = lerp(land, swampLevel(x, z), marsh);

  const riverEdge = distanceToRiver(x, z) - (4.5 + valueNoise(x * 0.02 + 200, z * 0.02 + 200) * 4);
  const lakeEdge = distanceToLake(x, z);
  const shore = Math.min(riverEdge, lakeEdge);

  const rim = smoothstep(Math.hypot(x, z), CONFIG.worldRadius - 10, CONFIG.worldRadius + 70) * 26;
  const inland = smoothstep(shore, 0, SHORE_WIDTH);
  if (shore >= 0) return lerp(WATER_LEVEL + 0.12, land, inland) + rim * smoothstep(shore, 0, SHORE_WIDTH * 2);

  // Daryoning sayoz kechuv joylari va chuqur joylari almashib keladi, ko'llar esa chuqurroq
  const naturalDepth = 0.6 + valueNoise(x * 0.015 + 300, z * 0.015 + 300) * 1.6;
  const fordDistance = Math.min(...fords.map((ford) => Math.hypot(ford.x - x, ford.z - z)));
  const riverDepth = lerp(0.6, naturalDepth, smoothstep(fordDistance, 8, 20));
  const depthLimit = lerp(3.4, riverDepth, smoothstep(lakeEdge - riverEdge, -6, 6));
  return WATER_LEVEL + 0.12 - Math.min(-shore * 0.28, depthLimit);
}

const heightField = new Float32Array(FIELD_SIDE * FIELD_SIDE);
for (let row = 0; row < FIELD_SIDE; row++) {
  for (let column = 0; column < FIELD_SIDE; column++) {
    heightField[row * FIELD_SIDE + column] = computeHeight(column * FIELD_CELL - FIELD_HALF, row * FIELD_CELL - FIELD_HALF);
  }
}

/** Berilgan nuqtadagi yer balandligi (jadvaldagi to'rt qo'shni qiymatdan). */
function terrainHeight(x, z) {
  const gridX = clamp((x + FIELD_HALF) / FIELD_CELL, 0, FIELD_SIDE - 1.001);
  const gridZ = clamp((z + FIELD_HALF) / FIELD_CELL, 0, FIELD_SIDE - 1.001);
  const column = Math.floor(gridX), row = Math.floor(gridZ);
  const fx = gridX - column, fz = gridZ - row;
  const index = row * FIELD_SIDE + column;
  return lerp(
    lerp(heightField[index], heightField[index + 1], fx),
    lerp(heightField[index + FIELD_SIDE], heightField[index + FIELD_SIDE + 1], fx),
    fz,
  );
}

/** Nuqtadagi suv chuqurligi. Quruqlikda manfiy bo'ladi. */
const waterDepth = (x, z) => WATER_LEVEL - terrainHeight(x, z);
const isDryLand = (x, z) => waterDepth(x, z) < -0.3;

/** Yurishga xalaqit beradigan chuqurlik: qishda muz ustidan yuriladi. */
const wadeDepthAt = (x, z) => (conditions.frozen ? 0 : waterDepth(x, z));
