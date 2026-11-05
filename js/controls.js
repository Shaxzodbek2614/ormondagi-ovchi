'use strict';

/* ==========================================================================
   BOSHQARUV
   ========================================================================== */

document.addEventListener('pointerlockchange', onPointerLockChange);
document.addEventListener('pointerlockerror', onLockFailed);

/** Sichqoncha yoki barmoq siljishini kamera burilishiga aylantiradi. */
function turnView(dx, dy) {
  // Mo'ljalga olganda kamera sekinroq aylanadi, shunda uzoqdagi nishonni ushlash oson
  const aimZoom = weapon.gun.aimFov ? 0.24 : 0.55;
  const zoom = lerp(lerp(1, aimZoom, player.aim), 0.22, player.scope);
  const sensitivity = CONFIG.player.lookSensitivity * profile.settings.sensitivity * zoom;
  player.yaw -= dx * sensitivity;
  player.pitch = clamp(player.pitch - dy * sensitivity, -1.45, 1.45);
  input.lookX += dx;
  input.lookY += dy;
}

function startScoping() {
  if (!isEquipped('binoculars') && game.myRole !== 'observer') return;
  input.scoping = true;
  ui.binoculars.hidden = false;
}

function stopScoping() {
  input.scoping = false;
  ui.binoculars.hidden = true;
}

/** O'yinchi hozir boshqara oladimi: pauza oynasi ochiq bo'lsa, yo'q. */
const canControl = () => game.state === 'playing' && !game.menuOpen;

document.addEventListener('mousemove', (event) => {
  if (!canControl()) return;
  turnView(event.movementX, event.movementY);

  if (pointer.free) {
    const edge = event.clientX / window.innerWidth;
    input.edgeTurn = edge < 0.06 ? -1 : edge > 0.94 ? 1 : 0;
  }
});

document.addEventListener('mousedown', (event) => {
  if (!canControl()) return;
  if (event.button === 0) input.fire = true;
  if (event.button === 2) input.aiming = true;
});
document.addEventListener('mouseup', (event) => {
  if (event.button === 2) input.aiming = false;
});
document.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM' && !event.repeat) sound.toggleMute();
  if (event.code === 'Tab') {
    event.preventDefault(); // brauzer fokusni boshqa joyga o'tkazmasin
    if (canControl() && !event.repeat) toggleMap();
  }
  if (!canControl()) return;
  input.keys[event.code] = true;
  if (event.code === 'KeyR') startReload();
  if (event.repeat) return;
  if (event.code === 'KeyC') player.crouching = !player.crouching;
  if (event.code === 'KeyH') useMedkit();
  if (event.code === 'KeyF') player.lampOn = !player.lampOn;
  if (event.code === 'KeyT') pressFishKey();
  if (event.code === 'KeyY') useTower();
  if (event.code === 'KeyU') useTrap();
  if (event.code === 'KeyK' && dog.active) dog.staying = !dog.staying;
  if (event.code === 'KeyG' && game.mode === 'team') placePing();
  const digit = /^Digit([1-7])$/.exec(event.code);
  if (digit) trySwitchWeapon(WEAPON_ORDER[Number(digit[1]) - 1]);
  if (event.code === 'KeyQ') cycleWeapon();
  if (event.code === 'KeyB') startScoping();
  if (event.code === 'Escape' && pointer.free) pauseRound(); // qulflangan rejimda buni brauzer qiladi
});
document.addEventListener('keyup', (event) => {
  input.keys[event.code] = false;
  if (event.code === 'KeyB') stopScoping();
});

/* Telefon boshqaruvi */

const TOUCH_LOOK_SPEED = 1.7;
const STICK_RADIUS = 56;

/** Keyingi sotib olingan qurolga o'tadi. */
function cycleWeapon() {
  const available = availableWeapons();
  trySwitchWeapon(available[(available.indexOf(weapon.current) + 1) % available.length]);
}

