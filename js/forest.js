'use strict';

/* ==========================================================================
   TO'SIQLAR PANJARASI
   Daraxt va toshlarni kataklarga bo'lib saqlaymiz: to'qnashuvni tekshirganda
   yuzlab ob'ektni emas, faqat yaqin atrofdagilarini ko'rib chiqamiz.
   ========================================================================== */

const GRID_CELL = 8;
const GRID_MARGIN = 3; // to'siq qo'shni kataklarga ham shu zaxira bilan yoziladi
const obstacleGrid = new Map();
const coverGrid = new Map(); // butalar: ularning orqasida yashirinish mumkin
const EMPTY_CELL = [];

const cellKey = (ix, iz) => ix * 4096 + iz;

function cellAt(x, z, grid = obstacleGrid) {
  return grid.get(cellKey(Math.floor(x / GRID_CELL), Math.floor(z / GRID_CELL))) ?? EMPTY_CELL;
}

function addToGrid(grid, item) {
  const reach = item.radius + GRID_MARGIN;
  for (let ix = Math.floor((item.x - reach) / GRID_CELL); ix <= Math.floor((item.x + reach) / GRID_CELL); ix++) {
    for (let iz = Math.floor((item.z - reach) / GRID_CELL); iz <= Math.floor((item.z + reach) / GRID_CELL); iz++) {
      const key = cellKey(ix, iz);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(item);
    }
  }
}

/** @param top to'siqning yuqori nuqtasi (o'q shundan balandda o'tib ketadi) */
function addObstacle(x, z, radius, top) {
  addToGrid(obstacleGrid, { x, z, radius, top });
}

const isInCover = (x, z) => cellAt(x, z, coverGrid).some((bush) => Math.hypot(bush.x - x, bush.z - z) < bush.radius);

function isSpotFree(x, z, clearance) {
  return cellAt(x, z).every((o) => Math.hypot(o.x - x, o.z - z) > o.radius + clearance);
}

/** Jismni unga tegib turgan to'siqlardan tashqariga suradi (devor bo'ylab sirpanish effekti). */
function pushOutOfObstacles(position, radius) {
  for (const o of cellAt(position.x, position.z)) {
    const dx = position.x - o.x, dz = position.z - o.z;
    const distance = Math.hypot(dx, dz) || 0.001;
    const minimum = o.radius + radius;
    if (distance < minimum) {
      position.x = o.x + (dx / distance) * minimum;
      position.z = o.z + (dz / distance) * minimum;
    }
  }
}

/* ==========================================================================
   O'RMON: daraxtlar, butalar, toshlar, o'tlar
   Bir xil ob'ektlar InstancedMesh bilan chiziladi: minglab nusxa uchun bitta chizish buyrug'i.
   ========================================================================== */

function pineGeometry() {
  return merge(
    cylinder(0.16, 0.3, 4, '#5a3d28', [0, 2, 0]),
    cone(2.5, 3.6, '#2f5f33', [0, 4.5, 0]),
    cone(2.05, 3.2, '#35693a', [0, 6.2, 0]),
    cone(1.55, 2.8, '#3c7442', [0, 7.8, 0]),
    cone(1, 2.4, '#458049', [0, 9.3, 0]),
  );
}

function oakGeometry() {
  return merge(
    cylinder(0.26, 0.42, 3.4, '#4e3825', [0, 1.7, 0]),
    cylinder(0.1, 0.2, 2, '#4e3825', [0.7, 3.8, 0], [0, 0, -0.6]),
    cylinder(0.1, 0.2, 2, '#4e3825', [-0.6, 3.9, 0.2], [0.1, 0, 0.5]),
    lumpy(2.4, '#4d8a35', [0, 5.8, 0], [1.1, 0.9, 1.1]),
    lumpy(1.8, '#5c9a3c', [1.5, 4.9, 0.6]),
    lumpy(1.7, '#437c30', [-1.5, 5.1, -0.5]),
    lumpy(1.4, '#68a544', [0.2, 7.1, 0.3]),
  );
}

