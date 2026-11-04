'use strict';

/* ==========================================================================
   BIRGA OV RAUNDI: holatni sinxronlash, otish, yiqilish, belgilar
   ========================================================================== */

const SEND_INTERVAL = { player: 1 / 15, world: 1 / 10 };
const ANIMAL_STATES = ['graze', 'walk', 'alert', 'flee', 'charge', 'recover', 'stalk', 'rear', 'swim', 'fly', 'hidden', 'leap', 'dead', 'pose'];
const REVIVE_TIME = 3;
const REVIVE_RANGE = 2.8;
const REVIVE_HEALTH = 40;
const CLIENT_TIMEOUT = 8000; // shuncha vaqt xabar kelmasa, mijoz chiqib ketgan hisoblanadi

const isNumber = Number.isFinite;

/* Raundni boshlash */

function addTeamMate(member) {
  if (member.id === network.myId || member.hunter) return;
  member.hunter = new RemoteHunter(member.id, member.name, member.colorIndex);
  hunters.push(member.hunter);
}

/** O'yinchilar boshlang'ich nuqta atrofida doira bo'lib turadi. */
function teamSpawnPoint(index) {
  const angle = (index / MAX_PLAYERS) * TAU;
  return { x: Math.cos(angle) * 4, z: Math.sin(angle) * 4 };
}

function buildStartMessage() {
  return {
    t: 'start',
    setup: network.roundSetup,
    spawns: network.spawns,
    teamMission: game.activeMission?.id ?? null,
    goals: game.missions.map(({ text, goal, progress, reward }) => ({ text, goal, progress, reward })),
    timeLeft: game.timeLeft,
    roster: rosterList(),
  };
}

function beginTeamRound(setup, teamMission) {
  sound.init();
  game.mode = 'team';
  game.activeMission = teamMission;
  network.roundSetup = setup;
  applySetup(setup);
  resetRound();

  const members = [...network.roster.values()];
  members.forEach(addTeamMate);
  hunters.length = 0;
  hunters.push(player, ...members.map((member) => member.hunter).filter((hunter) => hunter && hunter !== player));
  for (const member of members) {
    if (member.hunter) member.hunter.down = false;
    member.lastSeen = performance.now(); // xonada kutilgan vaqt uzilish deb hisoblanmasin
  }
  game.reviveProgress = 0;
  game.myRole = null;
  game.marks = [];
  game.teamStatus = null;
  renderTeamStatus(null);
  game.pings = [];
  game.menuOpen = true; // o'yinchi tugmani bosmaguncha boshqaruv yoqilmaydi
  game.state = 'playing';
  ui.lobby.hidden = true;
  ui.hud.hidden = false;
  viewModel.visible = true;
  ui.pauseNote.textContent = teamMission?.brief ?? 'Raund boshlandi.';
  ui.pause.hidden = false;
}

function moveToSpawn(spawn) {
  player.pos.x = spawn?.x ?? 0;
  player.pos.z = spawn?.z ?? 0;
}

/** Xost: raundni hamma uchun boshlaydi. */
function startTeamRound() {
  const mission = network.selectedTeamMission ?? null;
  if (network.roster.size < (mission?.minPlayers ?? 1)) {
    setLobbyStatus(`Bu vazifa uchun kamida ${mission.minPlayers} kishi kerak.`);
    return;
  }
  beginTeamRound(mission?.setup ?? { ...profile.setup }, mission);
  mission?.prepare?.();
  assignRoles(mission);
  moveToSpawn(network.spawns[HOST_ID]);
  broadcast(buildStartMessage());
  requestLock();
}

/* Holat yuborish */

function localPlayerState() {
  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  return [
    +player.pos.x.toFixed(2), +player.pos.y.toFixed(2), +player.pos.z.toFixed(2), +player.yaw.toFixed(3),
    +speed.toFixed(1), +player.noise.toFixed(2), player.crouching ? 1 : 0, player.down ? 1 : 0,
  ];
}

