'use strict';

/* ==========================================================================
   TARMOQ: xona, ulanish va xabarlar
   Xonani ochgan o'yinchi xost: hayvonlar va vaqtni u hisoblaydi, qolganlar
   natijani oladi. Barcha xabarlar xost orqali o'tadi (PeerJS / WebRTC).
   ========================================================================== */

const PROTOCOL_VERSION = 1;
const PEER_PREFIX = 'ormondagi-ovchi-';
const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const TEAM_SITE_URL = 'https://shaxzodbek2614.github.io/ormondagi-ovchi/';
const MAX_PLAYERS = 4;
const HOST_ID = 'h';

const network = {
  active: false,      // xonaga ulanganmi
  isHost: false,
  isClient: false,
  peer: null,
  hostConnection: null,
  myId: null,
  roster: new Map(),  // id -> { id, name, colorIndex, connection, hunter, lastSeen }
  nextClientNumber: 1,
  sendClock: 0,
};

const HOST_MARK_KEY = 'ormondagi-ovchi-xost';

/** Bu kompyuter shu xonani ochganmi. Havola do'stga yuborilganda u xost bo'lib qolmasligi uchun tabda saqlanadi. */
function isRoomOwner() {
  try {
    return sessionStorage.getItem(HOST_MARK_KEY) === roomCode;
  } catch {
    return false;
  }
}

function markRoomOwner(code) {
  try {
    sessionStorage.setItem(HOST_MARK_KEY, code);
  } catch {
    // Saqlab bo'lmasa, sahifa yangilanganda xost mijozga aylanadi
  }
}

function loadPeerJs() {
  if (window.Peer) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PEERJS_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error('peerjs'));
    document.head.append(script);
  });
}

/** Dunyo nazorat yig'indisi: ikki tomonda o'rmon bir xil ekanini tekshiradi. */
function worldChecksum() {
  let sum = 0;
  const seen = new Set();
  for (const cell of obstacleGrid.values()) {
    for (const obstacle of cell) {
      if (seen.has(obstacle)) continue;
      seen.add(obstacle);
      sum += obstacle.x * 1.7 + obstacle.z * 3.1;
    }
  }
  return Math.round(sum);
}

const cleanName = (value) => String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) || 'Ovchi';

function describePeerError(error) {
  switch (error.type) {
    case 'peer-unavailable': return 'Bunday xona topilmadi. Kodni tekshiring yoki do‘stingiz xonani ochganini so‘rang.';
    case 'unavailable-id': return 'Bu xona kodi band. Bir daqiqadan keyin qayta urinib ko‘ring.';
    case 'browser-incompatible': return `Bu sahifada birga o‘ynab bo‘lmaydi. O‘yinni saytda oching: ${TEAM_SITE_URL}`;
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return 'Ulanish xizmatiga yetib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';
    default: return 'Ulanishda xato chiqdi. Sahifani yangilab, qayta urinib ko‘ring.';
  }
}

function sendTo(connection, message) {
  if (connection?.open) connection.send(message);
}

/** Xost: barcha mijozlarga, kerak bo'lsa bittasidan tashqari. */
function broadcast(message, exceptId = null) {
  for (const member of network.roster.values()) {
    if (member.id !== exceptId && member.connection) sendTo(member.connection, message);
  }
}

/** Har ikki tomon uchun: mijoz xostga, xost esa to'g'ridan-to'g'ri o'ziga ishlov beradi. */
function sendToHost(message) {
  if (network.isClient) sendTo(network.hostConnection, message);
  else if (network.isHost) HOST_MESSAGES[message.t]?.(network.roster.get(HOST_ID), message);
}

const rosterList = () => [...network.roster.values()]
  .map(({ id, name, colorIndex }) => ({ id, name, colorIndex }));

/* --------------------------------------------------------------------------
   Xost
   -------------------------------------------------------------------------- */

async function openRoom() {
  network.active = network.isHost = true;
  network.myId = HOST_ID;
  network.roster.set(HOST_ID, { id: HOST_ID, name: cleanName(profile.nickname), colorIndex: 0, connection: null, hunter: player });
  renderLobby();
  setLobbyStatus('Xona ochilmoqda…');

  await loadPeerJs();
  let attempts = 0;
  const connect = () => {
    const peer = new Peer(PEER_PREFIX + roomCode);
    network.peer = peer;
    peer.on('open', () => setLobbyStatus('Xona tayyor. Do‘stlaringizga kod yoki havolani yuboring.'));
    peer.on('connection', acceptClient);
    peer.on('error', (error) => {
      // Sahifa yangilanganda eski ulanish bir oz vaqt kodni band tutadi
      if (error.type === 'unavailable-id' && attempts++ < 6) {
        setLobbyStatus('Xona kodi bo‘shashini kutmoqdamiz…');
        peer.destroy();
        setTimeout(connect, 5000);
        return;
      }
      setLobbyStatus(describePeerError(error));
    });
  };
  connect();
}

