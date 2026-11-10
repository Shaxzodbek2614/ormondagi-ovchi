'use strict';

/* ==========================================================================
   GEOMETRIK SHAKLLAR YIG'UVCHISI
   Har bir model oddiy shakllardan yig'iladi va bitta geometriyaga birlashtiriladi.
   Ranglar vertex'larga yoziladi, shuning uchun butun model bitta material bilan chiziladi.
   ========================================================================== */

const lowPolyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const gearMaterial = lowPolyMaterial.clone(); // qurollar: faslga bog'liq bo'yalmaydi
lowPolyMaterial.onBeforeCompile = addSeasonShader;
const smoothMaterial = new THREE.MeshLambertMaterial({ vertexColors: true }); // qirrasiz mayda narsalar
smoothMaterial.onBeforeCompile = addSeasonShader;

function painted(geometry, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const shape = geometry.index ? geometry.toNonIndexed() : geometry;
  shape.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  ));
  const tint = new THREE.Color(color);
  const colors = new Float32Array(shape.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
  shape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return shape;
}

const box = (w, h, d, color, pos, rot) => painted(new THREE.BoxGeometry(w, h, d), color, pos, rot);
const cylinder = (top, bottom, h, color, pos, rot, sides = 7) =>
  painted(new THREE.CylinderGeometry(top, bottom, h, sides), color, pos, rot);
const cone = (radius, h, color, pos, rot, sides = 7) =>
  painted(new THREE.ConeGeometry(radius, h, sides), color, pos, rot);
const merge = (...parts) => mergeGeometries(parts.flat());

/** Sharsimon shaklni notekis qiladi: tosh va daraxt shoxlari tabiiyroq ko'rinadi. */
function lumpy(radius, color, position, scale = [1, 1, 1], strength = 0.28) {
  const shape = new THREE.IcosahedronGeometry(radius, 1);
  const points = shape.attributes.position;
  const offset = Math.random() * 100;
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
    // Bir xil nuqtalar bir xil siljiydi, shuning uchun shaklda teshik paydo bo'lmaydi
    const bump = 1 + (valueNoise(x * 3 + y * 2 + offset, z * 3 - y * 2) - 0.5) * 2 * strength;
    points.setXYZ(i, x * bump, y * bump, z * bump);
  }
  return painted(shape, color, position, [0, 0, 0], scale);
}

/* ==========================================================================
   SILLIQ SIRTLAR
   Halqalar qatoridan teri tortiladi: daraxt tanasi, barg to'plami, tosh, qurol qo'ndog'i.
   Normal qo'shni nuqtalardan hisoblanadi, shuning uchun qirralar ko'rinmaydi.
   ========================================================================== */

const WHITE = new THREE.Color('#ffffff');

/**
 * @param grid halqalar: har biri bir xil sondagi [x, y, z] nuqtalar, halqa yopiq deb olinadi
 * @param colorAt (qator, ustun, nuqta) => THREE.Color
 * @param uvScale [aylana bo'ylab takror, uzunlik bo'ylab 1 metrga takror]
 * @param normalAt (nuqta, hisoblangan normal) => [x, y, z]: barglar uchun yumshoq normal
 * @param fitV true bo'lsa, v birinchi halqada 0, oxirgisida uvScale[1] bo'ladi
 */
