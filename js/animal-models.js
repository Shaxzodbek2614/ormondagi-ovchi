'use strict';

/* ==========================================================================
   HAYVON MODELLARI
   Tana qutilardan emas, yumaloq kesimlardan "cho'zib" yasaladi (loft). Har bir model
   oldinga (+Z) qaraydi, oyoqlari y=0 da turadi. Bo'g'inlar alohida qismlar: ularni
   aylantirib animatsiya qilamiz.
   ========================================================================== */

/** Hayvon junini eslatuvchi mayda tolali tekstura. */
function createFurTexture() {
  const size = 256;
  const paper = document.createElement('canvas');
  paper.width = paper.height = size;
  const pen = paper.getContext('2d');
  pen.fillStyle = '#e6e6e6';
  pen.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const shade = Math.floor(randRange(165, 255));
    pen.strokeStyle = `rgba(${shade},${shade},${shade},.5)`;
    pen.lineWidth = randRange(0.5, 1.4);
    const x = Math.random() * size, y = Math.random() * size;
    pen.beginPath();
    pen.moveTo(x, y);
    pen.lineTo(x + randRange(-2, 2), y + randRange(4, 9));
    pen.stroke();
  }
  const texture = new THREE.CanvasTexture(paper);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const furMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: createFurTexture() });

const catmullRom = (a, b, c, d, t) => 0.5 * (
  2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t
);

/**
 * Yumaloq kesimlar orqali silliq tana yasaydi.
 * @param rings [y, z, kenglik, balandlik] ko'rinishidagi kesimlar (yarim o'lchamlarda)
 * @param options.top   orqa tomon rangi
 * @param options.bottom qorin tomon rangi (berilmasa top bilan bir xil)
 * @param options.tip   [rang, boshlanishi]: uchiga yaqin rang (tumshuq, tuyoq, dum uchi)
 */
function loft(rings, { top, bottom = top, tip, sides = 12, steps = 4, mottle = 0.05 }) {
  // Kesimlar orasini silliq egri chiziq bilan to'ldiramiz
  const path = [];
  const at = (index) => rings[clamp(index, 0, rings.length - 1)];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      path.push([0, 1, 2, 3].map((k) => catmullRom(at(i - 1)[k], at(i)[k], at(i + 1)[k], at(i + 2)[k], t)));
    }
  }
  path.push(rings[rings.length - 1]);

  const positions = [], colors = [], uvs = [], indices = [];
  const topColor = new THREE.Color(top), bottomColor = new THREE.Color(bottom);
  const tipColor = tip && new THREE.Color(tip[0]);
  const color = new THREE.Color();

  const addVertex = (x, y, z, side, progress) => {
    positions.push(x, y, z);
    uvs.push((x + y) * 2.2, (z + y * 0.5) * 2.2);
    color.lerpColors(bottomColor, topColor, smoothstep(side, -0.55, 0.4));
    if (tip) color.lerp(tipColor, smoothstep(progress, tip[1], tip[1] + 0.07));
    const speck = 1 + (Math.random() - 0.5) * 2 * mottle;
    colors.push(color.r * speck, color.g * speck, color.b * speck);
  };

  path.forEach(([y, z, width, height], ringIndex) => {
    // Kesim tekisligi yo'nalishga perpendikulyar turadi, shuning uchun bo'yin va oyoqlar ham to'g'ri chiqadi
    const next = path[Math.min(ringIndex + 1, path.length - 1)];
    const previous = path[Math.max(ringIndex - 1, 0)];
    const tangentY = next[0] - previous[0], tangentZ = next[1] - previous[1];
    const length = Math.hypot(tangentY, tangentZ) || 1;
    const normalY = tangentZ / length, normalZ = -tangentY / length;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * TAU;
      const side = Math.sin(angle);
      addVertex(Math.cos(angle) * width, y + normalY * side * height, z + normalZ * side * height, side, ringIndex / (path.length - 1));
    }
  });

  for (let ring = 0; ring < path.length - 1; ring++) {
    for (let i = 0; i < sides; i++) {
      const a = ring * sides + i, b = ring * sides + ((i + 1) % sides);
      const c = a + sides, d = b + sides;
      indices.push(a, b, c, b, d, c);
    }
  }

  // Ikki uchini yopamiz
  const capEnd = (ringIndex, flipped) => {
    const [y, z] = path[ringIndex];
    const center = positions.length / 3;
    addVertex(0, y, z, 0, ringIndex / (path.length - 1));
    for (let i = 0; i < sides; i++) {
      const a = ringIndex * sides + i, b = ringIndex * sides + ((i + 1) % sides);
      if (flipped) indices.push(center, b, a);
      else indices.push(center, a, b);
    }
  };
  capEnd(0, true);
  capEnd(path.length - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry.toNonIndexed();
}

