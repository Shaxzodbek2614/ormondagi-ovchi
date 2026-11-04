'use strict';

/* ==========================================================================
   HAYVON TURLARI VA XULQ-ATVORI
   ========================================================================== */

const SPECIES = {
  deer: {
    track: { type: 'hoof', size: 1, step: 1.5, width: 0.16 },
    name: 'Bug‘u', points: 25, hp: 2, headDamage: 2, count: 24, groupSize: [3, 4], drinks: true, wadeDepth: 0.8, model: deerModel(),
    walkSpeed: 2.1, runSpeed: 11.5, turnRate: 3.2, radius: 0.7,
    senseRange: 30, alertTime: [0.5, 1], stride: 1.5, grazeAngle: 2.05, lieHeight: 0.3,
  },
  // Noyob oq bug'u: faqat missiyada chiqadi, uzoqdan sezadi va juda tez chopadi
  whiteDeer: {
    track: { type: 'hoof', size: 1, step: 1.5, width: 0.16 },
    name: 'Oq bug‘u', points: 200, hp: 2, headDamage: 2, count: 1, missionOnly: true, wadeDepth: 0.8,
    model: deerModel({ back: '#f1ece2', belly: '#ffffff', dark: '#cfc8ba' }),
    walkSpeed: 2.1, runSpeed: 13, turnRate: 3.6, radius: 0.7,
    senseRange: 46, alertTime: [0.3, 0.6], stride: 1.5, grazeAngle: 2.05, lieHeight: 0.3,
  },
  rabbit: {
    track: { type: 'paw', size: 0.5, step: 1.2, width: 0.08 },
    name: 'Quyon', points: 15, hp: 1, headDamage: 1, count: 30, wadeDepth: 0.1, model: rabbitModel(),
    walkSpeed: 1.3, runSpeed: 9.5, turnRate: 6, radius: 0.3, scale: 1.3, hops: true,
    senseRange: 16, alertTime: [0.2, 0.5], stride: 5.5, grazeAngle: 0.8, lieHeight: 0.2,
  },
  boar: {
    // Qalin bosh suyagi: yugurib kelayotgan cho'chqani bitta o'q to'xtatmaydi
    track: { type: 'hoof', size: 1.1, step: 1.3, width: 0.2 },
    name: 'Cho‘chqa', points: 40, hp: 3, headDamage: 2, count: 14, drinks: true, wadeDepth: 0.9, voice: 'grunt', model: boarModel(),
    walkSpeed: 1.7, runSpeed: 8.6, turnRate: 3.6, radius: 0.75,
    senseRange: 24, alertTime: [0.4, 0.7], stride: 2.8, grazeAngle: 0.75, lieHeight: 0.42,
    aggressive: true, damage: 20, biteRange: 2, giveUpRange: 60,
  },
  fox: {
    track: { type: 'paw', size: 0.7, step: 1.3, width: 0.1 },
    name: 'Tulki', points: 30, hp: 1, headDamage: 1, count: 12, wadeDepth: 0.3, scale: 0.66, tailWag: 0.25,
    model: canineModel({ back: '#c4632a', belly: '#f2e9dc', sock: '#231a16', tailTip: '#f6f0e6', muzzle: '#f2e9dc', earScale: 1.35, tailScale: 1.25 }),
    walkSpeed: 1.9, runSpeed: 11, turnRate: 7, radius: 0.32, zigzag: true,
    senseRange: 32, alertTime: [0.1, 0.3], stride: 3.4, grazeAngle: 0.95, lieHeight: 0.17,
  },
  duck: {
    name: 'O‘rdak', points: 35, hp: 1, headDamage: 1, count: 14, warmOnly: true, model: duckModel(), scale: 1.25,
    walkSpeed: 0.9, runSpeed: 14, turnRate: 3, radius: 0.3,
    senseRange: 20, lieHeight: 0.08,
  },
  fish: {
    name: 'Baliq', points: 20, hp: 1, headDamage: 1, count: 5, warmOnly: true, model: fishModel(), scale: 1.5,
    walkSpeed: 1, runSpeed: 1, turnRate: 1, radius: 0.2, senseRange: 0, lieHeight: 0.02,
  },
  wolf: {
    track: { type: 'paw', size: 1, step: 1.5, width: 0.14 },
    name: 'Bo‘ri', points: 50, hp: 2, headDamage: 2, count: 12, groupSize: [3, 4], wadeDepth: 0.9, tailWag: 0.18, voice: 'growl',
    model: canineModel({ back: '#6d6c6b', belly: '#cbc7be', sock: '#8c8a86', tailTip: '#2f2e2d', muzzle: '#cbc7be' }),
    walkSpeed: 2.4, runSpeed: 10.2, turnRate: 4.5, radius: 0.5,
    senseRange: 28, alertTime: [0.3, 0.5], stride: 2.6, grazeAngle: 0.55, lieHeight: 0.26,
    aggressive: true, pack: true, damage: 15, biteRange: 1.8, giveUpRange: 70,
  },
  bear: {
    track: { type: 'paw', size: 1.9, step: 1.5, width: 0.32 },
    name: 'Ayiq', points: 120, hp: 6, headDamage: 2, count: 6, drinks: true, wadeDepth: 1.1, voice: 'growl', model: bearModel(),
    walkSpeed: 1.5, runSpeed: 9.2, turnRate: 2.6, radius: 1.1,
    senseRange: 15, alertTime: [0.6, 0.9], stride: 1.7, grazeAngle: 0.8, lieHeight: 0.62,
    aggressive: true, rears: true, damage: 35, biteRange: 2.6, giveUpRange: 70, recoverTime: 1.8,
  },
};

