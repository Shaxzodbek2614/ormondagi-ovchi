'use strict';

/* ==========================================================================
   JAMOA JANGI: ikki jamoa bir-birini ov qiladi
   Kimga o'q tekkanini faqat xost hal qiladi. Mijoz "tekkizdim" deb xabar beradi,
   xost masofa, jamoa va jonni tekshiradi.
   ========================================================================== */

const TEAMS = {
  blue: { name: 'Ko‘k jamoa', color: '#4f9be0' },
  red: { name: 'Qizil jamoa', color: '#e2553f' },
};
const BATTLE = {
  damage: 34,         // miltiqning tanaga bitta zarbasi
  headMultiplier: 2,
  respawnTime: 6,     // yiqilgan ovchi shuncha soniyada lagerda turadi
  safeTime: 3,        // lagerda turgandan keyin shuncha soniya o'q tegmaydi
  downPoints: 100,
  winScore: 1000,
  campDistance: 70,
  maxRange: 260,
  botAccuracy: [0.6, 0.2], // yaqin va uzoqdagi raqibga tegish ehtimoli
};

/** Roster a'zosining rangi: jamoa missiyasida jamoa rangi. */
function memberColor(member) {
  const team = game.activeMission?.teams ? TEAMS[teamOf(member?.id)] : null;
  return team?.color ?? HUNTER_COLORS[(member?.colorIndex ?? 0) % HUNTER_COLORS.length];
}

/** Ovchining roster raqami: shu kompyuterdagi o'yinchi uchun ham to'g'ri. */
const hunterId = (hunter) => (hunter === player ? myRosterId() : hunter.id);

/** Roster a'zosining tanasi: shu kompyuterdagi o'yinchi uchun player. */
const bodyOf = (member) => (member && member.id === myRosterId() ? player : member?.hunter);

const otherTeam = (team) => (team === 'blue' ? 'red' : 'blue');

/** Eng yaqin tirik raqib: botlar shunga qarab yuradi va otadi. */
function nearestEnemy(hunter, range) {
  const id = hunterId(hunter);
  let best = null, bestDistance = range;
  for (const other of hunters) {
    if (other === hunter || other.down || other.immobile || sameTeam(id, hunterId(other))) continue;
    const distance = Math.hypot(other.pos.x - hunter.pos.x, other.pos.z - hunter.pos.z);
    if (distance < bestDistance) {
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

/* O'q tegishi: xostda */

/** Xost: o'qni tekshirib, zararni missiyaga beradi. Bot ham shu yo'ldan otadi. */
function battleHit(shooter, target, part, power) {
  const mission = game.activeMission;
  if (!mission?.pvp || game.state !== 'playing' || !shooter || !target || shooter === target) return;
  const from = bodyOf(shooter), to = bodyOf(target);
  if (!from || !to || from.down || to.down || sameTeam(shooter.id, target.id)) return;
  if (Math.hypot(from.pos.x - to.pos.x, from.pos.z - to.pos.z) > BATTLE.maxRange) return;
  const amount = Math.round(BATTLE.damage * power * (part === 'head' ? BATTLE.headMultiplier : 1));
  mission.hurt(shooter, target, amount);
}

HOST_MESSAGES.hitHunter = (member, { id, part, power }) => {
  const target = network.roster.get(String(id));
  battleHit(member, target, part === 'head' ? 'head' : 'body', clamp(Number(power) || 1, 0.1, 40));
};

/* Lagerda qayta turish */

function respawnSelf({ x, z }) {
  reviveSelf();
  player.hp = CONFIG.player.maxHp;
  player.velocity.set(0, 0, 0);
  moveToSpawn({ x, z });
  updateHealthHud();
}

/** Xost: yiqilgan ovchini o'z lagerida to'liq jon bilan turg'izadi. */
function respawnMember(member, spot) {
  const body = bodyOf(member);
  if (!body) return;
  if (body === player) {
    respawnSelf(spot);
  } else if (member.isBot) {
    body.revive();
    body.hp = CONFIG.player.maxHp;
    body.placeAt(spot);
  } else {
    sendTo(member.connection, { t: 'respawn', x: spot.x, z: spot.z });
    body.down = false;
  }
}

CLIENT_MESSAGES.respawn = ({ x, z }) => {
  if (isNumber(x) && isNumber(z)) respawnSelf({ x, z });
};

CLIENT_MESSAGES.downed = ({ by, who }) => {
  showPopup(`${cleanName(by)} → ${cleanName(who)}`);
};

/* Ko'rinish: lager bayroqlari va avatar ranglari */

function createTeamFlag(color) {
  const flag = new THREE.Mesh(merge(
    cylinder(0.06, 0.08, 4.2, '#6a4b2c', [0, 2.1, 0], [0, 0, 0], 6),
    box(1.3, 0.8, 0.04, color, [0.68, 3.7, 0]),
    box(0.9, 0.12, 0.9, '#5b5348', [0, 0.06, 0]),
  ), gearMaterial);
  flag.castShadow = true;
  flag.visible = false;
  scene.add(flag);
  return flag;
}

const teamFlags = Object.fromEntries(Object.entries(TEAMS).map(([team, { color }]) => [team, createTeamFlag(color)]));

function showTeamCamps(camps) {
  for (const [team, flag] of Object.entries(teamFlags)) {
    const camp = camps?.[team];
    flag.visible = Boolean(camp);
    if (camp) flag.position.set(camp.x, terrainHeight(camp.x, camp.z), camp.z);
  }
}

/** Sheriklarning ismi va bog'ichi jamoa rangiga bo'yaladi. */
function paintTeams() {
  for (const member of network.roster.values()) {
    member.hunter?.setTeamColor?.(game.activeMission?.teams && teamOf(member.id) ? memberColor(member) : null);
  }
}
