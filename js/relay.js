'use strict';

/* ==========================================================================
   ZAXIRA ULANISH: ochiq MQTT serveri orqali
   Ko'p provayderlar (masalan, symmetric NAT ishlatadiganlar) to'g'ridan-to'g'ri
   WebRTC ulanishga yo'l qo'ymaydi. Bunday holatda xabarlar oddiy WebSocket orqali
   ochiq server yordamida uzatiladi. RelayLink PeerJS ulanishi kabi ishlaydi, shuning
   uchun o'yin kodi qaysi yo'l ishlatilayotganini bilmaydi.
   Eslatma: xabarlar ochiq serverdan o'tadi, ularda faqat o'yin ma'lumoti va ism bor.
   ========================================================================== */

const MQTT_URL = 'https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js';
const RELAY_BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const RELAY_ROOT = `ormondagi-ovchi/v1/${roomCode}`;
const RELAY_TOPICS = {
  host: `${RELAY_ROOT}/host`,            // mijozlardan xostga
  everyone: `${RELAY_ROOT}/all`,         // xostdan hammaga
  client: (id) => `${RELAY_ROOT}/c/${id}`, // xostdan bitta mijozga
};

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(url));
    document.head.append(script);
  });
}

/**
 * Barcha serverlarga ulanishni boshlaydi. Server o'chib qolsa, qayta urinib turadi.
 * @param onConnect har bir ulanishda chaqiriladi (obunani qayta yozish uchun)
 */
function startBrokers(will, onConnect) {
  return RELAY_BROKERS.map((url) => {
    const broker = window.mqtt.connect(url, {
      clean: true, connectTimeout: 8000, reconnectPeriod: 3000, keepalive: 20, protocolVersion: 4, will,
    });
    broker.on('error', () => {}); // xato bo'lsa, kutubxonaning o'zi qayta urinadi
    broker.on('connect', () => onConnect(broker));
    return broker;
  });
}

/** PeerJS ulanishi bilan bir xil ko'rinishdagi aloqa: on, send, open, close. */
class RelayLink {
  /** @param brokers xabar yuboriladigan serverlar: mijoz javob kelgunicha hammasidan yuboradi */
  constructor(brokers, topic, wrap = (message) => message) {
    this.brokers = brokers;
    this.topic = topic;
    this.wrap = wrap;
    this.open = true;
    this.relay = true;
    this.handlers = {};
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }

  emit(event, value) {
    this.handlers[event]?.(value);
  }

  send(message) {
    if (!this.open) return;
    const text = JSON.stringify(this.wrap(message));
    for (const broker of this.brokers) {
      if (broker.connected) broker.publish(this.topic, text, { qos: 0 });
    }
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }
}

const parseJson = (payload) => {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
};

/** Bir nechta serverdan birortasi ulanguncha kutadi. Muddat tugasa false qaytaradi. */
function waitForBroker(register, timeout) {
  return new Promise((resolve) => {
    register(() => resolve(true));
    setTimeout(() => resolve(false), timeout);
  });
}

/** Xost: barcha serverlarda mijozlarni kutadi. Mijoz qaysi serverdan yozsa, shu orqali javob oladi. */
async function openRelayInbox() {
  if (!window.mqtt) await loadScript(MQTT_URL);
  const links = new Map();
  const will = { topic: RELAY_TOPICS.everyone, payload: JSON.stringify({ t: 'hostleft' }), qos: 0 };

  const onMessage = (broker, payload) => {
    const envelope = parseJson(payload);
    const id = String(envelope?.from ?? '').slice(0, 24);
    const message = envelope?.m;
    if (!id || !message) return;

    let link = links.get(id);
    if (!link) {
      if (message.t !== 'hello') return;
      link = new RelayLink([broker], RELAY_TOPICS.client(id));
      links.set(id, link);
      acceptClient(link);
    }
    if (message.t === 'bye') {
      if (!link.brokers.includes(broker)) return; // mijoz ishlatmayotgan serverdan kelgan
      link.close();
      links.delete(id);
    } else {
      link.emit('data', message);
    }
  };

  return waitForBroker((ready) => {
    network.relayBrokers = startBrokers(will, (broker) => {
      broker.subscribe(RELAY_TOPICS.host, { qos: 0 });
      ready();
    });
    for (const broker of network.relayBrokers) broker.on('message', (_, payload) => onMessage(broker, payload));
  }, 9000);
}

/** Mijoz: hamma serverlardan yozadi, xost qaysi birida javob bersa, shunda qoladi. */
async function connectThroughRelay() {
  if (!window.mqtt) await loadScript(MQTT_URL);
  const id = Math.random().toString(36).slice(2, 12);
  const wrap = (message) => ({ from: id, m: message });
  const will = { topic: RELAY_TOPICS.host, payload: JSON.stringify(wrap({ t: 'bye' })), qos: 0 };
  let link = null;

  const connected = await waitForBroker((ready) => {
    const brokers = startBrokers(will, (broker) => {
      broker.subscribe([RELAY_TOPICS.client(id), RELAY_TOPICS.everyone], { qos: 0 });
      ready();
    });
    network.relayBrokers = brokers;
    link = new RelayLink(brokers, RELAY_TOPICS.host, wrap);
    for (const broker of brokers) {
      broker.on('message', (_, payload) => {
        const message = parseJson(payload);
        if (!message) return;
        if (link.brokers.length > 1) {
          // Xost shu serverda ekan: qolganlarini yopamiz. Yopish yumshoq bo'lishi shart,
          // aks holda server "kutilmaganda uzildi" deb xostga xayrlashuv xabarini yuboradi.
          link.brokers.filter((other) => other !== broker).forEach((other) => other.end());
          link.brokers = [broker];
        }
        link.emit('data', message);
      });
    }
  }, 9000);
  return connected ? link : null;
}
