'use strict';

/* ==========================================================================
   SHERIK OVCHILAR: boshqa o'yinchilarning o'rmondagi tanasi
   ========================================================================== */

const HUNTER_COLORS = ['#d9682b', '#3f87c7', '#6fae45', '#c9a227'];
const AVATAR_EYE_HEIGHT = 1.62;

/** Odam tanasi: oyoq y=0 da, oldinga (+Z) qaraydi. Rang kurtkaga beriladi. */
function hunterModel(jacket) {
  const skin = '#d9a97f', trousers = '#3e4436', boot = '#2a2019', hat = '#55432c', wood = '#70452a', metal = '#2b2d31';
  const arm = (side) => limb(
    [[0, 0, 0.06, 0.065], [-0.24, 0.1, 0.05, 0.055], [-0.32, 0.26, 0.045, 0.05]],
    { top: jacket, tip: [skin, 0.82] },
  ).translate(side * 0.245, 1.42, 0.02);
  const shin = limb([[0, 0, 0.065, 0.07], [-0.3, 0, 0.055, 0.06], [-0.42, 0.03, 0.06, 0.08], [-0.46, 0.08, 0.05, 0.09]], { top: trousers, tip: [boot, 0.62] });
  const thigh = limb([[0.04, 0, 0.09, 0.1], [-0.2, 0, 0.08, 0.085], [-0.44, 0, 0.066, 0.072]], { top: trousers });
  return {
    body: merge(
      loft([[0.9, 0, 0.17, 0.12], [1.05, 0, 0.19, 0.13], [1.3, 0, 0.21, 0.14], [1.44, 0, 0.2, 0.13], [1.5, 0, 0.09, 0.08]], { top: jacket, mottle: 0.03 }),
      blob(0.115, skin, [0, 1.62, 0.01], [0.95, 1.08, 1]),
      cylinder(0.2, 0.2, 0.025, hat, [0, 1.71, 0], [0, 0, 0], 12),
      cylinder(0.1, 0.125, 0.11, hat, [0, 1.77, 0], [0, 0, 0], 10),
      arm(-1), arm(1),
      box(0.045, 0.07, 0.34, wood, [0.02, 1.2, 0.3]),
      cylinder(0.014, 0.018, 0.6, metal, [0.02, 1.23, 0.72], [Math.PI / 2, 0, 0], 6),
    ),
    thigh,
    shin,
  };
}

