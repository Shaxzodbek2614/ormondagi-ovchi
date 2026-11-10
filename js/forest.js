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

/* Daraxt shakllari ikki xil: yaqindagisi batafsil, uzoqdagisi (detail = 0) sodda.
   Har biri ikki guruhdan iborat: po'stloq va barg, har guruh o'z materiali bilan chiziladi. */

const up3 = new THREE.Vector3(0, 1, 0);

/** Qarag'ay shoxlari qavati: tanadan chiqib, pastga egilgan yulduzsimon etak. */
function pineTier(apexY, radius, drop, sides, detail, dark, light) {
  const ring = (reach, fall, star) => Array.from({ length: sides }, (_, j) => {
    const angle = (j / sides) * TAU + apexY * 1.7;
    const wobble = valueNoise(j * 1.3 + apexY * 5, apexY * 2.1 + j) - 0.5;
    const out = radius * reach * (star ? (j % 2 ? 0.74 : 1) + wobble * 0.3 : 1);
    return [Math.cos(angle) * out, apexY - drop * fall * (star && j % 2 ? 0.8 : 1) + (star ? wobble * 0.25 : 0), Math.sin(angle) * out];
  });
  const grid = detail ? [ring(0.03, 0, false), ring(0.56, 0.3, false), ring(1, 1, true)] : [ring(0.03, 0, false), ring(1, 1, true)];
  const last = grid.length - 1;
  return surface(grid, {
    fitV: true,
    // Uzoqdagi shaklda tishli chet ishlatilmaydi: mayda teshiklar uzoqdan shoxni yo'qotib qo'yadi
    uvScale: [radius > 1.4 ? 2 : 1, detail ? 1 : 0.5],
    colorAt: (i) => blend(dark, light, i / last),
    normalAt: (point, normal) => normal.clone().lerp(up3, 0.3).toArray(),
  });
}

function pineGeometry(detail = 1) {
  const tiers = detail ? 9 : 7, sides = detail ? 10 : 7;
  const trunk = tube(
    [[0, -0.3, 0], [0, 0.45, 0], [0.05, 3, 0.03], [-0.02, 6.5, -0.03], [0, 10.3, 0]],
    [0.45, 0.31, 0.24, 0.14, 0.03], '#9c7254',
    { sides: detail ? 8 : 5, bumpy: detail ? 0.1 : 0, uvScale: [2, 0.4], colorAt: (i) => blend('#7d5a44', '#a47a5a', i / 2) },
  );
  const boughs = [];
  for (let k = 0; k < tiers; k++) {
    const t = k / (tiers - 1);
    const radius = lerp(2.65, 0.6, Math.pow(t, 0.85)) * (1 + (valueNoise(k * 3.7, 9.1) - 0.5) * 0.16);
    boughs.push(pineTier(lerp(3.5, 10.5, t), radius, radius * 0.72 + 0.35, sides, detail,
      blend('#1d3d24', '#2b5831', t), blend('#417c43', '#5d9c59', t)));
  }
  return mergeGroups([trunk], boughs);
}

/** Barg to'plami: pasti to'q, tepasi och. Normal toj markazidan olinadi, toj bir butun bo'lib yoritiladi. */
function leafBlob(center, radii, color, crown, detail, grain = 1) {
  const [, ry] = [radii].flat().concat(radii);
  const around = Math.max(3, Math.round([radii].flat()[0] * 3.2 * grain));
  const low = new THREE.Color(color).multiplyScalar(0.5), high = new THREE.Color(color).multiplyScalar(1.12);
  return lump(center, radii, color, {
    sides: detail ? 9 : 6, rings: detail ? 6 : 4, bumpy: 0.3, grain: 1.3,
    soft: 0.65, softFrom: crown, uvScale: [around, 0.5 * grain],
    colorAt: (i, j, point) => low.clone().lerp(high, clamp((point.y - center[1]) / ry * 0.5 + 0.55, 0, 1)),
  });
}

