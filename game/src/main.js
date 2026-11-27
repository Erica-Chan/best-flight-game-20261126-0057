// Boot and the one loop: input is read every frame, the flight model
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title (with a live attract flight), play, paused and end.
// ?shot=cover|ring|cockpit|landing stages that scene instead of the loop,
// paints it twice and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { STEP, MISSIONS, RUNWAY } from './config.js';
import { buildTerrain } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { createFlight } from './flight.js';
import { buildRings } from './rings.js';
import { createCameraRig } from './cameraRig.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot, autopilotControls } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const BEST_KEY = 'fjord-run-best';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 9000);
const terrain = buildTerrain(scene);
const aircraft = buildAircraft();
scene.add(aircraft);

const hud = createHud();
const input = createInput(canvas);
const audio = createAudio();
const cameraRig = createCameraRig(camera, aircraft);

let flight = null;
let rings = null;
let missionIndex = 0;
let screen = 'title'; // title | play | paused | end
let lastGroundOverlay = '';
let best = 0;
try { best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { best = 0; }
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
}

function reset(missionIdx) {
  missionIndex = missionIdx;
  if (rings) scene.remove(rings.group);
  flight = createFlight(MISSIONS[missionIdx], terrain.heightAt);
  rings = buildRings(scene, MISSIONS[missionIdx]);
  cameraRig.snapTo(flight.state);
}

function stepWorld(dt, controls) {
  const events = flight.step(dt, controls);
  const hit = rings.check(flight.state, flight);
  if (hit) {
    flight.say(`${hit.isBeacon ? 'BEACON' : 'RING'} ${hit.index + 1}/${hit.total}  +${hit.points}`);
    audio.ring();
  }
  for (const ev of events) {
    if (ev === 'landed') audio.land();
    else if (ev === 'crashed') audio.crash();
    else if (ev === 'complete') audio.complete();
  }
  return events;
}

// The driver the screenshot scenes use: the same reset/step the game uses.
const driver = {
  get flight() { return flight; },
  get rings() { return rings; },
  heightAt: (x, z) => terrain.heightAt(x, z),
  reset: (mi) => reset(mi),
  step: (dt, controls) => stepWorld(dt, controls),
  set cameraMode(m) { cameraRig.setMode(m); },
};

function debriefHtml() {
  const s = flight.state;
  const t = Math.floor(s.time);
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return `SCORE <b>${s.score}</b> &nbsp;•&nbsp; ${s.ringsPassed}/${s.mission.targets.length} targets<br>
    TIME ${mm}:${ss} &nbsp;•&nbsp; FUEL ${Math.round(s.fuel)}% &nbsp;•&nbsp; DAMAGE ${Math.round(s.damage)}%<br>
    BEST ${Math.max(best, s.score)}${s.crashReason ? `<br><span class="bad">${s.crashReason}</span>` : ''}`;
}

function startMission(mi) {
  audio.ensure();
  reset(mi);
  screen = 'play';
  lastGroundOverlay = '';
  hud.showOverlay('none');
  flight.say(`${MISSIONS[mi].name} — FLY THE ${MISSIONS[mi].id === 'island-tour' ? 'BEACONS' : 'RINGS'}, THEN LAND`);
}

function handleActions() {
  for (const action of input.takeActions()) {
    if (action === 'mute') {
      audio.toggleMute();
    } else if (action === 'camera' && screen === 'play') {
      cameraRig.toggle();
    } else if (action === 'restart') {
      startMission(missionIndex);
    } else if (action === 'pause') {
      if (screen === 'play') {
        screen = 'paused';
        hud.showOverlay('paused');
      } else if (screen === 'paused') {
        screen = 'play';
        hud.showOverlay('none');
      }
    } else if (action === 'confirm') {
      if (screen === 'title') startMission(missionIndex);
      else if (screen === 'end') startMission(missionIndex);
    } else if (action.startsWith('mission:')) {
      const mi = Number(action.split(':')[1]);
      if (screen === 'title' || screen === 'end') startMission(mi);
      else if (screen === 'play') { missionIndex = mi; }
    }
  }
}