/** Xost: bitta ko'ruvchi uchun yaqin hayvonlar ro'yxati, tekis sonlar massivida. */
function encodeAnimals(viewer) {
  const list = [];
  for (const animal of animals) {
    if (animal.dormant || !animal.spawned) continue;
    if (Math.hypot(animal.pos.x - viewer.pos.x, animal.pos.z - viewer.pos.z) > ANIMAL_VIEW_DISTANCE) continue;
    const y = animal.pos.y;
    list.push(
      animal.id, Math.round(animal.pos.x * 10), Math.round(y * 10), Math.round(animal.pos.z * 10),
      Math.round((animal.heading ?? 0) * 100), Math.round((animal.speed ?? 0) * 10),
      Math.max(ANIMAL_STATES.indexOf(animal.state), 0), animal.prey === viewer && animal.state === 'charge' ? 1 : 0,
    );
  }
  return list;
}

function sendWorld() {
  game.teamStatus = collectTeamStatus();
  renderTeamStatus(game.teamStatus);
  const players = [...network.roster.values()].map((member) => [
    member.id, member.id === HOST_ID ? localPlayerState() : member.lastState ?? null,
  ]);
  const shared = {
    t: 'world',
    time: +game.timeLeft.toFixed(1),
    score: game.score,
    wind: +wind.angle.toFixed(2),
    goals: game.missions.map((goal) => goal.progress),
    status: game.teamStatus,
    players,
  };
  for (const member of network.roster.values()) {
    if (member.connection && member.hunter) sendTo(member.connection, { ...shared, animals: encodeAnimals(member.hunter) });
  }
}

function updateNetwork(dt) {
  if (!network.active) return;

  for (const member of network.roster.values()) {
    if (member.hunter && member.hunter !== player) member.hunter.update(dt);
  }

  if (game.mode !== 'team' || game.state !== 'playing') return;
  network.sendClock -= dt;
  if (network.isClient && network.sendClock <= 0) {
    network.sendClock = SEND_INTERVAL.player;
    sendToHost({ t: 'me', state: localPlayerState() });
  }
  if (network.isHost && network.sendClock <= 0) {
    network.sendClock = SEND_INTERVAL.world;
    sendWorld();
    const now = performance.now();
    for (const member of [...network.roster.values()]) {
      if (member.connection && now - member.lastSeen > CLIENT_TIMEOUT) {
        member.connection.close();
        dropClient(member.connection);
      }
    }
  }
  updateRevive(dt);
  updateMarkers();
}

/* Mijozdagi hayvonlar: xost holatini silliq ko'rsatish */

function applyAnimalSnapshot(list) {
  const stamp = performance.now();
  for (let i = 0; i + 7 < list.length; i += 8) {
    const animal = animals[list[i]];
    if (!animal) continue;
    animal.net = {
      x: list[i + 1] / 10, y: list[i + 2] / 10, z: list[i + 3] / 10, heading: list[i + 4] / 100,
      speed: list[i + 5] / 10, state: ANIMAL_STATES[list[i + 6]] ?? 'graze', targeted: list[i + 7] === 1, stamp,
    };
  }
}

/* Xost qabul qiladigan xabarlar */

const HOST_MESSAGES = {
  me(member, { state }) {
    if (!Array.isArray(state) || state.length !== 8 || !state.every(isNumber)) return;
    const [x, , z] = state;
    if (Math.abs(x) > FIELD_HALF || Math.abs(z) > FIELD_HALF) return;
    member.lastState = state;
    member.hunter?.applyState(state);
    checkTeamWipe();
  },

  hit(member, { id, part, power }) {
    const animal = animals[id];
    if (!animal?.alive || !animal.spawned) return;
    const safePart = part === 'head' ? 'head' : 'body';
    applyHit(animal, safePart, clamp(Number(power) || 1, 1, 3), member);
  },

  shot(member, { radius }) {
    if (!member.hunter || !isNumber(radius)) return;
    const { x, z } = member.hunter.pos;
    alarmAnimals(x, z, clamp(radius, 0, 60));
    broadcast({ t: 'bang', id: member.id, x, z }, member.id);
    if (member.id !== HOST_ID) sound.distantShot({ x, z });
  },

  ping(member, { x, y, z }) {
    if (![x, y, z].every(isNumber)) return;
    game.activeMission?.onPing?.(x, z);
    const message = { t: 'ping', id: member.id, x, y, z, label: labelNear(x, z) };
    broadcast(message);
    showPing(message);
  },

  revive(member, { id }) {
    const target = network.roster.get(String(id));
    if (!target?.hunter?.down) return;
    if (target.id === HOST_ID) reviveSelf();
    else sendTo(target.connection, { t: 'revived' });
    target.hunter.down = false;
  },
};

