'use strict';

/* --------------------------------------------------------------------------
   Dunyo urug'i. Birga o'ynaganda hammada bir xil o'rmon chiqishi kerak, shuning
   uchun dunyo qurilishi vaqtida Math.random urug'li generatorga almashtiriladi.
   Urug' xona kodidan olinadi. Qurilish tugagach, asl Math.random qaytariladi.
   -------------------------------------------------------------------------- */

const ROOM_HASH = '#xona-';
const roomCode = location.hash.startsWith(ROOM_HASH)
  ? location.hash.slice(ROOM_HASH.length).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
  : '';

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const nativeRandom = Math.random;
Math.random = seededRandom(roomCode ? hashText(roomCode) : Math.floor(nativeRandom() * 2 ** 32));

/* ==========================================================================
   SOZLAMALAR — o'yin balansini shu yerdan o'zgartirish mumkin
   ========================================================================== */

const CONFIG = {
  roundSeconds: 180,
  worldRadius: 260,        // o'yinchi yura oladigan doira radiusi
  spawnClearing: 13,       // boshlang'ich nuqta atrofidagi ochiq maydon
  player: {
    eyeHeight: 1.7,
    radius: 0.5,
    walkSpeed: 6,
    sprintSpeed: 10,
    aimSpeed: 3,
    crouchSpeed: 2.6,
    crouchEyeHeight: 1.02,
    maxHp: 100,
    lookSensitivity: 0.0022,
  },
  fov: { normal: 75, aiming: 42, binoculars: 15 },
  medkitHeal: 40,
};

// Grafika sifati darajalari: kuchsiz kompyuterlar uchun soya va o't kamaytiriladi
const QUALITY = {
  low: { label: 'Past', pixelRatio: 1, shadowSize: 0, detail: 0.35 },
  medium: { label: 'O‘rta', pixelRatio: 1.25, shadowSize: 1024, detail: 0.7 },
  high: { label: 'Yuqori', pixelRatio: 1.5, shadowSize: 2048, detail: 1 },
};

/* --------------------------------------------------------------------------
   O'yinchi profili: rekord va sozlamalar brauzerda saqlanadi.
   Maxfiy rejimda localStorage ishlamasligi mumkin, bu holda ma'lumot shunchaki saqlanmaydi.
   -------------------------------------------------------------------------- */

// Sensorli ekran asosiy boshqaruv bo'lgan qurilma: telefon yoki planshet
const IS_TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches;

const PROFILE_KEY = 'ormondagi-ovchi-profil';
const DEFAULT_PROFILE = {
  best: 0,
  coins: 0,
  owned: [],    // sotib olingan jihozlar
  missions: {}, // missiya id: olingan yulduzlar
  medkits: 0,
  settings: { sensitivity: 1, volume: 0.8, quality: IS_TOUCH_DEVICE ? 'low' : 'high' },
  setup: { time: 'day', weather: 'clear', season: 'summer', wind: 'breeze', difficulty: 'normal', duration: '180' },
};

function loadProfile() {
  const fresh = structuredClone(DEFAULT_PROFILE);
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY)) ?? {};
    return {
      ...fresh,
      ...saved,
      settings: { ...fresh.settings, ...saved.settings },
      setup: { ...fresh.setup, ...saved.setup },
    };
  } catch {
    return fresh;
  }
}

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Saqlab bo'lmadi: o'yinga ta'sir qilmaydi
  }
}

const profile = loadProfile();
const owns = (itemId) => profile.owned.includes(itemId);

/* ==========================================================================
   YORDAMCHI FUNKSIYALAR
   ========================================================================== */

const { lerp, clamp, smoothstep } = THREE.MathUtils;
const TAU = Math.PI * 2;

const randRange = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Kadrlar tezligiga bog'liq bo'lmagan silliq yaqinlashish. */
const damp = (current, target, rate, dt) => lerp(current, target, 1 - Math.exp(-rate * dt));

/** Ikki burchak orasidagi eng qisqa farq (-PI..PI). */
function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// Value noise: yer balandligi, ranglar va daraxt zichligi uchun ishlatiladi.
// Jadval har safar tasodifiy to'ldiriladi, shuning uchun har gal o'rmon boshqacha.
const noiseTable = Float32Array.from({ length: 256 * 256 }, Math.random);

function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const at = (i, j) => noiseTable[((j & 255) << 8) | (i & 255)];
  return lerp(
    lerp(at(ix, iz), at(ix + 1, iz), sx),
    lerp(at(ix, iz + 1), at(ix + 1, iz + 1), sx),
    sz,
  );
}

/** Uch qatlamli shovqin: katta tepaliklar ustiga mayda notekisliklar qo'shadi. */
function layeredNoise(x, z) {
  return valueNoise(x, z) * 0.6 + valueNoise(x * 2.1, z * 2.1) * 0.28 + valueNoise(x * 4.3, z * 4.3) * 0.12;
}