function syncAircraft() {
  const s = flight.state;
  aircraft.position.set(s.x, s.y, s.z);
  aircraft.rotation.set(s.pitch, -s.heading, -s.bank, 'YXZ');
  const glow = aircraft.userData.engineGlow;
  const g = 0.6 + s.throttle * 1.6;
  glow.scale.set(g, g, 1);
  glow.material.color.setHSL(0.08, 1, 0.55 + s.throttle * 0.15);
  // Strobe blinks once a second.
  aircraft.userData.navLights[2].visible = (s.time % 1) < 0.12;
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

reset(0);
hud.showOverlay('title');

// Mission buttons on the title overlay.
for (const btn of document.querySelectorAll('[data-mission]')) {
  btn.addEventListener('click', () => startMission(Number(btn.dataset.mission)));
}
document.getElementById('overlay').addEventListener('click', (e) => {
  if (e.target.id === 'overlay' && screen === 'title') startMission(missionIndex);
});

function runShot(name) {
  const staged = stageShot(name, driver);
  cameraRig.setMode(staged.cameraMode);
  syncAircraft();
  cameraRig.snapTo(flight.state);
  cameraRig.update(0.5, flight.state);
  terrain.update(0.1);
  hud.update(flight, rings, cameraRig.mode, 'play');
  if (staged.overlay === 'landed') {
    hud.showOverlay('landed', debriefHtml());
  } else {
    hud.showOverlay('none');
  }
  let painted = 0;
  function paint() {
    syncAircraft();
    cameraRig.update(0.016, flight.state);
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) {
  runShot(shot);
} else {
  let last = performance.now();
  let accumulator = 0;
  const MAX_FRAME = 0.25;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    const look = input.look();
    cameraRig.setLook(look.yaw, look.pitch);
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (screen === 'title') {
        // Attract mode: the jet flies itself down the fjord behind the title.
        const target = rings.nextTarget() ?? { x: RUNWAY.x, y: 120, z: RUNWAY.z };
        stepWorld(STEP, autopilotControls(flight.state, target, terrain.heightAt));
        const s = flight.state;
        if (s.status === 'crashed' || s.ringsPassed >= 3) reset(0);
      } else if (screen === 'play') {
        const events = stepWorld(STEP, input.controls());
        const s = flight.state;
        if (s.status === 'crashed') {
          screen = 'end';
          if (s.score > best) { best = s.score; saveBest(best); }
          hud.showOverlay('crashed', debriefHtml());
        } else if (s.status === 'complete') {
          screen = 'end';
          if (s.score > best) { best = s.score; saveBest(best); }
          hud.showOverlay('complete', debriefHtml());
        } else if (s.status === 'landed') {
          // Show once; the panel must not sit over the runway while the
          // pilot rolls for take-off again.
          if (lastGroundOverlay !== 'landed') {
            hud.showOverlay('landed', debriefHtml());
            lastGroundOverlay = 'landed';
          }
        } else if (s.status === 'flying' && lastGroundOverlay === 'landed') {
          hud.showOverlay('none');
          lastGroundOverlay = '';
        }
      }
    }
    if (screen !== 'paused') {
      terrain.update(1 / 60);
      syncAircraft();
      cameraRig.update(1 / 60, flight.state);
      audio.update(flight.state.throttle, flight.state.speed, screen === 'play');
      hud.update(flight, rings, cameraRig.mode, screen === 'title' ? 'title' : 'play');
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

// Playtest hook: the harness reads the live state, never the DOM.
window.__game = {
  get state() {
    const s = flight.state;
    return {
      screen, mission: s.mission.id, status: s.status, score: s.score,
      ringsPassed: s.ringsPassed, fuel: Math.round(s.fuel), damage: Math.round(s.damage),
      speedKnots: Math.round(s.speed * 1.944), altitudeFt: Math.round((s.y - terrain.heightAt(s.x, s.z)) * 3.281),
      headingDeg: Math.round(((s.heading * 180 / Math.PI) % 360 + 360) % 360),
      bankDeg: Math.round(s.bank * 180 / Math.PI),
      pitchDeg: Math.round(s.pitch * 180 / Math.PI),
      groundAt: (x, z) => Math.round(terrain.heightAt(x, z)),
      nextTarget: (() => { const t = rings.nextTarget(); return t ? { x: t.x, y: t.y, z: t.z } : null; })(),
      x: Math.round(s.x), y: Math.round(s.y), z: Math.round(s.z),
    };
  },
  startMission: (mi) => startMission(mi),
};