function acceptClient(connection) {
  connection.on('data', (message) => {
    const member = [...network.roster.values()].find((candidate) => candidate.connection === connection);
    if (message?.t === 'hello' && !member) {
      welcomeClient(connection, message);
    } else if (member && HOST_MESSAGES[message?.t]) {
      member.lastSeen = performance.now();
      HOST_MESSAGES[message.t](member, message);
    }
  });
  connection.on('close', () => dropClient(connection));
}

function welcomeClient(connection, hello) {
  const refuse = (reason) => {
    sendTo(connection, { t: 'refused', reason });
    setTimeout(() => connection.close(), 300);
  };
  if (hello.version !== PROTOCOL_VERSION) return refuse('O‘yin versiyangiz boshqa. Sahifani yangilang.');
  if (network.roster.size >= MAX_PLAYERS) return refuse(`Xona to‘lgan: ${MAX_PLAYERS} kishidan ko‘p bo‘lmaydi.`);
  if (hello.checksum !== worldChecksum()) return refuse('O‘rmon mos kelmadi. Sahifani yangilab, qayta kiring.');

  const id = `p${network.nextClientNumber++}`;
  const used = new Set([...network.roster.values()].map((member) => member.colorIndex));
  const colorIndex = [0, 1, 2, 3].find((index) => !used.has(index));
  const member = { id, name: cleanName(hello.name), colorIndex, connection, lastSeen: performance.now() };
  network.roster.set(id, member);

  sendTo(connection, { t: 'welcome', id, roster: rosterList() });
  broadcast({ t: 'roster', roster: rosterList() }, id);
  renderLobby();
  if (game.mode === 'team' && game.state !== 'menu' && game.state !== 'over') {
    addTeamMate(member);
    sendTo(connection, buildStartMessage());
  }
  return undefined;
}

function dropClient(connection) {
  const member = [...network.roster.values()].find((candidate) => candidate.connection === connection);
  if (!member) return;
  member.hunter?.remove();
  network.roster.delete(member.id);
  broadcast({ t: 'left', id: member.id, name: member.name, roster: rosterList() });
  showPopup(`${member.name} chiqib ketdi`);
  renderLobby();
  checkTeamWipe();
}

/* --------------------------------------------------------------------------
   Mijoz
   -------------------------------------------------------------------------- */

async function joinRoom() {
  network.active = network.isClient = true;
  renderLobby();
  setLobbyStatus('Xonaga ulanilmoqda…');

  await loadPeerJs();
  const peer = new Peer();
  network.peer = peer;
  peer.on('error', (error) => setLobbyStatus(describePeerError(error)));
  peer.on('open', () => {
    const connection = peer.connect(PEER_PREFIX + roomCode, { reliable: true, serialization: 'json' });
    network.hostConnection = connection;
    connection.on('open', () => sendTo(connection, {
      t: 'hello', version: PROTOCOL_VERSION, name: profile.nickname, checksum: worldChecksum(),
    }));
    connection.on('data', (message) => CLIENT_MESSAGES[message?.t]?.(message));
    connection.on('close', onHostLost);
  });
}

function onHostLost() {
  if (network.closing) return;
  if (game.mode === 'team' && game.state === 'playing') endRound('Xost o‘yindan chiqib ketdi');
  else setLobbyStatus('Xost bilan aloqa uzildi. Xonaga qaytadan kiring.');
}

/** Xonani tark etadi: sahifa yangi o'rmon bilan qayta yuklanadi. */
function leaveRoom() {
  network.closing = true;
  network.peer?.destroy();
  location.hash = '';
  location.reload();
}

function applyRoster(roster) {
  const known = new Set();
  for (const entry of roster) {
    const id = String(entry.id);
    known.add(id);
    const member = network.roster.get(id) ?? { id };
    Object.assign(member, { name: cleanName(entry.name), colorIndex: Number(entry.colorIndex) || 0 });
    network.roster.set(id, member);
  }
  for (const [id, member] of network.roster) {
    if (!known.has(id)) {
      member.hunter?.remove();
      network.roster.delete(id);
    }
  }
  renderLobby();
}
