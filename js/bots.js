'use strict';

/* ==========================================================================
   BOT SHERIKLAR
   Botlarni xost boshqaradi. Boshqalar uchun bot oddiy sherik kabi ko'rinadi:
   holati sendWorld orqali tarqaladi, zarbasi esa odamniki kabi applyHit'dan o'tadi.
   ========================================================================== */

const BOT_NAMES = ['Anvar', 'Dilnoza', 'Sardor'];
const BOT = { walkSpeed: 5.2, sneakSpeed: 2.8, range: 78, searchRange: 110, shootEvery: [2.2, 3.6], sneakRange: 30, alarmRadius: 32, selfRevive: 30 };

class BotHunter extends RemoteHunter {
  constructor(id, name, colorIndex) {
    super(id, name, colorIndex);
    this.isBot = true;
    this.reset();
  }

  reset() {
    this.hp = CONFIG.player.maxHp;
    this.down = false;
    this.plan = {};
    this.planClock = 0;
    this.shotClock = randRange(...BOT.shootEvery);
    this.side = pick([-1, 1]);
    this.detour = null;
    this.reviveClock = 0;
    this.downClock = 0;
    this.stuckClock = 0;
    this.stuckFrom = { x: this.pos.x, z: this.pos.z };
    this.speed = 0;
    this.crouchGoal = 0;
    this.noise = 0.9;
  }

  placeAt({ x, z }) {
    this.target.set(x, this.surfaceY(x, z), z);
    this.pos.copy(this.target);
    this.stuckFrom = { x, z };
  }

  surfaceY(x, z) {
    const lowest = conditions.frozen ? WATER_LEVEL : WATER_LEVEL - 0.55;
    return Math.max(terrainHeight(x, z), lowest) + AVATAR_EYE_HEIGHT - (this.crouchGoal ? 0.6 : 0);
  }

  takeDamage(amount) {
    if (this.down) return;
    this.hp -= amount;
    if (this.hp > 0) return;
    this.hp = 0;
    this.down = true;
    this.downClock = 0;
    this.speed = 0;
    showPopup(`${this.name} yiqildi`);
    checkTeamWipe();
  }

  revive() {
    this.down = false;
    this.hp = REVIVE_HEALTH;
  }

  /** Mijozlarga yuboriladigan holat: odam o'yinchi bilan bir xil ko'rinishda. */
  stateArray() {
    const { x, y, z } = this.target;
    return [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +this.targetYaw.toFixed(3), +this.speed.toFixed(1), +this.noise.toFixed(2), this.crouchGoal, this.down ? 1 : 0];
  }

  distanceTo(point) {
    return Math.hypot(point.x - this.target.x, point.z - this.target.z);
  }

