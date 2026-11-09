'use strict';

/* ==========================================================================
   YER
   ========================================================================== */

/** Yer uchun kod bilan chizilgan mayda o't teksturasi. */
function createGrassTexture() {
  const size = 512;
  const paper = document.createElement('canvas');
  paper.width = paper.height = size;
  const pen = paper.getContext('2d');
  pen.fillStyle = '#d9d9d9';
  pen.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const shade = Math.floor(randRange(150, 255));
    pen.strokeStyle = `rgba(${shade},${shade},${shade},.55)`;
    pen.lineWidth = randRange(0.6, 1.8);
    const x = Math.random() * size, y = Math.random() * size;
    pen.beginPath();
    pen.moveTo(x, y);
    pen.lineTo(x + randRange(-5, 5), y + randRange(-10, 10));
    pen.stroke();
  }
  const texture = new THREE.CanvasTexture(paper);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const CHUNK_SIZE = 88;                       // yer bo'lagining o'lchami
const CHUNK_CELLS = CHUNK_SIZE / FIELD_CELL; // bo'lak balandlik jadvalining kataklariga aniq tushadi

/** Yer bo'laklari ustidan yuradi: faqat dunyoga tegishli bo'laklar uchun fn(originX, originZ) chaqiriladi. */
function forEachChunk(callback) {
  for (let originZ = -FIELD_HALF; originZ < FIELD_HALF; originZ += CHUNK_SIZE) {
    for (let originX = -FIELD_HALF; originX < FIELD_HALF; originX += CHUNK_SIZE) {
      const nearestX = clamp(0, originX, originX + CHUNK_SIZE), nearestZ = clamp(0, originZ, originZ + CHUNK_SIZE);
      if (Math.hypot(nearestX, nearestZ) < CONFIG.worldRadius + 95) callback(originX, originZ);
    }
  }
}

function createChunkPlane(originX, originZ, y = 0) {
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_CELLS, CHUNK_CELLS);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(originX + CHUNK_SIZE / 2, y, originZ + CHUNK_SIZE / 2);
  return geometry;
}

const GROUND_COLORS = {
  lush: new THREE.Color('#4f8233'),
  shade: new THREE.Color('#37632b'),
  dry: new THREE.Color('#8a9648'),
  dirt: new THREE.Color('#6e5a3b'),
  sand: new THREE.Color('#a89a6c'),
  mud: new THREE.Color('#4d4630'),
  rock: new THREE.Color('#7f786b'),
  snow: new THREE.Color('#e8ecef'),
  marsh: new THREE.Color('#5f6a35'),
  peat: new THREE.Color('#3d3624'),
};
const SNOW_LINE = 24; // tog'da shundan yuqorisi qor

/** Bir nechta shovqin qatlami bilan o't, quruq joy, tuproq va qirg'oq ranglarini aralashtiradi. */
function groundColor(x, y, z, color) {
  const { lush, shade, dry, dirt, sand, mud, rock, snow, marsh, peat } = GROUND_COLORS;
  color.lerpColors(lush, shade, smoothstep(layeredNoise(x * 0.05, z * 0.05), 0.35, 0.65));
  color.lerp(dry, smoothstep(layeredNoise(x * 0.02 + 40, z * 0.02 + 40), 0.52, 0.72) * 0.75);
  color.lerp(dirt, smoothstep(layeredNoise(x * 0.09 + 80, z * 0.09 + 80), 0.62, 0.74) * 0.8);
  const aboveWater = y - WATER_LEVEL;
  const wet = swampWeight(x, z);
  color.lerp(marsh, wet * 0.75);
  color.lerp(sand, (1 - smoothstep(aboveWater, 0.15, 1.3)) * (1 - wet)); // botqoqda qum yo'q
  color.lerp(mud, 1 - smoothstep(aboveWater, -0.7, 0.14));
  color.lerp(peat, wet * (1 - smoothstep(aboveWater, 0.1, 0.7)));
  // Tog': yuqorida tosh, cho'qqida qor
  const high = mountainWeight(x, z);
  color.lerp(rock, high * smoothstep(y, 7, 16) * (0.7 + valueNoise(x * 0.3, z * 0.3) * 0.3));
  color.lerp(snow, high * smoothstep(y, SNOW_LINE - 2, SNOW_LINE + 3)); // dunyo chetidagi tepaliklar qorsiz
}