/** Oyoq kabi ingichka qismlar uchun yengilroq loft. */
const limb = (rings, options) => loft(rings, { sides: 8, steps: 2, ...options });

/** Silliq shar yoki ellipsoid. */
const blob = (radius, color, position, scale, rotation) =>
  painted(new THREE.SphereGeometry(radius, 10, 8), color, position, rotation, scale);

/** Ikki ko'z: yaltirashi uchun ustiga kichkina oq nuqta qo'yiladi. */
function eyes(x, y, z, radius, iris = '#120c08') {
  return [-1, 1].flatMap((side) => [
    blob(radius, iris, [side * x, y, z]),
    blob(radius * 0.34, '#ffffff', [side * (x + radius * 0.6), y + radius * 0.5, z + radius * 0.5]),
  ]);
}

/** Bir juft oyoq: chap va o'ng. */
function legPair(x, y, z, upper, knee, lower) {
  return [-1, 1].map((side) => ({ pivot: [side * x, y, z], upper, knee, lower }));
}

/** Quloqlar boshga alohida ulanadi, shunda ular qimirlay oladi. */
function earPair(x, y, z, geometry, tiltX, tiltZ) {
  return { geometry, tiltX, tiltZ, pivots: [[-x, y, z], [x, y, z]] };
}

function deerModel({ back = '#8c5c36', belly = '#dcc6a2', dark = '#5e3c24' } = {}) {
  const hoof = '#1d1612', bone = '#ddcfae';
  const antler = (side) => [
    cylinder(0.017, 0.028, 0.32, bone, [side * 0.1, 0.25, -0.07], [-0.25, 0, -side * 0.4], 5),
    cylinder(0.012, 0.018, 0.3, bone, [side * 0.2, 0.48, -0.05], [0.35, 0, -side * 0.25], 5),
    cylinder(0.008, 0.015, 0.17, bone, [side * 0.13, 0.31, 0.05], [1, 0, -side * 0.2], 5),
    cylinder(0.007, 0.013, 0.17, bone, [side * 0.26, 0.6, 0.06], [0.9, 0, -side * 0.4], 5),
  ];
  return {
    body: loft([
      [1.2, -0.8, 0.03, 0.03], [1.2, -0.74, 0.15, 0.19], [1.19, -0.55, 0.235, 0.285], [1.15, -0.2, 0.25, 0.295],
      [1.14, 0.15, 0.255, 0.31], [1.17, 0.42, 0.235, 0.315], [1.22, 0.62, 0.17, 0.255], [1.27, 0.74, 0.05, 0.08],
    ], { top: back, bottom: belly }),
    neck: {
      pivot: [0, 1.28, 0.58],
      geometry: loft([
        [-0.05, -0.06, 0.15, 0.2], [0.2, 0.1, 0.115, 0.15], [0.46, 0.23, 0.09, 0.105], [0.66, 0.32, 0.08, 0.085],
      ], { top: back, bottom: belly, sides: 10, steps: 3 }),
    },
    head: {
      pivot: [0, 0.66, 0.32],
      geometry: merge(
        loft([
          [0.02, -0.12, 0.05, 0.05], [0.04, -0.06, 0.095, 0.1], [0.03, 0.05, 0.1, 0.105],
          [-0.01, 0.17, 0.072, 0.075], [-0.04, 0.28, 0.05, 0.052], [-0.05, 0.34, 0.03, 0.03],
        ], { top: back, bottom: belly, tip: ['#1c1412', 0.88], sides: 10 }),
        eyes(0.088, 0.065, 0.06, 0.024),
        antler(-1), antler(1),
      ),
    },
    ears: earPair(0.075, 0.1, -0.05, painted(new THREE.ConeGeometry(0.065, 0.24, 8), dark, [0, 0.11, 0], [0, 0, 0], [1, 1, 0.4]), -0.1, 1.05),
    tail: {
      pivot: [0, 1.3, -0.76],
      rest: 0.2,
      geometry: limb([[0, 0, 0.05, 0.03], [-0.1, -0.06, 0.06, 0.035], [-0.2, -0.08, 0.02, 0.02]], { top: dark, bottom: '#f3ecdf' }),
    },
    legs: [
      ...legPair(0.13, 1.02, 0.46,
        limb([[0.05, 0, 0.075, 0.085], [-0.2, 0, 0.06, 0.07], [-0.42, 0.01, 0.04, 0.045]], { top: back, bottom: dark }),
        [0, -0.42, 0.01],
        limb([[0, 0, 0.036, 0.04], [-0.25, -0.01, 0.026, 0.03], [-0.5, 0, 0.028, 0.034], [-0.56, 0.01, 0.034, 0.042]], { top: dark, tip: [hoof, 0.72] })),
      ...legPair(0.14, 1.08, -0.5,
        limb([[0.08, 0, 0.1, 0.14], [-0.18, -0.03, 0.085, 0.12], [-0.4, -0.1, 0.045, 0.05]], { top: back, bottom: dark }),
        [0, -0.4, -0.1],
        limb([[0, 0, 0.04, 0.05], [-0.2, 0.02, 0.028, 0.034], [-0.6, 0.06, 0.027, 0.032], [-0.66, 0.07, 0.034, 0.042]], { top: dark, tip: [hoof, 0.76] })),
    ],
    hitBody: { size: [0.66, 1.05, 1.95], center: [0, 1.02, 0] },
    hitNeck: { size: [0.28, 0.8, 0.36], center: [0, 0.3, 0.14] },
    hitHead: { size: [0.3, 0.34, 0.62], center: [0, 0.03, 0.1] },
  };
}