// isOn: tugma yoqilgan holatda ko'rinadi, isAvailable: tugma faqat kerak bo'lganda chiqadi
const TOUCH_BUTTONS = [
  { id: 'fire', label: 'Otish', press: () => { input.fire = true; } },
  { id: 'aim', label: 'Mo‘ljal', press: () => { input.aiming = !input.aiming; }, isOn: () => input.aiming },
  { id: 'reload', label: 'O‘qlash', press: startReload },
  { id: 'crouch', label: 'Egilish', press: () => { player.crouching = !player.crouching; }, isOn: () => player.crouching },
  { id: 'sprint', label: 'Yugurish', press: () => { input.keys.ShiftLeft = !input.keys.ShiftLeft; }, isOn: () => input.keys.ShiftLeft },
  { id: 'swap', label: 'Qurol', press: cycleWeapon, isAvailable: () => availableWeapons().length > 1 },
  { id: 'scope', label: 'Durbin', press: startScoping, release: stopScoping, isAvailable: () => isEquipped('binoculars') || game.myRole === 'observer' },
  { id: 'heal', label: 'Dori', press: useMedkit, isAvailable: () => profile.medkits > 0 },
  { id: 'map', label: 'Xarita', press: toggleMap },
  { id: 'fish', label: 'Baliq', press: () => { input.keys.KeyT = true; pressFishKey(); }, release: () => { input.keys.KeyT = false; }, isAvailable: () => fishing.state !== 'idle' || Boolean(fishingSpot()) },
  { id: 'tower', label: 'Minora', press: useTower, isAvailable: () => isEquipped('tower') },
  { id: 'trap', label: 'Tuzoq', press: useTrap, isAvailable: () => isEquipped('trap') },
  { id: 'ping', label: 'Belgi', press: () => placePing(), isAvailable: () => game.mode === 'team' },
  { id: 'revive', label: 'Turg‘izish', press: () => { input.keys.KeyE = true; }, release: () => { input.keys.KeyE = false; }, isAvailable: () => Boolean(game.reviveTarget) },
  { id: 'lamp', label: 'Chiroq', press: () => { player.lampOn = !player.lampOn; }, isOn: () => player.lampOn, isAvailable: () => conditions.night },
  { id: 'pause', label: 'II', press: pauseRound },
];

function showTouchControls(visible) {
  ui.touchControls.hidden = !visible || !IS_TOUCH_DEVICE;
}

/** Tugmalar holatini yangilaydi. Har kadrda chaqiriladi, lekin faqat telefonda. */
function updateTouchButtons() {
  for (const { button, isOn, isAvailable } of touchButtons) {
    if (isOn) button.classList.toggle('on', Boolean(isOn()));
    if (isAvailable) button.hidden = !isAvailable();
  }
}

const touchButtons = TOUCH_BUTTONS.map((definition) => {
  const button = document.createElement('button');
  button.textContent = definition.label;
  button.dataset.touch = definition.id;
  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    definition.press();
  });
  if (definition.release) {
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, definition.release);
  }
  ui.touchButtons.append(button);
  return { ...definition, button };
});

/** Chap tomonga tekkan barmoq joystick, o'ng tomondagisi qarash uchun ishlatiladi. */
function setupTouchSurface() {
  const stick = { id: null, x: 0, y: 0 };
  const look = { id: null, x: 0, y: 0 };
  const surface = ui.touchControls;

  surface.addEventListener('pointerdown', (event) => {
    surface.setPointerCapture(event.pointerId);
    if (event.clientX < window.innerWidth * 0.42 && stick.id === null) {
      Object.assign(stick, { id: event.pointerId, x: event.clientX, y: event.clientY });
      ui.joystick.hidden = false;
      ui.joystick.style.left = `${stick.x}px`;
      ui.joystick.style.top = `${stick.y}px`;
      ui.joystickKnob.style.transform = '';
    } else if (look.id === null) {
      Object.assign(look, { id: event.pointerId, x: event.clientX, y: event.clientY });
    }
  });

  surface.addEventListener('pointermove', (event) => {
    if (event.pointerId === stick.id) {
      const dx = event.clientX - stick.x, dy = event.clientY - stick.y;
      const scale = Math.min(1, STICK_RADIUS / (Math.hypot(dx, dy) || 1));
      input.stickX = (dx * scale) / STICK_RADIUS;
      input.stickY = (dy * scale) / STICK_RADIUS;
      ui.joystickKnob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    } else if (event.pointerId === look.id) {
      turnView((event.clientX - look.x) * TOUCH_LOOK_SPEED, (event.clientY - look.y) * TOUCH_LOOK_SPEED);
      look.x = event.clientX;
      look.y = event.clientY;
    }
  });

  const release = (event) => {
    if (event.pointerId === stick.id) {
      stick.id = null;
      input.stickX = input.stickY = 0;
      ui.joystick.hidden = true;
    } else if (event.pointerId === look.id) {
      look.id = null;
    }
  };
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);
}

if (IS_TOUCH_DEVICE) {
  document.body.classList.add('touch');
  setupTouchSurface();
}

window.addEventListener('blur', () => {
  if (pointer.free && game.state === 'playing') pauseRound();
});

ui.startBtn.addEventListener('click', showSetup);
ui.againBtn.addEventListener('click', restartRound);
ui.missionsBtn.addEventListener('click', showMissions);
ui.trophiesBtn.addEventListener('click', showTrophies);
ui.trophiesBackBtn.addEventListener('click', () => {
  ui.trophies.hidden = true;
  ui.menu.hidden = false;
});
ui.briefBackBtn.addEventListener('click', () => {
  ui.brief.hidden = true;
  applySetup(profile.setup);
  showMissions();
});
ui.missionsBackBtn.addEventListener('click', () => {
  ui.missions.hidden = true;
  if (network.active) showLobby();
  else ui.menu.hidden = false;
});
ui.resumeBtn.addEventListener('click', resumeRound);
document.querySelectorAll('[data-return-menu]').forEach((button) => button.addEventListener('click', returnToMenu));

