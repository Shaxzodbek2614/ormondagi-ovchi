'use strict';

/* ==========================================================================
   XARITA VA KOMPAS
   ========================================================================== */

const MAP_SIZE = 560;
const MAP_RANGE = CONFIG.worldRadius + 16; // xarita markazdan shuncha masofani ko'rsatadi

const mapBase = document.createElement('canvas');
mapBase.width = mapBase.height = MAP_SIZE;
let mapBaseFrozen = null; // qaysi fasl uchun chizilgan

const mapX = (x) => (x / MAP_RANGE * 0.5 + 0.5) * MAP_SIZE;
const mapY = (z) => (z / MAP_RANGE * 0.5 + 0.5) * MAP_SIZE;

/** Xarita foni: balandlik jadvalidan bir marta chiziladi, fasl o'zgarganda yangilanadi. */
function drawMapBase() {
  const pen = mapBase.getContext('2d');
  const image = pen.createImageData(MAP_SIZE, MAP_SIZE);
  const frozen = conditions.frozen;

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let column = 0; column < MAP_SIZE; column++) {
      const x = (column / MAP_SIZE * 2 - 1) * MAP_RANGE, z = (row / MAP_SIZE * 2 - 1) * MAP_RANGE;
      const y = terrainHeight(x, z);
      const depth = WATER_LEVEL - y;
      let color;
      if (depth > 0) {
        const shallow = clamp(1 - depth / 1.6, 0, 1);
        color = frozen ? [176 + shallow * 30, 208 + shallow * 20, 222] : [34 + shallow * 60, 92 + shallow * 70, 124 + shallow * 40];
      } else if (y - WATER_LEVEL < 0.7) {
        color = frozen ? [226, 232, 234] : [176, 162, 112];
      } else {
        const light = clamp((y + 2) / 12, 0, 1);
        color = frozen ? [206 + light * 30, 212 + light * 28, 216 + light * 26] : [58 + light * 44, 92 + light * 42, 48 + light * 26];
      }
      const index = (row * MAP_SIZE + column) * 4;
      image.data.set([...color, 255], index);
    }
  }
  pen.putImageData(image, 0, 0);

  // Daraxtlar
  pen.fillStyle = frozen ? 'rgba(70, 92, 84, .55)' : 'rgba(18, 44, 22, .5)';
  const seen = new Set();
  for (const cell of obstacleGrid.values()) {
    for (const obstacle of cell) {
      if (seen.has(obstacle)) continue;
      seen.add(obstacle);
      pen.fillRect(mapX(obstacle.x) - 1, mapY(obstacle.z) - 1, 2, 2);
    }
  }

  // Dunyo chegarasi
  pen.strokeStyle = 'rgba(243, 234, 214, .5)';
  pen.setLineDash([6, 6]);
  pen.beginPath();
  pen.arc(MAP_SIZE / 2, MAP_SIZE / 2, (CONFIG.worldRadius / MAP_RANGE) * (MAP_SIZE / 2), 0, TAU);
  pen.stroke();
  pen.setLineDash([]);
  mapBaseFrozen = frozen;
}

function drawDot(pen, x, z, color, radius = 5) {
  pen.fillStyle = color;
  pen.beginPath();
  pen.arc(mapX(x), mapY(z), radius, 0, TAU);
  pen.fill();
}

function drawLabel(pen, x, z, text, color) {
  pen.font = '600 12px "Avenir Next", "Segoe UI", sans-serif';
  pen.textAlign = 'center';
  pen.lineWidth = 3;
  pen.strokeStyle = 'rgba(0, 0, 0, .75)';
  pen.strokeText(text, mapX(x), mapY(z) - 10);
  pen.fillStyle = color;
  pen.fillText(text, mapX(x), mapY(z) - 10);
}

/** Daryodan o'tish joyi: ko'zga tashlanadigan sariq ko'prikcha. */
function drawFord(pen, ford) {
  const x = mapX(ford.x), y = mapY(ford.z);
  pen.fillStyle = '#ffd24d';
  pen.strokeStyle = '#3a2a08';
  pen.lineWidth = 2;
  pen.beginPath();
  pen.moveTo(x, y - 8);
  pen.lineTo(x + 8, y);
  pen.lineTo(x, y + 8);
  pen.lineTo(x - 8, y);
  pen.closePath();
  pen.fill();
  pen.stroke();
  drawLabel(pen, ford.x, ford.z - 3, 'O‘tish joyi', '#ffd24d');
}