function rabbitModel() {
  const fur = '#a8937a', pale = '#e0d6c6', white = '#f6f2ea', pink = '#dba09c';
  const ear = merge(
    blob(0.05, fur, [0, 0.16, 0], [0.9, 3.4, 0.35]),
    blob(0.034, pink, [0, 0.16, 0.012], [0.9, 3.5, 0.3]),
  );
  return {
    body: loft([
      [0.33, -0.27, 0.04, 0.04], [0.33, -0.22, 0.13, 0.14], [0.33, -0.1, 0.165, 0.175],
      [0.31, 0.06, 0.14, 0.145], [0.33, 0.17, 0.1, 0.11], [0.35, 0.22, 0.04, 0.05],
    ], { top: fur, bottom: pale, sides: 10 }),
    neck: {
      pivot: [0, 0.4, 0.16],
      geometry: limb([[-0.03, -0.02, 0.08, 0.085], [0.05, 0.05, 0.075, 0.075], [0.09, 0.08, 0.07, 0.07]], { top: fur, bottom: pale }),
    },
    head: {
      pivot: [0, 0.1, 0.09],
      geometry: merge(
        loft([
          [0, -0.09, 0.04, 0.04], [0.02, -0.05, 0.09, 0.09], [0.01, 0.04, 0.092, 0.09],
          [-0.02, 0.12, 0.06, 0.06], [-0.03, 0.17, 0.02, 0.02],
        ], { top: fur, bottom: pale, tip: [pink, 0.9], sides: 10, steps: 3 }),
        eyes(0.075, 0.045, 0.03, 0.02),
      ),
    },
    ears: earPair(0.045, 0.085, -0.03, ear, -0.25, 0.14),
    tail: { pivot: [0, 0.37, -0.25], rest: 0, geometry: lumpy(0.075, white, [0, 0, 0], [1, 1, 1], 0.12) },
    legs: [
      ...legPair(0.07, 0.21, 0.13,
        limb([[0.03, 0, 0.03, 0.035], [-0.08, 0.01, 0.025, 0.03]], { top: fur, bottom: pale }),
        [0, -0.08, 0.01],
        limb([[0, 0, 0.024, 0.028], [-0.1, 0.015, 0.022, 0.028], [-0.125, 0.03, 0.03, 0.04]], { top: pale })),
      ...legPair(0.125, 0.26, -0.14,
        limb([[0.06, 0, 0.06, 0.1], [-0.06, 0.02, 0.055, 0.09], [-0.13, -0.02, 0.03, 0.04]], { top: fur, bottom: pale }),
        [0, -0.13, -0.02],
        limb([[0, 0, 0.03, 0.03], [-0.09, 0.03, 0.03, 0.03], [-0.12, 0.12, 0.028, 0.03], [-0.125, 0.16, 0.02, 0.02]], { top: pale })),
    ],
    hitBody: { size: [0.52, 0.55, 0.85], center: [0, 0.32, -0.02] },
    hitHead: { size: [0.26, 0.42, 0.36], center: [0, 0.07, 0.05] },
  };
}