  /** Eng yaqin ov. Baliq ovlanmaydi, filter esa missiyaga qarab toraytiradi. */
  nearestAnimal(accept = () => true, range = 70) {
    let best = null, bestDistance = range;
    for (const animal of animals) {
      if (!animal.alive || !animal.spawned || animal.dormant || animal.kind === 'fish' || !accept(animal)) continue;
      const distance = this.distanceTo(animal.pos);
      if (distance < bestDistance) {
        best = animal;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Nima qilishni tanlaydi: sherikni qutqarish, missiya vazifasi yoki oddiy ov. */
  choosePlan() {
    const fallen = hunters.find((hunter) => hunter !== this && hunter.down && !hunter.immobile && this.distanceTo(hunter.pos) < 50);
    if (fallen) return { moveTo: fallen.pos, revive: fallen };

    // Hujum qilayotgan yirtqich har qanday vazifadan muhim
    const armed = !ROLE_INFO[network.roles?.[this.id]]?.unarmed;
    const danger = armed ? this.nearestAnimal((animal) => animal.state === 'charge', 45) : null;
    const missionPlan = game.activeMission?.botPlan?.(this);
    if (missionPlan) return { ...missionPlan, target: missionPlan.target ?? danger };

    const prey = danger ?? this.nearestAnimal(undefined, BOT.searchRange);
    if (prey) return { target: prey, moveTo: this.distanceTo(prey.pos) > 34 ? prey.pos : null };
    return { moveTo: this.roamPoint() };
  }

  /** Ov ko'rinmasa, sherik atrofida izlab yuradi. */
  roamPoint() {
    if (!this.roam || elapsed > this.roam.until || this.distanceTo(this.roam) < 3) {
      const leader = hunters.find((hunter) => !hunter.isBot && !hunter.immobile) ?? player;
      this.roam = { ...nearbyPoint(leader.pos.x, leader.pos.z, 30, 90), until: elapsed + 20 };
    }
    return this.roam;
  }

  /** Bir qadam yuradi: daraxtni aylanib o'tadi, chuqur suvga kirmaydi. */
  walk(goal, speed, dt) {
    const { target } = this;
    const dx = goal.x - target.x, dz = goal.z - target.z;
    if (Math.hypot(dx, dz) < 1.2) {
      this.speed = 0;
      return;
    }
    const isClear = (angle) => {
      const x = target.x + Math.sin(angle) * 2.4, z = target.z + Math.cos(angle) * 2.4;
      return isSpotFree(x, z, 0.7) && wadeDepthAt(x, z) <= MAX_WADE_DEPTH - 0.1;
    };
    let angle = Math.atan2(dx, dz);
    if (!isClear(angle)) {
      const turn = [0.7, 1.3, 2].flatMap((value) => [value * this.side, -value * this.side]).find((value) => isClear(angle + value));
      angle += turn ?? 0;
    }

    const nextX = target.x + Math.sin(angle) * speed * dt, nextZ = target.z + Math.cos(angle) * speed * dt;
    if (wadeDepthAt(nextX, nextZ) <= MAX_WADE_DEPTH) {
      target.x = nextX;
      target.z = nextZ;
    }
    pushOutOfObstacles(target, 0.5);
    const fromCenter = Math.hypot(target.x, target.z);
    if (fromCenter > CONFIG.worldRadius) target.multiplyScalar(CONFIG.worldRadius / fromCenter);
    this.speed = speed;
    this.targetYaw = Math.atan2(-Math.sin(angle), -Math.cos(angle));
    this.watchForStuck(dt);
  }

  /** Bir joyda qolib ketsa, yo'lini o'zgartiradi: suv to'sgan bo'lsa, o'tish joyiga boradi. */
  watchForStuck(dt) {
    this.stuckClock += dt;
    if (this.stuckClock < 2) return;
    this.stuckClock = 0;
    if (this.distanceTo(this.stuckFrom) < 2) {
      this.side *= -1;
      const ford = fords.reduce((best, candidate) => (!best || this.distanceTo(candidate) < this.distanceTo(best) ? candidate : best), null);
      const nearWater = !isDryLand(this.target.x, this.target.z) || this.distanceTo(ford ?? this.target) < 60;
      this.detour = { ...(nearWater && ford ? ford : nearbyPoint(this.target.x, this.target.z, 6, 14)), until: elapsed + 9 };
    }
    this.stuckFrom = { x: this.target.x, z: this.target.z };
  }

  /** Nishon ko'rinsa, otadi. Masofa uzoq bo'lsa, ko'proq xato qiladi. */
  tryShoot(animal, dt, sure) {
    this.shotClock -= dt;
    if (!animal?.alive || this.shotClock > 0) return;
    const distance = this.distanceTo(animal.pos);
    if (distance > BOT.range || isSightBlocked(animal.pos, this, distance)) return;

    const skill = clamp(conditions.damage, 0.7, 1.25);
    this.shotClock = randRange(...BOT.shootEvery) / skill;
    this.targetYaw = Math.atan2(this.target.x - animal.pos.x, this.target.z - animal.pos.z);

    const { x, z } = this.target;
    sound.distantShot({ x, z });
    broadcast({ t: 'bang', id: this.id, x, z });
    alarmAnimals(x, z, BOT.alarmRadius);

    const chance = sure ? 1 : lerp(0.62, 0.22, distance / BOT.range) * skill;
    if (Math.random() < chance) {
      applyHit(animal, Math.random() < 0.15 ? 'head' : 'body', 1, network.roster.get(this.id));
    }
  }

  act(dt) {
    this.planClock -= dt;
    if (this.planClock <= 0) {
      this.planClock = 0.45;
      this.plan = this.choosePlan();
    }
    const { plan } = this;

    if (this.detour && (elapsed > this.detour.until || this.distanceTo(this.detour) < 2)) this.detour = null;
    const goal = this.detour ?? plan.moveTo;

    // Nishonga yaqinlashganda egilib, sekin yuradi
    const close = plan.sneak || (plan.target && this.distanceTo(plan.target.pos) < BOT.sneakRange);
    this.crouchGoal = close ? 1 : 0;
    if (goal) this.walk(goal, close ? BOT.sneakSpeed : BOT.walkSpeed, dt);
    else this.speed = 0;
    this.target.y = this.surfaceY(this.target.x, this.target.z);

    const role = ROLE_INFO[network.roles?.[this.id]];
    this.noise = (this.speed > 0 ? 0.9 : 0.5) * (close ? 0.5 : 1) * (role?.noise ?? 1) * conditions.noise;

    if (plan.revive) {
      const nearby = this.distanceTo(plan.revive.pos) < REVIVE_RANGE;
      this.reviveClock = nearby ? this.reviveClock + dt : 0;
      if (this.reviveClock >= REVIVE_TIME) {
        this.reviveClock = 0;
        const id = plan.revive === player ? HOST_ID : plan.revive.id;
        HOST_MESSAGES.revive(network.roster.get(this.id), { id });
      }
    }

    if (plan.sure) this.shotClock = Math.min(this.shotClock, 0.5);
    this.tryShoot(plan.target, dt, plan.sure);
  }

  /** Yordam kelmasa, bot biroz yotib o'zi turadi: missiya bir botga qarab qolmaydi. */
  waitForHelp(dt) {
    this.downClock += dt;
    if (this.downClock >= BOT.selfRevive) this.revive();
  }

  update(dt) {
    if (game.mode === 'team' && game.state === 'playing') {
      if (this.down) this.waitForHelp(dt);
      else this.act(dt);
    }
    super.update(dt);
  }
}

/* Xonadagi botlar ro'yxati */

function removeBot(member) {
  member.hunter?.remove();
  network.roster.delete(member.id);
}

function addBot() {
  const used = new Set([...network.roster.values()].map((member) => member.colorIndex));
  const names = new Set([...network.roster.values()].map((member) => member.name));
  const name = BOT_NAMES.map((value) => `${value} (bot)`).find((value) => !names.has(value));
  const id = `b${network.nextClientNumber++}`;
  const colorIndex = [0, 1, 2, 3].find((index) => !used.has(index));
  network.roster.set(id, { id, name, colorIndex, isBot: true, connection: null });
}

/** Bot sonini tanlovga va haqiqiy o'yinchilar soniga moslaydi. */
function syncBots() {
  if (!network.isHost) return;
  const members = [...network.roster.values()];
  const humans = members.filter((member) => !member.isBot).length;
  const bots = members.filter((member) => member.isBot);
  const wanted = Math.min(profile.botCount, MAX_PLAYERS - humans);
  while (bots.length > wanted) removeBot(bots.pop());
  for (let count = bots.length; count < wanted; count++) addBot();
  broadcast({ t: 'roster', roster: rosterList() });
  renderLobby();
}
