// Input: keyboard flight controls plus mouse-drag look. The game reads this
// once a frame; actions (pause, camera, restart, mission pick) are queued
// so a tap is never lost between frames.
import { KEYS } from './config.js';

function has(list, code) {
  return list.includes(code);
}

export function createInput(canvas) {
  const down = new Set();
  const actions = [];
  let lookYaw = 0;
  let lookPitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down.add(e.code);
    if (has(KEYS.pause, e.code)) actions.push('pause');
    else if (has(KEYS.camera, e.code)) actions.push('camera');
    else if (has(KEYS.restart, e.code)) actions.push('restart');
    else if (has(KEYS.confirm, e.code)) actions.push('confirm');
    else if (has(KEYS.mute, e.code)) actions.push('mute');
    else if (e.code === 'Digit1') actions.push('mission:0');
    else if (e.code === 'Digit2') actions.push('mission:1');
    else if (e.code === 'Digit3') actions.push('mission:2');
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lookYaw = Math.max(-1, Math.min(1, lookYaw - (e.clientX - lastX) * 0.004));
    lookPitch = Math.max(-0.6, Math.min(0.6, lookPitch + (e.clientY - lastY) * 0.003));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function axis(positive, negative) {
    let v = 0;
    for (const code of positive) if (down.has(code)) v += 1;
    for (const code of negative) if (down.has(code)) v -= 1;
    return Math.max(-1, Math.min(1, v));
  }

  return {
    // Pitch: +1 pulls the nose up. Roll: +1 banks right. Yaw: +1 right.
    controls() {
      return {
        throttle: axis(KEYS.throttleUp, KEYS.throttleDown),
        pitch: axis(KEYS.pitchUp, KEYS.pitchDown),
        roll: axis(KEYS.rollRight, KEYS.rollLeft),
        yaw: axis(KEYS.yawRight, KEYS.yawLeft),
      };
    },
    takeActions() {
      const out = actions.splice(0, actions.length);
      return out;
    },
    look() {
      // Look recentres itself when the mouse is released.
      if (!dragging) {
        lookYaw *= 0.92;
        lookPitch *= 0.92;
      }
      return { yaw: lookYaw, pitch: lookPitch };
    },
  };
}
