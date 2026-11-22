// All the game's sounds.
//
// By default every sound is made by the browser itself (the "Web Audio API"),
// so there are no audio files to download and nothing copyrighted.
//
// WANT TO USE YOUR OWN SOUND FILES INSTEAD?
// Put .mp3 files in an "audio" folder and fill in the paths below, e.g.
//   correct: "audio/correct.mp3"
// Any sound left as "" uses the built-in generated sound.
const SOUND_FILES = {
  countdownBeep: "", // played on 3, 2 and 1
  countdownGo: "",   // played on START!
  correct: "",
  wrong: "",         // played on Skip
  timeUp: "",        // played when a player's clock hits zero
  music: ""          // background music during the duel (loops)
};

const MUSIC_VOLUME = 0.35;   // 0 = silent, 1 = full volume
const EFFECTS_VOLUME = 0.8;

const Sound = (() => {
  let ctx = null;          // the browser's audio engine (created on first click)
  let master = null;       // master volume, used for mute
  let muted = false;
  try { muted = localStorage.getItem("floorMuted") === "1"; } catch (e) {}

  // Browsers only allow sound after the user clicks something,
  // so this is called from a button click (Confirm in the "Who's starting?" popup).
  function unlock() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  // ---------- Helpers for generated sounds ----------

  // Play one note. freq = pitch in Hz, start = seconds from now, length in seconds.
  function tone(freq, start, length, { type = "sine", volume = 0.3, slideTo = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume * EFFECTS_VOLUME, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  // A short burst of "hiss" (used for the hi-hat in the music).
  function noise(atTime, length, volume, out) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, atTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + length);
    src.connect(filter).connect(gain).connect(out);
    src.start(atTime);
  }

  // ---------- Playing sound files (if any are set above) ----------

  const fileCache = {};
  function playFile(name, { loop = false, volume = EFFECTS_VOLUME } = {}) {
    const path = SOUND_FILES[name];
    if (!path) return null;
    let audio = fileCache[name];
    if (!audio) {
      audio = new Audio(path);
      fileCache[name] = audio;
    }
    audio.loop = loop;
    audio.volume = muted ? 0 : volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return audio;
  }

  // ---------- Sound effects ----------

  function countdownBeep() {
    if (playFile("countdownBeep")) return;
    tone(660, 0, 0.18, { type: "square", volume: 0.18 });
  }

  function countdownGo() {
    if (playFile("countdownGo")) return;
    // A bright three-note chord.
    [880, 1109, 1319].forEach(f => tone(f, 0, 0.7, { type: "square", volume: 0.12 }));
  }

  function correct() {
    if (playFile("correct")) return;
    // Quick rising "ding-ding!"
    tone(988, 0, 0.18, { type: "triangle", volume: 0.4 });
    tone(1319, 0.1, 0.4, { type: "triangle", volume: 0.4 });
  }

  function wrong() {
    if (playFile("wrong")) return;
    // Low buzzer: two slightly-out-of-tune notes sound harsh together.
    tone(140, 0, 0.5, { type: "sawtooth", volume: 0.22 });
    tone(147, 0, 0.5, { type: "sawtooth", volume: 0.22 });
  }

  function timeUp() {
    if (playFile("timeUp")) return;
    // Long falling buzzer.
    tone(220, 0, 1.2, { type: "sawtooth", volume: 0.25, slideTo: 80 });
    tone(226, 0, 1.2, { type: "sawtooth", volume: 0.25, slideTo: 82 });
  }

  // ---------- Background music ----------
  // A tense loop at 128 beats per minute: low "heartbeat" kick, ticking hi-hat
  // and a minor-key bass line. Notes are scheduled slightly ahead of time
  // so the rhythm stays steady.

  const BPM = 128;
  const STEP = 60 / BPM / 2;                // one step = half a beat
  const BASS = [55, 55, 65.4, 55, 82.4, 55, 73.4, 61.7]; // A, A, C, A, E, A, D, B (low notes)
  let musicGain = null;
  let musicTimer = null;
  let nextStepTime = 0;
  let stepIndex = 0;
  let musicFile = null;

  function scheduleStep(step, t) {
    // Kick drum on every beat (a quick low "thump").
    if (step % 2 === 0) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(g).connect(musicGain);
      osc.start(t);
      osc.stop(t + 0.3);
    }
    // Hi-hat tick on every step, louder on the off-beat.
    noise(t, 0.04, step % 2 ? 0.25 : 0.1, musicGain);
    // Bass note.
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    bass.type = "sawtooth";
    bass.frequency.value = BASS[step % BASS.length];
    filter.type = "lowpass";
    filter.frequency.value = 500;
    bg.gain.setValueAtTime(0.35, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + STEP * 0.9);
    bass.connect(filter).connect(bg).connect(musicGain);
    bass.start(t);
    bass.stop(t + STEP);
    // A high "tension" note every 2 bars.
    if (step % 16 === 0) {
      tone(880, t - ctx.currentTime, STEP * 6, { type: "sine", volume: 0.05 });
    }
  }

  function startMusic() {
    stopMusic();
    musicFile = playFile("music", { loop: true, volume: MUSIC_VOLUME });
    if (musicFile || !ctx) return;
    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(master);
    nextStepTime = ctx.currentTime + 0.05;
    stepIndex = 0;
    musicTimer = setInterval(() => {
      while (nextStepTime < ctx.currentTime + 0.12) {
        scheduleStep(stepIndex, nextStepTime);
        nextStepTime += STEP;
        stepIndex++;
      }
    }, 25);
  }

  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    if (musicGain) {
      // Fade out quickly instead of cutting off.
      musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      const old = musicGain;
      setTimeout(() => old.disconnect(), 300);
      musicGain = null;
    }
    if (musicFile) {
      musicFile.pause();
      musicFile = null;
    }
  }

  // ---------- Mute ----------

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem("floorMuted", muted ? "1" : "0"); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 1;
    Object.values(fileCache).forEach(a => {
      a.volume = muted ? 0 : (a.loop ? MUSIC_VOLUME : EFFECTS_VOLUME);
    });
  }

  return {
    unlock, countdownBeep, countdownGo, correct, wrong, timeUp,
    startMusic, stopMusic,
    isMuted: () => muted,
    toggleMute: () => setMuted(!muted)
  };
})();
