'use strict';

/* ==========================================================================
   O'YINCHI
   ========================================================================== */

const player = {
  pos: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  hp: CONFIG.player.maxHp,
  id: 'me',
  down: false,   // birga o'ynaganda: joni tugab yiqilgan
  lampOn: false, // bosh chirog'i
  onTower: null, // minora ustida bo'lsa, uning joyi
  noise: 0,      // shovqin darajasi: hayvonlar sezish masofasini shunga ko'paytiradi
  crouching: false,
  crouch: 0,     // 0 = tik turgan, 1 = to'liq egilgan
  stepPhase: 0,  // yurishda bosh tebranishi va qadam ovozi uchun
  recoil: 0,     // o'q uzgandagi kamera ko'tarilishi
  shake: 0,      // zarar olgandagi kamera titrashi
  aim: 0,        // 0 = oddiy, 1 = to'liq mo'ljalga olingan
  scope: 0,      // 0 = oddiy, 1 = durbindan qaralmoqda
};

// Hayvonlar sezadigan barcha ovchilar. Birga o'ynaganda bu ro'yxatga sheriklar ham qo'shiladi.
const hunters = [player];

function nearestHunter(x, z) {
  let nearest = player, nearestDistance = Infinity;
  for (const hunter of hunters) {
    const distance = Math.hypot(hunter.pos.x - x, hunter.pos.z - z);
    if (!hunter.down && distance < nearestDistance) {
      nearest = hunter;
      nearestDistance = distance;
    }
  }
  return nearest;
}

const input = {
  keys: {},
  fire: false,
  aiming: false,
  scoping: false,
  lookX: 0,      // shu kadrdagi sichqoncha siljishi (miltiq tebranishi uchun)
  lookY: 0,
  edgeTurn: 0,   // erkin sichqoncha rejimida kursor ekran chetida bo'lsa: -1..1
  stickX: 0,     // telefondagi joystick: -1..1
  stickY: 0,
};

