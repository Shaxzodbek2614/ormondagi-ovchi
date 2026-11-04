'use strict';

/* ==========================================================================
   SAHNA: renderer, kameralar, yorug'lik, osmon
   ========================================================================== */

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false; // ikkita sahnani ustma-ust chizamiz (o'rmon + miltiq)

const HORIZON_COLOR = new THREE.Color('#cfe0d6');
const SKY_COLOR = new THREE.Color('#5c9bd6');
const SUN_DIRECTION = new THREE.Vector3(0.55, 0.72, 0.42).normalize();

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(HORIZON_COLOR, 0.0105);
renderer.setClearColor(HORIZON_COLOR);

const camera = new THREE.PerspectiveCamera(CONFIG.fov.normal, 1, 0.1, 700);
camera.rotation.order = 'YXZ';

// Miltiq alohida sahnada chiziladi: shunda u daraxtlar ichiga kirib ketmaydi
// va mo'ljalga olganda kattalashib buzilmaydi.
const weaponScene = new THREE.Scene();
const weaponCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 10);

const skyLight = new THREE.HemisphereLight('#d7e8ff', '#5a6b35', 1.5);
scene.add(skyLight);

const sun = new THREE.DirectionalLight('#ffe6bd', 2.9);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 320 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const weaponSkyLight = new THREE.HemisphereLight('#d7e8ff', '#5a6b35', 1.6);
weaponScene.add(weaponSkyLight);
const weaponSun = new THREE.DirectionalLight('#ffe6bd', 2.2);
weaponSun.position.set(1, 2, 1);
weaponScene.add(weaponSun);

/* --------------------------------------------------------------------------
   Ov sharoiti: vaqt, ob-havo, fasl, shamol, qiyinlik va davomiylikdan yig'iladi.
   name: tanlov oynasidagi nom, note: o'yinga qanday ta'sir qilishi.
   -------------------------------------------------------------------------- */

const SETUP_OPTIONS = {
  time: {
    label: 'Vaqt',
    choices: {
      dawn: { name: 'Tong', sky: '#7d9ccb', horizon: '#f2d2b0', sunColor: '#ffc898', sunPower: 2.3, ambient: 1.15, fog: 0.014, sun: [0.8, 0.26, 0.35], note: 'Hayvonlar suv bo‘yiga keladi.' },
      day: { name: 'Kunduz', sky: '#5c9bd6', horizon: '#cfe0d6', sunColor: '#ffe6bd', sunPower: 2.9, ambient: 1.5, fog: 0.0105, sun: [0.55, 0.72, 0.42] },
      dusk: { name: 'Oqshom', sky: '#3c5283', horizon: '#e89c6c', sunColor: '#ffa060', sunPower: 2, ambient: 0.85, fog: 0.013, sun: [-0.8, 0.2, 0.3], predatorSense: 1.3, note: 'Yirtqichlar sergakroq.' },
      night: { name: 'Tun', sky: '#0d1830', horizon: '#1d2a40', sunColor: '#a9bde6', sunPower: 0.55, ambient: 0.34, fog: 0.015, sun: [-0.35, 0.7, 0.45], predatorSense: 1.4, stars: 1, note: 'F tugmasi bilan bosh chirog‘i yonadi, lekin chiroq hayvonlarga ko‘rinadi.' },
    },
  },
  weather: {
    label: 'Ob-havo',
    choices: {
      clear: { name: 'Ochiq', clouds: 0.5, gray: 0, light: 1 },
      cloudy: { name: 'Bulutli', clouds: 0.22, gray: 0.35, light: 0.62 },
      mist: { name: 'Tuman', clouds: 0.3, gray: 0.6, light: 0.5, fog: 0.03, note: 'Uzoqni ko‘rmaysiz, hayvon ham sizni kech ko‘radi.', noise: 0.85 },
      rain: { name: 'Yomg‘ir', clouds: 0.12, gray: 0.6, light: 0.36, fog: 0.018, rain: true, noise: 0.7, trackLife: 0.5, note: 'Qadam kam eshitiladi, izlar tez yuviladi.' },
      storm: { name: 'Momaqaldiroq', clouds: 0.05, gray: 0.75, light: 0.26, fog: 0.02, rain: true, lightning: true, noise: 0.6, trackLife: 0.5, note: 'Guldurak paytida otsangiz, o‘q ovozi yaxshi eshitilmaydi.' },
      snow: { name: 'Qor', clouds: 0.15, gray: 0.5, light: 0.6, fog: 0.016, snowfall: true, noise: 0.8, trackLife: 2, note: 'Izlar uzoq saqlanadi.' },
    },
  },
  season: {
    label: 'Fasl',
    choices: {
      summer: { name: 'Yoz' },
      autumn: { name: 'Kuz', autumn: 1, note: 'Barglar sarg‘aygan.' },
      winter: { name: 'Qish', snow: 1, frozen: true, trackLife: 2, note: 'Ko‘llar muzlaydi, ustidan yurish mumkin. O‘rdak va baliq bo‘lmaydi.' },
    },
  },
  wind: {
    label: 'Shamol',
    choices: {
      calm: { name: 'Tinch', strength: 0.3, sway: 0.1, note: 'Hid uzoqqa bormaydi.' },
      breeze: { name: 'O‘rtacha', strength: 1, sway: 0.34 },
      gale: { name: 'Kuchli', strength: 1.6, sway: 0.62, note: 'Shamolga qarshi yuring: hidingiz uzoqqa boradi.' },
    },
  },
  difficulty: {
    label: 'Qiyinlik',
    choices: {
      easy: { name: 'Oson', sense: 0.8, damage: 0.65, predators: 0.5, reward: 0.7 },
      normal: { name: 'O‘rta', sense: 1, damage: 1, predators: 0.8, reward: 1 },
      hard: { name: 'Qiyin', sense: 1.25, damage: 1.4, predators: 1, reward: 1.5 },
    },
  },
  duration: {
    label: 'Davomiylik',
    choices: {
      180: { name: '3 daqiqa' },
      300: { name: '5 daqiqa' },
      600: { name: '10 daqiqa' },
    },
  },
};