function surface(grid, { color = '#ffffff', colorAt, uvScale = [1, 1], normalAt, fitV = false } = {}) {
  const rows = grid.length, sides = grid[0].length;
  const tint = new THREE.Color(color);
  const middle = new THREE.Vector3();
  for (const ring of grid) for (const p of ring) middle.add(new THREE.Vector3(...p));
  middle.divideScalar(rows * sides);

  // Uzunlik bo'ylab masofa: tekstura cho'zilmasin
  const along = [0];
  for (let i = 1; i < rows; i++) {
    let step = 0;
    for (let j = 0; j < sides; j++) step += Math.hypot(...grid[i][j].map((value, axis) => value - grid[i - 1][j][axis]));
    along.push(along[i - 1] + step / sides);
  }

  const at = (i, j) => new THREE.Vector3(...grid[clamp(i, 0, rows - 1)][(j + sides) % sides]);
  const vertices = [];
  let outward = 0;
  for (let i = 0; i < rows; i++) {
    vertices.push([]);
    for (let j = 0; j <= sides; j++) {
      const point = at(i, j);
      const normal = at(i, j + 1).sub(at(i, j - 1)).cross(at(i + 1, j).sub(at(i - 1, j)));
      const fromMiddle = point.clone().sub(middle);
      if (normal.lengthSq() < 1e-10) normal.copy(fromMiddle);
      normal.normalize();
      outward += normal.dot(fromMiddle);
      vertices[i].push({ point, normal, uv: [(j / sides) * uvScale[0], (fitV ? along[i] / along[rows - 1] : along[i]) * uvScale[1]], color: colorAt ? colorAt(i, j % sides, point) : tint });
    }
  }
  const sign = outward < 0 ? -1 : 1;
  for (const row of vertices) {
    for (const vertex of row) {
      vertex.normal.multiplyScalar(sign);
      if (normalAt) vertex.normal.set(...normalAt(vertex.point, vertex.normal)).normalize();
    }
  }

  const positions = [], normals = [], uvs = [], colors = [];
  const face = new THREE.Vector3(), edge = new THREE.Vector3();
  const triangle = (a, b, c) => {
    face.subVectors(b.point, a.point).cross(edge.subVectors(c.point, a.point));
    if (face.lengthSq() < 1e-12) return; // qutbdagi yopishgan uchburchak
    // O'ralish yo'nalishi tashqariga qaragan bo'lsin
    const order = face.dot(a.normal.clone().add(b.normal).add(c.normal)) < 0 ? [a, c, b] : [a, b, c];
    for (const vertex of order) {
      positions.push(vertex.point.x, vertex.point.y, vertex.point.z);
      normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
      uvs.push(vertex.uv[0], vertex.uv[1]);
      colors.push(vertex.color.r, vertex.color.g, vertex.color.b);
    }
  };
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = vertices[i][j], b = vertices[i][j + 1], c = vertices[i + 1][j + 1], d = vertices[i + 1][j];
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Ikki rang orasida: t 0 bo'lsa birinchisi, 1 bo'lsa ikkinchisi. */
const blend = (from, to, t) => new THREE.Color(from).lerp(new THREE.Color(to), clamp(t, 0, 1));

/**
 * Egri chiziq bo'ylab quvur: tana, shox, stvol.
 * @param path [[x, y, z], ...] o'q nuqtalari
 * @param radii har nuqtadagi radius (son yoki [eni, bo'yi])
 * @param bumpy tana notekisligi (0..1), shovqin bilan
 */
function tube(path, radii, color, { sides = 7, uvScale = [1, 0.5], colorAt, bumpy = 0, squash } = {}) {
  const points = path.map((p) => new THREE.Vector3(...p));
  const first = points[1].clone().sub(points[0]).normalize();
  const reference = Math.abs(first.y) > 0.8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const grid = points.map((point, i) => {
    const tangent = points[Math.min(i + 1, points.length - 1)].clone().sub(points[Math.max(i - 1, 0)]).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, reference).normalize();
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const [width, height] = [radii[i]].flat().concat(radii[i]);
    return Array.from({ length: sides }, (_, j) => {
      const angle = (j / sides) * TAU;
      let x = Math.cos(angle), y = Math.sin(angle);
      if (squash) [x, y] = squash(x, y, i);
      const bump = 1 + (valueNoise(point.y * 1.7 + j * 2.3 + point.x * 3, j * 1.9 + point.z * 3 + i) - 0.5) * 2 * bumpy;
      return point.clone().addScaledVector(side, x * width * bump).addScaledVector(up, y * height * bump).toArray();
    });
  });
  return surface(grid, { color, colorAt, uvScale });
}

/**
 * Notekis shar: barg to'plami yoki tosh.
 * @param soft 0..1: normal umumiy markazdan (softFrom) qanchalik olinadi. Barglar bir butun toj bo'lib yoritiladi.
 */