function boarModel() {
  const hide = '#4b382e', belly = '#6b5444', dark = '#2a1f1a', snout = '#a07a68', tusk = '#f0e7d0', hoof = '#17110e';
  // Orqa bo'ylab tik turgan qillar
  const bristles = [];
  for (let z = -0.55; z < 0.6; z += 0.1) {
    const height = 1.22 + 0.1 * smoothstep(z, -0.5, 0.35);
    bristles.push(cone(0.05, 0.2, dark, [0, height, z], [-0.45, 0, 0], 4));
  }
  const tuskPair = [-1, 1].map((side) => cone(0.032, 0.2, tusk, [side * 0.105, -0.13, 0.42], [0.45, 0, -side * 0.3], 6));
  return {
    body: merge(
      loft([
        [0.78, -0.82, 0.05, 0.05], [0.8, -0.76, 0.24, 0.27], [0.82, -0.45, 0.33, 0.36], [0.86, -0.05, 0.36, 0.4],
        [0.92, 0.3, 0.37, 0.44], [0.93, 0.52, 0.3, 0.39], [0.9, 0.66, 0.12, 0.16],
      ], { top: hide, bottom: belly, mottle: 0.1 }),
      bristles,
    ),
    neck: {
      pivot: [0, 0.92, 0.56],
      geometry: loft([[0, -0.08, 0.27, 0.33], [0, 0.1, 0.24, 0.28], [-0.03, 0.22, 0.2, 0.22]], { top: hide, bottom: belly, sides: 10, steps: 3, mottle: 0.1 }),
    },
    head: {
      pivot: [0, -0.03, 0.22],
      geometry: merge(
        loft([
          [0.05, -0.1, 0.1, 0.1], [0.03, 0, 0.19, 0.2], [-0.02, 0.15, 0.17, 0.17], [-0.07, 0.32, 0.115, 0.115],
          [-0.1, 0.46, 0.095, 0.09], [-0.1, 0.52, 0.09, 0.085], [-0.1, 0.54, 0.05, 0.05],
        ], { top: hide, bottom: belly, tip: [snout, 0.84], mottle: 0.1 }),
        eyes(0.145, 0.06, 0.16, 0.022, '#2a0d06'),
        tuskPair,
      ),
    },
    ears: earPair(0.13, 0.16, -0.02, painted(new THREE.ConeGeometry(0.085, 0.2, 8), dark, [0, 0.09, 0], [0, 0, 0], [1, 1, 0.4]), -0.2, 0.55),
    tail: {
      pivot: [0, 0.94, -0.8],
      rest: 0.3,
      geometry: limb([[0, 0, 0.022, 0.022], [-0.12, -0.05, 0.016, 0.016], [-0.24, -0.04, 0.012, 0.012]], { top: dark }),
    },
    legs: [
      ...legPair(0.2, 0.55, 0.42,
        limb([[0.05, 0, 0.1, 0.12], [-0.14, 0, 0.075, 0.085], [-0.25, 0, 0.055, 0.06]], { top: hide, bottom: dark }),
        [0, -0.25, 0],
        limb([[0, 0, 0.05, 0.055], [-0.2, 0, 0.045, 0.05], [-0.29, 0.01, 0.055, 0.065]], { top: dark, tip: [hoof, 0.6] })),
      ...legPair(0.19, 0.58, -0.5,
        limb([[0.08, 0, 0.12, 0.17], [-0.12, -0.02, 0.09, 0.12], [-0.27, -0.06, 0.055, 0.06]], { top: hide, bottom: dark }),
        [0, -0.27, -0.06],
        limb([[0, 0, 0.05, 0.055], [-0.12, 0.02, 0.04, 0.045], [-0.3, 0.04, 0.055, 0.065]], { top: dark, tip: [hoof, 0.6] })),
    ],
    hitBody: { size: [0.95, 1.1, 1.9], center: [0, 0.76, -0.05] },
    hitHead: { size: [0.52, 0.52, 0.82], center: [0, -0.03, 0.2] },
  };
}