/* Mijoz qabul qiladigan xabarlar */

const CLIENT_MESSAGES = {
  refused({ reason }) {
    setLobbyStatus(String(reason ?? 'Xonaga kirib bo‘lmadi.'));
  },
  welcome({ id, roster }) {
    network.myId = String(id);
    applyRoster(roster);
    setLobbyStatus('Xonadasiz. Xost raundni boshlashini kuting.');
  },
  roster({ roster }) {
    applyRoster(roster);
  },
  task({ text }) {
    setLobbyStatus(`Xost tanladi: ${String(text).slice(0, 40)}`);
  },
  left({ name, roster }) {
    applyRoster(roster);
    showPopup(`${cleanName(name)} chiqib ketdi`);
  },
  start(message) {
    applyRoster(message.roster);
    const setup = { ...profile.setup, ...message.setup };
    beginTeamRound(setup, TEAM_MISSIONS.find((mission) => mission.id === message.teamMission) ?? null);
    game.missions = message.goals.map((goal) => ({
      text: String(goal.text), goal: Number(goal.goal), progress: Number(goal.progress), reward: Number(goal.reward) || 0,
    }));
    game.timeLeft = message.timeLeft;
    updateMissionHud();
    moveToSpawn(message.spawns?.[network.myId]);
    // Hayvonlarni xostdan kelgan holat bilan ko'rsatamiz
    for (const animal of animals) {
      animal.net = null;
      animal.root.visible = false;
    }
  },
  world(message) {
    game.timeLeft = message.time;
    game.score = message.score;
    wind.angle = message.wind;
    updateScoreHud();
    updateTimeHud();
    let changed = false;
    message.goals.forEach((progress, index) => {
      const goal = game.missions[index];
      if (goal && goal.progress !== progress) {
        goal.progress = progress;
        changed = true;
      }
    });
    if (changed) updateMissionHud();
    renderTeamStatus(message.status);
    for (const [id, state] of message.players) {
      const member = network.roster.get(String(id));
      if (member?.hunter && member.hunter !== player && state) member.hunter.applyState(state);
    }
    applyAnimalSnapshot(message.animals);
  },
  kill({ name, points, headshot }) {
    showPopup(`+${points} ${cleanName(name)}${headshot ? ' · boshga!' : ''}`);
  },
  hurt({ amount, x, z, name }) {
    damagePlayer(amount, { pos: { x, z }, spec: { name: cleanName(name) } });
  },
  bang({ x, z }) {
    sound.distantShot({ x, z });
  },
  ping(message) {
    showPing(message);
  },
  revived() {
    reviveSelf();
  },
  end({ reason, won, score, kills }) {
    game.score = score;
    game.kills = { ...game.kills, ...kills };
    endRound(String(reason), Boolean(won));
  },
};

/* Yiqilish va qutqarish */

function goDown() {
  player.down = true;
  player.hp = 0;
  player.velocity.set(0, 0, 0);
  updateHealthHud();
  ui.downBanner.hidden = false;
  checkTeamWipe();
}

function reviveSelf() {
  player.down = false;
  player.hp = REVIVE_HEALTH;
  ui.downBanner.hidden = true;
  updateHealthHud();
  sound.heal();
}

/** Xost: hamma yiqilsa, raund tugaydi. */
function checkTeamWipe() {
  if (!network.isHost || game.mode !== 'team' || game.state !== 'playing') return;
  if (hunters.filter((hunter) => !hunter.immobile).every((hunter) => hunter.down)) endRound('Butun jamoa yiqildi');
}

