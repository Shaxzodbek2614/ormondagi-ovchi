'use strict';

/* ==========================================================================
   JAMOA MISSIYALARI
   Yakka missiyalardan farqi: bir kishi bajara olmaydi. Mantiq faqat xostda ishlaydi,
   status() natijasi har soniyada bir necha marta barcha o'yinchilarga yuboriladi.
   ========================================================================== */

const ROLE_INFO = {
  driver: { name: 'Haydovchi', tip: 'Siz haydovchisiz: shovqin qilib yuring, bug‘ular sizdan qochib zona tomon boradi.', noise: 1.8 },
  ambusher: { name: 'Pistirmachi', tip: 'Siz pistirmachisiz: zonada egilib kuting va kelgan bug‘uni oting.' },
  observer: { name: 'Kuzatuvchi', tip: 'Siz kuzatuvchisiz: B bilan durbindan qarang, G bilan nishonni belgilang. Qurolingiz yo‘q.', fog: 0.5, unarmed: true },
  shooter: { name: 'Otuvchi', tip: 'Siz otuvchisiz: ko‘rish masofangiz qisqa. Sherigingiz belgilagan nishonni oting.', fog: 3.6 },
};

const groupCenter = () => {
  const people = hunters.filter((hunter) => !hunter.immobile);
  return {
    x: people.reduce((sum, hunter) => sum + hunter.pos.x, 0) / people.length,
    z: people.reduce((sum, hunter) => sum + hunter.pos.z, 0) / people.length,
  };
};

/** Bosh hayvonni qaysi tomondan otilganiga qarab zarba kuchi. */
function isBehind(animal, x, z) {
  const dx = x - animal.pos.x, dz = z - animal.pos.z;
  const facing = (dx * Math.sin(animal.heading) + dz * Math.cos(animal.heading)) / (Math.hypot(dx, dz) || 1);
  return facing < -0.2;
}