/** Yer bo'laklarga bo'linadi: kameraga ko'rinmaydigan bo'laklar chizilmaydi. */
function createTerrain() {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: createGrassTexture() });
  material.onBeforeCompile = addSeasonShader;
  const color = new THREE.Color();
  const normal = new THREE.Vector3();

  forEachChunk((originX, originZ) => {
    const geometry = createChunkPlane(originX, originZ);
    const points = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const colors = new Float32Array(points.count * 3);

    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), z = points.getZ(i);
      const y = terrainHeight(x, z);
      points.setY(i, y);
      // Normal balandlik jadvalidan olinadi, shuning uchun qo'shni bo'laklar chegarasi ko'rinmaydi
      normal.set(
        terrainHeight(x - FIELD_CELL, z) - terrainHeight(x + FIELD_CELL, z),
        FIELD_CELL * 2,
        terrainHeight(x, z - FIELD_CELL) - terrainHeight(x, z + FIELD_CELL),
      ).normalize();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
      groundColor(x, y, z, color);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

/* ==========================================================================
   SUV: daryo va ko'llar yuzasi
   ========================================================================== */

const waterMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  fog: true,
  uniforms: {
    ...THREE.UniformsLib.fog,
    time: skyMaterial.uniforms.time,
    topColor: skyMaterial.uniforms.topColor,
    horizonColor: skyMaterial.uniforms.horizonColor,
    sunDirection: skyMaterial.uniforms.sunDirection,
    frozen: { value: 0 },
    deepColor: { value: new THREE.Color('#1d4a52') },
    shallowColor: { value: new THREE.Color('#4f8a78') },
  },
  vertexShader: /* glsl */ `
    attribute float depth;
    varying vec3 vWorld;
    varying float vDepth;
    #include <fog_pars_vertex>
    void main() {
      vDepth = depth;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      vec4 mvPosition = viewMatrix * world;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform float time, frozen;
    uniform vec3 topColor, horizonColor, sunDirection, deepColor, shallowColor;
    varying vec3 vWorld;
    varying float vDepth;
    #include <fog_pars_fragment>

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    // Uch xil o'lchamdagi to'lqinlar turli tomonga siljiydi
    float waves(vec2 p) {
      return noise(p * 0.5 + vec2(time * 0.32, time * 0.2)) * 0.6
           + noise(p * 1.3 - vec2(time * 0.46, -time * 0.28)) * 0.3
           + noise(p * 3.1 + time * 0.7) * 0.1;
    }

    void main() {
      vec2 p = vWorld.xz;
      float height = waves(p);
      vec3 normal = normalize(vec3(
        (height - waves(p + vec2(0.3, 0.0))) * 0.55 * (1.0 - frozen * 0.9), 1.0,
        (height - waves(p + vec2(0.0, 0.3))) * 0.55 * (1.0 - frozen * 0.9)));

      vec3 toCamera = normalize(cameraPosition - vWorld);
      vec3 mirrored = reflect(-toCamera, normal);
      float fresnel = pow(1.0 - max(dot(toCamera, normal), 0.0), 3.0);

      vec3 sky = mix(horizonColor, topColor, pow(clamp(mirrored.y, 0.0, 1.0), 0.6));
      vec3 color = mix(shallowColor, deepColor, smoothstep(0.0, 1.8, vDepth));
      color = mix(color, sky, 0.18 + fresnel * 0.72);
      color += vec3(1.0, 0.92, 0.75) * pow(max(dot(mirrored, sunDirection), 0.0), 220.0) * 2.2;

      // Qirg'oqdagi ko'pik va sayozda suvning shaffofligi
      float foam = smoothstep(0.2, 0.02, vDepth + (height - 0.5) * 0.22);
      color = mix(color, vec3(0.92, 0.95, 0.92), foam * 0.55);
      float alpha = mix(0.4, 0.93, smoothstep(0.0, 1.3, vDepth));

      // Muz: oqish yuza, ichida yorilish chiziqlari
      vec3 ice = mix(vec3(0.62, 0.76, 0.84), vec3(0.86, 0.92, 0.95), noise(p * 0.7)) * (0.55 + sky * 0.6);
      ice = mix(ice, vec3(0.95), smoothstep(0.47, 0.5, noise(p * 1.7)) * smoothstep(0.53, 0.5, noise(p * 1.7)) * 0.7);
      color = mix(color, ice, frozen);
      alpha = mix(max(alpha, foam * 0.7), 0.97, frozen);

      gl_FragColor = vec4(color, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
});

/** Suv yuzasi faqat suv bor bo'laklarda yasaladi. */
function createWater() {
  forEachChunk((originX, originZ) => {
    const geometry = createChunkPlane(originX, originZ, WATER_LEVEL);
    const points = geometry.attributes.position;
    const depths = new Float32Array(points.count);
    let hasWater = false;
    for (let i = 0; i < points.count; i++) {
      const depth = waterDepth(points.getX(i), points.getZ(i));
      depths[i] = Math.max(depth, 0);
      if (depth > 0) hasWater = true;
    }
    if (!hasWater) return;
    geometry.setAttribute('depth', new THREE.BufferAttribute(depths, 1));
    scene.add(new THREE.Mesh(geometry, waterMaterial));
  });
}
