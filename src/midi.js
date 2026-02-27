/**
 * VizMix - MIDI Manager with MIDI Learn
 * v1.0.0
 */

let midiAccess = null;
let callbacks = {};
let isEnabled = false;

// Fixed mappings (default)
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

// ── MIDI Learn ─────────────────────────────────────────────────────────────
const LEARN_STORAGE_KEY = 'vizmix-midi-learn';
let learnMode = false;
let learnTarget = null; // { targetId, type: 'cc'|'note', range }
let learnMappings = {}; // { "cc-{ch}-{num}": { targetId, range }, "note-{ch}-{num}": { targetId, type:'trigger' } }

// Learnable targets registry: targetId → { element, type: 'slider'|'button', range }
const learnableTargets = {};

export function registerLearnableTarget(targetId, element, type, range) {
  learnableTargets[targetId] = { element, type, range };
}

function loadLearnMappings() {
  try {
    const saved = localStorage.getItem(LEARN_STORAGE_KEY);
    if (saved) {
      learnMappings = JSON.parse(saved);
      console.log('[MIDI Learn] Restored mappings:', Object.keys(learnMappings).length);
    }
  } catch (e) {
    console.warn('[MIDI Learn] Failed to load mappings:', e);
  }
}

function saveLearnMappings() {
  try {
    localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(learnMappings));
  } catch (e) {
    console.warn('[MIDI Learn] Failed to save mappings:', e);
  }
}

export function isLearnMode() {
  return learnMode;
}

export function toggleLearnMode() {
  learnMode = !learnMode;
  learnTarget = null;

  // Highlight all learnable elements
  Object.values(learnableTargets).forEach(t => {
    if (t.element) {
      t.element.classList.toggle('midi-learnable', learnMode);
    }
  });

  if (learnMode) {
    // Add click listeners for target selection
    Object.entries(learnableTargets).forEach(([targetId, t]) => {
      if (t.element) {
        t.element._midiLearnClick = () => {
          // Select this as learn target
          Object.values(learnableTargets).forEach(lt => {
            if (lt.element) lt.element.classList.remove('midi-learn-selected');
          });
          t.element.classList.add('midi-learn-selected');
          learnTarget = {
            targetId,
            type: t.type === 'button' ? 'note' : 'cc',
            range: t.range || [0, 100],
          };
          showMidiIndicator(`Learn: waiting for MIDI input...`);
          console.log(`[MIDI Learn] Target selected: ${targetId}`);
        };
        t.element.addEventListener('click', t.element._midiLearnClick);
      }
    });
    showMidiIndicator('MIDI Learn: click a control');
  } else {
    // Remove click listeners
    Object.values(learnableTargets).forEach(t => {
      if (t.element && t.element._midiLearnClick) {
        t.element.removeEventListener('click', t.element._midiLearnClick);
        t.element._midiLearnClick = null;
      }
      if (t.element) {
        t.element.classList.remove('midi-learn-selected');
      }
    });
  }

  return learnMode;
}

export function clearLearnMapping(targetId) {
  const keysToRemove = [];
  for (const [key, mapping] of Object.entries(learnMappings)) {
    if (mapping.targetId === targetId) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => delete learnMappings[k]);
  saveLearnMappings();
  console.log(`[MIDI Learn] Cleared mapping for ${targetId}`);
}

export function clearAllLearnMappings() {
  learnMappings = {};
  saveLearnMappings();
  console.log('[MIDI Learn] All mappings cleared');
}

export function getLearnMappings() {
  return { ...learnMappings };
}
// ─────────────────────────────────────────────────────────────────────────────

export async function initMidi(actionCallbacks) {
  callbacks = actionCallbacks;
  loadLearnMappings();

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
  const channel = status & 0x0F;

  // ── MIDI Learn mode: capture incoming MIDI ──
  if (learnMode && learnTarget) {
    if (msgType === 0xB0) {
      // CC → map to target
      const key = `cc-${channel}-${data1}`;
      learnMappings[key] = {
        targetId: learnTarget.targetId,
        range: learnTarget.range,
      };
      saveLearnMappings();
      showMidiIndicator(`Learned: CC${data1} → ${learnTarget.targetId}`);
      console.log(`[MIDI Learn] Mapped CC${data1} → ${learnTarget.targetId}`);
      learnTarget = null;
      // Deselect highlight
      Object.values(learnableTargets).forEach(t => {
        if (t.element) t.element.classList.remove('midi-learn-selected');
      });
      return;
    } else if (msgType === 0x90 && data2 > 0) {
      // Note → map to target as trigger
      const key = `note-${channel}-${data1}`;
      learnMappings[key] = {
        targetId: learnTarget.targetId,
        type: 'trigger',
      };
      saveLearnMappings();
      showMidiIndicator(`Learned: Note${data1} → ${learnTarget.targetId}`);
      console.log(`[MIDI Learn] Mapped Note${data1} → ${learnTarget.targetId}`);
      learnTarget = null;
      Object.values(learnableTargets).forEach(t => {
        if (t.element) t.element.classList.remove('midi-learn-selected');
      });
      return;
    }
  }

  // ── Normal mode: check learn mappings first, then fixed mappings ──
  if (msgType === 0x90 && data2 > 0) {
    // Note On
    const learnKey = `note-${channel}-${data1}`;
    const learned = learnMappings[learnKey];
    if (learned && callbacks[learned.targetId]) {
      callbacks[learned.targetId]();
      showMidiIndicator(`Note ${data1} → ${learned.targetId}`);
      return;
    }
    // Fixed mapping
    const mapping = NOTE_MAP[data1];
    if (mapping && callbacks[mapping.action]) {
      callbacks[mapping.action](mapping.value);
      showMidiIndicator(`Note ${data1}`);
    }
  } else if (msgType === 0xB0) {
    // Control Change
    const learnKey = `cc-${channel}-${data1}`;
    const learned = learnMappings[learnKey];
    if (learned && callbacks[learned.targetId]) {
      const [min, max] = learned.range || [0, 100];
      const value = Math.round(min + (data2 / 127) * (max - min));
      callbacks[learned.targetId](value);
      showMidiIndicator(`CC${data1}: ${value} → ${learned.targetId}`);
      return;
    }
    // Fixed mapping
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