function lump(center, radii, color, { sides = 9, rings = 6, bumpy = 0.25, grain = 1.6, soft = 0, softFrom = center, uvScale = [3, 0.6], colorAt, flatBase = false } = {}) {
  const [cx, cy, cz] = center;
  const [rx, ry, rz] = [radii].flat().concat(radii, radii);
  const grid = [];
  for (let i = 0; i <= rings; i++) {
    const polar = (i / rings) * Math.PI;
    const ring = [];
    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * TAU + i * 0.35;
      let x = Math.sin(polar) * Math.cos(angle), y = Math.cos(polar), z = Math.sin(polar) * Math.sin(angle);
      const bump = 1 + (layeredNoise((x + cx) * grain + cy * 3.1, (z + cz) * grain + y * grain * 1.3 + cy) - 0.5) * 2 * bumpy;
      if (flatBase && y < 0) y *= 0.35;
      ring.push([cx + x * rx * bump, cy + y * ry * bump, cz + z * rz * bump]);
    }
    grid.push(ring);
  }
  const origin = new THREE.Vector3(...softFrom);
  return surface(grid, {
    color, colorAt, uvScale,
    normalAt: soft ? (point, normal) => normal.clone().lerp(point.clone().sub(origin).normalize(), soft).toArray() : undefined,
  });
}

/** Alohida materialli qismlarni bitta geometriyaga yig'adi: har ro'yxat o'z guruhi (material raqami) bo'ladi. */
const mergeGroups = (...lists) => mergeGeometries(lists.map((parts) => merge(parts)), true);

/* ==========================================================================
   KOD BILAN CHIZILGAN TEKSTURALAR: po'stloq, barg, igna, tosh, yog'och
   Bezak tasodifi alohida generatordan olinadi: dunyo urug'i ketma-ketligiga tegmaydi.
   ========================================================================== */

const artRandom = seededRandom(0x51ed270b);
const artRange = (min, max) => min + artRandom() * (max - min);
const TEXTURE_SIZE = 256;

function blankCanvas(fill) {
  const paper = document.createElement('canvas');
  paper.width = paper.height = TEXTURE_SIZE;
  const pen = paper.getContext('2d', { willReadFrequently: true });
  pen.fillStyle = fill;
  pen.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  return pen;
}

/** Chizmani 9 marta suradi: tekstura chetlari bir-biriga ulanadi. */
function tiled(pens, draw) {
  for (const pen of [pens].flat()) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        pen.save();
        pen.translate(dx * TEXTURE_SIZE, dy * TEXTURE_SIZE);
        draw(pen);
        pen.restore();
      }
    }
  }
}

function finishTexture(texture) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

/** Rang va niqob chizmasidan shaffof joyli tekstura: chetlarda qora hoshiya qolmaydi. */
function cutoutTexture(colorPen, maskPen) {
  const color = colorPen.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data;
  const mask = maskPen.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE).data;
  const data = new Uint8Array(color.length);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[i];
    data[i + 1] = color[i + 1];
    data[i + 2] = color[i + 2];
    data[i + 3] = mask[i];
  }
  const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return finishTexture(texture);
}

/** Tasodifiy egri chiziqlar: po'stloq yoriqlari, yog'och tolasi. */
function scratches(pen, count, { length, width, wobble, style, across = false }) {
  for (let n = 0; n < count; n++) {
    const x = artRandom() * TEXTURE_SIZE, y = artRandom() * TEXTURE_SIZE;
    const steps = Math.ceil(artRange(...length) / 8);
    const bends = Array.from({ length: steps }, () => artRange(-wobble, wobble));
    const thickness = artRange(...width), ink = style();
    tiled(pen, (p) => {
      p.strokeStyle = ink;
      p.lineWidth = thickness;
      p.lineCap = 'round';
      p.beginPath();
      p.moveTo(x, y);
      let drift = 0;
      bends.forEach((bend, i) => {
        drift += bend;
        if (across) p.lineTo(x + (i + 1) * 8, y + drift);
        else p.lineTo(x + drift, y + (i + 1) * 8);
      });
      p.stroke();
    });
  }
}

function speckles(pen, count, radius, style) {
  for (let n = 0; n < count; n++) {
    const x = artRandom() * TEXTURE_SIZE, y = artRandom() * TEXTURE_SIZE, r = artRange(...radius), ink = style();
    tiled(pen, (p) => {
      p.fillStyle = ink;
      p.beginPath();
      p.arc(x, y, r, 0, TAU);
      p.fill();
    });
  }
}

const gray = (from, to, alpha) => {
  const shade = Math.floor(artRange(from, to));
  return `rgba(${shade},${shade},${shade},${alpha})`;
};