function oakGeometry(detail = 1) {
  const bark = '#8d7965', crown = [0, 5.4, 0];
  const sides = detail ? 8 : 5;
  const wood = [tube(
    [[0, -0.3, 0], [0, 0.4, 0], [0.06, 1.8, 0], [-0.05, 3.3, 0.05], [0.08, 4.8, 0]],
    [0.66, 0.45, 0.37, 0.31, 0.18], bark,
    { sides, bumpy: detail ? 0.16 : 0, uvScale: [2, 0.4], colorAt: (i) => blend('#6f5d4c', bark, i / 2) },
  )];
  if (detail) {
    wood.push(
      tube([[0, 2.9, 0], [0.8, 3.7, 0.2], [1.6, 4.9, 0.5]], [0.2, 0.14, 0.06], bark, { sides: 5 }),
      tube([[0, 3.1, 0], [-0.7, 3.9, -0.2], [-1.5, 5, -0.5]], [0.19, 0.13, 0.06], bark, { sides: 5 }),
      tube([[0, 3.3, 0], [-0.2, 4.1, 0.8], [-0.4, 5, 1.6]], [0.16, 0.11, 0.05], bark, { sides: 5 }),
    );
  }
  const leaves = [
    leafBlob([0, 6.1, 0], [2.6, 2.1, 2.6], '#4d8a35', crown, detail),
    leafBlob([1.75, 5, 0.6], 1.85, '#5c9a3c', crown, detail),
    leafBlob([-1.65, 5.2, -0.6], 1.75, '#437c30', crown, detail),
    leafBlob([0.3, 7.4, 0.3], 1.5, '#68a544', crown, detail),
  ];
  if (detail) {
    leaves.push(
      leafBlob([-0.5, 5, 1.75], 1.5, '#558f38', crown, detail),
      leafBlob([0.6, 5.2, -1.8], 1.5, '#4a8433', crown, detail),
      leafBlob([-1.1, 6.8, 0.9], 1.25, '#62a040', crown, detail),
    );
  }
  return mergeGroups(wood, leaves);
}

function birchGeometry(detail = 1) {
  const crown = [0, 5.6, 0];
  const wood = [tube(
    [[0, -0.3, 0], [0.03, 1.5, 0], [0.13, 3.5, 0.05], [0.08, 5.5, 0], [0, 7.4, 0]],
    [0.27, 0.19, 0.15, 0.1, 0.03], '#ffffff', { sides: detail ? 7 : 5, uvScale: [1, 0.33] },
  )];
  if (detail) {
    wood.push(
      tube([[0.1, 3.4, 0], [0.6, 4.2, 0.2], [1, 5.2, 0.35]], [0.07, 0.05, 0.02], '#d8d4ca', { sides: 4 }),
      tube([[0.1, 3.9, 0], [-0.5, 4.7, -0.2], [-0.9, 5.6, -0.3]], [0.07, 0.05, 0.02], '#d8d4ca', { sides: 4 }),
    );
  }
  const leaves = [
    leafBlob([0, 6.4, 0], [1.55, 2.1, 1.55], '#8fb04a', crown, detail, 1.5),
    leafBlob([0.8, 5.1, 0.3], [1.05, 1.4, 1.05], '#a2bf55', crown, detail, 1.5),
    leafBlob([-0.8, 5.3, -0.3], [1, 1.35, 1], '#7ea241', crown, detail, 1.5),
  ];
  if (detail) {
    leaves.push(
      leafBlob([0.1, 4.5, -0.75], [0.85, 1.1, 0.85], '#86a945', crown, detail, 1.5),
      leafBlob([-0.2, 7.7, 0.15], [0.8, 1.1, 0.8], '#9dbb52', crown, detail, 1.5),
    );
  }
  return mergeGroups(wood, leaves);
}

/** Botqoqdagi qurigan daraxt: bargsiz, qiyshiq shoxlar. */
function deadTreeGeometry() {
  const bark = '#a09488', dark = '#857a70';
  return merge(
    tube([[0, -0.3, 0], [0.05, 1.4, 0], [0.2, 3.2, 0.05], [0.15, 4.6, -0.05], [0.3, 5.6, 0]], [0.3, 0.22, 0.17, 0.11, 0.03], bark, { sides: 6, bumpy: 0.12, uvScale: [1, 0.4] }),
    tube([[0.18, 3, 0], [0.8, 3.7, 0.1], [1.3, 3.9, 0.3], [1.5, 4.5, 0.4]], [0.09, 0.07, 0.04, 0.015], dark, { sides: 4 }),
    tube([[0.15, 3.8, 0], [-0.5, 4.4, 0.2], [-0.9, 5.3, 0.25]], [0.08, 0.05, 0.015], bark, { sides: 4 }),
    tube([[0.18, 4.7, -0.05], [0.2, 5.1, -0.5], [0, 5.7, -0.8]], [0.06, 0.04, 0.012], dark, { sides: 4 }),
    tube([[0.1, 2.2, 0], [-0.4, 2.6, -0.3], [-0.6, 2.7, -0.7]], [0.06, 0.04, 0.012], dark, { sides: 4 }),
  );
}