function birchGeometry() {
  return merge(
    cylinder(0.11, 0.2, 6, '#e6e2d6', [0, 3, 0]),
    box(0.3, 0.1, 0.3, '#2c2a26', [0, 1.5, 0]),
    box(0.27, 0.08, 0.27, '#2c2a26', [0, 2.7, 0]),
    box(0.23, 0.08, 0.23, '#2c2a26', [0, 4, 0]),
    lumpy(1.6, '#8fb04a', [0, 6.2, 0], [1, 1.35, 1]),
    lumpy(1.15, '#a2bf55', [0.7, 5.1, 0.3]),
    lumpy(1.05, '#7ea241', [-0.7, 5.3, -0.3]),
  );
}

function bushGeometry() {
  return merge(
    lumpy(0.75, '#3f7a35', [0, 0.5, 0], [1.2, 0.85, 1.2]),
    lumpy(0.55, '#4f8f3e', [0.6, 0.38, 0.25]),
    lumpy(0.5, '#376f30', [-0.55, 0.36, -0.2]),
  );
}

function rockGeometry() {
  return lumpy(1, '#8b8c86', [0, 0.35, 0], [1.15, 0.72, 0.95], 0.34);
}

function stumpGeometry() {
  return merge(
    cylinder(0.42, 0.55, 0.7, '#5a3d28', [0, 0.35, 0]),
    cylinder(0.4, 0.4, 0.02, '#b89a6c', [0, 0.71, 0]),
  );
}

function mushroomGeometry() {
  return merge(
    cylinder(0.05, 0.07, 0.2, '#eee4d2', [0, 0.1, 0], [0, 0, 0], 5),
    cone(0.17, 0.15, '#c8402f', [0, 0.26, 0], [0, 0, 0], 6),
  );
}

function flowerGeometry() {
  return merge(
    cylinder(0.012, 0.016, 0.34, '#5a8a3a', [0, 0.17, 0], [0, 0, 0], 3),
    painted(new THREE.IcosahedronGeometry(0.07, 0), '#ffffff', [0, 0.36, 0]),
  );
}

// O'tlar shamol yo'nalishida tebranadi: siljish vertex shaderga dunyo koordinatasida qo'shiladi
const grassUniforms = { swayTime: skyMaterial.uniforms.time, swayWind: { value: new THREE.Vector2(0.3, 0) } };
const grassMaterial = lowPolyMaterial.clone();
grassMaterial.onBeforeCompile = (shader) => {
  addSeasonShader(shader);
  Object.assign(shader.uniforms, grassUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform float swayTime;\nuniform vec2 swayWind;')
    .replace('#include <project_vertex>', `
      vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
      float sway = sin(swayTime * 2.2 + mvPosition.x * 0.3 + mvPosition.z * 0.3) * 0.5 + 0.7;
      mvPosition.xz += swayWind * sway * transformed.y * transformed.y;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`);
};

/** O't tutami: pastda to'q, uchida och rangli bir nechta ingichka konus. */
function grassTuftGeometry() {
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * TAU;
    blades.push(painted(
      new THREE.ConeGeometry(0.05, 0.55, 3, 1, true),
      '#ffffff',
      [Math.cos(angle) * 0.1, 0.27, Math.sin(angle) * 0.1],
      [Math.sin(angle) * 0.3, angle, -Math.cos(angle) * 0.3],
    ));
  }
  const geometry = merge(blades);
  const points = geometry.attributes.position;
  const colors = geometry.attributes.color;
  const root = new THREE.Color('#3e6f2a'), tip = new THREE.Color('#9cc25a'), color = new THREE.Color();
  for (let i = 0; i < points.count; i++) {
    color.lerpColors(root, tip, clamp(points.getY(i) / 0.55, 0, 1));
    colors.setXYZ(i, color.r, color.g, color.b);
  }
  return geometry;
}

// Nusxalar hududlarga bo'linadi: kameraga ham, soyaga ham ko'rinmaydigan hududlar umuman chizilmaydi
const TILE_SIZE = 60;
const DETAIL_DISTANCE = 105; // o't va gullar bundan uzoqda tumanda baribir ko'rinmaydi
const detailTiles = [];

