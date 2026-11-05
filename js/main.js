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
byId('preyList').replaceChildren(...Object.values(SPECIES).filter((spec) => !spec.missionOnly && !spec.companion).map((spec) => {
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

/** O'yin mantig'ining bir qadami. Rasm chizish alohida: xost oynasi yashirilganda ham hisob-kitob davom etadi. */
function simulate(realDt) {
  // Fizika uchun qadam cheklanadi, lekin raund vaqti haqiqiy soat bo'yicha hisoblanadi
  const dt = Math.min(realDt, 0.05);
  elapsed += dt;

  if (game.state === 'playing') {
    updatePlayer(dt);
    updateWeapon(dt);
    updateFishing(dt);
    updateArrows(dt);
    updateTraps(dt);
    dog.update(dt);
    updateCompass();
    if (!ui.mapScreen.hidden) renderMap();
    if (IS_TOUCH_DEVICE) updateTouchButtons();
    if (!network.isClient) updateRound(realDt);
  } else if (game.state !== 'paused') {
    updateIdleCamera(dt);
  }
  if (game.state !== 'paused') {
    updateWind(dt);
    updateAnimals(dt);
    updateTracks(dt);
    sound.updateAmbience(dt);
  }
  updateNetwork(dt);

  updateParticles(dt);
  updateMotes(dt, elapsed);
  updateRain(dt);
  updateStorm(dt);
  updateHeadlamp();
  updateSun(player.pos);
  updateDetailTiles();
  skyDome.position.copy(camera.position);
  skyMaterial.uniforms.time.value = elapsed;

}

let lastFrameAt = 0;

function frame() {
  requestAnimationFrame(frame);
  lastFrameAt = performance.now();
  simulate(Math.min(clock.getDelta(), 1));

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(weaponScene, weaponCamera);
}

// Oyna orqa fonga o'tsa, brauzer kadrlarni to'xtatadi. Birga o'ynaganda xost o'rmonni hisoblashda
// davom etishi kerak, shuning uchun alohida oqimdagi soat qadamlarni uzluksiz yuboradi.
if (roomCode) {
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50);'])));
  ticker.onmessage = () => {
    if (network.active && performance.now() - lastFrameAt > 200) simulate(Math.min(clock.getDelta(), 1));
  };
}

frame();

// Hammasi tayyor: tugmani yoqamiz
window.ovchiReady = true;
ui.startBtn.disabled = false;
ui.startBtn.textContent = 'Erkin ov';
updateRankLine();
bootRoom();

// Ko'p ko'lli dunyo uchun sahifa qayta yuklangan bo'lsa, missiya tavsifi darrov ochiladi
const waitingMission = MISSIONS.find((mission) => mission.id === pendingMission?.id);
if (waitingMission) showMissionBrief(waitingMission);