const animals = [];
const ANIMAL_VIEW_DISTANCE = 175;
let elapsed = 0; // o'yin boshlanganidan beri o'tgan vaqt

// Shamol vaqti-vaqti bilan yo'nalishini o'zgartiradi. Burchak shamol qayerga esayotganini bildiradi.
const wind = { angle: Math.random() * TAU, target: 0, changeIn: 0 };
wind.target = wind.angle;

function updateWind(dt) {
  wind.changeIn -= dt;
  if (wind.changeIn <= 0) {
    wind.changeIn = randRange(25, 45);
    wind.target = wind.angle + randRange(-1.4, 1.4);
  }
  wind.angle = damp(wind.angle, wind.target, 0.3, dt);
  grassUniforms.swayWind.value.set(Math.sin(wind.angle), Math.cos(wind.angle)).multiplyScalar(conditions.windSway);
}

/** Shamol hidni hayvon tomonga olib borsa, u ovchini uzoqdan sezadi. Teskari bo'lsa, yaqindan. */
function windSenseFactor(position, hunter) {
  const dx = position.x - hunter.pos.x, dz = position.z - hunter.pos.z;
  const towardsAnimal = (dx * Math.sin(wind.angle) + dz * Math.cos(wind.angle)) / (Math.hypot(dx, dz) || 1);
  return 1 + towardsAnimal * (towardsAnimal > 0 ? 0.6 : 0.4) * conditions.windStrength;
}

/** Hayvon bilan ovchi orasida daraxt yoki tosh bormi. */
function isSightBlocked(position, hunter, distance) {
  const direction = { x: (hunter.pos.x - position.x) / distance, y: 0, z: (hunter.pos.z - position.z) / distance };
  return rayToObstacle({ x: position.x, y: position.y + 1, z: position.z }, direction, distance) < distance;
}

// Oyoqlar qaysi navbatda harakat qiladi (chap old, o'ng old, chap orqa, o'ng orqa)
const WALK_RHYTHM = [0, 0.5, 0.75, 0.25];
const GALLOP_RHYTHM = [0, 0.12, 0.55, 0.67];

function createHitBox({ size, center }, parent, animal, part) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
  mesh.position.set(...center);
  mesh.visible = false; // ko'rinmaydi, lekin Raycaster uni baribir topadi
  mesh.userData = { animal, part };
  parent.add(mesh);
  return mesh;
}

class Animal {
  constructor(kind) {
    this.kind = kind;
    this.spec = SPECIES[kind];
    const { model } = this.spec;

    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.root.scale.setScalar(this.spec.scale ?? 1);
    this.pos = this.root.position;

    const addPart = (geometry, parent, position, castShadow = true) => {
      const mesh = new THREE.Mesh(geometry, furMaterial);
      mesh.castShadow = castShadow;
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };

    // Tana, bo'yin, bosh, quloqlar, dum va ikki bo'g'inli oyoqlar
    this.body = addPart(model.body, this.root, [0, 0, 0]);
    if (model.neck) {
      this.neck = addPart(model.neck.geometry, this.root, model.neck.pivot);
      this.head = addPart(model.head.geometry, this.neck, model.head.pivot);
    }
    this.ears = (model.ears?.pivots ?? []).map((pivot, index) => {
      const ear = addPart(model.ears.geometry, this.head, pivot, false);
      ear.rotation.set(model.ears.tiltX, 0, (index === 0 ? 1 : -1) * model.ears.tiltZ);
      return ear;
    });
    this.tail = addPart(model.tail.geometry, this.root, model.tail.pivot, false);
    this.legs = model.legs.map(({ pivot, upper, knee, lower }) => {
      const thigh = addPart(upper, this.root, pivot);
      return { thigh, shin: addPart(lower, thigh, knee, false) };
    });

    this.hitBoxes = [createHitBox(model.hitBody, this.root, this, 'body')];
    if (model.hitHead) this.hitBoxes.push(createHitBox(model.hitHead, this.head, this, 'head'));
    if (model.hitNeck) this.hitBoxes.push(createHitBox(model.hitNeck, this.neck, this, 'body'));
    scene.add(this.root);
  }