let conditions; // hozirgi raund sharoiti, applySetup yig'adi

/** Bir-biriga zid tanlovlarni to'g'rilaydi: qor faqat qishda yog'adi, qishda yomg'ir yog'maydi. */
function normalizeSetup(setup, changed) {
  if (changed === 'weather' && setup.weather === 'snow') setup.season = 'winter';
  if (setup.season === 'winter' && (setup.weather === 'rain' || setup.weather === 'storm')) setup.weather = 'snow';
  if (setup.season !== 'winter' && setup.weather === 'snow') setup.weather = 'cloudy';
}

function buildConditions(setup) {
  const pickChoice = (key) => SETUP_OPTIONS[key].choices[setup[key]];
  const time = pickChoice('time'), weather = pickChoice('weather'), season = pickChoice('season');
  const wind = pickChoice('wind'), difficulty = pickChoice('difficulty');

  // Bulutli havoda osmon rangi kulrangga va xiraroqqa o'tadi
  const overcast = (hex) => {
    const color = new THREE.Color(hex);
    const gray = (color.r + color.g + color.b) / 3;
    return color.lerp(new THREE.Color(gray, gray * 1.02, gray * 1.05), weather.gray).multiplyScalar(1 - weather.gray * 0.25);
  };

  return {
    name: [time.name, weather.name, season.name].join(' · '),
    note: [time.note, weather.note, season.note, wind.note].filter(Boolean).join(' '),
    sky: overcast(time.sky),
    horizon: overcast(time.horizon),
    sunColor: time.sunColor,
    sunPower: time.sunPower * weather.light,
    ambient: time.ambient * lerp(1, 0.85, weather.gray),
    fog: Math.max(time.fog, weather.fog ?? 0),
    sun: time.sun,
    clouds: weather.clouds,
    stars: (time.stars ?? 0) * (1 - weather.gray),
    noise: weather.noise ?? 1,
    rain: weather.rain,
    snowfall: weather.snowfall,
    lightning: weather.lightning,
    predatorSense: (time.predatorSense ?? 1) * difficulty.sense,
    preySense: difficulty.sense,
    night: setup.time === 'night',
    frozen: Boolean(season.frozen),
    snow: season.snow ?? 0,
    autumn: season.autumn ?? 0,
    trackLife: (weather.trackLife ?? 1) * (season.trackLife ?? 1),
    windStrength: wind.strength,
    windSway: wind.sway,
    damage: difficulty.damage,
    predators: difficulty.predators,
    reward: difficulty.reward,
    duration: Number(setup.duration),
  };
}

// Fasl rangi shader orqali beriladi: qorda ustki yuzalar oqaradi, kuzda yashil rang sarg'ayadi
const seasonUniforms = { snowCover: { value: 0 }, autumnCover: { value: 0 } };

function addSeasonShader(shader) {
  Object.assign(shader.uniforms, seasonUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vUpness;')
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      vec3 worldNormal = objectNormal;
      #ifdef USE_INSTANCING
        worldNormal = mat3(instanceMatrix) * worldNormal;
      #endif
      vUpness = normalize(mat3(modelMatrix) * worldNormal).y;`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float snowCover, autumnCover;\nvarying float vUpness;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      // Qarag'ay ignalari to'q yashil: kuzda ham yashilligicha qoladi
      float leafy = clamp((diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * 9.0, 0.0, 1.0)
        * smoothstep(0.1, 0.17, diffuseColor.g);
      vec3 fallen = mix(vec3(0.82, 0.4, 0.07), vec3(0.62, 0.13, 0.04), clamp(diffuseColor.g * 5.0 - 0.4, 0.0, 1.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, fallen * (0.4 + diffuseColor.g * 1.4), autumnCover * leafy);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98), snowCover * smoothstep(0.15, 0.62, vUpness));`);
}

