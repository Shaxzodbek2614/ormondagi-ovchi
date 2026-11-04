'use strict';

/* ==========================================================================
   BIRGA OV OYNALARI: xona ochish, kirish va kutish xonasi
   ========================================================================== */

const ROOM_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // bir-biriga o'xshash belgilar yo'q

function createRoomCode() {
  return Array.from({ length: 5 }, () => pick([...ROOM_CODE_LETTERS])).join('');
}

/** Xona kodi URL'ga yoziladi va sahifa qayta yuklanadi: o'rmon shu koddan quriladi. */
function enterRoom(code) {
  location.hash = `${ROOM_HASH.slice(1)}${code}`;
  location.reload();
}

function saveNickname() {
  profile.nickname = cleanName(ui.nickInput.value);
  ui.nickInput.value = profile.nickname;
  saveProfile();
}

function showTeamScreen() {
  ui.nickInput.value = profile.nickname ?? '';
  ui.teamError.textContent = '';
  ui.menu.hidden = true;
  ui.team.hidden = false;
}

function createRoom() {
  saveNickname();
  const code = createRoomCode();
  markRoomOwner(code);
  enterRoom(code);
}

function joinTypedRoom() {
  const code = ui.roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) {
    ui.teamError.textContent = 'Xona kodi 5 ta belgidan iborat.';
    return;
  }
  saveNickname();
  enterRoom(code);
}

function setLobbyStatus(text) {
  ui.lobbyStatus.textContent = text;
}

function renderLobby() {
  ui.lobbyCode.textContent = roomCode;
  ui.lobbyLink.value = `${location.origin}${location.pathname}${ROOM_HASH}${roomCode}`;
  ui.lobbyPlayers.replaceChildren(...[...network.roster.values()].map((member) => {
    const item = document.createElement('li');
    item.textContent = member.name + (member.id === HOST_ID ? ' (xost)' : '') + (member.id === network.myId ? ' · siz' : '');
    item.style.color = HUNTER_COLORS[member.colorIndex % HUNTER_COLORS.length];
    return item;
  }));
  ui.lobbyHostTools.hidden = !network.isHost;
  ui.lobbyConditions.textContent = buildConditions(profile.setup).name;
  ui.lobbyTaskName.textContent = network.selectedTeamMission?.title ?? 'Erkin birga ov';
}

function showLobby() {
  ui.menu.hidden = ui.team.hidden = ui.result.hidden = ui.setup.hidden = true;
  ui.lobby.hidden = false;
  renderLobby();
}

/** Sahifa xona kodi bilan ochilganda ishlaydi. */
function bootRoom() {
  if (!roomCode) return;
  if (!profile.nickname) profile.nickname = `Ovchi${Math.floor(Math.random() * 90 + 10)}`;
  showLobby();
  const connect = isRoomOwner() ? openRoom : joinRoom;
  connect().catch(() => setLobbyStatus('Ulanish kutubxonasi yuklanmadi. Internetni tekshiring.'));
}

async function copyRoomLink() {
  try {
    await navigator.clipboard.writeText(ui.lobbyLink.value);
    ui.copyLinkBtn.textContent = 'Nusxa olindi';
  } catch {
    ui.lobbyLink.select(); // nusxalash taqiqlangan bo'lsa, matnni belgilab beramiz
  }
}

ui.teamBtn.addEventListener('click', showTeamScreen);
ui.teamBackBtn.addEventListener('click', () => {
  ui.team.hidden = true;
  ui.menu.hidden = false;
});
ui.createRoomBtn.addEventListener('click', createRoom);
ui.joinRoomBtn.addEventListener('click', joinTypedRoom);
ui.copyLinkBtn.addEventListener('click', copyRoomLink);
ui.lobbyLeaveBtn.addEventListener('click', leaveRoom);
ui.lobbyStartBtn.addEventListener('click', startTeamRound);
ui.lobbyConditionsBtn.addEventListener('click', () => {
  ui.lobby.hidden = true;
  showSetup();
});