class RemoteHunter {
  constructor(id, name, colorIndex) {
    this.id = id;
    this.name = name;
    this.color = HUNTER_COLORS[colorIndex % HUNTER_COLORS.length];
    this.pos = new THREE.Vector3(0, terrainHeight(0, 0) + AVATAR_EYE_HEIGHT, 0); // ko'z balandligidagi nuqta
    this.target = this.pos.clone();
    this.yaw = 0;
    this.targetYaw = 0;
    this.speed = 0;
    this.noise = 1;
    this.down = false;
    this.crouch = 0;
    this.gait = 0;

    const model = hunterModel(this.color);
    this.root = new THREE.Group();
    const addPart = (geometry, parent, position) => {
      const mesh = new THREE.Mesh(geometry, furMaterial);
      mesh.castShadow = true;
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    addPart(model.body, this.root, [0, 0, 0]);
    this.legs = [-1, 1].map((side) => {
      const thigh = addPart(model.thigh, this.root, [side * 0.1, 0.9, 0]);
      return { thigh, shin: addPart(model.shin, thigh, [0, -0.44, 0]) };
    });
    this.nameTag = this.createNameTag();
    this.root.add(this.nameTag);
    // Jamoa jangi uchun ko'rinmas nishon qutilari: oyoq tagidan o'lchanadi
    this.hitBoxes = [
      createHitBox({ size: [0.62, 1.5, 0.46], center: [0, 0.82, 0] }, this.root, null, 'body'),
      createHitBox({ size: [0.34, 0.36, 0.34], center: [0, 1.66, 0] }, this.root, null, 'head'),
    ];
    for (const box of this.hitBoxes) box.userData.hunter = this;
    // Jamoa rangidagi bog'ich: jamoa bo'lmasa ko'rinmaydi
    this.band = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.14, 12, 1, true), new THREE.MeshLambertMaterial());
    this.band.position.y = 1.32;
    this.band.visible = false;
    this.root.add(this.band);
    this.teamColor = null;
    scene.add(this.root);
  }

  /** Jamoa rangi: ism yozuvi va bog'ich shu rangga bo'yaladi. null bo'lsa, o'z rangi. */
  setTeamColor(color) {
    if (this.teamColor === color) return;
    this.teamColor = color;
    this.band.visible = Boolean(color);
    if (color) this.band.material.color.set(color);
    this.drawNameTag(color ?? this.color);
  }

  /** Boshi ustidagi nom: rangli yozuv. */
  createNameTag() {
    this.tagPaper = document.createElement('canvas');
    this.tagPaper.width = 256;
    this.tagPaper.height = 64;
    this.tagTexture = new THREE.CanvasTexture(this.tagPaper);
    this.drawNameTag(this.color);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tagTexture, depthWrite: false }));
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.y = 2.15;
    return sprite;
  }

  drawNameTag(color) {
    const pen = this.tagPaper.getContext('2d');
    pen.clearRect(0, 0, 256, 64);
    pen.font = '600 34px "Avenir Next", "Segoe UI", sans-serif';
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.lineWidth = 6;
    pen.strokeStyle = 'rgba(0, 0, 0, .7)';
    pen.strokeText(this.name, 128, 32);
    pen.fillStyle = color;
    pen.fillText(this.name, 128, 32);
    this.tagTexture.needsUpdate = true;
  }

  /** Tarmoqdan kelgan holat: [x, y, z, yaw, tezlik, shovqin, egilish, yiqilgan, qayiqda]. */
  applyState([x, y, z, yaw, speed, noise, crouch, down, inBoat]) {
    this.inBoat = Boolean(inBoat);
    this.target.set(x, y, z);
    if (this.pos.distanceTo(this.target) > 12) this.pos.copy(this.target); // lagerga ko'chdi: sirg'anmasin
    this.targetYaw = yaw;
    this.speed = speed;
    this.noise = noise;
    this.crouchGoal = crouch;
    this.down = Boolean(down);
  }

  update(dt) {
    this.pos.lerp(this.target, 1 - Math.exp(-12 * dt));
    this.yaw += angleDelta(this.yaw, this.targetYaw) * (1 - Math.exp(-14 * dt));
    this.crouch = damp(this.crouch, this.inBoat ? 1 : this.crouchGoal ?? 0, 10, dt); // qayiqda o'tiradi
    this.updateBoat();

    this.root.position.set(this.pos.x, this.pos.y - AVATAR_EYE_HEIGHT + this.crouch * 0.6, this.pos.z);
    // Kamera -Z ga qaraydi, model esa +Z ga, shuning uchun yarim aylana qo'shiladi
    this.root.rotation.set(this.down ? -1.5 : this.crouch * 0.35, this.yaw + Math.PI, 0);

    this.gait += this.speed * 1.5 * dt;
    const swing = clamp(this.speed / 6, 0, 1) * 0.7;
    this.legs.forEach(({ thigh, shin }, index) => {
      const phase = this.gait + index * Math.PI;
      thigh.rotation.x = -Math.sin(phase) * swing - this.crouch * 0.9;
      shin.rotation.x = Math.max(0, Math.cos(phase)) * swing * 1.3 + this.crouch * 1.5;
    });
  }

  /** Sherik qayiqda bo'lsa, uning tagida qayiq ko'rinadi. */
  updateBoat() {
    if (this.inBoat && !this.boatMesh) {
      this.boatMesh = new THREE.Mesh(boatShape, gearMaterial);
      scene.add(this.boatMesh);
    }
    if (!this.boatMesh) return;
    this.boatMesh.visible = this.inBoat;
    this.boatMesh.position.set(this.pos.x, WATER_LEVEL - 0.08, this.pos.z);
    this.boatMesh.rotation.y = this.yaw;
  }

  remove() {
    if (this.boatMesh) scene.remove(this.boatMesh);
    scene.remove(this.root);
    const index = hunters.indexOf(this);
    if (index >= 0) hunters.splice(index, 1);
  }
}