/** Chuqur tik yoriqli po'stloq: qarag'ay, eman, to'nka. Rang vertex'dan keladi. */
function createBarkTexture() {
  const pen = blankCanvas('#b8b0a6');
  speckles(pen, 500, [2, 9], () => gray(120, 230, 0.16));
  scratches(pen, 150, { length: [50, 190], width: [2, 5.5], wobble: 2.2, style: () => `rgba(38,30,24,${artRange(0.35, 0.7)})` });
  scratches(pen, 110, { length: [30, 120], width: [1, 2.2], wobble: 1.6, style: () => `rgba(250,240,225,${artRange(0.15, 0.4)})` });
  scratches(pen, 40, { length: [10, 30], width: [1, 2], wobble: 2, across: true, style: () => 'rgba(30,24,20,.35)' });
  return finishTexture(new THREE.CanvasTexture(pen.canvas));
}

/** Qayin po'stlog'i: oq, ko'ndalang qora chiziqchalar va dog'lar. */
function createBirchTexture() {
  const pen = blankCanvas('#efece4');
  speckles(pen, 260, [3, 12], () => gray(190, 255, 0.2));
  scratches(pen, 90, { length: [8, 34], width: [1, 2.6], wobble: 0.7, across: true, style: () => `rgba(34,30,27,${artRange(0.5, 0.9)})` });
  scratches(pen, 160, { length: [4, 12], width: [0.6, 1.2], wobble: 0.5, across: true, style: () => 'rgba(90,82,74,.5)' });
  for (let n = 0; n < 7; n++) {
    const x = artRandom() * TEXTURE_SIZE, y = artRandom() * TEXTURE_SIZE, w = artRange(10, 22), h = artRange(5, 10);
    tiled(pen, (p) => {
      p.fillStyle = 'rgba(28,25,22,.9)';
      p.beginPath();
      p.moveTo(x - w, y);
      p.quadraticCurveTo(x, y - h * 2, x + w, y);
      p.quadraticCurveTo(x, y + h * 0.6, x - w, y);
      p.fill();
    });
  }
  return finishTexture(new THREE.CanvasTexture(pen.canvas));
}

/** Barg to'plami: alohida barglar orasi teshik, toj ichi ko'rinib turadi. */
function createLeafTexture() {
  const color = blankCanvas('#c9d0bd'), mask = blankCanvas('#000000');
  for (let n = 0; n < 430; n++) {
    const x = artRandom() * TEXTURE_SIZE, y = artRandom() * TEXTURE_SIZE;
    const length = artRange(8, 13), width = length * artRange(0.42, 0.6), turn = artRandom() * TAU;
    const light = Math.floor(artRange(175, 255)), warm = artRange(0.9, 1);
    tiled([color, mask], (p) => {
      const isMask = p === mask;
      p.translate(x, y);
      p.rotate(turn);
      p.fillStyle = isMask ? '#ffffff' : `rgb(${Math.floor(light * warm)},${light},${Math.floor(light * 0.86)})`;
      p.beginPath();
      p.moveTo(-length, 0);
      p.quadraticCurveTo(0, -width * 1.5, length, 0);
      p.quadraticCurveTo(0, width * 1.5, -length, 0);
      p.fill();
      if (isMask) return;
      // Bargning yarmi soyada, o'rtasida tomir
      p.fillStyle = 'rgba(40,60,30,.2)';
      p.beginPath();
      p.moveTo(-length, 0);
      p.quadraticCurveTo(0, width * 1.5, length, 0);
      p.fill();
      p.strokeStyle = 'rgba(255,255,240,.4)';
      p.lineWidth = 0.8;
      p.beginPath();
      p.moveTo(-length, 0);
      p.lineTo(length, 0);
      p.stroke();
    });
  }
  return cutoutTexture(color, mask);
}

