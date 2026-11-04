'use strict';

/* ==========================================================================
   GEOMETRIK SHAKLLAR YIG'UVCHISI
   Har bir model oddiy shakllardan yig'iladi va bitta geometriyaga birlashtiriladi.
   Ranglar vertex'larga yoziladi, shuning uchun butun model bitta material bilan chiziladi.
   ========================================================================== */

const lowPolyMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const gearMaterial = lowPolyMaterial.clone(); // qurollar: faslga bog'liq bo'yalmaydi
lowPolyMaterial.onBeforeCompile = addSeasonShader;

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