function nearestDownedMate() {
  if (player.down) return null;
  return hunters.find((hunter) => hunter !== player && hunter.down
    && Math.hypot(hunter.pos.x - player.pos.x, hunter.pos.z - player.pos.z) < REVIVE_RANGE) ?? null;
}

function updateRevive(dt) {
  const mate = nearestDownedMate();
  game.reviveTarget = mate;
  if (mate && input.keys.KeyE) {
    game.reviveProgress += dt;
    if (game.reviveProgress >= REVIVE_TIME) {
      game.reviveProgress = 0;
      sendToHost({ t: 'revive', id: mate.id });
    }
  } else {
    game.reviveProgress = 0;
  }
}

/* Belgilar: sheriklar va qo'yilgan belgilar ekranda ko'rinadi */

const PING_LIFETIME = 7000;

/** Belgi yonida hayvon bo'lsa, uning nomini yozamiz. */
function labelNear(x, z) {
  const animal = animals.find((candidate) => candidate.alive && candidate.spawned && !candidate.dormant
    && Math.hypot(candidate.pos.x - x, candidate.pos.z - z) < 7);
  return animal?.spec.name ?? '';
}

/** G tugmasi: qaragan joyga belgi qo'yadi. */
function placePing() {
  camera.updateMatrixWorld();
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const distance = Math.min(rayToGround(camera.position, direction, 200), 200);
  const point = camera.position.clone().addScaledVector(direction, distance);
  sendToHost({ t: 'ping', x: +point.x.toFixed(1), y: +point.y.toFixed(1), z: +point.z.toFixed(1) });
}

function showPing({ id, x, y, z, label }) {
  const member = network.roster.get(String(id));
  game.pings.push({
    point: new THREE.Vector3(x, y, z),
    text: cleanName(label || member?.name),
    color: HUNTER_COLORS[(member?.colorIndex ?? 0) % HUNTER_COLORS.length],
    until: performance.now() + PING_LIFETIME,
  });
  sound.tick();
}

const markerProjection = new THREE.Vector3();

/** 3D nuqtani ekran chetidan chiqib ketmaydigan yorliq sifatida joylaydi. */
function placeMarker(element, point, text, color) {
  markerProjection.copy(point).project(camera);
  const behind = markerProjection.z > 1;
  const x = clamp((behind ? -markerProjection.x : markerProjection.x) * 0.5 + 0.5, 0.04, 0.96);
  const y = behind ? 0.92 : clamp(0.5 - markerProjection.y * 0.5, 0.08, 0.92);
  element.style.transform = `translate(${x * window.innerWidth}px, ${y * window.innerHeight}px) translate(-50%, -50%)`;
  element.style.color = color;
  if (element.textContent !== text) element.textContent = text;
}

function updateMarkers() {
  const now = performance.now();
  game.pings = game.pings.filter((ping) => ping.until > now);

  const items = [];
  for (const id of game.marks ?? []) {
    const animal = animals[id];
    if (animal?.alive) {
      items.push({ point: animal.pos, color: '#ff7a5c', text: `◎ Nishon · ${Math.round(animal.pos.distanceTo(player.pos))} m` });
    }
  }
  for (const member of network.roster.values()) {
    if (!member.hunter || member.hunter === player) continue;
    const distance = Math.round(member.hunter.pos.distanceTo(player.pos));
    if (distance < 25 && !member.hunter.down) continue; // yaqinda boshi ustidagi nom yetarli
    items.push({
      point: member.hunter.pos, color: HUNTER_COLORS[member.colorIndex % HUNTER_COLORS.length],
      text: `${member.hunter.down ? 'Yordam! ' : ''}${member.name} · ${distance} m`,
    });
  }
  for (const ping of game.pings) {
    items.push({ point: ping.point, color: ping.color, text: `◆ ${ping.text} · ${Math.round(ping.point.distanceTo(player.pos))} m` });
  }

  while (ui.markers.children.length < items.length) ui.markers.append(document.createElement('span'));
  [...ui.markers.children].forEach((element, index) => {
    const item = items[index];
    element.hidden = !item;
    if (item) placeMarker(element, item.point, item.text, item.color);
  });
}