  /** Bo'sh quruqlik nuqtasi. Guruh a'zolari yo'lboshchisi yonida chiqadi. */
  findSpawnPoint(minDistance) {
    const leader = this.group && groupLeader(this.group);
    let x = 0, z = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (leader && leader !== this) {
        x = leader.pos.x + randRange(-7, 7);
        z = leader.pos.z + randRange(-7, 7);
      } else {
        ({ x, z } = randomPoint(CONFIG.worldRadius - 6));
      }
      const farEnough = hunters.every((hunter) => Math.hypot(x - hunter.pos.x, z - hunter.pos.z) > minDistance);
      if (farEnough && isDryLand(x, z) && isSpotFree(x, z, this.spec.radius + 0.3)) break;
    }
    return { x, z };
  }

  /** Hayvonni o'yinchidan uzoqroq, bo'sh joyga qayta chiqaradi. */
  spawn(minDistance) {
    const { x, z } = this.findSpawnPoint(minDistance);
    this.pos.set(x, this.groundLevel(x, z), z);
    this.spawned = true;
    this.root.visible = true;
    this.root.scale.setScalar(this.spec.scale ?? 1);
    this.root.rotation.set(0, Math.random() * TAU, 0);
    this.heading = this.wantedHeading = this.root.rotation.y;
    this.hp = this.spec.hp;
    this.speed = 0;
    this.gait = Math.random() * TAU;
    this.idleClock = Math.random() * 10;
    this.headAngle = 0;
    this.headGoal = 0;
    this.earTwitch = 0;
    this.farClock = 0;
    this.rearAmount = 0;
    this.relentless = false; // true bo'lsa, uzoqlashsa ham quvishni to'xtatmaydi
    this.sightClock = Math.random() * 0.4;
    this.sightBlocked = false;
    this.trackTravel = 0;
    this.trackSide = 1;
    this.avoidSide = pick([-1, 1]);
    this.target = { x, z };
    this.deadTime = 0;
    this.respawnIn = 0;
    this.setState('graze', randRange(1, 6));
  }

  setState(state, duration = 0) {
    this.state = state;
    this.stateTime = duration;
  }

  get alive() {
    return this.state !== 'dead';
  }

  groundLevel(x, z) {
    const ground = terrainHeight(x, z);
    return conditions.frozen ? Math.max(ground, WATER_LEVEL) : ground;
  }

  /** Shu kompyuterdagi o'yinchigacha masofa: ko'rinish va ovoz uchun. */
  distanceToPlayer() {
    return Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
  }

  /** Eng yaqin ovchini topadi: hayvon sezish, qochish va hujumda shunga qaraydi. */
  locatePrey() {
    this.prey = nearestHunter(this.pos.x, this.pos.z);
    this.preyDistance = Math.hypot(this.prey.pos.x - this.pos.x, this.prey.pos.z - this.pos.z);
  }

  faceTowards(x, z) {
    this.wantedHeading = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  /** Hayvon o'yinchini qaysi masofadan sezadi: shovqin, shamol va ko'rish chizig'iga bog'liq. */
  senseDistance(dt, distance) {
    const alertness = this.spec.aggressive ? conditions.predatorSense : conditions.preySense;
    const reach = this.spec.senseRange * this.prey.noise * windSenseFactor(this.pos, this.prey) * alertness;
    this.sightClock -= dt;
    if (this.sightClock <= 0 && distance < reach * 1.5) {
      this.sightClock = 0.4;
      this.sightBlocked = isSightBlocked(this.pos, this.prey, distance);
    }
    return this.sightBlocked ? reach * 0.7 : reach;
  }

  /** Hayvon o'yinchini sezdi: bir lahza qotib qaraydi. Aynan shu payt otish uchun qulay. */
  notice() {
    this.setState('alert', randRange(...this.spec.alertTime));
    if (this.spec.voice) sound[this.spec.voice](this.pos);
  }

  /** Guruhdagi boshqa hayvonlarni ham ogohlantiradi. */
  alertGroup() {
    for (const mate of this.group?.members ?? []) {
      if (mate !== this && mate.alive && mate.spawned) mate.startle();
    }
  }

  beginFlee() {
    this.setState('flee', randRange(4, 7));
    this.alertGroup();
  }

  /** Yirtqichlar turiga qarab hujum boshlaydi: bo'rilar o'raydi, ayiq avval tik turadi. */
  beginAttack() {
    const { spec } = this;
    if (spec.pack) {
      this.setState('stalk');
    } else if (spec.rears) {
      this.setState('rear', 1.5);
      sound.roar(this.pos);
    } else {
      this.setState('charge');
    }
    this.alertGroup();
  }

  /** O'q ovozi yoki jarohat: endi kutib turmaydi. */
  startle() {
    if (['flee', 'charge', 'recover', 'stalk', 'rear'].includes(this.state)) return;
    if (this.spec.aggressive) {
      if (this.spec.voice) sound[this.spec.voice](this.pos);
      this.beginAttack();
    } else {
      this.beginFlee();
    }
  }

  /** @returns {boolean} hayvon shu o'qdan o'ldimi */
  takeHit(part, power = 1) {
    this.hp -= (part === 'head' ? this.spec.headDamage : 1) * power;
    if (this.hp <= 0) {
      this.setState('dead');
      this.fallSide = pick([-1, 1]);
      return true;
    }
    this.startle();
    return false;
  }

  update(dt) {
    if (!this.spawned) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) this.spawn(60);
      return;
    }
    if (this.state === 'dead') {
      this.updateDeath(dt);
      return;
    }

    // Tumandan narida hayvon chizilmaydi va kamroq hisoblanadi
    this.locatePrey();
    this.root.visible = this.distanceToPlayer() < ANIMAL_VIEW_DISTANCE;
    if (this.preyDistance >= ANIMAL_VIEW_DISTANCE) {
      this.farClock += dt;
      if (this.farClock < 0.25) return;
      dt = this.farClock;
      this.farClock = 0;
    }

    const speedGoal = this.think(dt);
    this.move(dt, speedGoal);
    if (this.root.visible) this.animate(dt);
  }

  /** Mijozda hayvon o'zi fikrlamaydi: xostdan kelgan holatni silliq ko'rsatadi. */
  updatePuppet(dt) {
    const { net, pos, spec } = this;
    const now = performance.now();
    if (!net || now - net.stamp > 1500 || net.state === 'hidden') {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;

    if (net.state === 'dead') {
      if (this.state !== 'dead') {
        this.state = 'dead';
        this.deadTime = 0;
        this.fallSide = pick([-1, 1]);
      }
      this.updateDeath(dt);
      return;
    }

    // Oxirgi xabardan beri o'tgan vaqt uchun hayvon qayerga yetganini taxmin qilamiz
    const age = Math.min((now - net.stamp) / 1000, 0.35);
    const x = net.x + Math.sin(net.heading) * net.speed * age;
    const z = net.z + Math.cos(net.heading) * net.speed * age;
    const jumped = Math.hypot(x - pos.x, z - pos.z) > 12;
    pos.x = jumped ? x : damp(pos.x, x, 12, dt);
    pos.z = jumped ? z : damp(pos.z, z, 12, dt);
    this.heading += angleDelta(this.heading, net.heading) * (1 - Math.exp(-12 * dt));
    this.speed = damp(this.speed, net.speed, 8, dt);
    this.state = net.state;
    this.prey = net.targeted ? player : null;
    this.headGoal = net.state === 'graze' ? spec.grazeAngle ?? 0 : 0.1;

    const airborne = net.state === 'fly' || net.state === 'leap';
    pos.y = airborne ? damp(pos.y, net.y, 12, dt) : this.groundLevel(pos.x, pos.z);
    this.root.rotation.set(0, this.heading, 0);
    this.leaveTracks(dt);
    this.animate(dt);
  }

  /** Holatlar mashinasi. Qaytariladigan qiymat: hozir qanday tezlikda yurish kerak. */
  think(dt) {
    const { spec, prey } = this;
    const distance = this.preyDistance;
    const sensed = distance < this.senseDistance(dt, distance);
    this.stateTime -= dt;

    switch (this.state) {
      case 'graze':
        this.headGoal = spec.grazeAngle;
        if (sensed) this.notice();
        else if (this.stateTime <= 0) this.pickWanderTarget();
        return 0;

      case 'walk':
        this.headGoal = 0.15;
        this.faceTowards(this.target.x, this.target.z);
        if (sensed) this.notice();
        else if (this.stateTime <= 0 || Math.hypot(this.target.x - this.pos.x, this.target.z - this.pos.z) < 1) {
          this.setState('graze', randRange(2, 7));
        }
        return spec.walkSpeed;

      case 'alert':
        this.headGoal = -0.12;
        this.faceTowards(prey.pos.x, prey.pos.z);
        if (this.stateTime <= 0) {
          if (spec.aggressive) this.beginAttack();
          else this.beginFlee();
        }
        return 0;

      case 'flee':
        this.headGoal = 0.1;
        this.wantedHeading = Math.atan2(this.pos.x - prey.pos.x, this.pos.z - prey.pos.z)
          + Math.sin(this.gait * 0.13) * 0.5;
        if (spec.zigzag) this.wantedHeading += Math.sin(this.gait * 0.45) * 0.9;
        // Chegaraga yetganda burilib, dunyo markazi tomon qochadi
        if (Math.hypot(this.pos.x, this.pos.z) > CONFIG.worldRadius - 12) this.faceTowards(0, 0);
        if (this.stateTime <= 0) {
          if (distance > spec.senseRange * 1.5) this.setState('graze', randRange(1, 3));
          else this.stateTime = 2;
        }
        return spec.runSpeed;

      case 'charge':
        this.headGoal = 0.3;
        this.faceTowards(prey.pos.x, prey.pos.z);
        if (distance < spec.biteRange + (prey.reach ?? 0)) {
          strikeHunter(prey, spec.damage * conditions.damage, this);
          this.setState('recover', spec.recoverTime ?? 1.3);
        } else if ((distance > spec.giveUpRange && !this.relentless) || game.state !== 'playing') {
          this.pickWanderTarget();
        }
        return spec.runSpeed;

      case 'recover':
        // Urgandan keyin biroz chekinadi, so'ng yana yuguradi
        this.headGoal = 0.1;
        this.wantedHeading = Math.atan2(this.pos.x - prey.pos.x, this.pos.z - prey.pos.z);
        if (this.stateTime <= 0) this.setState(spec.pack ? 'stalk' : 'charge');
        return spec.walkSpeed * 2;

      case 'stalk':
        return this.stalk(dt, distance);

      case 'rear':
        // Ayiq orqa oyog'ida turib na'ra tortadi: bu qochish yoki otish uchun oxirgi imkoniyat
        this.headGoal = -0.3;
        this.faceTowards(prey.pos.x, prey.pos.z);
        if (this.stateTime <= 0) this.setState('charge');
        return 0;
    }
    return 0;
  }

  /** Bo'rilar o'yinchini aylanib o'raydi, keyin navbat bilan bittadan hujum qiladi. */
  stalk(dt, distance) {
    const { spec, group } = this;
    const pack = group.members.filter((mate) => mate.alive && mate.spawned);
    this.headGoal = 0.35;

    if (pack.length === 1) {
      this.beginFlee(); // yolg'iz qolgan bo'ri qochadi
      return 0;
    }
    if (distance > spec.giveUpRange || game.state !== 'playing') {
      this.pickWanderTarget();
      return 0;
    }

    if (this === pack[0]) {
      group.orbit += dt * 0.35;
      group.attackTimer -= dt;
      if (group.attackTimer <= 0) {
        const stalkers = pack.filter((mate) => mate.state === 'stalk');
        if (stalkers.length) pick(stalkers).setState('charge');
        group.attackTimer = randRange(2.2, 3.6);
      }
    }

    const angle = group.orbit + (pack.indexOf(this) / pack.length) * TAU;
    const x = this.prey.pos.x + Math.cos(angle) * 14, z = this.prey.pos.z + Math.sin(angle) * 14;
    this.faceTowards(x, z);
    return clamp(Math.hypot(x - this.pos.x, z - this.pos.z) * 1.5, 1, spec.runSpeed * 0.75);
  }

  /** Bug'u kabi hayvonlar ba'zan qirg'oqqa suv ichgani boradi. */
  pickDrinkingSpot() {
    let nearest = null, nearestDistance = 70;
    for (let i = 0; i < 12 && shorePoints.length; i++) {
      const point = pick(shorePoints);
      const distance = Math.hypot(point.x - this.pos.x, point.z - this.pos.z);
      if (distance < nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  pickWanderTarget() {
    const leader = this.group && groupLeader(this.group);
    const drinkingSpot = this.spec.drinks && Math.random() < 0.3 ? this.pickDrinkingSpot() : null;
    const angle = Math.random() * TAU, distance = randRange(8, 26);
    let x = this.pos.x + Math.cos(angle) * distance, z = this.pos.z + Math.sin(angle) * distance;
    if (leader && leader !== this) {
      x = leader.pos.x + randRange(-6, 6);
      z = leader.pos.z + randRange(-6, 6);
    } else if (drinkingSpot) {
      ({ x, z } = drinkingSpot);
    }
    const scale = Math.min(1, (CONFIG.worldRadius - 8) / Math.hypot(x, z));
    this.target = { x: x * scale, z: z * scale };
    this.avoidSide = pick([-1, 1]);
    this.setState('walk', randRange(6, 14));
  }

  /** Oldinda to'siq bo'lsa, yo'nalishni bir tomonga buradi. */
  steerAroundObstacles() {
    const aheadX = this.pos.x + Math.sin(this.wantedHeading) * 2.6;
    const aheadZ = this.pos.z + Math.cos(this.wantedHeading) * 2.6;
    const blocked = !isSpotFree(aheadX, aheadZ, this.spec.radius + 0.4)
      || wadeDepthAt(aheadX, aheadZ) > this.spec.wadeDepth;
    if (blocked) this.wantedHeading += this.avoidSide * 1.1;
  }

  move(dt, speedGoal) {
    const { spec, pos } = this;
    if (speedGoal > 0) this.steerAroundObstacles();

    const turn = clamp(angleDelta(this.heading, this.wantedHeading), -spec.turnRate * dt, spec.turnRate * dt);
    this.heading += turn;
    this.speed = damp(this.speed, speedGoal, 6, dt);

    const nextX = pos.x + Math.sin(this.heading) * this.speed * dt;
    const nextZ = pos.z + Math.cos(this.heading) * this.speed * dt;
    if (wadeDepthAt(nextX, nextZ) < spec.wadeDepth + 0.15) {
      pos.x = nextX;
      pos.z = nextZ;
    }
    pushOutOfObstacles(pos, spec.radius);

    const fromCenter = Math.hypot(pos.x, pos.z);
    if (fromCenter > CONFIG.worldRadius - 2) {
      const scale = (CONFIG.worldRadius - 2) / fromCenter;
      pos.x *= scale;
      pos.z *= scale;
    }

    this.leaveTracks(dt);

    // Tanani yer qiyaligiga moslab, oyoqlar havoda qolmasligini ta'minlaymiz
    const sinH = Math.sin(this.heading), cosH = Math.cos(this.heading);
    const front = terrainHeight(pos.x + sinH * 0.6, pos.z + cosH * 0.6);
    const back = terrainHeight(pos.x - sinH * 0.6, pos.z - cosH * 0.6);
    this.root.rotation.set(Math.atan2(back - front, 1.2), this.heading, 0);
    pos.y = this.groundLevel(pos.x, pos.z);
  }

  /** Yurgan hayvon yerda iz qoldiradi, yaralangani esa qon tomchilari ham. */
  leaveTracks(dt) {
    const { spec, pos } = this;
    if (!spec.track || !this.root.visible) return;
    this.trackTravel += this.speed * dt;
    if (this.trackTravel < spec.track.step) return;
    this.trackTravel = 0;
    this.trackSide *= -1;

    const sideX = Math.cos(this.heading) * this.trackSide * spec.track.width;
    const sideZ = -Math.sin(this.heading) * this.trackSide * spec.track.width;
    if (waterDepth(pos.x, pos.z) < 0) {
      tracks[spec.track.type].add(pos.x + sideX, pos.z + sideZ, this.heading, spec.track.size, `${spec.name} izi`);
    }
    if (this.hp < spec.hp) {
      tracks.blood.add(pos.x - sideX, pos.z - sideZ, Math.random() * TAU, randRange(0.7, 1.3), `Yarador ${spec.name.toLowerCase()} qoni`);
    }
  }

  animate(dt) {
    const { spec } = this;
    this.gait += this.speed * spec.stride * dt;
    this.idleClock += dt;

    // Bo'yin yerga egilganda bosh teskari tomonga buriladi, shunda tumshuq o'tga tegadi
    this.headAngle = damp(this.headAngle, this.headGoal, 5, dt);
    const chewing = this.state === 'graze' ? Math.sin(this.idleClock * 7) * 0.03 : 0;
    this.neck.rotation.x = this.headAngle;
    this.head.rotation.x = -this.headAngle * 0.43 + chewing;

    // Nafas olish va dum qimirlashi
    this.body.scale.x = 1 + Math.sin(this.idleClock * 2.2) * 0.012;
    this.tail.rotation.x = spec.model.tail.rest + Math.sin(this.idleClock * 3) * 0.08;
    this.tail.rotation.y = Math.sin(this.idleClock * 2.1) * (spec.tailWag ?? 0.1);

    // Vaqti-vaqti bilan quloq chivinni haydagandek qimirlab qo'yadi
    this.earTwitch = damp(this.earTwitch, 0, 9, dt);
    if (Math.random() < dt * 0.35) this.earTwitch = 1;
    if (this.ears.length) this.ears[0].rotation.x = spec.model.ears.tiltX + this.earTwitch * 0.5;

    const moving = clamp(this.speed / spec.walkSpeed, 0, 1);
    if (spec.hops) this.animateHop(moving);
    else this.animateGait(moving);

    // Ayiq tik turganda tana orqa oyoqlar ustiga ko'tariladi
    this.rearAmount = damp(this.rearAmount, this.state === 'rear' ? 1 : 0, 5, dt);
    if (this.rearAmount > 0.01) {
      this.root.rotation.x -= this.rearAmount * 1.15;
      this.pos.y += this.rearAmount * 0.85;
      this.legs[0].thigh.rotation.x -= this.rearAmount * 0.7;
      this.legs[1].thigh.rotation.x -= this.rearAmount * 0.5;
    }
  }

  /** Yurish va chopish: tezlik oshgani sari oyoq ritmi yurishdan yelishga o'tadi. */
  animateGait(moving) {
    const { spec } = this;
    const running = clamp((this.speed - spec.walkSpeed) / (spec.runSpeed - spec.walkSpeed), 0, 1);
    const swing = lerp(0.42, 0.8, running) * moving;
    const bend = lerp(0.7, 1.25, running) * moving;

    this.legs.forEach(({ thigh, shin }, index) => {
      const phase = (lerp(WALK_RHYTHM[index], GALLOP_RHYTHM[index], running) * TAU) + this.gait;
      thigh.rotation.x = -Math.sin(phase) * swing;
      shin.rotation.x = Math.max(0, Math.cos(phase)) * bend;
    });

    // Chopganda tana oldinga-orqaga chayqaladi
    this.pos.y += Math.abs(Math.sin(this.gait)) * 0.05 * moving * (1 + running);
    this.root.rotation.x += Math.sin(this.gait) * 0.07 * running;
  }

  /** Quyon sakraydi: oldingi va orqa oyoqlari juft bo'lib ishlaydi. */
  animateHop(moving) {
    const hop = Math.abs(Math.sin(this.gait * 0.5));
    this.pos.y += hop * 0.42 * moving;
    this.root.rotation.x += (hop - 0.5) * 0.35 * moving;
    this.legs.forEach(({ thigh, shin }, index) => {
      const front = index < 2;
      thigh.rotation.x = (front ? -1 : 1) * hop * 0.9 * moving;
      shin.rotation.x = (1 - hop) * 0.5 * moving;
    });
  }

  updateDeath(dt) {
    const { root, spec } = this;
    this.deadTime += dt;
    root.rotation.z = damp(root.rotation.z, this.fallSide * Math.PI / 2, 7, dt);

    // Tana bo'shashadi: bosh osilib, oyoqlar asta to'g'rilanadi
    if (this.neck) {
      this.neck.rotation.x = damp(this.neck.rotation.x, 0.6, 5, dt);
      this.head.rotation.x = damp(this.head.rotation.x, 0.3, 5, dt);
    }
    for (const { thigh, shin } of this.legs) {
      thigh.rotation.x = damp(thigh.rotation.x, 0.15, 4, dt);
      shin.rotation.x = damp(shin.rotation.x, 0.25, 4, dt);
    }

    const ground = this.groundLevel(this.pos.x, this.pos.z) + spec.lieHeight * (spec.scale ?? 1);
    if (this.deadTime < 7) {
      this.pos.y = damp(this.pos.y, ground, 7, dt);
    } else {
      this.pos.y -= dt * 0.5; // bir oz yotgach yerga cho'kib yo'qoladi
    }
    if (this.deadTime > 9) {
      root.visible = false;
      this.spawned = false;
      this.respawnIn = randRange(4, 10);
    }
  }
}

/** Ko'l ichidagi yetarlicha chuqur tasodifiy nuqta. */
function randomLakePoint(lake = pick(lakes)) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const angle = Math.random() * TAU, radius = Math.sqrt(Math.random()) * lake.radius * 0.8;
    const x = lake.x + Math.cos(angle) * radius, z = lake.z + Math.sin(angle) * radius;
    if (waterDepth(x, z) > 0.7) return { x, z };
  }
  return { x: lake.x, z: lake.z };
}

/** O'rdak ko'lda suzadi, cho'chisa boshqa ko'lga uchib ketadi. Uchayotganda ham otish mumkin. */
class Duck extends Animal {
  constructor(kind) {
    super(kind);
    const { wings } = this.spec.model;
    this.wings = wings.pivots.map((pivot, index) => {
      const wing = new THREE.Mesh(wings.geometry, furMaterial);
      wing.position.set(...pivot);
      if (index === 0) wing.scale.x = -1; // chap qanot o'ng qanotning ko'zgudagi aksi
      this.root.add(wing);
      return wing;
    });
  }

  findSpawnPoint() {
    return randomLakePoint();
  }

  groundLevel(x, z) {
    return Math.max(terrainHeight(x, z), WATER_LEVEL);
  }

  spawn(minDistance) {
    super.spawn(minDistance);
    this.flight = null;
    this.setState('swim', randRange(2, 6));
  }

  startle() {
    if (this.state !== 'swim') return;
    const target = randomLakePoint();
    const distance = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
    this.flight = {
      fromX: this.pos.x, fromZ: this.pos.z, toX: target.x, toZ: target.z,
      progress: 0, duration: Math.max(5, distance / this.spec.runSpeed), height: randRange(15, 24),
    };
    this.setState('fly');
    sound.quack(this.pos);
  }

  think(dt) {
    if (this.state === 'fly') return 0;
    this.stateTime -= dt;
    const distance = this.preyDistance;
    if (distance < this.senseDistance(dt, distance)) {
      this.startle();
    } else if (this.stateTime <= 0) {
      const angle = Math.random() * TAU;
      this.target = { x: this.pos.x + Math.cos(angle) * 8, z: this.pos.z + Math.sin(angle) * 8 };
      this.stateTime = randRange(3, 8);
    }
    return this.spec.walkSpeed;
  }

  move(dt, speedGoal) {
    const { pos, root } = this;
    if (this.state === 'fly') {
      const { flight } = this;
      flight.progress = Math.min(1, flight.progress + dt / flight.duration);
      const t = flight.progress;
      const x = lerp(flight.fromX, flight.toX, t), z = lerp(flight.fromZ, flight.toZ, t);
      this.heading = Math.atan2(x - pos.x, z - pos.z) || this.heading;
      pos.set(x, WATER_LEVEL + Math.pow(Math.sin(t * Math.PI), 0.55) * flight.height, z);
      root.rotation.set(t < 0.5 ? -0.3 : 0.05, this.heading, 0);
      if (t >= 1) this.setState('swim', randRange(2, 6));
      return;
    }

    this.faceTowards(this.target.x, this.target.z);
    this.heading += clamp(angleDelta(this.heading, this.wantedHeading), -this.spec.turnRate * dt, this.spec.turnRate * dt);
    const nextX = pos.x + Math.sin(this.heading) * speedGoal * dt;
    const nextZ = pos.z + Math.cos(this.heading) * speedGoal * dt;
    if (waterDepth(nextX, nextZ) > 0.45) {
      pos.x = nextX;
      pos.z = nextZ;
    } else {
      this.stateTime = 0; // qirg'oqqa yetdi: yangi yo'nalish tanlaydi
    }
    pos.y = WATER_LEVEL - 0.08;
    root.rotation.set(0, this.heading, 0);
  }

  animate(dt) {
    this.idleClock += dt;
    const flying = this.state === 'fly';
    const flap = flying ? Math.sin(this.idleClock * 24) * 0.85 : -0.05;
    this.wings[0].rotation.z = -flap;
    this.wings[1].rotation.z = flap;
    this.neck.rotation.x = flying ? 0.9 : Math.sin(this.idleClock * 1.3) * 0.08;
    this.head.rotation.x = flying ? -0.8 : 0;
    this.tail.rotation.x = this.spec.model.tail.rest;
    if (!flying) this.pos.y += Math.sin(this.idleClock * 2) * 0.012;
  }
}

/** Baliq ko'pincha ko'rinmaydi, faqat vaqti-vaqti bilan o'yinchiga eng yaqin ko'ldan sakraydi. */
class Fish extends Animal {
  groundLevel(x, z) {
    return Math.max(terrainHeight(x, z), WATER_LEVEL);
  }

  findSpawnPoint() {
    return randomLakePoint();
  }

  spawn(minDistance) {
    super.spawn(minDistance);
    this.root.visible = false;
    this.setState('hidden', randRange(2, 9));
  }

  startle() {}

  animate() {
    this.tail.rotation.y = Math.sin(elapsed * 40) * 0.5;
  }

  leap() {
    const watcher = pick(hunters);
    const lake = lakes.reduce((best, candidate) => (
      Math.hypot(candidate.x - watcher.pos.x, candidate.z - watcher.pos.z)
        < Math.hypot(best.x - watcher.pos.x, best.z - watcher.pos.z) ? candidate : best));
    const { x, z } = randomLakePoint(lake);
    this.pos.set(x, WATER_LEVEL, z);
    this.heading = Math.random() * TAU;
    this.root.visible = true;
    this.setState('leap', 1);
    if (this.distanceToPlayer() < 70) {
      burst(this.pos, '#dcebf0', 8, 2);
      sound.splash();
    }
  }

  update(dt) {
    if (!this.spawned || this.state === 'dead') {
      super.update(dt);
      return;
    }
    this.stateTime -= dt;
    if (this.state === 'hidden') {
      if (this.stateTime <= 0) this.leap();
      return;
    }

    // Sakrash yoyi: baliq havoda burilib, boshi bilan suvga tushadi
    const t = 1 - Math.max(this.stateTime, 0);
    this.pos.x += Math.sin(this.heading) * 2.2 * dt;
    this.pos.z += Math.cos(this.heading) * 2.2 * dt;
    this.pos.y = WATER_LEVEL - 0.25 + Math.sin(t * Math.PI) * 1.7;
    this.root.rotation.set(-Math.cos(t * Math.PI) * 1.1, this.heading, 0);
    this.tail.rotation.y = Math.sin(this.stateTime * 40) * 0.5;
    if (this.stateTime <= 0) {
      this.root.visible = false;
      this.setState('hidden', randRange(3, 10));
    }
  }
}

const ANIMAL_CLASSES = { duck: Duck, fish: Fish };

/** Guruhning hozirgi yo'lboshchisi: tirik a'zolardan birinchisi. */
function groupLeader(group) {
  return group.members.find((member) => member.alive && member.spawned) ?? null;
}

function createAnimals() {
  for (const [kind, spec] of Object.entries(SPECIES)) {
    const AnimalClass = ANIMAL_CLASSES[kind] ?? Animal;
    let group = null, groupRoom = 0;
    for (let i = 0; i < spec.count; i++) {
      const animal = new AnimalClass(kind);
      animal.id = animals.length;
      animal.rosterRank = i / spec.count; // qiyinlikka qarab qancha yirtqich faol bo'lishini belgilaydi
      animals.push(animal);
      if (!spec.groupSize) continue;
      if (groupRoom === 0) {
        group = { members: [], orbit: Math.random() * TAU, attackTimer: 2 };
        groupRoom = Math.round(randRange(...spec.groupSize));
      }
      animal.group = group;
      animal.rosterRank = group.members[0]?.rosterRank ?? animal.rosterRank; // to'da birga faol bo'ladi
      group.members.push(animal);
      groupRoom--;
    }
  }
}

function updateAnimals(dt) {
  let attacker = null;
  let attackerDistance = 35;
  for (const animal of animals) {
    // Mijozda hayvonlarni xost boshqaradi, u yerda uxlab turgani ham uyg'onishi mumkin
    if (network.isClient) animal.updatePuppet(dt);
    else if (animal.dormant) continue;
    else animal.update(dt);
    if (animal.state !== 'charge' || animal.prey !== player) continue;
    const distance = animal.distanceToPlayer();
    if (distance < attackerDistance) {
      attacker = animal;
      attackerDistance = distance;
    }
  }
  updateThreatHud(game.state === 'playing' ? attacker : null);
}