/** Bo'ri va tulki bir xil tana tuzilishiga ega, faqat ranglari va nisbatlari farq qiladi. */
function canineModel({ back, belly, sock, tailTip, muzzle, earScale = 1, tailScale = 1 }) {
  const ear = painted(new THREE.ConeGeometry(0.06 * earScale, 0.16 * earScale, 8), back, [0, 0.07 * earScale, 0], [0, 0, 0], [1, 1, 0.45]);
  const t = tailScale;
  return {
    body: loft([
      [0.86, -0.66, 0.04, 0.05], [0.86, -0.6, 0.14, 0.16], [0.86, -0.3, 0.175, 0.2], [0.84, 0, 0.175, 0.215],
      [0.87, 0.28, 0.185, 0.25], [0.92, 0.46, 0.16, 0.22], [0.96, 0.58, 0.07, 0.09],
    ], { top: back, bottom: belly, mottle: 0.08 }),
    neck: {
      pivot: [0, 0.98, 0.46],
      geometry: loft([[-0.05, -0.05, 0.14, 0.17], [0.1, 0.1, 0.115, 0.13], [0.2, 0.22, 0.1, 0.105]], { top: back, bottom: belly, sides: 10, steps: 3, mottle: 0.08 }),
    },
    head: {
      pivot: [0, 0.2, 0.24],
      geometry: merge(
        loft([
          [0.04, -0.1, 0.05, 0.05], [0.05, -0.03, 0.115, 0.105], [0.02, 0.08, 0.1, 0.09],
          [-0.02, 0.2, 0.055, 0.05], [-0.035, 0.3, 0.04, 0.035], [-0.04, 0.34, 0.02, 0.02],
        ], { top: back, bottom: muzzle, tip: ['#141010', 0.9], sides: 10 }),
        eyes(0.075, 0.06, 0.07, 0.018, '#2a1a08'),
      ),
    },
    ears: earPair(0.07, 0.13, -0.04, ear, -0.1, 0.22),
    tail: {
      pivot: [0, 0.92, -0.62],
      rest: 0.15,
      geometry: limb([
        [0, 0, 0.05 * t, 0.055 * t], [-0.16 * t, -0.12 * t, 0.075 * t, 0.08 * t],
        [-0.34 * t, -0.2 * t, 0.07 * t, 0.075 * t], [-0.48 * t, -0.24 * t, 0.02, 0.02],
      ], { top: back, bottom: belly, tip: [tailTip, 0.62], steps: 3 }),
    },
    legs: [
      ...legPair(0.11, 0.72, 0.38,
        limb([[0.04, 0, 0.06, 0.075], [-0.15, 0, 0.05, 0.055], [-0.3, 0.01, 0.035, 0.04]], { top: back, bottom: belly }),
        [0, -0.3, 0.01],
        limb([[0, 0, 0.032, 0.036], [-0.2, 0, 0.026, 0.03], [-0.38, 0.02, 0.032, 0.042], [-0.41, 0.04, 0.02, 0.03]], { top: sock })),
      ...legPair(0.115, 0.76, -0.44,
        limb([[0.06, 0, 0.08, 0.12], [-0.14, -0.03, 0.07, 0.095], [-0.3, -0.08, 0.04, 0.045]], { top: back, bottom: belly }),
        [0, -0.3, -0.08],
        limb([[0, 0, 0.035, 0.04], [-0.18, 0.03, 0.026, 0.03], [-0.43, 0.05, 0.03, 0.04], [-0.46, 0.07, 0.02, 0.03]], { top: sock })),
    ],
    hitBody: { size: [0.54, 0.9, 1.45], center: [0, 0.74, 0] },
    hitNeck: { size: [0.3, 0.36, 0.42], center: [0, 0.08, 0.1] },
    hitHead: { size: [0.3, 0.3, 0.52], center: [0, 0.02, 0.1] },
  };
}