const TEAM_MISSIONS = [
  {
    id: 'drive-hunt',
    title: 'Haydab ov',
    brief: 'Haydovchilar bug‘ularni zonaga haydaydi, pistirmachilar u yerda otadi. Faqat zona ichidagi ov hisoblanadi.',
    minPlayers: 2,
    roles: ['ambusher', 'driver'],
    setup: { time: 'dawn', weather: 'clear', season: 'autumn', wind: 'calm', difficulty: 'normal', duration: '300' },
    goals: [{ kind: 'deer', inZone: true, goal: 5, text: 'Zonadagi bug‘u' }],
    reward: 120,
    fastLeft: 130,
    prepare() {
      const angle = Math.random() * TAU;
      const zone = nearbyPoint(Math.cos(angle) * 85, Math.sin(angle) * 85, 0, 12);
      this.zone = { x: zone.x, z: zone.z, radius: 24 };
      bringAnimals('deer', 16, zone.x * 0.5, zone.z * 0.5, 4, 20);
    },
    spawnFor(role, index) {
      return role === 'ambusher' ? nearbyPoint(this.zone.x, this.zone.z, 2, 8) : teamSpawnPoint(index);
    },
    /** Zonaga eng yaqin bug'uni tanlab, uni bot bilan zona orasiga oladi. */
    driverPlan(bot) {
      const { zone } = this;
      const fromZone = (animal) => Math.hypot(animal.pos.x - zone.x, animal.pos.z - zone.z);
      const outside = animals.filter((animal) => animal.kind === 'deer' && animal.alive && animal.spawned
        && !animal.dormant && fromZone(animal) > zone.radius);
      if (!outside.length) return { moveTo: zone };
      const deer = outside.reduce((best, animal) => (fromZone(animal) < fromZone(best) ? animal : best));

      const ux = (deer.pos.x - zone.x) / fromZone(deer), uz = (deer.pos.z - zone.z) / fromZone(deer);
      const offsetX = bot.target.x - deer.pos.x, offsetZ = bot.target.z - deer.pos.z;
      if (offsetX * ux + offsetZ * uz > 8) return { moveTo: { x: deer.pos.x + ux * 10, z: deer.pos.z + uz * 10 } };

      // Bot noto'g'ri tomonda: bug'uni hurkitmay, yonidan ortiga aylanib o'tadi
      const side = offsetZ * ux - offsetX * uz > 0 ? 1 : -1;
      return { sneak: true, moveTo: { x: deer.pos.x - uz * side * 36 + ux * 14, z: deer.pos.z + ux * side * 36 + uz * 14 } };
    },
    botPlan(bot) {
      if (network.roles[bot.id] === 'driver') return this.driverPlan(bot);
      const inZone = (animal) => animal.kind === 'deer'
        && Math.hypot(animal.pos.x - this.zone.x, animal.pos.z - this.zone.z) < this.zone.radius;
      return { moveTo: bot.distanceTo(this.zone) > 8 ? this.zone : null, target: bot.nearestAnimal(inZone) };
    },
    annotate(moment, animal) {
      moment.inZone = Math.hypot(animal.pos.x - this.zone.x, animal.pos.z - this.zone.z) < this.zone.radius;
    },
    status() {
      return { zone: this.zone, text: 'Bug‘ularni zonaga haydang' };
    },
  },
  {
    id: 'camp-defense',
    title: 'Lager mudofaasi',
    brief: 'Bo‘rilar to‘lqin-to‘lqin lagerga hujum qiladi. Besh to‘lqinga bardosh bering, lager yo‘q bo‘lsa yutqazasiz.',
    minPlayers: 1,
    setup: { time: 'night', weather: 'clear', season: 'winter', wind: 'breeze', difficulty: 'normal', duration: '300' },
    goals: [{ custom: true, goal: 5, text: 'To‘lqin' }],
    reward: 150,
    fastLeft: 90,
    prepare() {
      this.camp = {
        id: 'camp', name: 'Lager', immobile: true, down: false, noise: 2, reach: 3, hp: 100,
        pos: new THREE.Vector3(0, terrainHeight(0, 0), 0),
        takeDamage(amount) {
          this.hp -= amount * 0.4;
          if (this.hp <= 0) endRound('Lager yo‘q qilindi');
        },
      };
      hunters.push(this.camp);
      this.wave = [];
      this.waveClock = 5;
      this.pushClock = 0;
      for (const animal of animals.filter(({ spec }) => spec.aggressive)) {
        animal.dormant = true;
        animal.root.visible = false;
      }
    },
    botPlan(bot) {
      const wolf = bot.nearestAnimal((animal) => this.wave.includes(animal), 140);
      if (wolf) return { target: wolf, moveTo: bot.distanceTo(wolf.pos) > 26 ? wolf.pos : null };
      return { moveTo: bot.distanceTo(this.camp.pos) > 9 ? this.camp.pos : null };
    },
    startWave(number) {
      const pool = animals.filter((animal) => animal.kind === 'wolf' && (!animal.alive || animal.dormant || !animal.spawned));
      this.wave = pool.slice(0, 3 + number);
      for (const wolf of this.wave) {
        const { x, z } = nearbyPoint(0, 0, 65, 85);
        wolf.spawn(0);
        placeAnimal(wolf, x, z);
        wolf.relentless = true;
        wolf.staysDead = true;
        wolf.setState('charge');
      }
    },
    tick(dt) {
      const goal = game.missions[0];
      const alive = this.wave.filter((wolf) => wolf.alive);
      if (this.wave.length && alive.length === 0) {
        goal.progress++;
        updateMissionHud();
        this.wave = [];
        this.waveClock = 7;
      }
      if (!this.wave.length && goal.progress < goal.goal) {
        this.waveClock -= dt;
        if (this.waveClock <= 0) this.startWave(goal.progress);
      }
      // To'lqindagi bo'rilar chalg'imasin: lager yoki ovchilarga qaytadan yuboriladi
      this.pushClock -= dt;
      if (this.pushClock <= 0) {
        this.pushClock = 3;
        for (const wolf of alive) if (['flee', 'graze', 'walk'].includes(wolf.state)) wolf.setState('charge');
      }
    },
    status() {
      const wolves = this.wave.filter((wolf) => wolf.alive).length;
      return { camp: true, text: `Lager: ${Math.max(0, Math.round(this.camp.hp))}% · Bo‘ri: ${wolves}` };
    },
  },
  {
    id: 'giant-bear',
    title: 'Ulkan ayiq',
    brief: 'Ayiq oldidan juda kam zarar oladi, orqasidan esa ikki baravar ko‘p. Biringiz chalg‘iting, boshqangiz orqadan oting.',
    minPlayers: 2,
    setup: { time: 'dusk', weather: 'storm', season: 'summer', wind: 'gale', difficulty: 'normal', duration: '300' },
    goals: [{ kind: 'bear', goal: 1, text: 'Ulkan ayiq' }],
    reward: 170,
    fastLeft: 130,
    prepare() {
      const bears = animals.filter((animal) => animal.kind === 'bear');
      this.boss = bears[0];
      bears.slice(1).forEach((bear) => { bear.dormant = true; bear.root.visible = false; });
      const { x, z } = nearbyPoint(0, 0, 55, 70);
      placeAnimal(this.boss, x, z);
      this.boss.root.scale.setScalar(1.7);
      this.bossHp = this.boss.hp = 30;
    },
    botPlan(bot) {
      const { boss } = this;
      if (!boss.alive) return {};
      // Ayiq botni quvsa, u qochib chalg'itadi. Aks holda orqasiga o'tib otadi.
      if (boss.prey === bot && boss.state !== 'graze') {
        return { moveTo: { x: bot.target.x * 2 - boss.pos.x, z: bot.target.z * 2 - boss.pos.z } };
      }
      const behind = { x: boss.pos.x - Math.sin(boss.heading) * 16, z: boss.pos.z - Math.cos(boss.heading) * 16 };
      return { moveTo: behind, target: boss };
    },
    adjustPower(animal, power, shooter) {
      if (animal !== this.boss) return power;
      const behind = isBehind(animal, shooter.hunter.pos.x, shooter.hunter.pos.z);
      if (behind) {
        const message = { t: 'kill', name: 'Orqadan zarba', points: 0, headshot: false };
        broadcast(message);
        showPopup('Orqadan zarba!');
      }
      return behind ? power * 2 : power * 0.35;
    },
    status() {
      return { boss: this.boss.id, text: `Ulkan ayiq: ${Math.max(0, Math.round((this.boss.hp / this.bossHp) * 100))}%` };
    },
  },
  {
    id: 'one-moment',
    title: 'Bir lahzada',
    brief: 'Ikki belgilangan bug‘uni ikki kishi 2 soniya ichida otishi kerak. Biri kechiksa, ikkovi qochadi. Uch marta adashsangiz yutqazasiz.',
    minPlayers: 2,
    setup: { time: 'day', weather: 'cloudy', season: 'summer', wind: 'calm', difficulty: 'normal', duration: '300' },
    goals: [{ custom: true, goal: 3, text: 'Juft ov' }],
    reward: 140,
    fastLeft: 120,
    prepare() {
      this.misses = 0;
      this.newPair();
    },
    newPair() {
      const center = groupCenter();
      const middle = nearbyPoint(center.x, center.z, 28, 40);
      const deer = animals.filter((animal) => animal.kind === 'deer' && animal.alive && !animal.dormant).slice(0, 2);
      this.marks = deer.map((animal) => animal.id);
      this.firstHit = null;
      for (const animal of deer) {
        const { x, z } = nearbyPoint(middle.x, middle.z, 11, 16);
        placeAnimal(animal, x, z);
        animal.hp = animal.spec.hp;
        animal.setState('pose', 999); // nishon joyida turadi
      }
    },
    botPlan(bot) {
      // Bot birinchi bo'lib otmaydi: sherik bittasini otgach, ikkinchisini darrov uradi
      const free = this.marks.map((id) => animals[id]).find((animal) => animal.id !== this.firstHit?.id);
      if (!free) return {};
      const moveTo = bot.distanceTo(free.pos) > 24 ? free.pos : null;
      return this.firstHit && this.firstHit.by !== bot.id ? { moveTo, target: free, sure: true } : { moveTo };
    },
    onHit(animal, part, shooter) {
      if (!this.marks.includes(animal.id)) return false;
      if (!this.firstHit) {
        this.firstHit = { id: animal.id, by: shooter.id, at: elapsed };
      } else if (this.firstHit.id !== animal.id && this.firstHit.by !== shooter.id) {
        for (const id of this.marks) {
          animals[id].takeHit('head', 9);
          onAnimalKilled(animals[id], { headshot: false, shooter });
        }
        game.missions[0].progress++;
        updateMissionHud();
        sound.chime();
        this.marks = [];
        this.firstHit = null;
        if (game.missions[0].progress < game.missions[0].goal) this.pairDelay = 2.5;
      }
      return true;
    },
    tick(dt) {
      if (this.pairDelay > 0) {
        this.pairDelay -= dt;
        if (this.pairDelay <= 0) this.newPair();
      }
      if (this.firstHit && elapsed - this.firstHit.at > 2) {
        this.marks.forEach((id) => animals[id].setState('flee', 6));
        this.misses++;
        if (this.misses >= 3) endRound('Uch marta kechikdingiz');
        else this.pairDelay = 4;
        this.marks = [];
        this.firstHit = null;
      }
    },
    status() {
      return { marks: this.marks, text: `Adashish: ${this.misses} / 3` };
    },
  },
  {
    id: 'spotter',
    title: 'Kuzatuvchi va otuvchi',
    brief: 'Kuzatuvchi uzoqni ko‘radi, lekin quroli yo‘q. Otuvchi yaqinni ko‘radi. Faqat belgilangan nishon hisoblanadi.',
    minPlayers: 2,
    roles: ['observer', 'shooter'],
    setup: { time: 'dusk', weather: 'clear', season: 'autumn', wind: 'breeze', difficulty: 'normal', duration: '300' },
    goals: [{ marked: true, goal: 5, text: 'Belgilangan nishon' }],
    reward: 130,
    fastLeft: 130,
    prepare() {
      this.marks = new Map();
      bringAnimals('deer', 10, 0, 0, 40, 90);
      bringAnimals('boar', 4, 0, 0, 50, 90);
    },
    botPlan(bot) {
      const leader = hunters.find((hunter) => !hunter.isBot && !hunter.immobile) ?? player;
      if (network.roles[bot.id] === 'observer') {
        // Kuzatuvchi bot odam otuvchiga yaqin hayvonni vaqti-vaqti bilan belgilab beradi
        if (elapsed > (bot.nextSpot ?? 0)) {
          bot.nextSpot = elapsed + 5;
          const animal = bot.nearestAnimal((candidate) => !candidate.spec.aggressive, 110);
          if (animal) {
            this.onPing(animal.pos.x, animal.pos.z);
            HOST_MESSAGES.ping(network.roster.get(bot.id), { x: animal.pos.x, y: animal.pos.y, z: animal.pos.z });
          }
        }
        return { moveTo: bot.distanceTo(leader.pos) > 20 ? leader.pos : null };
      }
      const marked = [...this.marks.keys()].map((id) => animals[id]).find((animal) => animal.alive);
      if (!marked) return { moveTo: bot.distanceTo(leader.pos) > 14 ? leader.pos : null };
      return { target: marked, moveTo: bot.distanceTo(marked.pos) > 26 ? marked.pos : null };
    },
    onPing(x, z) {
      const animal = animals.find((candidate) => candidate.alive && candidate.spawned && !candidate.dormant
        && Math.hypot(candidate.pos.x - x, candidate.pos.z - z) < 8);
      if (animal) this.marks.set(animal.id, elapsed + 25);
    },
    annotate(moment, animal) {
      moment.marked = this.marks.has(animal.id);
    },
    tick() {
      for (const [id, until] of this.marks) {
        if (until < elapsed || !animals[id].alive) this.marks.delete(id);
      }
    },
    status() {
      return { marks: [...this.marks.keys()], text: 'Faqat belgilangan nishonni oting' };
    },
  },
  {
    id: 'zone-duel',
    title: 'Zona janggi',
    brief: 'Musobaqa: hamma bitta zonada, faqat zona ichidagi ov hisoblanadi. Vaqt tugaganda eng ko‘p ochko olgan g‘olib.',
    minPlayers: 1,
    versus: true,
    setup: { time: 'day', weather: 'clear', season: 'summer', wind: 'calm', difficulty: 'normal', duration: '300' },
    goals: [],
    reward: 160,
    prepare() {
      const center = nearbyPoint(0, 0, 0, 8);
      this.zone = { x: center.x, z: center.z, radius: 60 };
      this.scores = new Map([...network.roster.keys()].map((id) => [id, 0]));
      this.restockClock = 0;
      this.restock();
    },
    spawnFor(role, index) {
      const angle = (index / MAX_PLAYERS) * TAU;
      return nearbyPoint(this.zone.x + Math.cos(angle) * 44, this.zone.z + Math.sin(angle) * 44, 0, 4);
    },
    isInside(position) {
      return Math.hypot(position.x - this.zone.x, position.z - this.zone.z) < this.zone.radius;
    },
    /** Zonada doim ov bo'lsin: tashqaridagi hayvonlar ichkariga olib kelinadi. */
    restock() {
      const prey = animals.filter((animal) => ['deer', 'rabbit', 'boar', 'fox'].includes(animal.kind)
        && animal.alive && animal.spawned && !animal.dormant);
      const missing = 14 - prey.filter((animal) => this.isInside(animal.pos)).length;
      const outside = prey.filter((animal) => !this.isInside(animal.pos))
        .sort(() => Math.random() - 0.5) // turlari aralash bo'lsin
        .slice(0, Math.max(missing, 0));
      for (const animal of outside) {
        const { x, z } = nearbyPoint(this.zone.x, this.zone.z, 8, this.zone.radius - 4);
        const seen = hunters.some((hunter) => Math.hypot(hunter.pos.x - x, hunter.pos.z - z) < 16);
        if (!seen) placeAnimal(animal, x, z);
      }
    },
    tick(dt) {
      this.restockClock -= dt;
      if (this.restockClock <= 0) {
        this.restockClock = 5;
        this.restock();
      }
    },
    annotate(moment, animal) {
      moment.inZone = this.isInside(animal.pos);
    },
    onKill(animal, moment, points) {
      if (!moment.inZone) return;
      const id = moment.shooter?.id ?? HOST_ID;
      this.scores.set(id, (this.scores.get(id) ?? 0) + points);
    },
    botPlan(bot) {
      const prey = bot.nearestAnimal((animal) => this.isInside(animal.pos));
      if (!prey) return { moveTo: bot.distanceTo(this.zone) > 20 ? this.zone : null };
      return { target: prey, moveTo: bot.distanceTo(prey.pos) > 34 ? prey.pos : null };
    },
    status() {
      const board = [...this.scores.entries()]
        .map(([id, score]) => ({ id, score, name: network.roster.get(id)?.name ?? 'Ovchi' }))
        .sort((a, b) => b.score - a.score);
      return { zone: this.zone, board, text: 'Zona janggi' };
    },
  },
];