function bushGeometry() {
  const crown = [0, 0.1, 0];
  const part = (center, radii, color) => lump(center, radii, color, {
    sides: 8, rings: 5, bumpy: 0.32, grain: 2.2, soft: 0.6, softFrom: crown, uvScale: [3, 0.9], flatBase: true,
    colorAt: (i, j, point) => new THREE.Color(color).multiplyScalar(clamp(0.45 + point.y * 0.75, 0.45, 1.15)),
  });
  return merge(
    part([0, 0.5, 0], [0.9, 0.68, 0.9], '#3f7a35'),
    part([0.62, 0.38, 0.25], 0.55, '#4f8f3e'),
    part([-0.58, 0.36, -0.2], 0.52, '#376f30'),
    part([0.05, 0.4, -0.6], 0.45, '#468536'),
  );
}

/** Xarsang: qirrali, pasti to'q, usti ochroq. */
function rockGeometry() {
  return lump([0, 0.35, 0], [1.15, 0.72, 0.95], '#b9b9b1', {
    sides: 10, rings: 7, bumpy: 0.36, grain: 1.9, uvScale: [3, 0.5],
    colorAt: (i, j, point) => blend('#8f8e87', '#c9c8c0', point.y * 0.9 + 0.25)
      .multiplyScalar(0.86 + valueNoise(point.x * 4 + 7, point.z * 4 + point.y * 3) * 0.3),
  });
}

function stumpGeometry() {
  const rings = [0.42, 0.33, 0.24, 0.14, 0.05, 0.005].map((radius) =>
    Array.from({ length: 8 }, (_, j) => [Math.cos((j / 8) * TAU) * radius, 0.7, Math.sin((j / 8) * TAU) * radius]));
  return merge(
    tube([[0, -0.15, 0], [0, 0.12, 0], [0, 0.4, 0], [0, 0.7, 0]], [0.74, 0.54, 0.46, 0.42], '#9c7254', { sides: 8, bumpy: 0.12, uvScale: [2, 0.5] }),
    surface(rings, { uvScale: [0.2, 0.2], colorAt: (i) => blend(i % 2 ? '#d9c39c' : '#f2e2c0', '#b89a6c', i / 9), normalAt: () => [0, 1, 0] }),
  );
}

function mushroomGeometry() {
  return merge(
    tube([[0, 0, 0], [0.005, 0.1, 0], [0, 0.2, 0]], [0.06, 0.045, 0.04], '#eee4d2', { sides: 6 }),
    lump([0, 0.2, 0], [0.17, 0.12, 0.17], '#c8402f', {
      sides: 8, rings: 4, bumpy: 0, flatBase: true,
      colorAt: (i, j) => (i === 1 && j % 2 ? new THREE.Color('#f4ecdf') : new THREE.Color('#c8402f')),
    }),
  );
}

/** Gul: poya, besh gulbarg va o'rtasi. Gulbarg rangi nusxa rangidan keladi. */
function flowerGeometry() {
  const parts = [cylinder(0.01, 0.014, 0.34, '#b9dc8c', [0, 0.17, 0], [0, 0, 0], 3)];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * TAU;
    const petal = new THREE.BufferGeometry();
    const tip = [Math.cos(angle) * 0.085, 0.37, Math.sin(angle) * 0.085];
    const side = (turn) => [Math.cos(angle + turn) * 0.05, 0.355, Math.sin(angle + turn) * 0.05];
    petal.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.345, 0, ...side(0.5), ...tip, 0, 0.345, 0, ...tip, ...side(-0.5)], 3));
    petal.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
    petal.computeVertexNormals();
    parts.push(painted(petal, '#ffffff'));
  }
  parts.push(cone(0.022, 0.03, '#f0b429', [0, 0.365, 0], [0, 0, 0], 5));
  return merge(parts);
}

// O'tlar shamol yo'nalishida tebranadi: siljish vertex shaderga dunyo koordinatasida qo'shiladi
const grassUniforms = { swayTime: skyMaterial.uniforms.time, swayWind: { value: new THREE.Vector2(0.3, 0) } };
const grassMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
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
  // Yaproq ikki tomondan bir xil yoritiladi, yer bilan qo'shilib ketadi
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
    '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif');
};