function updatePlayer(dt) {
  const cfg = CONFIG.player;
  const { keys } = input;

  player.yaw -= input.edgeTurn * 1.8 * dt;

  // Yiqilgan o'yinchi yura olmaydi, faqat atrofga qaraydi
  if (player.down) {
    player.noise = 0;
    player.pos.y = terrainHeight(player.pos.x, player.pos.z) + 0.4;
    camera.position.copy(player.pos);
    camera.rotation.set(player.pitch, player.yaw, 0.4);
    return;
  }

  const forward = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) - input.stickY;
  const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + input.stickX;
  const throttle = player.onTower ? 0 : Math.min(1, Math.hypot(forward, strafe)); // joystick qanchalik surilgan
  const moving = throttle > 0.12;
  const aiming = input.aiming && weapon.reloadLeft <= 0;
  const sprinting = moving && !aiming && (keys.ShiftLeft || keys.ShiftRight);
  if (sprinting) player.crouching = false;
  // Suvda qadam og'irlashadi
  const wading = clamp(wadeDepthAt(player.pos.x, player.pos.z) / MAX_WADE_DEPTH, 0, 1);
  const baseSpeed = sprinting ? cfg.sprintSpeed
    : player.crouching ? cfg.crouchSpeed
      : aiming ? cfg.aimSpeed : cfg.walkSpeed;
  const speed = baseSpeed * (1 - wading * 0.55);

  // Bosilgan tugmalarni qarash yo'nalishiga nisbatan dunyo yo'nalishiga aylantiramiz
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const wishX = -sin * forward + cos * strafe;
  const wishZ = -cos * forward - sin * strafe;
  const length = Math.hypot(wishX, wishZ) || 1;
  const targetSpeed = moving ? speed * throttle : 0;
  player.velocity.x = damp(player.velocity.x, (wishX / length) * targetSpeed, 10, dt);
  player.velocity.z = damp(player.velocity.z, (wishZ / length) * targetSpeed, 10, dt);

  // Har bir o'q alohida tekshiriladi: chuqur suv bo'ylab sirpanib yurish mumkin
  const nextX = player.pos.x + player.velocity.x * dt;
  const nextZ = player.pos.z + player.velocity.z * dt;
  const blockedX = wadeDepthAt(nextX, player.pos.z) > MAX_WADE_DEPTH;
  const blockedZ = wadeDepthAt(player.pos.x, nextZ) > MAX_WADE_DEPTH;
  if (!blockedX) player.pos.x = nextX;
  if (!blockedZ) player.pos.z = nextZ;
  pushOutOfObstacles(player.pos, cfg.radius);

  // Dunyo chegarasi
  const fromCenter = Math.hypot(player.pos.x, player.pos.z);
  if (fromCenter > CONFIG.worldRadius) {
    const scale = CONFIG.worldRadius / fromCenter;
    player.pos.x *= scale;
    player.pos.z *= scale;
  }
  // Chuqurroq joyda o'yinchi loyga botmaydi: boshi suvdan yetarlicha baland qoladi
  if (player.onTower) {
    player.pos.x = player.onTower.x;
    player.pos.z = player.onTower.z;
    player.velocity.set(0, 0, 0);
  }

  player.crouch = damp(player.crouch, player.crouching ? 1 : 0, 10, dt);
  const eyeHeight = lerp(cfg.eyeHeight, cfg.crouchEyeHeight, player.crouch);
  const lowestStand = conditions.frozen ? WATER_LEVEL : WATER_LEVEL - 0.55;
  player.pos.y = Math.max(terrainHeight(player.pos.x, player.pos.z), lowestStand) + eyeHeight
    + (player.onTower ? TOWER_HEIGHT : 0);

  // Hayvonlar shovqinni eshitadi: turgan odamni kechroq, yugurganni ertaroq sezadi.
  // Egilish va buta orasida turish bu masofani qisqartiradi, suvda shaloplash esa oshiradi.
  const hidden = isInCover(player.pos.x, player.pos.z);
  player.noise = (!moving ? 0.55 : sprinting ? 1.5 : aiming ? 0.7 : 1)
    * (player.crouching ? 0.5 : 1)
    * (hidden ? 0.6 : 1)
    * (moving && wading > 0.05 ? 1.3 : 1)
    * conditions.noise
    * (isEquipped('camo') ? 0.8 : 1)
    * (player.onTower ? 0.5 : 1) // minorada hid va shovqin yerga kamroq yetadi
    * (dog.active && !dog.staying ? 1.15 : 1)
    * (player.lampOn && conditions.night ? 1.35 : 1) // tunda chiroq uzoqdan ko'rinadi
    * (ROLE_INFO[game.myRole]?.noise ?? 1);
  updateFieldHud(hidden);

  // Qadam va bosh tebranishi
  const groundSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  const previousStep = Math.floor(player.stepPhase / Math.PI);
  player.stepPhase += groundSpeed * 1.15 * dt;
  if (Math.floor(player.stepPhase / Math.PI) !== previousStep) {
    if (wading > 0.05) sound.splash();
    else sound.footstep(sprinting);
  }
  const bob = Math.sin(player.stepPhase * 2) * 0.035 * clamp(groundSpeed / cfg.walkSpeed, 0, 1.3) * (1 - player.aim * 0.7);

  // Mo'ljalga olish: ko'rish burchagi torayadi
  player.aim = damp(player.aim, aiming ? 1 : 0, 12, dt);
  player.scope = damp(player.scope, input.scoping ? 1 : 0, 12, dt);
  const aimFov = weapon.gun.aimFov ?? CONFIG.fov.aiming;
  const fov = lerp(lerp(CONFIG.fov.normal, aimFov, player.aim), CONFIG.fov.binoculars, player.scope);
  if (Math.abs(fov - camera.fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  player.recoil = damp(player.recoil, 0, 9, dt);
  player.shake = damp(player.shake, 0, 6, dt);

  camera.position.copy(player.pos);
  camera.position.y += bob;
  camera.rotation.set(
    clamp(player.pitch + player.recoil, -1.5, 1.5) + randRange(-1, 1) * player.shake * 0.04,
    player.yaw,
    randRange(-1, 1) * player.shake * 0.05,
  );

  ui.crosshair.style.setProperty('--gap', `${lerp(9 + groundSpeed * 1.1, 3, player.aim)}px`);
  setHint(hintText(fromCenter, moving && (blockedX || blockedZ)));
}

function hintText(fromCenter, blockedByWater) {
  if (game.reviveTarget) {
    const percent = Math.round((game.reviveProgress / REVIVE_TIME) * 100);
    return `E tugmasini bosib turing: ${game.reviveTarget.name} (${percent}%)`;
  }
  const fishingText = fishingHint();
  if (fishingText) return fishingText;
  if (weapon.ammo === 0 && weapon.reloadLeft <= 0 && weapon.reserve > 0) return 'O‘q tugadi: R tugmasini bosing';
  if (weapon.ammo === 0 && weapon.reserve === 0) return 'O‘q qolmadi';
  if (blockedByWater) return 'Bu yer juda chuqur: sayoz joyni qidiring';
  if (fromCenter > CONFIG.worldRadius - 2) return 'O‘rmon chegarasi: ortga qayting';
  return dog.hint() ?? nearbyTrackLabel ?? fishingOffer();
}

/** Hayvon zarbasi: ovchi shu kompyuterdagi o'yinchi bo'lsa, zararni shu yerda hisoblaymiz. */
function strikeHunter(hunter, amount, attacker) {
  if (hunter.takeDamage) {
    hunter.takeDamage(amount);
    return;
  }
  if (hunter === player) {
    damagePlayer(amount, attacker);
    return;
  }
  sendTo(network.roster.get(hunter.id)?.connection, {
    t: 'hurt', amount, x: attacker.pos.x, z: attacker.pos.z, name: attacker.spec.name,
  });
}

/** @param attacker zarba kelgan hayvon: o'yinchi undan orqaga itariladi */
function damagePlayer(amount, attacker) {
  if (game.state !== 'playing' || player.down) return;
  player.hp = Math.max(0, player.hp - Math.round(amount));
  game.damageTaken += Math.round(amount);
  player.shake = 1;
  const dx = player.pos.x - attacker.pos.x, dz = player.pos.z - attacker.pos.z;
  const distance = Math.hypot(dx, dz) || 1;
  player.velocity.x += (dx / distance) * 13;
  player.velocity.z += (dz / distance) * 13;

  sound.hurt();
  const angle = angleFromView(attacker.pos.x, attacker.pos.z);
  ui.hitArc.animate(
    [{ opacity: 1, transform: `rotate(${angle}rad)` }, { opacity: 0, transform: `rotate(${angle}rad)` }],
    { duration: 900, easing: 'ease-out' },
  );
  ui.vignette.animate([{ opacity: 1 }, { opacity: lowHealthGlow() }], { duration: 600, easing: 'ease-out' });
  updateHealthHud();
  if (player.hp > 0) return;
  if (game.mode === 'team') goDown();
  else endRound(`${attacker.spec.name} sizni yengdi`);
}