/**
 * Ro'yxatdagi har bir nuqtaga geometriyaning nusxasini qo'yadi.
 * @param items {x, z, scale, tint?, sink?, y?} ko'rinishidagi massiv (y berilsa, aynan shu balandlikka qo'yiladi)
 * @param detail true bo'lsa, uzoqdagi hududlar o'chirib qo'yiladi
 */
function addInstances(geometry, items, { castShadow = true, detail = false, summerOnly = false, material = lowPolyMaterial } = {}) {
  const tiles = new Map();
  for (const item of items) {
    const key = `${Math.floor(item.x / TILE_SIZE)},${Math.floor(item.z / TILE_SIZE)}`;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(item);
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (const tileItems of tiles.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, tileItems.length);
    tileItems.forEach((item, index) => {
      dummy.position.set(item.x, item.y ?? terrainHeight(item.x, item.z) - (item.sink ?? 0.05), item.z);
      dummy.rotation.set(randRange(-0.04, 0.04), Math.random() * TAU, randRange(-0.04, 0.04));
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, item.tint ?? color.setScalar(randRange(0.82, 1.14)));
    });
    mesh.computeBoundingSphere();
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (detail) {
      mesh.userData.total = tileItems.length;
      mesh.userData.summerOnly = summerOnly;
      detailTiles.push(mesh);
    }
  }
}

function updateDetailTiles() {
  for (const tile of detailTiles) {
    const { center, radius } = tile.boundingSphere;
    tile.visible = Math.hypot(center.x - camera.position.x, center.z - camera.position.z) < DETAIL_DISTANCE + radius;
  }
}

function createForest() {
  const reach = CONFIG.worldRadius + 70;
  const trees = { pine: [], oak: [], birch: [] };

  // Daraxtlar: shovqin yordamida quyuq changalzorlar va ochiq sayhonliklar hosil bo'ladi
  for (let attempt = 0; attempt < 11000; attempt++) {
    const { x, z } = randomPoint(reach);
    const fromCenter = Math.hypot(x, z);
    if (fromCenter < CONFIG.spawnClearing || !isDryLand(x, z)) continue;
    const insideWorld = fromCenter < CONFIG.worldRadius;
    if (insideWorld && layeredNoise(x * 0.022 + 60, z * 0.022 + 60) < 0.44) continue;
    if (!isSpotFree(x, z, insideWorld ? 3.2 : 2.9)) continue;

    const roll = Math.random();
    const kind = roll < 0.58 ? 'pine' : roll < 0.82 ? 'oak' : 'birch';
    const scale = randRange(0.85, 1.7);
    const trunkRadius = { pine: 0.3, oak: 0.42, birch: 0.2 }[kind] * scale;
    trees[kind].push({ x, z, scale });
    addObstacle(x, z, trunkRadius + 0.1, terrainHeight(x, z) + 9 * scale);
  }
  addInstances(pineGeometry(), trees.pine);
  addInstances(oakGeometry(), trees.oak);
  addInstances(birchGeometry(), trees.birch);

  // Toshlar va to'nkalar: ustidan o'tib bo'lmaydi
  const rocks = [], stumps = [];
  for (let i = 0; i < 420; i++) {
    const { x, z } = randomPoint(reach);
    if (Math.hypot(x, z) < 7 || !isDryLand(x, z) || !isSpotFree(x, z, 1.6)) continue;
    const scale = randRange(0.5, 2);
    rocks.push({ x, z, scale, sink: 0.1 * scale });
    addObstacle(x, z, scale * 0.95, terrainHeight(x, z) + scale * 0.95);
  }
  for (let i = 0; i < 130; i++) {
    const { x, z } = randomPoint(CONFIG.worldRadius);
    if (Math.hypot(x, z) < 7 || !isDryLand(x, z) || !isSpotFree(x, z, 1.5)) continue;
    const scale = randRange(0.8, 1.3);
    stumps.push({ x, z, scale });
    addObstacle(x, z, 0.5 * scale, terrainHeight(x, z) + 0.7 * scale);
  }
  addInstances(rockGeometry(), rocks);
  addInstances(stumpGeometry(), stumps);

  // Butalar, o'tlar va gullar: ular orasidan bemalol o'tish mumkin
  const scatter = (count, radius, describe) =>
    Array.from({ length: count }, () => ({ ...randomPoint(radius), ...describe() }))
      .filter(({ x, z }) => isDryLand(x, z));

  const bushes = scatter(950, reach, () => ({ scale: randRange(0.7, 1.7) }))
    .filter(({ x, z }) => Math.hypot(x, z) > 8); // boshlang'ich nuqtada ko'rishni to'smasin
  addInstances(bushGeometry(), bushes);
  for (const { x, z, scale } of bushes) addToGrid(coverGrid, { x, z, radius: scale * 1.1 });
  addInstances(grassTuftGeometry(), scatter(58000, CONFIG.worldRadius + 25, () => ({
    scale: randRange(0.8, 1.9),
    tint: new THREE.Color().setScalar(randRange(0.75, 1.1)),
  })), { castShadow: false, detail: true, material: grassMaterial });

  const petals = ['#f4d04e', '#f7f3ea', '#b98be0', '#ee8fa8'].map((hex) => new THREE.Color(hex));
  addInstances(flowerGeometry(), scatter(3200, CONFIG.worldRadius, () => ({
    scale: randRange(0.9, 1.5),
    tint: pick(petals),
  })), { castShadow: false, detail: true, summerOnly: true });
  addInstances(mushroomGeometry(), scatter(640, CONFIG.worldRadius, () => ({ scale: randRange(0.8, 1.8) })), { detail: true, summerOnly: true });
}