function drawPlayerArrow(pen) {
  pen.save();
  pen.translate(mapX(player.pos.x), mapY(player.pos.z));
  pen.rotate(-player.yaw);
  pen.fillStyle = '#ffffff';
  pen.strokeStyle = '#000000';
  pen.lineWidth = 2;
  pen.beginPath();
  pen.moveTo(0, -11);
  pen.lineTo(7, 8);
  pen.lineTo(0, 4);
  pen.lineTo(-7, 8);
  pen.closePath();
  pen.fill();
  pen.stroke();
  pen.restore();
}

function renderMap() {
  if (mapBaseFrozen !== conditions.frozen) drawMapBase();
  const pen = ui.mapCanvas.getContext('2d');
  pen.drawImage(mapBase, 0, 0);

  fords.forEach((ford) => drawFord(pen, ford));

  if (game.teamStatus?.zone) {
    const { x, z, radius } = game.teamStatus.zone;
    pen.strokeStyle = '#e5ad4c';
    pen.lineWidth = 3;
    pen.beginPath();
    pen.arc(mapX(x), mapY(z), (radius / MAP_RANGE) * (MAP_SIZE / 2), 0, TAU);
    pen.stroke();
  }
  if (game.teamStatus?.camp) drawLabel(pen, 0, 0, 'Lager', '#ffb26b');

  for (const item of placeables.values()) {
    drawDot(pen, item.x, item.z, item.kind === 'tower' ? '#d9a35a' : '#b9bec4', 4);
  }
  for (const ping of game.pings ?? []) {
    drawDot(pen, ping.point.x, ping.point.z, ping.color, 5);
    drawLabel(pen, ping.point.x, ping.point.z, ping.text, ping.color);
  }
  for (const member of network.roster.values()) {
    if (!member.hunter || member.hunter === player) continue;
    const color = HUNTER_COLORS[member.colorIndex % HUNTER_COLORS.length];
    drawDot(pen, member.hunter.pos.x, member.hunter.pos.z, color, 6);
    drawLabel(pen, member.hunter.pos.x, member.hunter.pos.z, member.name, color);
  }
  drawPlayerArrow(pen);
}

function toggleMap() {
  ui.mapScreen.hidden = !ui.mapScreen.hidden;
}

/* Kompas: qarash yo'nalishiga qarab suriladigan chiziq */

const COMPASS_SPAN = 1.5; // chiziq markazdan ikki tomonga shuncha radianni ko'rsatadi
const COMPASS_MARKS = [[0, 'Shimol'], [Math.PI / 2, 'Sharq'], [Math.PI, 'Janub'], [-Math.PI / 2, 'G‘arb']];

const bearingTo = (x, z) => Math.atan2(x - player.pos.x, -(z - player.pos.z));

function updateCompass() {
  const canvas = ui.compass;
  const pen = canvas.getContext('2d');
  const { width, height } = canvas;
  const heading = -player.yaw;
  const place = (bearing) => width / 2 + (angleDelta(heading, bearing) / COMPASS_SPAN) * (width / 2);

  pen.clearRect(0, 0, width, height);
  pen.fillStyle = 'rgba(243, 234, 214, .55)';
  for (let bearing = 0; bearing < TAU; bearing += Math.PI / 12) {
    pen.fillRect(place(bearing), height - 7, 1, 5);
  }

  pen.font = '700 13px "Avenir Next", "Segoe UI", sans-serif';
  pen.textAlign = 'center';
  pen.fillStyle = '#f3ead6';
  for (const [bearing, label] of COMPASS_MARKS) {
    if (Math.abs(angleDelta(heading, bearing)) < COMPASS_SPAN) pen.fillText(label, place(bearing), 15);
  }

  // Eng yaqin o'tish joyi va sheriklar
  const marker = (x, z, color) => {
    const bearing = bearingTo(x, z);
    if (Math.abs(angleDelta(heading, bearing)) >= COMPASS_SPAN) return;
    pen.fillStyle = color;
    pen.beginPath();
    pen.arc(place(bearing), height - 13, 3.5, 0, TAU);
    pen.fill();
  };
  const nearestFord = fords.reduce((best, ford) => (
    !best || Math.hypot(ford.x - player.pos.x, ford.z - player.pos.z) < Math.hypot(best.x - player.pos.x, best.z - player.pos.z) ? ford : best), null);
  if (nearestFord) marker(nearestFord.x, nearestFord.z, '#ffd24d');
  for (const member of network.roster.values()) {
    if (member.hunter && member.hunter !== player) {
      marker(member.hunter.pos.x, member.hunter.pos.z, HUNTER_COLORS[member.colorIndex % HUNTER_COLORS.length]);
    }
  }
}
