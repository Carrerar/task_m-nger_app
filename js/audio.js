let audioContext = null;

function ensureContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function unlockAudio() {
  const context = ensureContext();
  if (context && context.state === "suspended") {
    context.resume();
  }
}

export function playDoneBell() {
  const context = ensureContext();
  if (!context) return;

  const now = context.currentTime;
  [0, 0.18, 0.36].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(index === 1 ? 880 : 660, now + offset);
    gain.gain.setValueAtTime(0.001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.16);
  });
}