/** O't tutami: tashqariga egilgan yassi yaproqlar, pastda to'q, uchida och. */
function grassTuftGeometry() {
  const positions = [], normals = [], colors = [];
  const root = new THREE.Color('#345f24'), middle = new THREE.Color('#5d9238'), tip = new THREE.Color('#a8c865');
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * TAU + (i % 2) * 0.5;
    const dx = Math.cos(angle), dz = Math.sin(angle);
    const height = 0.42 + ((i * 7) % 5) * 0.05, lean = 0.12 + ((i * 3) % 4) * 0.05;
    const wide = 0.03, bx = dx * 0.05, bz = dz * 0.05;
    const corner = (out, y, half) => [bx + dx * out - dz * half, y, bz + dz * out + dx * half];
    const a = corner(0, 0, -wide), b = corner(0, 0, wide);
    const c = corner(lean * 0.45, height * 0.55, wide * 0.7), d = corner(lean * 0.45, height * 0.55, -wide * 0.7);
    const e = corner(lean, height, 0);
    const normal = new THREE.Vector3(dx * 0.8, 0.55, dz * 0.8).normalize();
    for (const [point, color] of [[a, root], [b, root], [c, middle], [a, root], [c, middle], [d, middle], [d, middle], [c, middle], [e, tip]]) {
      positions.push(...point);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// Nusxalar hududlarga bo'linadi: kameraga ham, soyaga ham ko'rinmaydigan hududlar umuman chizilmaydi
const TILE_SIZE = 60;
const DETAIL_DISTANCE = 105; // o't va gullar bundan uzoqda tumanda baribir ko'rinmaydi
const detailTiles = [];
const lodTiles = []; // daraxtlar: { near, far } juftlari, kameraga yaqini batafsil chiziladi
const LOD_DISTANCE = { low: 38, medium: 62, high: 90 };

/**
 * Ro'yxatdagi har bir nuqtaga geometriyaning nusxasini qo'yadi.
 * @param items {x, z, scale, tint?, sink?, y?} ko'rinishidagi massiv (y berilsa, aynan shu balandlikka qo'yiladi)
 * @param detail true bo'lsa, uzoqdagi hududlar o'chirib qo'yiladi
 * @param far uzoqdan ko'rinadigan sodda shakl: berilsa, har hududda ikki nusxa turadi va biri ko'rsatiladi
 */
function addInstances(geometry, items, { castShadow = true, detail = false, summerOnly = false, material = lowPolyMaterial, far = null } = {}) {
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
    const distant = far && new THREE.InstancedMesh(far, material, tileItems.length);
    tileItems.forEach((item, index) => {
      dummy.position.set(item.x, item.y ?? terrainHeight(item.x, item.z) - (item.sink ?? 0.05), item.z);
      dummy.rotation.set(randRange(-0.04, 0.04), Math.random() * TAU, randRange(-0.04, 0.04));
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      const tint = item.tint ?? color.setScalar(randRange(0.82, 1.14));
      mesh.setColorAt(index, tint);
      distant?.setMatrixAt(index, dummy.matrix);
      distant?.setColorAt(index, tint);
    });
    for (const part of distant ? [mesh, distant] : [mesh]) {
      part.computeBoundingSphere();
      part.castShadow = castShadow;
      part.receiveShadow = true;
      scene.add(part);
    }
    if (distant) lodTiles.push({ near: mesh, far: distant });
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
  const reach = LOD_DISTANCE[profile.settings.quality];
  for (const { near, far } of lodTiles) {
    const { center } = near.boundingSphere;
    near.visible = Math.hypot(center.x - camera.position.x, center.z - camera.position.z) < reach;
    far.visible = !near.visible;
  }
}

function createForest() {
  const reach = CONFIG.worldRadius + 70;
  const trees = { pine: [], oak: [], birch: [], dead: [] };

  // Daraxtlar: shovqin yordamida quyuq changalzorlar va ochiq sayhonliklar hosil bo'ladi
  for (let attempt = 0; attempt < 11000; attempt++) {
    const { x, z } = randomPoint(reach);
    const fromCenter = Math.hypot(x, z);
    if (fromCenter < CONFIG.spawnClearing || !isDryLand(x, z)) continue;
    const insideWorld = fromCenter < CONFIG.worldRadius;
    if (insideWorld && layeredNoise(x * 0.022 + 60, z * 0.022 + 60) < 0.44) continue;
    // Tog'da qor chizig'idan yuqorida daraxt yo'q, botqoqda siyrak
    const high = mountainWeight(x, z), wet = swampWeight(x, z);
    if ((high > 0 && terrainHeight(x, z) > SNOW_LINE - 3) || Math.random() < high * 0.35 + wet * 0.7) continue;
    if (!isSpotFree(x, z, insideWorld ? 3.2 : 2.9)) continue;

    const roll = Math.random();
    let kind = roll < 0.58 ? 'pine' : roll < 0.82 ? 'oak' : 'birch';
    if (high > 0.3) kind = 'pine';
    if (wet > 0.3) kind = roll < 0.6 ? 'dead' : 'birch';
    const scale = randRange(0.85, 1.7);
    const trunkRadius = { pine: 0.3, oak: 0.42, birch: 0.2, dead: 0.22 }[kind] * scale;
    trees[kind].push({ x, z, scale });
    addObstacle(x, z, trunkRadius + 0.1, terrainHeight(x, z) + 9 * scale);
  }
  addInstances(pineGeometry(), trees.pine, { material: [barkMaterial, needleMaterial], far: pineGeometry(0) });
  addInstances(oakGeometry(), trees.oak, { material: [barkMaterial, leafMaterial], far: oakGeometry(0) });
  addInstances(birchGeometry(), trees.birch, { material: [birchMaterial, leafMaterial], far: birchGeometry(0) });
  addInstances(deadTreeGeometry(), trees.dead, { material: barkMaterial });

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
  // Tog' yonbag'rida qo'shimcha xarsanglar
  for (let i = 0; mountain && i < 320; i++) {
    const angle = Math.random() * TAU, distance = Math.sqrt(Math.random()) * mountain.radius * 0.9;
    const x = mountain.x + Math.cos(angle) * distance, z = mountain.z + Math.sin(angle) * distance;
    if (Math.hypot(x, z) > CONFIG.worldRadius - 4 || !isDryLand(x, z) || !isSpotFree(x, z, 1.8)) continue;
    const scale = randRange(0.7, 2.4);
    rocks.push({ x, z, scale, sink: 0.15 * scale });
    addObstacle(x, z, scale * 0.95, terrainHeight(x, z) + scale * 0.95);
  }
  addInstances(rockGeometry(), rocks, { material: stoneMaterial });
  addInstances(stumpGeometry(), stumps, { material: barkMaterial });

  // Butalar, o'tlar va gullar: ular orasidan bemalol o'tish mumkin
  const scatter = (count, radius, describe) =>
    Array.from({ length: count }, () => ({ ...randomPoint(radius), ...describe() }))
      .filter(({ x, z }) => isDryLand(x, z));

  const bushes = scatter(950, reach, () => ({ scale: randRange(0.7, 1.7) }))
    .filter(({ x, z }) => Math.hypot(x, z) > 8); // boshlang'ich nuqtada ko'rishni to'smasin
  addInstances(bushGeometry(), bushes, { material: leafMaterial });
  for (const { x, z, scale } of bushes) addToGrid(coverGrid, { x, z, radius: scale * 1.1 });
  const belowSnow = ({ x, z }) => mountainWeight(x, z) === 0 || terrainHeight(x, z) < SNOW_LINE - 1;
  addInstances(grassTuftGeometry(), scatter(58000, CONFIG.worldRadius + 25, () => ({
    scale: randRange(0.8, 1.9),
    tint: new THREE.Color().setScalar(randRange(0.75, 1.1)),
  })).filter(belowSnow), { castShadow: false, detail: true, material: grassMaterial });

  const petals = ['#f4d04e', '#f7f3ea', '#b98be0', '#ee8fa8'].map((hex) => new THREE.Color(hex));
  addInstances(flowerGeometry(), scatter(3200, CONFIG.worldRadius, () => ({
    scale: randRange(0.9, 1.5),
    tint: pick(petals),
  })).filter(({ x, z }) => mountainWeight(x, z) < 0.3), { castShadow: false, detail: true, summerOnly: true });
  addInstances(mushroomGeometry(), scatter(640, CONFIG.worldRadius, () => ({ scale: randRange(0.8, 1.8) })), { detail: true, summerOnly: true, material: smoothMaterial });
}

// Qamish yaprog'i ikki tomondan ko'rinadi, o'tdek tebranmaydi
const reedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
reedMaterial.onBeforeCompile = (shader) => {
  addSeasonShader(shader);
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
    '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif');
};
reedMaterial.customProgramCacheKey = () => 'reed';

/** Qamish: egilgan lentasimon barglar va qo'ng'ir boshoqli poya. */
function reedGeometry() {
  const parts = [];
  const blade = (angle, height, lean, width, color) => {
    const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz * width, sz = dx * width;
    const rows = [0, 0.35, 0.7, 1].map((t) => {
      const out = lean * t * t, y = height * t, w = 1 - t * 0.92;
      return [[dx * out - sx * w, y, dz * out - sz * w], [dx * out + sx * w, y, dz * out + sz * w]];
    });
    const position = [], normal = [], colors = [];
    const low = new THREE.Color(color).multiplyScalar(0.62), high = new THREE.Color(color);
    for (let i = 0; i < 3; i++) {
      const [a, b] = rows[i], [c, d] = rows[i + 1];
      for (const [point, t] of [[a, i], [b, i], [c, i + 1], [b, i], [d, i + 1], [c, i + 1]]) {
        position.push(...point);
        normal.push(dx * 0.7, 0.6, dz * 0.7);
        colors.push(...low.clone().lerp(high, t / 3).toArray());
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(position.length / 3 * 2), 2));
    return geometry;
  };
  const greens = ['#6f9a44', '#5f8a3c', '#7fa650', '#527c35', '#8aa858'];
  for (let i = 0; i < 5; i++) {
    parts.push(blade(i * 1.9 + 0.4, 1.25 + (i % 3) * 0.28, 0.22 + (i % 2) * 0.2, 0.045, greens[i]));
  }
  // Ikki poya, uchida duxobadek boshoq
  for (const [x, z, height] of [[0.03, -0.1, 2], [-0.1, 0.07, 1.65]]) {
    parts.push(
      cylinder(0.011, 0.014, height, '#7d9450', [x, height / 2, z], [0, 0, 0], 4),
      cylinder(0.038, 0.042, 0.3, '#5a3a22', [x, height + 0.1, z], [0, 0, 0], 6),
      cone(0.014, 0.12, '#6b4a2c', [x, height + 0.31, z], [0, 0, 0], 4),
    );
  }
  return merge(parts);
}

/** Nilufar: kesigi bor yassi barglar va ochilgan gul. */
function lilyGeometry() {
  const pad = (x, z, radius, turn, color) => {
    const position = [], normal = [], colors = [];
    const edge = new THREE.Color(color), heart = new THREE.Color(color).multiplyScalar(1.18);
    const steps = 11, gap = 0.5; // barg kesigi
    for (let i = 0; i < steps; i++) {
      const a = turn + gap / 2 + (i / steps) * (TAU - gap), b = turn + gap / 2 + ((i + 1) / steps) * (TAU - gap);
      position.push(x, 0.012, z, x + Math.sin(a) * radius, 0.01, z + Math.cos(a) * radius, x + Math.sin(b) * radius, 0.01, z + Math.cos(b) * radius);
      normal.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      colors.push(...heart.toArray(), ...edge.toArray(), ...edge.toArray());
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(position.length / 3 * 2), 2));
    return geometry;
  };
  const parts = [pad(0, 0, 0.42, 0.6, '#3e7f45'), pad(0.52, 0.25, 0.3, 2.9, '#4a9150'), pad(-0.2, 0.5, 0.22, 4.4, '#44894a')];
  // Gul: ikki qavat gulbarg va sariq o'rta
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU, inner = i % 2;
    const tilt = inner ? 0.5 : 1.0;
    parts.push(cone(0.035, 0.15, inner ? '#fbeef4' : '#f1d9e6',
      [0.05 + Math.sin(angle) * 0.05 * tilt, 0.05 + (inner ? 0.02 : 0), 0.02 + Math.cos(angle) * 0.05 * tilt],
      [Math.cos(angle) * tilt, 0, -Math.sin(angle) * tilt], 4));
  }
  parts.push(cylinder(0.022, 0.022, 0.05, '#f0c23c', [0.05, 0.06, 0.02], [0, 0, 0], 5));
  return merge(parts);
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
  // Botqoqda qamish qalin o'sadi
  for (let i = 0; swamp && i < 2600; i++) {
    const angle = Math.random() * TAU, distance = Math.sqrt(Math.random()) * swamp.radius;
    const x = swamp.x + Math.cos(angle) * distance, z = swamp.z + Math.sin(angle) * distance;
    const depth = waterDepth(x, z);
    if (depth > -0.6 && depth < 0.7 && Math.random() < 0.5) reeds.push({ x, z, scale: randRange(0.8, 1.5) });
  }
  addInstances(reedGeometry(), reeds, { material: reedMaterial });
  addInstances(lilyGeometry(), lilies, { castShadow: false });
}