function bearModel() {
  const back = '#46321f', belly = '#694b33', muzzle = '#a98a66', claw = '#1a1410';
  const ear = blob(0.085, back, [0, 0.03, 0], [1, 1, 0.45]);
  return {
    body: loft([
      [1, -1, 0.08, 0.08], [1.02, -0.92, 0.36, 0.4], [1.06, -0.55, 0.52, 0.58], [1.1, -0.1, 0.56, 0.62],
      [1.14, 0.35, 0.54, 0.62], [1.12, 0.66, 0.42, 0.5], [1.06, 0.82, 0.16, 0.2],
    ], { top: back, bottom: belly, sides: 14, mottle: 0.1 }),
    neck: {
      pivot: [0, 1.12, 0.72],
      geometry: loft([[0, -0.1, 0.36, 0.42], [-0.02, 0.12, 0.3, 0.33], [-0.06, 0.3, 0.25, 0.26]], { top: back, bottom: belly, sides: 12, steps: 3, mottle: 0.1 }),
    },
    head: {
      pivot: [0, -0.04, 0.32],
      geometry: merge(
        loft([
          [0.05, -0.14, 0.08, 0.08], [0.06, -0.06, 0.22, 0.21], [0.03, 0.08, 0.23, 0.215], [-0.03, 0.22, 0.14, 0.13],
          [-0.07, 0.34, 0.095, 0.085], [-0.08, 0.4, 0.06, 0.055], [-0.08, 0.42, 0.02, 0.02],
        ], { top: back, bottom: muzzle, tip: ['#17110e', 0.9], mottle: 0.1 }),
        eyes(0.125, 0.1, 0.13, 0.022),
      ),
    },
    ears: earPair(0.17, 0.21, -0.03, ear, 0, 0.35),
    tail: { pivot: [0, 1.1, -0.96], rest: 0, geometry: blob(0.08, back, [0, 0, -0.03]) },
    legs: [
      ...legPair(0.3, 0.82, 0.5,
        limb([[0.12, 0, 0.17, 0.2], [-0.2, 0, 0.15, 0.17], [-0.38, 0, 0.12, 0.13]], { top: back, bottom: belly }),
        [0, -0.38, 0],
        limb([[0, 0, 0.115, 0.125], [-0.25, 0.01, 0.105, 0.115], [-0.4, 0.04, 0.125, 0.16], [-0.44, 0.07, 0.06, 0.1]], { top: back, tip: [claw, 0.7] })),
      ...legPair(0.3, 0.9, -0.6,
        limb([[0.15, 0, 0.21, 0.3], [-0.18, -0.03, 0.17, 0.22], [-0.42, -0.06, 0.125, 0.14]], { top: back, bottom: belly }),
        [0, -0.42, -0.06],
        limb([[0, 0, 0.12, 0.125], [-0.26, 0.02, 0.1, 0.11], [-0.44, 0.08, 0.125, 0.17], [-0.48, 0.12, 0.06, 0.1]], { top: back, tip: [claw, 0.72] })),
    ],
    hitBody: { size: [1.3, 1.55, 2.35], center: [0, 0.98, -0.05] },
    hitHead: { size: [0.56, 0.52, 0.78], center: [0, 0.03, 0.14] },
  };
}

