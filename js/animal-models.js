'use strict';

/* ==========================================================================
   HAYVON MODELLARI
   Tana qutilardan emas, yumaloq kesimlardan "cho'zib" yasaladi (loft). Har bir model
   oldinga (+Z) qaraydi, oyoqlari y=0 da turadi. Bo'g'inlar alohida qismlar: ularni
   aylantirib animatsiya qilamiz.
   Ko'rinish dunyo urug'iga ta'sir qilmaydi: tasodif artRandom'dan olinadi.
   ========================================================================== */

/** Hayvon junini eslatuvchi mayda tolali tekstura: tolalar tana bo'ylab yotadi. */
function createFurTexture() {
  const size = 256;
  const paper = document.createElement('canvas');
  paper.width = paper.height = size;
  const pen = paper.getContext('2d');
  pen.fillStyle = '#dedede';
  pen.fillRect(0, 0, size, size);
  const strand = (shade, alpha, width, length) => {
    pen.strokeStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    pen.lineWidth = width;
    const x = artRandom() * size, y = artRandom() * size, lean = artRange(-2.5, 2.5);
    // Chetdan chiqqan tola qarama-qarshi chetdan davom etadi: tekstura choksiz takrorlanadi
    for (const [ox, oy] of [[0, 0], [0, -size], [-size, 0], [size, 0]]) {
      pen.beginPath();
      pen.moveTo(x + ox, y + oy);
      pen.quadraticCurveTo(x + ox + lean, y + oy + length * 0.5, x + ox + lean * 0.6, y + oy + length);
      pen.stroke();
    }
  };
  for (let i = 0; i < 7000; i++) strand(Math.floor(artRange(150, 255)), 0.45, artRange(0.5, 1.3), artRange(5, 12));
  for (let i = 0; i < 900; i++) strand(Math.floor(artRange(90, 140)), 0.35, artRange(0.5, 1), artRange(7, 15)); // to'q qil
  const texture = new THREE.CanvasTexture(paper);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const furMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: createFurTexture() });
// Jun chetida yorug'lik sochiladi: tana silliq plastmassadek emas, momiqdek ko'rinadi
furMaterial.onBeforeCompile = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
    float fuzz = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);
    outgoingLight *= 1.0 + fuzz * 0.6;
    #include <opaque_fragment>`);
};
furMaterial.customProgramCacheKey = () => 'fur';

const catmullRom = (a, b, c, d, t) => 0.5 * (
  2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t
);

/**
 * Yumaloq kesimlar orqali silliq tana yasaydi.
 * @param rings [y, z, kenglik, balandlik] ko'rinishidagi kesimlar (yarim o'lchamlarda)
 * @param options.top    orqa tomon rangi
 * @param options.bottom qorin tomon rangi (berilmasa top bilan bir xil)
 * @param options.tip    [rang, boshlanishi]: uchiga yaqin rang (tumshuq, tuyoq, dum uchi)
 * @param options.ridge  kesim tuxumsimon bo'ladi: umurtqa tor, qorin keng (0 = ellips)
 * @param options.stripe [rang, kenglik, kuch]: umurtqa bo'ylab to'q yo'l
 * @param options.paint  (rang, { x, y, z, side, progress }) => rangni joyida o'zgartiradi (dog', oq dumg'aza)
 */