/** Qarag'ay shoxi: yuqorida (v=0) tana, pastda (v=1) tishli chet. Ignalar chetga qarab taraladi. */
function createNeedleTexture() {
  const color = blankCanvas('#9fa894'), mask = blankCanvas('#ffffff');
  scratches(color, 1300, { length: [14, 46], width: [0.8, 2], wobble: 1.4, style: () => gray(90, 255, artRange(0.35, 0.8)) });
  scratches(color, 120, { length: [40, 120], width: [2, 4], wobble: 1, style: () => 'rgba(30,40,28,.4)' });
  const teeth = 13;
  for (let n = 0; n < teeth; n++) {
    const x = ((n + artRange(0.2, 0.8)) / teeth) * TEXTURE_SIZE, half = TEXTURE_SIZE / teeth * artRange(0.36, 0.5), depth = artRange(60, 130);
    tiled(mask, (p) => {
      p.fillStyle = '#000000';
      p.beginPath();
      p.moveTo(x - half, TEXTURE_SIZE + 1);
      p.lineTo(x - half * 0.25, TEXTURE_SIZE - depth * 0.55);
      p.lineTo(x, TEXTURE_SIZE - depth);
      p.lineTo(x + half * 0.3, TEXTURE_SIZE - depth * 0.5);
      p.lineTo(x + half, TEXTURE_SIZE + 1);
      p.fill();
    });
  }
  // Mayda igna uchlari: tish chetlari arra kabi
  for (let n = 0; n < 260; n++) {
    const x = artRandom() * TEXTURE_SIZE, y = TEXTURE_SIZE - artRange(24, 150), h = artRange(8, 22), w = artRange(1.5, 3.5);
    tiled(mask, (p) => {
      p.fillStyle = '#000000';
      p.fillRect(x, y, w, h);
    });
  }
  return cutoutTexture(color, mask);
}

/** Tosh: dog'lar, mayda donalar va yoriqlar. */
function createStoneTexture() {
  const pen = blankCanvas('#c4c3bd');
  speckles(pen, 900, [3, 16], () => gray(120, 250, 0.12));
  speckles(pen, 2200, [0.5, 1.6], () => gray(60, 255, 0.3));
  scratches(pen, 26, { length: [40, 150], width: [0.8, 2], wobble: 5, style: () => 'rgba(40,40,38,.5)' });
  scratches(pen, 14, { length: [40, 120], width: [0.8, 1.6], wobble: 5, across: true, style: () => 'rgba(40,40,38,.45)' });
  return finishTexture(new THREE.CanvasTexture(pen.canvas));
}

/** Silliqlangan yog'och tolasi: qurol qo'ndog'i, qayiq. Tola u bo'ylab ketadi. */
function createWoodTexture() {
  const pen = blankCanvas('#cdbfae');
  scratches(pen, 260, { length: [90, 250], width: [0.7, 2.4], wobble: 0.9, across: true, style: () => `rgba(70,42,22,${artRange(0.12, 0.38)})` });
  scratches(pen, 90, { length: [60, 200], width: [1, 3], wobble: 0.8, across: true, style: () => `rgba(255,240,215,${artRange(0.1, 0.3)})` });
  speckles(pen, 5, [5, 9], () => 'rgba(60,36,20,.45)');
  return finishTexture(new THREE.CanvasTexture(pen.canvas));
}

const barkTexture = createBarkTexture();
const birchTexture = createBirchTexture();
const leafTexture = createLeafTexture();
const needleTexture = createNeedleTexture();
const stoneTexture = createStoneTexture();
const woodTexture = createWoodTexture();

/* Materiallar: silliq yoritish, rang vertex'dan, naqsh teksturadan */

function texturedMaterial(map, { cutout = false, season = true, softBack = cutout } = {}) {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map,
    alphaTest: cutout ? 0.42 : 0,
    side: cutout ? THREE.DoubleSide : THREE.FrontSide,
  });
  material.onBeforeCompile = (shader) => {
    if (season) addSeasonShader(shader);
    // Barg orqa tomondan ham bir xil yoritiladi: toj ichi qorayib qolmaydi
    if (softBack) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif');
    }
  };
  material.customProgramCacheKey = () => `textured-${cutout}-${season}-${softBack}`;
  return material;
}

const barkMaterial = texturedMaterial(barkTexture);
const birchMaterial = texturedMaterial(birchTexture);
const leafMaterial = texturedMaterial(leafTexture, { cutout: true });
const needleMaterial = texturedMaterial(needleTexture, { cutout: true, softBack: false }); // shox osti soyada qoladi
const stoneMaterial = texturedMaterial(stoneTexture);
