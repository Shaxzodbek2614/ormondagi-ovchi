'use strict';

/* ==========================================================================
   OVOZ — barcha ovozlar WebAudio bilan shu yerning o'zida yasaladi
   ========================================================================== */

const sound = {
  context: null,
  master: null,
  echo: null,
  noise: null,
  muted: false,
  birdTimer: 3,
  howlTimer: 20,

  /** Brauzer ovozni faqat foydalanuvchi bosgandan keyin ruxsat beradi. */
  init() {
    if (this.context) {
      this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = this.context = new AudioContextClass();

    this.master = context.createGain();
    this.applyVolume();
    this.master.connect(context.destination);

    // Oq shovqin: o'q, qadam va shamol ovozlari uchun xomashyo
    this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = this.noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

    // O'rmondagi aks-sado
    this.echo = context.createDelay(1);
    this.echo.delayTime.value = 0.27;
    const feedback = context.createGain();
    feedback.gain.value = 0.32;
    const tone = context.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 900;
    this.echo.connect(tone).connect(feedback).connect(this.echo);
    tone.connect(this.master);

    this.startWind();
  },

  toggleMute() {
    this.muted = !this.muted;
    this.applyVolume();
  },

  applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : profile.settings.volume;
  },

  /** Filtrlangan shovqin zarbasi. */
  noiseHit({ type = 'lowpass', from, to = from, volume, duration, delay = 0, target = this.master }) {
    if (!this.context) return null;
    const context = this.context, start = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(target);
    source.start(start, Math.random());
    source.stop(start + duration);
    return gain;
  },

  /** Chastotasi o'zgarib boruvchi oddiy nota. */
  tone({ type = 'sine', from, to = from, volume, duration, delay = 0, target = this.master }) {
    if (!this.context) return;
    const context = this.context, start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(target);
    oscillator.start(start);
    oscillator.stop(start + duration);
  },

  gunshot() {
    const gain = this.noiseHit({ from: 3200, to: 220, volume: 1, duration: 0.34 });
    gain?.connect(this.echo);
    this.tone({ from: 130, to: 38, volume: 0.9, duration: 0.2 });
  },
  shotgunBlast() {
    const gain = this.noiseHit({ from: 2600, to: 160, volume: 1.2, duration: 0.42 });
    gain?.connect(this.echo);
    this.tone({ from: 100, to: 30, volume: 1, duration: 0.26 });
  },
  bowRelease() {
    this.tone({ type: 'triangle', from: 220, to: 90, volume: 0.22, duration: 0.14 });
    this.noiseHit({ type: 'highpass', from: 2800, to: 1400, volume: 0.14, duration: 0.12 });
  },
  dryFire() {
    this.noiseHit({ type: 'highpass', from: 3000, volume: 0.25, duration: 0.03 });
  },
  reload(duration) {
    const clicks = [0.08, 0.47, 0.58, 0.86].map((share) => share * duration);
    clicks.forEach((delay) => {
      this.noiseHit({ type: 'bandpass', from: 2400, volume: 0.6, duration: 0.05, delay });
      this.tone({ type: 'square', from: 900, to: 500, volume: 0.05, duration: 0.04, delay });
    });
  },
  impact() {
    this.noiseHit({ from: 700, to: 180, volume: 0.5, duration: 0.09, delay: 0.05 });
  },
  footstep(sprinting) {
    this.noiseHit({ type: 'bandpass', from: randRange(500, 900), to: 300, volume: sprinting ? 0.16 : 0.09, duration: 0.09 });
  },
  splash() {
    this.noiseHit({ type: 'bandpass', from: randRange(1100, 1900), to: 500, volume: 0.2, duration: 0.16 });
  },
  hurt() {
    this.tone({ type: 'triangle', from: 170, to: 60, volume: 0.7, duration: 0.3 });
    this.noiseHit({ from: 500, to: 120, volume: 0.6, duration: 0.22 });
  },
  /** Hayvon ovozi uchun: yaqin bo'lsa baland, chap-o'ng tomoni ham eshitiladi. */
  spatial(position) {
    const dx = position.x - player.pos.x, dz = position.z - player.pos.z;
    const panner = this.context.createStereoPanner();
    panner.pan.value = clamp(Math.sin(angleFromView(position.x, position.z)), -1, 1);
    panner.connect(this.master);
    return { panner, volume: clamp(1 - Math.hypot(dx, dz) / 70, 0.04, 1) };
  },
  grunt(position) {
    if (!this.context) return;
    const { panner, volume } = this.spatial(position);
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.13;
      this.tone({ type: 'sawtooth', from: randRange(95, 125), to: 60, volume: volume * 0.5, duration: 0.14, delay, target: panner });
      this.noiseHit({ type: 'bandpass', from: 500, to: 260, volume: volume * 0.4, duration: 0.12, delay, target: panner });
    }
  },
  growl(position) {
    if (!this.context) return;
    const { panner, volume } = this.spatial(position);
    this.tone({ type: 'sawtooth', from: 85, to: 62, volume: volume * 0.4, duration: 0.8, target: panner });
    this.noiseHit({ type: 'bandpass', from: 320, to: 180, volume: volume * 0.45, duration: 0.8, target: panner });
  },
  roar(position) {
    if (!this.context) return;
    const { panner, volume } = this.spatial(position);
    this.tone({ type: 'sawtooth', from: 150, to: 58, volume: volume * 0.65, duration: 1.3, target: panner });
    this.tone({ type: 'square', from: 74, to: 40, volume: volume * 0.4, duration: 1.3, target: panner });
    this.noiseHit({ from: 900, to: 200, volume: volume * 0.6, duration: 1.3, target: panner });
  },
  quack(position) {
    if (!this.context) return;
    const { panner, volume } = this.spatial(position);
    for (let i = 0; i < 3; i++) {
      this.tone({ type: 'square', from: 520, to: 300, volume: volume * 0.18, duration: 0.11, delay: i * 0.17, target: panner });
    }
  },
  /** Uzoqdan eshitiladigan bo'ri uvillashi. */
  howl() {
    if (!this.context) return;
    const panner = this.context.createStereoPanner();
    panner.pan.value = randRange(-0.8, 0.8);
    panner.connect(this.master);
    this.tone({ from: 300, to: 470, volume: 0.05, duration: 1, target: panner });
    this.tone({ from: 470, to: 330, volume: 0.05, duration: 1.8, delay: 0.95, target: panner });
  },
  tick() {
    this.tone({ type: 'square', from: 1100, volume: 0.05, duration: 0.05 });
  },
  /** Mukofot ovozi: topshiriq bajarilganda. */
  chime() {
    [660, 880, 1100].forEach((from, i) => this.tone({ from, volume: 0.08, duration: 0.2, delay: i * 0.09 }));
  },
  /** Sherigining o'q ovozi: masofaga qarab pasayadi. */
  distantShot(position) {
    if (!this.context) return;
    const { panner, volume } = this.spatial(position);
    this.noiseHit({ from: 2200, to: 200, volume: volume * 0.7, duration: 0.4, target: panner });
    this.tone({ from: 110, to: 36, volume: volume * 0.5, duration: 0.22, target: panner });
  },
  thunder() {
    const delay = randRange(0.3, 1.3);
    this.noiseHit({ from: 420, to: 60, volume: 0.9, duration: 2.4, delay });
    this.tone({ from: 60, to: 28, volume: 0.45, duration: 2, delay });
  },
  heal() {
    this.tone({ from: 420, to: 700, volume: 0.1, duration: 0.3 });
  },
  horn() {
    this.tone({ type: 'sawtooth', from: 220, to: 210, volume: 0.22, duration: 0.7 });
    this.tone({ type: 'sawtooth', from: 330, to: 315, volume: 0.16, duration: 0.7, delay: 0.1 });
  },

  /** Doimiy shamol: shovqin sekin o'zgaruvchi filtr orqali o'tadi. */
  startWind() {
    const context = this.context;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    const gain = context.createGain();
    gain.gain.value = 0.045;
    const swell = context.createOscillator();
    swell.frequency.value = 0.09;
    const swellDepth = context.createGain();
    swellDepth.gain.value = 170;
    swell.connect(swellDepth).connect(filter.frequency);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    swell.start();

    // Yomg'ir shovqini doim aylanib turadi, ovozi faqat yomg'irda ochiladi
    const drizzle = context.createBufferSource();
    drizzle.buffer = this.noise;
    drizzle.loop = true;
    const drizzleTone = context.createBiquadFilter();
    drizzleTone.type = 'highpass';
    drizzleTone.frequency.value = 1500;
    this.rainGain = context.createGain();
    this.rainGain.gain.value = 0;
    drizzle.connect(drizzleTone).connect(this.rainGain).connect(this.master);
    drizzle.start();
  },

  setRain(raining) {
    if (this.rainGain) this.rainGain.gain.value = raining ? 0.09 : 0;
  },

  /** Vaqti-vaqti bilan uzoqdan qush sayraydi yoki bo'ri uvillaydi. */
  updateAmbience(dt) {
    this.howlTimer -= dt;
    if (this.howlTimer <= 0) {
      this.howlTimer = randRange(30, 60);
      this.howl();
    }
    this.birdTimer -= dt;
    if (this.birdTimer > 0 || !this.context) return;
    this.birdTimer = randRange(3, 9);
    const base = randRange(2200, 3800);
    const notes = Math.floor(randRange(2, 6));
    for (let i = 0; i < notes; i++) {
      this.tone({ from: base * randRange(0.9, 1.15), to: base * randRange(0.8, 1.3), volume: 0.022, duration: 0.09, delay: i * 0.13 });
    }
  },
};