function loft(rings, { top, bottom = top, tip, sides = 12, steps = 4, mottle = 0.05, ridge = 0, stripe, paint } = {}) {
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
  const stripeColor = stripe && new THREE.Color(stripe[0]);
  const color = new THREE.Color();

  const addVertex = (x, y, z, side, progress) => {
    positions.push(x, y, z);
    uvs.push((x + y) * 2.2, (z + y * 0.5) * 2.2);
    color.lerpColors(bottomColor, topColor, smoothstep(side, -0.55, 0.4));
    if (stripe) color.lerp(stripeColor, smoothstep(side, 1 - stripe[1], 1) * (stripe[2] ?? 0.6));
    if (tip) color.lerp(tipColor, smoothstep(progress, tip[1], tip[1] + 0.07));
    if (paint) paint(color, { x, y, z, side, progress });
    // Mayda dog' va yirikroq to'lqin: jun bir tekis bo'yalgandek ko'rinmaydi
    const speck = 1 + (artRandom() - 0.5) * 2 * mottle + (valueNoise(x * 9 + y * 7, z * 9 - y * 5) - 0.5) * 2 * mottle;
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
      addVertex(Math.cos(angle) * width * (1 - ridge * side), y + normalY * side * height, z + normalZ * side * height, side, ringIndex / (path.length - 1));
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

/** Mayda detal uchun yengil shar: barmoq, burun teshigi, dog'. */
const bead = (radius, color, position, scale, rotation) =>
  painted(new THREE.SphereGeometry(radius, 6, 4), color, position, rotation, scale);

/** Ikki ko'z: yaltirashi uchun ustiga kichkina oq nuqta qo'yiladi. */
function eyes(x, y, z, radius, iris = '#120c08') {
  return [-1, 1].flatMap((side) => [
    blob(radius, iris, [side * x, y, z]),
    bead(radius * 0.34, '#ffffff', [side * (x + radius * 0.6), y + radius * 0.5, z + radius * 0.5]),
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

/** Barg shaklidagi quloq: orqasi jun, old tomoni och va biroz botiq. */
function earLeaf(length, width, outer, inner, thick = 0.014) {
  return loft([
    [0, 0, width * 0.5, thick * 1.7], [length * 0.3, -thick, width, thick], [length * 0.65, -thick * 0.5, width * 0.8, thick],
    [length * 0.9, 0.008, width * 0.36, thick * 0.7], [length, 0.014, 0.006, 0.004],
  ], { top: outer, bottom: inner, sides: 8, steps: 2, mottle: 0.04 });
}

/** Panja: yostiqcha, oldinga chiqqan barmoqlar va (berilsa) tirnoqlar. */
function paw(y, z, size, color, claw) {
  const parts = [bead(size, color, [0, y, z], [1, 0.62, 1.25])];
  for (const side of [-1, 0, 1]) {
    const x = side * size * 0.58;
    parts.push(bead(size * 0.46, color, [x, y - size * 0.14, z + size * 1.05], [1, 0.8, 1.35]));
    if (claw) parts.push(cone(size * 0.13, size * 0.55, claw, [x, y - size * 0.28, z + size * 1.6], [1.9, 0, 0], 4));
  }
  return parts;
}

function deerModel({ back = '#8c5c36', belly = '#dcc6a2', dark = '#5e3c24', horns = false } = {}) {
  const hoof = '#1d1612', bone = '#d9c9a4', hornColor = '#5d4c38', nose = '#1c1412';
  const spine = new THREE.Color(back).multiplyScalar(0.7), rump = new THREE.Color(belly).lerp(WHITE, 0.4);
  const coat = { top: back, bottom: belly, stripe: [spine, 0.22, 0.55] };

  // Tog' echkisi shoxi: orqaga qayrilgan, halqa-halqa yo'g'on yoy
  const horn = (side) => {
    const path = [], radii = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, angle = t * 2.1;
      path.push([side * (0.055 + t * 0.06), 0.09 + Math.sin(angle) * 0.3, -0.03 - (1 - Math.cos(angle)) * 0.3]);
      radii.push(lerp(0.042, 0.009, t) * (i % 2 ? 1.14 : 0.92));
    }
    return [tube(path, radii, hornColor, { sides: 6, colorAt: (i) => blend('#4a3c2c', '#8a7860', i / 10) })];
  };
  // Bug'u shoxi: asosiy tana va undan chiqqan uch o'siq
  const antler = (side) => (horns ? horn(side) : [
    tube([[side * 0.07, 0.12, -0.06], [side * 0.1, 0.22, -0.08], [side * 0.17, 0.37, -0.13], [side * 0.24, 0.52, -0.11], [side * 0.27, 0.65, -0.02], [side * 0.25, 0.74, 0.08]],
      [0.024, 0.021, 0.018, 0.015, 0.012, 0.005], bone, { sides: 5 }),
    tube([[side * 0.095, 0.21, -0.075], [side * 0.11, 0.28, 0.02], [side * 0.12, 0.37, 0.09]], [0.015, 0.012, 0.004], bone, { sides: 4 }),
    tube([[side * 0.17, 0.37, -0.13], [side * 0.2, 0.47, -0.21], [side * 0.21, 0.57, -0.25]], [0.014, 0.011, 0.004], bone, { sides: 4 }),
    tube([[side * 0.245, 0.53, -0.105], [side * 0.31, 0.61, -0.1], [side * 0.36, 0.7, -0.07]], [0.013, 0.01, 0.004], bone, { sides: 4 }),
  ]);
  const ear = earLeaf(0.25, 0.062, dark, new THREE.Color(belly).lerp(new THREE.Color('#d9a59a'), 0.35));

  return {
    body: loft([
      [1.2, -0.8, 0.03, 0.03], [1.2, -0.76, 0.13, 0.17], [1.195, -0.63, 0.215, 0.265], [1.18, -0.42, 0.25, 0.295],
      [1.17, -0.16, 0.235, 0.27], [1.13, 0.1, 0.25, 0.3], [1.12, 0.34, 0.25, 0.33], [1.16, 0.52, 0.215, 0.31],
      [1.23, 0.66, 0.14, 0.21], [1.28, 0.75, 0.04, 0.06],
    ], {
      ...coat, ridge: 0.12,
      // Dumg'aza atrofi oq
      paint: (color, p) => color.lerp(rump, smoothstep(-p.z, 0.6, 0.74) * smoothstep(-p.side, -0.7, 0.1) * 0.85),
    }),
    neck: {
      pivot: [0, 1.28, 0.58],
      geometry: loft([
        [-0.1, -0.12, 0.17, 0.23], [-0.03, -0.05, 0.15, 0.2], [0.2, 0.1, 0.115, 0.15], [0.46, 0.23, 0.09, 0.105], [0.66, 0.32, 0.08, 0.085],
      ], { ...coat, sides: 10, steps: 3 }),
    },
    head: {
      pivot: [0, 0.66, 0.32],
      geometry: merge(
        loft([
          [0.02, -0.13, 0.04, 0.04], [0.045, -0.07, 0.092, 0.1], [0.05, 0.02, 0.104, 0.108], [0.025, 0.1, 0.092, 0.092],
          [-0.005, 0.19, 0.066, 0.068], [-0.03, 0.28, 0.052, 0.054], [-0.04, 0.335, 0.046, 0.046], [-0.045, 0.356, 0.022, 0.024],
        ], { top: back, bottom: belly, tip: [nose, 0.9], sides: 10 }),
        eyes(0.089, 0.065, 0.06, 0.025),
        bead(0.012, '#0c0908', [0.02, -0.03, 0.352]), bead(0.012, '#0c0908', [-0.02, -0.03, 0.352]),
        horns ? [cone(0.028, 0.13, dark, [0, -0.1, 0.2], [Math.PI - 0.25, 0, 0], 5)] : [], // echki soqoli
        antler(-1), antler(1),
      ),
    },
    ears: earPair(0.075, 0.1, -0.05, ear, -0.1, 1.05),
    tail: {
      pivot: [0, 1.3, -0.76],
      rest: 0.2,
      geometry: limb([[0.02, 0.02, 0.04, 0.03], [-0.05, -0.04, 0.062, 0.036], [-0.14, -0.08, 0.05, 0.03], [-0.21, -0.085, 0.015, 0.015]], { top: dark, bottom: '#f6f0e4' }),
    },
    legs: [
      ...legPair(0.13, 1.02, 0.46,
        limb([[0.16, -0.02, 0.07, 0.12], [0.02, 0, 0.082, 0.1], [-0.16, 0.01, 0.062, 0.075], [-0.32, 0.015, 0.046, 0.052], [-0.42, 0.01, 0.04, 0.044]], { top: back, bottom: dark }),
        [0, -0.42, 0.01],
        limb([[0.01, 0, 0.04, 0.046], [-0.07, 0.004, 0.03, 0.034], [-0.3, -0.005, 0.024, 0.028], [-0.44, 0, 0.028, 0.033], [-0.5, 0.008, 0.024, 0.028], [-0.555, 0.018, 0.033, 0.042]],
          { top: dark, tip: [hoof, 0.86] })),
      ...legPair(0.14, 1.08, -0.5,
        limb([[0.17, 0.02, 0.085, 0.17], [0.04, 0.01, 0.105, 0.165], [-0.14, -0.02, 0.092, 0.135], [-0.3, -0.07, 0.062, 0.075], [-0.4, -0.1, 0.044, 0.05]], { top: back, bottom: dark }),
        [0, -0.4, -0.1],
        limb([[0.012, -0.005, 0.042, 0.052], [-0.07, 0.005, 0.03, 0.038], [-0.3, 0.03, 0.025, 0.03], [-0.53, 0.052, 0.028, 0.033], [-0.6, 0.06, 0.025, 0.029], [-0.655, 0.072, 0.034, 0.043]],
          { top: dark, tip: [hoof, 0.88] })),
    ],
    hitBody: { size: [0.66, 1.05, 1.95], center: [0, 1.02, 0] },
    hitNeck: { size: [0.28, 0.8, 0.36], center: [0, 0.3, 0.14] },
    hitHead: { size: [0.3, 0.34, 0.62], center: [0, 0.03, 0.1] },
  };
}

function rabbitModel() {
  const fur = '#a8937a', pale = '#e0d6c6', white = '#f6f2ea', pink = '#dba09c';
  const ear = earLeaf(0.34, 0.046, fur, pink, 0.012);
  return {
    body: loft([
      [0.33, -0.27, 0.04, 0.04], [0.33, -0.22, 0.13, 0.14], [0.335, -0.1, 0.165, 0.18],
      [0.31, 0.06, 0.14, 0.145], [0.33, 0.17, 0.1, 0.11], [0.35, 0.22, 0.04, 0.05],
    ], { top: fur, bottom: pale, sides: 10, ridge: 0.1, stripe: ['#86735c', 0.25, 0.5], mottle: 0.08 }),
    neck: {
      pivot: [0, 0.4, 0.16],
      geometry: limb([[-0.03, -0.02, 0.08, 0.085], [0.05, 0.05, 0.075, 0.075], [0.09, 0.08, 0.07, 0.07]], { top: fur, bottom: pale }),
    },
    head: {
      pivot: [0, 0.1, 0.09],
      geometry: merge(
        loft([
          [0, -0.09, 0.04, 0.04], [0.02, -0.05, 0.09, 0.09], [0.012, 0.04, 0.094, 0.09],
          [-0.02, 0.12, 0.062, 0.06], [-0.03, 0.165, 0.035, 0.034], [-0.032, 0.178, 0.014, 0.014],
        ], { top: fur, bottom: pale, tip: [pink, 0.93], sides: 10, steps: 3 }),
        eyes(0.076, 0.045, 0.03, 0.021),
        bead(0.03, pale, [0.03, -0.035, 0.13], [1, 0.8, 1]), bead(0.03, pale, [-0.03, -0.035, 0.13], [1, 0.8, 1]), // lunj
      ),
    },
    ears: earPair(0.045, 0.085, -0.03, ear, -0.25, 0.14),
    tail: { pivot: [0, 0.37, -0.25], rest: 0, geometry: lump([0, 0, 0], 0.075, white, { sides: 7, rings: 5, bumpy: 0.14, uvScale: [1, 1] }) },
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

/** Silovsin: it shaklidan olinadi, lekin tumshug'i kalta, tanasi xolli, quloq uchida qora popuk. */
function lynxModel() {
  const back = '#b08b5c', belly = '#ece0c8', spot = '#5e4630';
  const model = canineModel({ back, belly, sock: '#9b7b52', tailTip: '#1c1a18', muzzle: belly, earScale: 1.4, tailScale: 0.32 });
  const spots = [[0.17, 0.92, 0.2], [0.18, 0.84, -0.1], [0.16, 0.95, -0.36], [0.19, 0.8, 0.36]]
    .flatMap(([x, y, z]) => [blob(0.035, spot, [x, y, z], [0.3, 1, 1.3]), blob(0.035, spot, [-x, y, z], [0.3, 1, 1.3])]);
  model.body = merge(model.body, spots);
  model.head.geometry = merge(
    loft([
      [0.04, -0.1, 0.06, 0.06], [0.05, -0.03, 0.125, 0.11], [0.03, 0.07, 0.11, 0.1], [0, 0.16, 0.07, 0.06], [-0.01, 0.21, 0.04, 0.035],
    ], { top: back, bottom: belly, tip: ['#141010', 0.9], sides: 10 }),
    eyes(0.08, 0.06, 0.06, 0.02, '#8a6a1c'),
    blob(0.06, belly, [0.1, -0.03, -0.02], [0.6, 1, 1]),
    blob(0.06, belly, [-0.1, -0.03, -0.02], [0.6, 1, 1]),
  );
  const ear = merge(
    painted(new THREE.ConeGeometry(0.084, 0.22, 8), back, [0, 0.1, 0], [0, 0, 0], [1, 1, 0.45]),
    cylinder(0.006, 0.012, 0.12, '#151210', [0, 0.26, 0], [0, 0, 0], 4),
  );
  model.ears = earPair(0.07, 0.13, -0.04, ear, -0.1, 0.22);
  return model;
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

/** O'rdak va g'oz bir xil tuzilgan: ranglari va bo'yin uzunligi farq qiladi. */
function waterfowlModel({ back, belly, wing, neckColor, headColor, bill, collar, cheek, neckRings, headPivot }) {
  return {
    body: merge(
      loft([
        [0.18, -0.24, 0.02, 0.015], [0.19, -0.2, 0.07, 0.05], [0.16, -0.08, 0.125, 0.1],
        [0.15, 0.06, 0.13, 0.105], [0.17, 0.16, 0.09, 0.085], [0.2, 0.22, 0.03, 0.03],
      ], { top: back, bottom: belly, sides: 10, mottle: 0.03 }),
      collar ? [blob(0.06, collar, [0, 0.235, 0.17], [1, 0.4, 1])] : [],
    ),
    neck: { pivot: [0, 0.22, 0.18], geometry: limb(neckRings, { top: neckColor, mottle: 0.02 }) },
    head: {
      pivot: headPivot,
      geometry: merge(
        loft([[0, -0.05, 0.03, 0.03], [0.01, -0.02, 0.055, 0.055], [0.01, 0.04, 0.055, 0.05], [-0.01, 0.08, 0.03, 0.025]], { top: headColor, sides: 10, steps: 3, mottle: 0.02 }),
        blob(0.03, bill, [0, -0.012, 0.11], [1, 0.42, 1.5]),
        eyes(0.046, 0.025, 0.02, 0.011),
        cheek ? [blob(0.03, cheek, [0.045, -0.005, -0.005], [0.4, 1, 1]), blob(0.03, cheek, [-0.045, -0.005, -0.005], [0.4, 1, 1])] : [],
      ),
    },
    tail: { pivot: [0, 0.2, -0.22], rest: -0.5, geometry: painted(new THREE.ConeGeometry(0.05, 0.12, 6), '#e6e0d2', [0, 0, -0.04], [-Math.PI / 2, 0, 0], [1, 0.8, 0.5]) },
    wings: { geometry: blob(0.1, wing, [0.1, 0, -0.03], [1.25, 0.12, 0.68]), pivots: [[-0.09, 0.2, 0.02], [0.09, 0.2, 0.02]] },
    legs: [],
    hitBody: { size: [0.62, 0.62, 0.86], center: [0, 0.24, 0] },
    hitHead: { size: [0.2, 0.26, 0.3], center: [0, 0, 0.04] },
  };
}

function duckModel() {
  return waterfowlModel({
    back: '#7c6b58', belly: '#d3c8b6', wing: '#6a5a49', neckColor: '#1e5c3c', headColor: '#1e5c3c', bill: '#d9a520', collar: '#f4efe4',
    neckRings: [[-0.02, -0.02, 0.05, 0.055], [0.08, 0.03, 0.04, 0.04], [0.16, 0.04, 0.04, 0.04]],
    headPivot: [0, 0.18, 0.05],
  });
}

/** Qirg'ovul: o'rdak shakli, lekin oyoqda turadi va dumi uzun. */
function pheasantModel() {
  const model = waterfowlModel({
    back: '#9a5a2c', belly: '#6f3a1c', wing: '#8b6a3e', neckColor: '#2b5a4c', headColor: '#1e4b40', bill: '#d9c78f',
    collar: '#f2ede2', cheek: '#c4302a',
    neckRings: [[-0.02, -0.02, 0.05, 0.055], [0.08, 0.03, 0.04, 0.04], [0.15, 0.04, 0.036, 0.038]],
    headPivot: [0, 0.17, 0.05],
  });
  const lift = 0.09;
  model.body = merge(
    model.body.translate(0, lift, 0),
    cylinder(0.012, 0.012, 0.14, '#8d7b58', [0.05, 0.07, 0.02], [0, 0, 0], 4),
    cylinder(0.012, 0.012, 0.14, '#8d7b58', [-0.05, 0.07, 0.02], [0, 0, 0], 4),
  );
  model.neck.pivot[1] += lift;
  model.wings.pivots.forEach((pivot) => { pivot[1] += lift; });
  model.hitBody.center[1] += lift;
  model.tail = {
    pivot: [0, 0.2 + lift, -0.2], rest: -0.2,
    geometry: painted(new THREE.ConeGeometry(0.035, 0.6, 5), '#8a5a30', [0, 0, -0.3], [-Math.PI / 2, 0, 0], [1, 1, 0.35]),
  };
  return model;
}

function gooseModel() {
  return waterfowlModel({
    back: '#857d70', belly: '#dcd6c9', wing: '#6b655a', neckColor: '#1f1e1c', headColor: '#1f1e1c', bill: '#262421', cheek: '#f1ece0',
    neckRings: [[-0.02, -0.02, 0.05, 0.055], [0.12, 0.03, 0.036, 0.04], [0.26, 0.05, 0.032, 0.034], [0.36, 0.06, 0.032, 0.034]],
    headPivot: [0, 0.38, 0.07],
  });
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