function reedGeometry() {
  return merge(
    cone(0.05, 1.5, '#5f8a3c', [0, 0.72, 0], [0.05, 0, 0.06], 3),
    cone(0.05, 1.8, '#6f9a44', [0.14, 0.86, 0.06], [-0.06, 0, -0.08], 3),
    cone(0.05, 1.3, '#527c35', [-0.12, 0.62, -0.08], [0.08, 0, 0.1], 3),
    cylinder(0.012, 0.012, 2, '#6f8a48', [0.03, 1, -0.12], [0, 0, 0], 3),
    cylinder(0.05, 0.05, 0.3, '#5a3a22', [0.03, 2, -0.12], [0, 0, 0], 5),
  );
}

function lilyGeometry() {
  return merge(
    cylinder(0.42, 0.42, 0.02, '#3e7f45', [0, 0, 0], [0, 0, 0], 9),
    cylinder(0.3, 0.3, 0.02, '#4a9150', [0.5, 0, 0.25], [0, 0, 0], 8),
    cone(0.09, 0.14, '#f3e7ee', [0.05, 0.08, 0.02], [0, 0, 0], 6),
  );
}

// Qirg'oq nuqtalari: keyinroq hayvonlar suv ichish uchun shu yerlarga keladi
const shorePoints = [];

/** Qamishlar va nilufarlar: suv chetini tasodifiy nuqtalar bilan qidirib topamiz. */
function createShoreline() {
  const reeds = [], lilies = [];
  for (let attempt = 0; attempt < 45000; attempt++) {
    const { x, z } = randomPoint(CONFIG.worldRadius + 40);
    const depth = waterDepth(x, z);
    if (depth > -0.45 && depth < 0.5 && Math.random() < 0.6) {
      reeds.push({ x, z, scale: randRange(0.7, 1.3) });
    } else if (depth > 0.7 && depth < 2.6 && distanceToLake(x, z) < 0 && Math.random() < 0.09) {
      lilies.push({ x, z, y: WATER_LEVEL + 0.03, scale: randRange(0.7, 1.4) });
    }
    if (depth > -0.9 && depth < -0.3 && Math.hypot(x, z) < CONFIG.worldRadius - 6) shorePoints.push({ x, z });
  }
  addInstances(reedGeometry(), reeds);
  addInstances(lilyGeometry(), lilies, { castShadow: false });
}