/* Ov sharoitini tanlash */

function renderSetup() {
  const setup = profile.setup;
  ui.setupNote.textContent = conditions.note || 'Odatdagi sharoit.';
  for (const button of ui.setupRows.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(setup[button.dataset.option] === button.dataset.choice));
  }
}

function changeSetup(option, choice) {
  profile.setup[option] = choice;
  normalizeSetup(profile.setup, option);
  saveProfile();
  applySetup(profile.setup);
  renderSetup();
}

function randomizeSetup() {
  for (const [option, { choices }] of Object.entries(SETUP_OPTIONS)) {
    if (option !== 'difficulty' && option !== 'duration') profile.setup[option] = pick(Object.keys(choices));
  }
  changeSetup('weather', profile.setup.weather);
}

function showSetup() {
  applySetup(profile.setup);
  renderSetup();
  ui.setupStartBtn.textContent = network.active ? 'Saqlash' : 'Ovga chiqish';
  renderLoadouts();
  ui.menu.hidden = true;
  ui.setup.hidden = false;
}

ui.setupRows.replaceChildren(...Object.entries(SETUP_OPTIONS).map(([option, { label, choices }]) => {
  const row = document.createElement('div');
  row.className = 'setting';
  const head = document.createElement('span');
  head.className = 'setting-head';
  head.textContent = label;
  const buttons = document.createElement('div');
  buttons.className = 'segmented';
  for (const [choice, { name }] of Object.entries(choices)) {
    const button = document.createElement('button');
    button.textContent = name;
    button.dataset.option = option;
    button.dataset.choice = choice;
    button.addEventListener('click', () => changeSetup(option, choice));
    buttons.append(button);
  }
  row.append(head, buttons);
  return row;
}));

/** Xonadan ochilgan sharoit oynasi xonaga qaytadi, oddiy menyudan ochilgani raundni boshlaydi. */
ui.setupStartBtn.addEventListener('click', () => {
  if (network.active) showLobby();
  else startRound();
});
ui.setupRandomBtn.addEventListener('click', randomizeSetup);
ui.setupBackBtn.addEventListener('click', () => {
  if (network.active) {
    showLobby();
    return;
  }
  ui.setup.hidden = true;
  ui.menu.hidden = false;
});

/* Sozlamalar oynasi */

function showSettings() {
  const { sensitivity, volume, quality } = profile.settings;
  ui.sensitivityInput.value = sensitivity;
  ui.sensitivityValue.textContent = `${sensitivity.toFixed(2)}×`;
  ui.volumeInput.value = volume;
  ui.volumeValue.textContent = `${Math.round(volume * 100)}%`;
  for (const button of ui.qualityButtons.children) {
    button.setAttribute('aria-pressed', String(button.dataset.quality === quality));
  }
}

function changeSetting(name, value) {
  profile.settings[name] = value;
  saveProfile();
  showSettings();
}

ui.qualityButtons.replaceChildren(...Object.entries(QUALITY).map(([key, { label }]) => {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.quality = key;
  button.addEventListener('click', () => {
    changeSetting('quality', key);
    applyQuality();
  });
  return button;
}));

ui.sensitivityInput.addEventListener('input', () => changeSetting('sensitivity', Number(ui.sensitivityInput.value)));
ui.volumeInput.addEventListener('input', () => {
  changeSetting('volume', Number(ui.volumeInput.value));
  sound.applyVolume();
});
document.querySelectorAll('[data-open-settings]').forEach((button) => button.addEventListener('click', () => {
  showSettings();
  ui.settings.hidden = false;
}));
ui.settingsCloseBtn.addEventListener('click', () => { ui.settings.hidden = true; });

/* Do'kon */