function applyConditions(next) {
  conditions = next;
  SKY_COLOR.copy(next.sky);
  HORIZON_COLOR.copy(next.horizon);
  SUN_DIRECTION.set(...next.sun).normalize();
  scene.fog.color.copy(HORIZON_COLOR);
  scene.fog.density = next.fog;
  renderer.setClearColor(HORIZON_COLOR);
  sun.color.set(next.sunColor);
  sun.intensity = next.sunPower;
  skyLight.intensity = next.ambient;
  weaponSun.color.set(next.sunColor);
  weaponSun.intensity = next.sunPower * 0.76;
  weaponSkyLight.intensity = next.ambient * 1.07;
  skyMaterial.uniforms.cloudLevel.value = next.clouds;
  skyMaterial.uniforms.sunGlow.value = next.sunPower / 2.9;
  skyMaterial.uniforms.cloudLight.value = clamp(next.ambient / 1.3, 0.1, 1);
  skyMaterial.uniforms.stars.value = next.stars;
  seasonUniforms.snowCover.value = next.snow;
  seasonUniforms.autumnCover.value = next.autumn;
}

/** Soya kamerasi o'yinchi bilan birga yuradi. Sakrashli qadam soya titrashini kamaytiradi. */
function updateSun(focus) {
  const snap = 2;
  const x = Math.round(focus.x / snap) * snap;
  const z = Math.round(focus.z / snap) * snap;
  sun.target.position.set(x, focus.y, z);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIRECTION, 160);
}

// Osmon: gradient, quyosh va harakatlanuvchi bulutlar shader bilan chiziladi
const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: SKY_COLOR },
    horizonColor: { value: HORIZON_COLOR },
    sunDirection: { value: SUN_DIRECTION },
    time: { value: 0 },
    cloudLevel: { value: 0.46 }, // qanchalik past bo'lsa, osmonni shunchalik ko'p bulut qoplaydi
    sunGlow: { value: 1 },
    cloudLight: { value: 1 },    // tunda bulutlar qorong'i bo'ladi
    stars: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDirection;
    void main() {
      vDirection = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 topColor, horizonColor, sunDirection;
    uniform float time, cloudLevel, sunGlow, cloudLight, stars;
    varying vec3 vDirection;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                 mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float clouds(vec2 p) {
      float sum = 0.0, weight = 0.5;
      for (int i = 0; i < 5; i++) { sum += noise(p) * weight; p *= 2.03; weight *= 0.5; }
      return sum;
    }

    void main() {
      vec3 dir = normalize(vDirection);
      vec3 color = mix(horizonColor, topColor, pow(clamp(dir.y, 0.0, 1.0), 0.55));

      float sunAmount = max(dot(dir, sunDirection), 0.0);
      color += vec3(1.0, 0.9, 0.7) * (pow(sunAmount, 900.0) * 5.0 + pow(sunAmount, 20.0) * 0.22) * sunGlow;

      if (dir.y > 0.0) {
        vec2 grid = floor(dir.xz / (dir.y + 0.25) * 90.0);
        color += vec3(0.9, 0.93, 1.0) * step(0.9975, hash(grid)) * stars * smoothstep(0.05, 0.3, dir.y);

        vec2 uv = dir.xz / (dir.y + 0.14) * 1.2 + time * 0.012;
        float cover = smoothstep(cloudLevel, cloudLevel + 0.28, clouds(uv)) * smoothstep(0.02, 0.22, dir.y);
        color = mix(color, vec3(1.0, 0.98, 0.94) * cloudLight, cover * 0.9);
      }

      gl_FragColor = vec4(color, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), skyMaterial);
scene.add(skyDome);

function resize() {
  const width = window.innerWidth, height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = weaponCamera.aspect = width / height;
  camera.updateProjectionMatrix();
  weaponCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

/** Tanlangan grafika sifatini sahnaga qo'llaydi. */
function applyQuality() {
  const quality = QUALITY[profile.settings.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
  resize();

  sun.castShadow = quality.shadowSize > 0;
  if (sun.castShadow && sun.shadow.mapSize.x !== quality.shadowSize) {
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  updateTileCounts();
}

/** O't va gullar soni: sifatga bog'liq, qishda gullar ko'rinmaydi. */
function updateTileCounts() {
  const { detail } = QUALITY[profile.settings.quality];
  for (const tile of detailTiles) {
    const hiddenThisSeason = tile.userData.summerOnly && conditions.snow > 0;
    tile.count = hiddenThisSeason ? 0 : Math.ceil(tile.userData.total * detail);
  }
}
