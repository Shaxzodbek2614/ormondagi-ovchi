'use strict';

/* ==========================================================================
   OV ITI
   Egasi yonida yuradi, yaqin hayvonni sezsa to'xtab huradi, yarador hayvonga
   yetaklaydi. Hayvonlar itga hujum qilmaydi. Birga o'ynaganda faqat egasi ko'radi.
   ========================================================================== */

const DOG = { scentRange: 35, woundedRange: 130, barkEvery: 3, waitForOwner: 18, teleport: 70 };

class HuntingDog extends Animal {
  constructor() {
    super('dog');
    this.root.visible = false;
    this.active = false;
    this.staying = false;
    this.scent = null;
    this.scentClock = 0;
    this.barkClock = 0;
  }

  findSpawnPoint() {
    return nearbyPoint(player.pos.x, player.pos.z, 2, 4);
  }

  /** Raund boshida: it jihozlar orasida tanlangan bo'lsa, o'yinchi yonida paydo bo'ladi. */
  enter(active) {
    this.active = active;
    this.staying = false;
    this.scent = null;
    this.root.visible = active;
    if (active) {
      this.spawn(0);
      this.root.visible = true;
      this.setState('walk');
    }
  }

  /** Eng avval yarador hayvonni, keyin yaqindagisini izlaydi. */
  sniff() {
    const candidates = animals.filter((animal) => animal.alive && animal.spawned && !animal.dormant && animal.kind !== 'fish');
    const distance = (animal) => Math.hypot(animal.pos.x - this.pos.x, animal.pos.z - this.pos.z);
    const wounded = candidates.find((animal) => animal.hp < animal.spec.hp && distance(animal) < DOG.woundedRange);
    if (wounded) return { animal: wounded, lead: true };
    const near = candidates.filter((animal) => distance(animal) < DOG.scentRange)
      .sort((a, b) => distance(a) - distance(b))[0];
    return near ? { animal: near, lead: false } : null;
  }

  /** Bu kadrda qayerga va qanday tezlikda borishini aniqlaydi. */
  chooseGoal(ownerDistance) {
    const { spec, pos, scent } = this;
    if (this.staying) return null;

    if (scent?.lead && ownerDistance < DOG.waitForOwner) {
      const { x, z } = scent.animal.pos;
      const away = Math.hypot(x - pos.x, z - pos.z);
      return away > 10 ? { x, z, speed: spec.runSpeed * 0.7 } : null;
    }
    if (scent) return null; // to'xtab, hayvon tomonga qarab huradi

    const behindX = player.pos.x + Math.sin(player.yaw) * 2.6;
    const behindZ = player.pos.z + Math.cos(player.yaw) * 2.6;
    const gap = Math.hypot(behindX - pos.x, behindZ - pos.z);
    return gap > 1.5 ? { x: behindX, z: behindZ, speed: clamp(gap * 1.6, 2, spec.runSpeed) } : null;
  }

  update(dt) {
    if (!this.active) return;
    this.prey = player;
    this.preyDistance = this.distanceToPlayer();
    if (this.preyDistance > DOG.teleport && !player.inBoat) this.spawn(0); // egasi qayiqda: qirg'oqda kutadi

    this.scentClock -= dt;
    if (this.scentClock <= 0) {
      this.scentClock = 0.7;
      this.scent = this.staying ? null : this.sniff();
    }

    const goal = this.chooseGoal(this.preyDistance);
    if (goal) this.faceTowards(goal.x, goal.z);
    else if (this.scent) this.faceTowards(this.scent.animal.pos.x, this.scent.animal.pos.z);

    this.barkClock -= dt;
    if (this.scent && !goal && this.barkClock <= 0) {
      this.barkClock = DOG.barkEvery;
      sound.bark(this.pos);
    }

    this.headGoal = this.scent ? -0.1 : 0.1;
    this.move(dt, goal?.speed ?? 0);
    this.animate(dt);
  }

  /** Pastdagi yozuv: it nimani sezgani. */
  hint() {
    if (!this.active) return null;
    if (this.staying) return 'It joyida turibdi. Chaqirish: K';
    if (!this.scent) return null;
    const { animal, lead } = this.scent;
    const distance = Math.round(Math.hypot(animal.pos.x - player.pos.x, animal.pos.z - player.pos.z));
    return `It ${lead ? 'yarador ' : ''}${animal.spec.name.toLowerCase()} sezdi · ${distance} m`;
  }
}

const dog = new HuntingDog();