const SHOP_ITEMS = [
  { id: 'binoculars', name: 'Durbin', price: 60, note: 'B tugmasini bosib turib uzoqni ko‘rish.' },
  { id: 'camo', name: 'Kamuflyaj', price: 100, note: 'Hayvonlar sizni 20% yaqinroqdan sezadi.' },
  { id: 'ammoPouch', name: 'O‘q xaltasi', price: 80, note: 'Har raundda zaxira o‘q 50% ko‘p bo‘ladi.' },
  { id: 'dog', name: 'Ov iti', price: 200, note: 'Hayvonni sezib huradi, yaradorga yetaklaydi. Lekin shovqin ko‘proq. K tugmasi: tur yoki yur.' },
  { id: 'tower', name: 'Minora', price: 140, note: 'Raundda bir marta Y bilan quriladi. Balanddan ko‘rasiz, hayvon kech sezadi.' },
  {
    id: 'trap', name: 'Tuzoq (3 ta)', price: 60, repeatable: true, count: () => profile.traps,
    give: () => { profile.traps += 3; }, note: 'U tugmasi bilan qo‘yiladi. Bosgan hayvon 8 soniya qimirlay olmaydi.',
  },
  {
    id: 'medkit', name: 'Dori', price: 30, repeatable: true, count: () => profile.medkits,
    give: () => { profile.medkits++; }, note: `H tugmasi: ${CONFIG.medkitHeal} jon tiklaydi.`,
  },
];

function buyItem(item) {
  if (profile.coins < item.price) return;
  profile.coins -= item.price;
  if (item.repeatable) item.give();
  else profile.owned.push(item.id);
  saveProfile();
  showShop();
}

/** Qurolni sotib oladi yoki kuchaytiradi. */
function buyWeaponStep(id) {
  const owned = id === 'rifle' || owns(id);
  const price = owned ? upgradeCost(id) : WEAPONS[id].price;
  if (profile.coins < price) return;
  profile.coins -= price;
  if (owned) profile.weaponLevels[id] = (profile.weaponLevels[id] ?? 0) + 1;
  else profile.owned.push(id);
  saveProfile();
  showShop();
}

function shopRow(title, note, label, disabled, onClick) {
  const row = document.createElement('li');
  const name = document.createElement('b');
  name.textContent = title;
  const small = document.createElement('small');
  small.textContent = note;
  const button = document.createElement('button');
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  row.append(name, small, button);
  return row;
}

function weaponRow(id) {
  const stats = gunStats(id);
  const owned = id === 'rifle' || owns(id);
  const maxed = stats.level >= UPGRADE.maxLevel;
  const price = owned ? upgradeCost(id) : stats.price;
  const label = !owned ? `${price} tanga` : maxed ? 'Eng kuchli' : `Kuchaytirish · ${price}`;
  const title = stats.level ? `${stats.name} +${stats.level}` : stats.name;
  const numbers = `Zarba ${stats.power.toFixed(1)} · Magazin ${stats.magazine} · O‘qlash ${stats.reloadTime.toFixed(1)} s`;
  const key = WEAPON_ORDER.indexOf(id) + 1;
  return shopRow(title, `${stats.note} ${numbers}. ${key} tugmasi.`, label, (owned && maxed) || profile.coins < price, () => buyWeaponStep(id));
}

function gearRow(item) {
  const bought = !item.repeatable && owns(item.id);
  return shopRow(
    item.repeatable ? `${item.name} · bor: ${item.count()}` : item.name,
    item.note,
    bought ? 'Sotib olingan' : `${item.price} tanga`,
    bought || profile.coins < item.price,
    () => buyItem(item),
  );
}

function shopHeading(text) {
  const heading = document.createElement('li');
  heading.className = 'shop-heading';
  heading.textContent = text;
  return heading;
}

function showShop() {
  ui.shopCoins.textContent = `Tanga: ${profile.coins}`;
  ui.shopList.replaceChildren(
    shopHeading('Qurollar'),
    ...WEAPON_ORDER.map(weaponRow),
    shopHeading('Jihozlar'),
    ...SHOP_ITEMS.map(gearRow),
  );
}

/* Raundga olib chiqiladigan jihozlar: o'yinchi o'zi tanlaydi */

const GEAR_ITEMS = [
  { id: 'binoculars', name: 'Durbin' },
  { id: 'camo', name: 'Kamuflyaj' },
  { id: 'ammoPouch', name: 'O‘q xaltasi' },
  { id: 'dog', name: 'Ov iti' },
  { id: 'tower', name: 'Minora' },
  { id: 'trap', name: 'Tuzoq' },
];

function renderLoadouts() {
  document.querySelectorAll('[data-loadout]').forEach((holder) => {
    holder.replaceChildren(...GEAR_ITEMS.map(({ id, name }) => {
      const button = document.createElement('button');
      const available = hasGear(id);
      button.textContent = name;
      button.disabled = !available;
      button.title = available ? '' : 'Do‘kondan sotib oling';
      button.setAttribute('aria-pressed', String(isEquipped(id)));
      button.addEventListener('click', () => {
        profile.loadout[id] = !isEquipped(id);
        saveProfile();
        renderLoadouts();
      });
      return button;
    }));
  });
}

document.querySelectorAll('[data-open-shop]').forEach((button) => button.addEventListener('click', () => {
  showShop();
  ui.shop.hidden = false;
}));
ui.shopCloseBtn.addEventListener('click', () => { ui.shop.hidden = true; });
