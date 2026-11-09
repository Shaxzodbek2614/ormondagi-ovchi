'use strict';

/* ==========================================================================
   TEZ XABARLAR: V tugmasi bilan sheriklarga qisqa gap yuborish
   Mijoz faqat gap raqamini yuboradi, xost uni tekshirib o'z jamoasiga tarqatadi.
   ========================================================================== */

// mark: yuboruvchi turgan joyda belgi ham qo'yiladi
const QUICK_CHAT = [
  { text: 'Bu yoqqa!', mark: true },
  { text: 'Ehtiyot bo‘l!' },
  { text: 'Kutib tur' },
  { text: 'Yordam!', mark: true },
  { text: 'Zo‘r o‘q!' },
];
const CHAT_COOLDOWN = 1500;
const CHAT_LINE_LIFETIME = 6000;
const CHAT_MENU_LIFETIME = 5000;

const chat = { menuOpen: false, menuClock: null };

/** Ovchining jamoasi: jamoa missiyasi bo'lmasa, null. */
function teamOf(id) {
  return ROLE_INFO[network.roles?.[id]]?.team ?? null;
}

/** Ikki ovchi bir jamoadami. Jamoalar bo'lmasa, hamma bir jamoa. */
function sameTeam(firstId, secondId) {
  const first = teamOf(firstId), second = teamOf(secondId);
  return !first || !second || first === second;
}

/** Shu kompyuterdagi o'yinchining roster raqami. */
const myRosterId = () => network.myId ?? HOST_ID;

/* Ro'yxat oynasi */

function buildChatMenu() {
  ui.chatMenu.replaceChildren(...QUICK_CHAT.map(({ text }, index) => {
    const button = document.createElement('button');
    button.innerHTML = `<kbd>${index + 1}</kbd>`;
    button.append(` ${text}`);
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      sayPhrase(index);
    });
    button.addEventListener('mousedown', (event) => event.stopPropagation()); // otish bo'lib ketmasin
    return button;
  }));
}

function setChatMenu(open) {
  chat.menuOpen = open;
  ui.chatMenu.hidden = !open;
  clearTimeout(chat.menuClock);
  if (open) chat.menuClock = setTimeout(() => setChatMenu(false), CHAT_MENU_LIFETIME);
}

function toggleChatMenu() {
  if (game.mode !== 'team') return;
  setChatMenu(!chat.menuOpen);
}

function sayPhrase(index) {
  setChatMenu(false);
  if (!QUICK_CHAT[index] || game.state !== 'playing') return;
  sendToHost({ t: 'say', n: index });
}

/* Xost: tekshirib, tarqatadi */

/** Gap yuboruvchining jamoasidagi odamlarga boradi. Botlar ekranga qaramaydi. */
function deliverSay(member, index) {
  if (!member || !QUICK_CHAT[index]) return;
  const now = performance.now();
  if (now - (member.chatAt ?? -Infinity) < CHAT_COOLDOWN) return;
  member.chatAt = now;

  sendToTeam(member.id, { t: 'said', id: member.id, n: index }, showSaid);
}

/** Xost: xabarni yuboruvchining jamoasiga yetkazadi. Xostning o'ziga show bilan ko'rsatadi. */
function sendToTeam(fromId, message, show) {
  for (const listener of network.roster.values()) {
    if (listener.isBot || !sameTeam(fromId, listener.id)) continue;
    if (listener.id === HOST_ID) show(message);
    else sendTo(listener.connection, message);
  }
}

HOST_MESSAGES.say = (member, { n }) => {
  if (Number.isInteger(n)) deliverSay(member, n);
};

CLIENT_MESSAGES.said = (message) => showSaid(message);

/* Ekranda ko'rsatish */

function showSaid({ id, n }) {
  const phrase = QUICK_CHAT[n];
  const member = network.roster.get(String(id));
  if (!phrase || !member) return;
  const color = memberColor(member);
  addChatLine(member.name, phrase.text, color);

  const body = member.id === myRosterId() ? player : member.hunter;
  if (phrase.mark && body) {
    game.pings.push({
      point: body.pos.clone(),
      text: `${cleanName(member.name)}: ${phrase.text}`,
      color,
      until: performance.now() + PING_LIFETIME,
    });
  }
  sound.tick();
}

function addChatLine(name, text, color) {
  const line = document.createElement('div');
  const who = document.createElement('b');
  who.textContent = cleanName(name);
  who.style.color = color;
  line.append(who, ` ${text}`);
  ui.chatFeed.append(line);
  while (ui.chatFeed.children.length > 4) ui.chatFeed.firstElementChild.remove();
  line.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: CHAT_LINE_LIFETIME })
    .onfinish = () => line.remove();
}

/** Raund boshida eski gaplar tozalanadi. */
function clearChat() {
  setChatMenu(false);
  ui.chatFeed.replaceChildren();
}

buildChatMenu();