/* --------------------------------------------------------------------------
   Holatni ekranda ko'rsatish: xostda ham, mijozda ham bir xil ishlaydi
   -------------------------------------------------------------------------- */

const zoneWall = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 7, 40, 1, true),
  new THREE.MeshBasicMaterial({ color: '#e5ad4c', transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
);
zoneWall.visible = false;
scene.add(zoneWall);

/** Lager: chodir, gulxan va o'tin. */
function createCamp() {
  const camp = new THREE.Group();
  const shape = merge(
    painted(new THREE.ConeGeometry(2.6, 2.8, 4), '#8f6b3e', [3.4, 1.4, 0], [0, Math.PI / 4, 0]),
    painted(new THREE.ConeGeometry(2.4, 2.6, 4), '#5f7446', [-3.2, 1.3, 1.2], [0, 0.5, 0]),
    cylinder(0.12, 0.14, 1.7, '#4e3825', [0.2, 0.15, 0.4], [Math.PI / 2, 0.7, 0]),
    cylinder(0.12, 0.14, 1.7, '#4e3825', [0, 0.15, 0.4], [Math.PI / 2, -0.7, 0]),
    cone(0.5, 1.1, '#ff9a2e', [0.1, 0.65, 0.4]),
    cone(0.28, 0.8, '#ffe07a', [0.1, 0.6, 0.4]),
  );
  const mesh = new THREE.Mesh(shape, gearMaterial);
  mesh.castShadow = true;
  camp.add(mesh);
  const glow = new THREE.PointLight('#ff9a4a', 40, 26, 2);
  glow.position.y = 1.6;
  camp.add(glow);
  camp.position.y = terrainHeight(0, 0);
  camp.visible = false;
  scene.add(camp);
  return camp;
}

const campModel = createCamp();

/** Musobaqa jadvali: o'rin, ism, ochko. */
function renderBoard(board) {
  ui.board.hidden = !board;
  if (!board) return;
  ui.board.replaceChildren(...board.map(({ id, name, score }, index) => {
    const row = document.createElement('li');
    row.classList.toggle('mine', id === network.myId);
    row.textContent = `${index + 1}. ${cleanName(name)}: ${score}`;
    return row;
  }));
  const mine = board.find(({ id }) => id === network.myId);
  if (mine) ui.score.textContent = mine.score;
}

/** Musobaqa natijasi: g'olibga to'liq mukofot, qolganlarga yarmi. */
function settleVersus() {
  const mission = game.activeMission;
  const board = game.teamStatus?.board ?? [];
  const place = board.findIndex(({ id }) => id === network.myId) + 1;
  const first = place === 1 && board[0].score > 0;
  profile.teamMissions[mission.id] = Math.max(profile.teamMissions[mission.id] ?? 0, first ? 3 : 1);
  return {
    coins: Math.round(mission.reward * (first ? 1 : 0.5)),
    summary: first ? 'G‘olib siz!' : `Siz ${place}-o‘rindasiz`,
    rows: board.map(({ name, score }, index) => [`${index + 1}. ${cleanName(name)}`, `${score} ochko`]),
  };
}

function applyRole(role) {
  if (game.myRole === role) return;
  game.myRole = role ?? null;
  const info = ROLE_INFO[role];
  scene.fog.density = conditions.fog * (info?.fog ?? 1);
  if (info) showTip(info.tip);
}

/** Jamoa holatini ekranga chiqaradi. status null bo'lsa, hammasi yashiriladi. */
function renderTeamStatus(status) {
  game.teamStatus = status;
  ui.teamLine.textContent = status?.text ?? '';
  game.marks = status?.marks ?? [];

  zoneWall.visible = Boolean(status?.zone);
  if (status?.zone) {
    const { x, z, radius } = status.zone;
    zoneWall.position.set(x, terrainHeight(x, z) + 3, z);
    zoneWall.scale.set(radius, 1, radius);
  }
  campModel.visible = Boolean(status?.camp);
  renderBoard(status?.board);
  if (isNumber(status?.boss)) animals[status.boss]?.root.scale.setScalar(1.7);
  applyRole(status?.roles?.[network.myId]);
}

/** Xost: missiya holatini yig'adi, sharoit va rollar bilan birga. */
function collectTeamStatus() {
  const mission = game.activeMission;
  if (!mission) return null;
  return { ...mission.status?.(), roles: network.roles };
}

/** Xost: rollarni navbat bilan taqsimlaydi. */
function assignRoles(mission) {
  const members = [...network.roster.values()];
  network.roles = {};
  network.spawns = {};
  members.forEach((member, index) => {
    const role = mission?.roles?.[index % mission.roles.length];
    if (role) network.roles[member.id] = role;
    network.spawns[member.id] = mission?.spawnFor?.(role, index) ?? teamSpawnPoint(index);
  });
}

/** Xost: jamoa missiyasini tanlash oynasi. */
function showTeamMissions() {
  const choose = (mission) => {
    network.selectedTeamMission = mission;
    if (mission) {
      Object.assign(profile.setup, mission.setup);
      saveProfile();
    }
    broadcast({ t: 'task', text: mission?.title ?? 'Erkin birga ov' });
    ui.missions.hidden = true;
    showLobby();
  };

  const freeHunt = { title: 'Erkin birga ov', brief: 'Tasodifiy topshiriqlar, o‘zingiz tanlagan sharoit.' };
  ui.missionsTitle.textContent = 'Jamoa vazifasi';
  ui.missionCards.replaceChildren(...[freeHunt, ...TEAM_MISSIONS].map((mission) => {
    const row = document.createElement('li');
    const title = document.createElement('b');
    title.textContent = mission.title;
    if (mission.id) {
      const stars = document.createElement('span');
      stars.className = 'stars';
      stars.textContent = starText(profile.teamMissions[mission.id] ?? 0);
      title.append(' ', stars);
    }
    const brief = document.createElement('small');
    brief.textContent = mission.minPlayers > 1 ? `${mission.brief} Kamida ${mission.minPlayers} kishi.` : mission.brief;
    const button = document.createElement('button');
    button.textContent = 'Tanlash';
    button.addEventListener('click', () => choose(mission.id ? mission : null));
    row.append(title, brief, button);
    return row;
  }));
  ui.lobby.hidden = true;
  ui.missions.hidden = false;
}
