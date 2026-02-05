/**
 * VizMix - MIDI Manager
 * v0.6.0
 */

let midiAccess = null;
let callbacks = {};
let isEnabled = false;

const NOTE_MAP = {
  0: { action: 'bankA', value: 0 },
  1: { action: 'bankA', value: 1 },
  2: { action: 'bankA', value: 2 },
  3: { action: 'bankA', value: 3 },
  4: { action: 'bankA', value: 4 },
  5: { action: 'bankA', value: 5 },
  6: { action: 'bankA', value: 6 },
  7: { action: 'bankA', value: 7 },
  8: { action: 'bankB', value: 0 },
  9: { action: 'bankB', value: 1 },
  10: { action: 'bankB', value: 2 },
  11: { action: 'bankB', value: 3 },
  12: { action: 'bankB', value: 4 },
  13: { action: 'bankB', value: 5 },
  14: { action: 'bankB', value: 6 },
  15: { action: 'bankB', value: 7 },
  16: { action: 'autoSwitchToggle' },
  17: { action: 'tap' },
  20: { action: 'fxInvert' },
  21: { action: 'fxGrayscale' },
  22: { action: 'fxSepia' },
};

const CC_MAP = {
  1: { action: 'crossfade', range: [0, 100] },
  2: { action: 'bpm', range: [60, 200] },
  10: { action: 'fxBlur', range: [0, 100] },
  11: { action: 'fxBrightness', range: [-100, 100] },
  12: { action: 'fxContrast', range: [-100, 100] },
};

export async function initMidi(actionCallbacks) {
  callbacks = actionCallbacks;

  if (!navigator.requestMIDIAccess) {
    console.warn('Web MIDI API not supported');
    return false;
  }

  try {
    midiAccess = await navigator.requestMIDIAccess();
    midiAccess.inputs.forEach(input => {
      console.log(`MIDI connected: ${input.name}`);
      input.onmidimessage = handleMidiMessage;
    });

    midiAccess.onstatechange = (e) => {
      if (e.port.type === 'input' && e.port.state === 'connected') {
        e.port.onmidimessage = handleMidiMessage;
        console.log(`MIDI connected: ${e.port.name}`);
        updateMidiStatus();
      }
      if (e.port.type === 'input' && e.port.state === 'disconnected') {
        console.log(`MIDI disconnected: ${e.port.name}`);
        updateMidiStatus();
      }
    };

    isEnabled = true;
    updateMidiStatus();
    return true;
  } catch (err) {
    console.error('MIDI access denied:', err);
    return false;
  }
}

function handleMidiMessage(e) {
  if (!isEnabled) return;

  const [status, data1, data2] = e.data;
  const msgType = status & 0xF0;

  if (msgType === 0x90 && data2 > 0) {
    // Note On
    const mapping = NOTE_MAP[data1];
    if (mapping && callbacks[mapping.action]) {
      callbacks[mapping.action](mapping.value);
      showMidiIndicator(`Note ${data1}`);
    }
  } else if (msgType === 0xB0) {
    // Control Change
    const mapping = CC_MAP[data1];
    if (mapping && callbacks[mapping.action]) {
      const [min, max] = mapping.range;
      const value = Math.round(min + (data2 / 127) * (max - min));
      callbacks[mapping.action](value);
      showMidiIndicator(`CC${data1}: ${value}`);
    }
  }
}

function showMidiIndicator(msg) {
  let el = document.getElementById('midiIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'midiIndicator';
    el.className = 'midi-indicator';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 400);
}

export function getMidiDevices() {
  if (!midiAccess) return [];
  const devices = [];
  midiAccess.inputs.forEach(input => {
    devices.push({ name: input.name, state: input.state });
  });
  return devices;
}

function updateMidiStatus() {
  const el = document.getElementById('midiDevices');
  if (!el) return;
  const devices = getMidiDevices();
  el.innerHTML = devices.length
    ? devices.map(d => `<span class="midi-device">${d.name}</span>`).join('')
    : '<span class="no-devices">No MIDI</span>';
}
