'use strict';

/* ==========================================================================
   ISHGA TUSHIRISH VA ASOSIY SIKL
   ========================================================================== */

createTerrain();
createWater();
createForest();
createShoreline();
createAnimals();
Math.random = nativeRandom; // dunyo tayyor: bundan keyingi tasodif har kompyuterda o'zicha
applySetup(profile.setup);
applyQuality();

// Bosh menyudagi hayvonlar ro'yxati to'g'ridan-to'g'ri sozlamalardan olinadi
byId('preyList').replaceChildren(...Object.values(SPECIES).filter((spec) => !spec.missionOnly).map((spec) => {
  const item = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = spec.name;
  name.classList.toggle('danger', Boolean(spec.aggressive));
  const points = document.createElement('b');
  points.textContent = spec.points;
  item.append(name, points);
  return item;
}));

resetRound();

const clock = new THREE.Clock();

/** Menyu va natija oynasi ortida kamera o'rmonni sekin aylanib ko'rsatadi. */
function updateIdleCamera(dt) {
  player.yaw += dt * 0.05;
  camera.position.copy(player.pos);
  camera.rotation.set(0.02, player.yaw, 0);
}

function frame() {
  requestAnimationFrame(frame);
  // Fizika uchun qadam cheklanadi, lekin raund vaqti haqiqiy soat bo'yicha hisoblanadi
  const realDt = Math.min(clock.getDelta(), 1);
  const dt = Math.min(realDt, 0.05);
  elapsed += dt;

  if (game.state === 'playing') {
    updatePlayer(dt);
    updateWeapon(dt);
    updateArrows(dt);
    if (IS_TOUCH_DEVICE) updateTouchButtons();
    updateRound(realDt);
  } else if (game.state !== 'paused') {
    updateIdleCamera(dt);
  }
  if (game.state !== 'paused') {
    updateWind(dt);
    updateAnimals(dt);
    updateTracks(dt);
    sound.updateAmbience(dt);
  }

  updateParticles(dt);
  updateMotes(dt, elapsed);
  updateRain(dt);
  updateStorm(dt);
  updateHeadlamp();
  updateSun(player.pos);
  updateDetailTiles();
  skyDome.position.copy(camera.position);
  skyMaterial.uniforms.time.value = elapsed;

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(weaponScene, weaponCamera);
}

frame();

// Hammasi tayyor: tugmani yoqamiz
window.ovchiReady = true;
ui.startBtn.disabled = false;
ui.startBtn.textContent = 'Erkin ov';