function duckModel() {
  const back = '#7c6b58', belly = '#d3c8b6', green = '#1e5c3c', wing = '#6a5a49';
  return {
    body: merge(
      loft([
        [0.18, -0.24, 0.02, 0.015], [0.19, -0.2, 0.07, 0.05], [0.16, -0.08, 0.125, 0.1],
        [0.15, 0.06, 0.13, 0.105], [0.17, 0.16, 0.09, 0.085], [0.2, 0.22, 0.03, 0.03],
      ], { top: back, bottom: belly, sides: 10, mottle: 0.03 }),
      blob(0.06, '#f4efe4', [0, 0.235, 0.17], [1, 0.4, 1]),
    ),
    neck: {
      pivot: [0, 0.22, 0.18],
      geometry: limb([[-0.02, -0.02, 0.05, 0.055], [0.08, 0.03, 0.04, 0.04], [0.16, 0.04, 0.04, 0.04]], { top: green, mottle: 0.02 }),
    },
    head: {
      pivot: [0, 0.18, 0.05],
      geometry: merge(
        loft([[0, -0.05, 0.03, 0.03], [0.01, -0.02, 0.055, 0.055], [0.01, 0.04, 0.055, 0.05], [-0.01, 0.08, 0.03, 0.025]], { top: green, sides: 10, steps: 3, mottle: 0.02 }),
        blob(0.03, '#d9a520', [0, -0.012, 0.11], [1, 0.42, 1.5]),
        eyes(0.046, 0.025, 0.02, 0.011),
      ),
    },
    tail: { pivot: [0, 0.2, -0.22], rest: -0.5, geometry: painted(new THREE.ConeGeometry(0.05, 0.12, 6), '#e6e0d2', [0, 0, -0.04], [-Math.PI / 2, 0, 0], [1, 0.8, 0.5]) },
    wings: { geometry: blob(0.1, wing, [0.1, 0, -0.03], [1.25, 0.12, 0.68]), pivots: [[-0.09, 0.2, 0.02], [0.09, 0.2, 0.02]] },
    legs: [],
    hitBody: { size: [0.62, 0.62, 0.86], center: [0, 0.24, 0] },
    hitHead: { size: [0.2, 0.26, 0.3], center: [0, 0, 0.04] },
  };
}

function fishModel() {
  const fin = painted(new THREE.ConeGeometry(0.13, 0.2, 6), '#3d5a5a', [0, 0, -0.08], [-Math.PI / 2, 0, 0], [0.2, 1, 1]);
  return {
    body: merge(
      loft([
        [0, -0.32, 0.01, 0.02], [0, -0.24, 0.03, 0.05], [0, -0.05, 0.07, 0.12],
        [0, 0.1, 0.07, 0.11], [0, 0.22, 0.04, 0.06], [0, 0.27, 0.01, 0.015],
      ], { top: '#3d5a5a', bottom: '#dfe4e4', sides: 10, mottle: 0.1 }),
      eyes(0.05, 0.03, 0.17, 0.014),
      painted(new THREE.ConeGeometry(0.1, 0.16, 5), '#335050', [0, 0.14, 0], [0, 0, 0], [0.15, 1, 1]),
    ),
    tail: { pivot: [0, 0, -0.3], rest: 0, geometry: fin },
    legs: [],
    hitBody: { size: [0.42, 0.5, 0.9], center: [0, 0, 0] },
  };
}
