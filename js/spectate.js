'use strict';

/* ==========================================================================
   KUZATISH: yiqilgan o'yinchi tirik sherigini orqasidan kuzatib turadi
   ========================================================================== */

const SPECTATE_DISTANCE = 3.4;
const SPECTATE_HEIGHT = 0.9;

const spectate = { target: null, yaw: 0 };

/** Kuzatsa bo'ladigan sheriklar: tirik, o'z jamoasidan. */
function spectateTargets() {
  return hunters.filter((hunter) => hunter !== player && !hunter.down && !hunter.immobile
    && sameTeam(hunter.id, myRosterId()));
}

function nextSpectateTarget() {
  const targets = spectateTargets();
  if (!targets.length) return;
  const index = targets.indexOf(spectate.target);
  spectate.target = targets[(index + 1) % targets.length];
}

/** Kim kuzatilayotganini tanlaydi va uning boshi ustidagi ismni yashiradi. */
function updateSpectateTarget() {
  if (!player.down || game.mode !== 'team') {
    spectate.target = null;
  } else if (!spectateTargets().includes(spectate.target)) {
    spectate.target = spectateTargets()[0] ?? null;
    if (spectate.target) spectate.yaw = spectate.target.yaw;
  }
  for (const hunter of hunters) {
    if (hunter.nameTag) hunter.nameTag.visible = hunter !== spectate.target;
  }
  return spectate.target;
}

/** Kamerani sherik orqasiga qo'yadi. Sherik bo'lmasa false qaytaradi. */
function followSpectateTarget(dt) {
  const mate = updateSpectateTarget();
  if (!mate) return false;
  spectate.yaw += angleDelta(spectate.yaw, mate.yaw) * (1 - Math.exp(-5 * dt));
  const x = mate.pos.x + Math.sin(spectate.yaw) * SPECTATE_DISTANCE;
  const z = mate.pos.z + Math.cos(spectate.yaw) * SPECTATE_DISTANCE;
  const y = Math.max(mate.pos.y + SPECTATE_HEIGHT, terrainHeight(x, z) + 0.6);
  camera.position.set(x, y, z);
  camera.rotation.set(clamp(player.pitch, -0.7, 0.35) - 0.15, spectate.yaw, 0);
  return true;
}

/** Yiqilganlik yozuvi: kim kuzatilayotgani va missiyaning o'z gapi bilan. */
function downBannerText() {
  const lines = [game.activeMission?.downText?.() ?? 'Yiqildingiz. Sherigingiz sizni turg‘izishi kerak.'];
  if (spectate.target) {
    const more = spectateTargets().length > 1 ? (IS_TOUCH_DEVICE ? ' · tugma bilan almashtiring' : ' · sichqonchani bosib almashtiring') : '';
    lines.push(`Kuzatilmoqda: ${spectate.target.name}${more}`);
  }
  return lines.join('\n');
}

function updateDownBanner() {
  if (!player.down) return;
  const text = downBannerText();
  if (ui.downBanner.textContent !== text) ui.downBanner.textContent = text;
}
