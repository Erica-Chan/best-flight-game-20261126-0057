// Screenshot scenes: each one flies the real flight model forward from a
// fresh start with a simple autopilot — steer at the next target, hold
// speed, mind the ground — so the frame is what a short flight really looks
// like, and the same seed always gives the same frame. No scene teleports,
// poses or fakes a state the game cannot reach.
import { STEP } from './config.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

// Autopilot controls for one step: bank toward the target bearing, pitch
// toward the target altitude, throttle to hold the cruise speed. It never
// flies below the terrain ahead plus a clearance margin, unless the caller
// passes clearance 0 (a landing final, where the runway is the ground).
export function autopilotControls(s, target, heightAt, cruise = 72, clearance = 55) {
  const dx = target.x - s.x;
  const dz = target.z - s.z;
  const desiredHeading = Math.atan2(dx, -dz);
  const headingErr = wrapAngle(desiredHeading - s.heading);
  const desiredBank = clamp(headingErr * 1.2, -0.75, 0.75);
  let wantAlt = target.y;
  if (clearance > 0 && heightAt) {
    // Ground 350 m ahead along the nose, under the target, and — the one
    // that matters on a descent — right under the aircraft.
    const aheadX = s.x + Math.sin(s.heading) * 350;
    const aheadZ = s.z - Math.cos(s.heading) * 350;
    wantAlt = Math.max(
      wantAlt,
      heightAt(aheadX, aheadZ) + clearance,
      heightAt(target.x, target.z) + 40,
      heightAt(s.x, s.z) + 45,
    );
  }
  const altErr = wantAlt - s.y;
  const desiredPitch = clamp(altErr * 0.004, -0.3, 0.3);
  return {
    throttle: s.speed < cruise - 6 ? 1 : s.speed > cruise + 6 ? -1 : 0,
    pitch: clamp((desiredPitch - s.pitch) * 3, -1, 1),
    roll: clamp((desiredBank - s.bank) * 2.5, -1, 1),
    yaw: clamp(headingErr * 0.8, -1, 1),
  };
}

function fly(driver, seconds, pickTarget, cruise, clearance, stopNear) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const s = driver.flight.state;
    if (s.status === 'crashed' || s.status === 'complete') break;
    const target = pickTarget(driver);
    if (!target) break;
    // Waypoint legs end on arrival, not on the clock: flying past a
    // waypoint just makes the autopilot turn the whole aircraft around.
    if (stopNear) {
      const d = Math.hypot(target.x - s.x, target.y - s.y, target.z - s.z);
      if (d < stopNear) break;
    }
    driver.step(STEP, autopilotControls(s, target, driver.heightAt, cruise, clearance));
  }
}

export function stageShot(name, driver) {
  // driver: { flight, rings, heightAt, reset(missionIndex), step(dt, controls) }
  if (name === 'cockpit') {
    driver.reset(0);
    driver.cameraMode = 'cockpit';
    // Climb straight ahead first: the valley walls are high, and a turn
    // south at low altitude flies into them. Then join the final.
    fly(driver, 12, () => ({ x: 0, y: 380, z: 300 }), undefined, undefined, 160);
    fly(driver, 30, () => ({ x: 0, y: 300, z: 2200 }), undefined, undefined, 160);
    fly(driver, 20, () => ({ x: 0, y: 130, z: 1150 }), undefined, undefined, 140);
    // Settle on the centreline so the runway sits ahead, not in a turn.
    fly(driver, 16, () => ({ x: 0, y: 120, z: 800 }), undefined, undefined, 120);
    fly(driver, 8, () => ({ x: 0, y: 120, z: 500 }), undefined, undefined, 120);
    return { screen: 'play', cameraMode: 'cockpit', overlay: 'none' };
  }
  if (name === 'ring') {
    driver.reset(0);
    // Fly the course until two rings are banked, then one more breath so
    // the score toast is on screen and the next ring glows ahead.
    const steps = Math.floor(75 / STEP);
    for (let i = 0; i < steps; i += 1) {
      const s = driver.flight.state;
      if (s.status === 'crashed' || s.status === 'complete' || s.ringsPassed >= 2) break;
      const target = driver.rings.nextTarget() ?? { x: 0, y: 120, z: 620 };
      driver.step(STEP, autopilotControls(s, target, driver.heightAt));
    }
    fly(driver, 1.2, (d) => d.rings.nextTarget() ?? { x: 0, y: 120, z: 620 });
    return { screen: 'play', cameraMode: 'chase', overlay: 'none' };
  }
  if (name === 'landing') {
    driver.reset(0);
    // Climb straight ahead first, then a high downwind leg south over the
    // sea — the turn back north happens high, over flat water, with room
    // to overshoot. After that the final is one long straight run in:
    // level off, settle on the centreline, then two shallow steps down.
    fly(driver, 12, () => ({ x: 0, y: 380, z: 300 }), undefined, undefined, 160);
    fly(driver, 30, () => ({ x: 0, y: 300, z: 2200 }), undefined, undefined, 160);
    fly(driver, 25, () => ({ x: 0, y: 280, z: 1400 }), undefined, undefined, 120);
    // Two straight, shallow steps in — no descending turn: by the last
    // step the wings are level and the centreline is under the nose.
    fly(driver, 25, () => ({ x: 0, y: 220, z: 1500 }), undefined, undefined, 120);
    fly(driver, 20, () => ({ x: 0, y: 120, z: 900 }), undefined, undefined, 60);
    const steps = Math.floor(120 / STEP);
    for (let i = 0; i < steps; i += 1) {
      const s = driver.flight.state;
      if (s.status === 'landed' || s.status === 'complete' || s.status === 'crashed') break;
      // Aim at the strip itself (y 20, below the asphalt): the touchdown
      // check fires at 2.4 m above the ground, and a proportional controller
      // aiming at the surface only ever asymptotes toward it. But never
      // descend onto the grass: hold 80 m until the centreline is under
      // the nose (the strip is 23 m either side, plus 6 m of margin in the
      // touchdown check — 29 m is the real edge).
      const aimY = Math.abs(s.x) > 29 ? 80 : 20;
      // Aim up the strip (z 500), not at its centre: the glide from 90 m
      // needs 500 m of runway to stay shallow enough to flare.
      const c = autopilotControls(s, { x: 0, y: aimY, z: 500 }, driver.heightAt, 50, 0);
      // Small banks only in the flare: a banked touchdown is a hard one.
      // Straighten the nose with the rudder instead, so the wheels meet
      // the strip pointing down the runway, not across it.
      if (driver.flight.altitudeAGL() < 30) {
        c.roll = Math.max(-0.35, Math.min(0.35, c.roll));
        c.yaw = Math.max(-1, Math.min(1, wrapAngle(0 - s.heading) * 1.2));
      }
      // On the ground: cut the power, wings level, roll to a stop on the strip.
      if (driver.flight.altitudeAGL() < 5) {
        c.throttle = -1;
        c.pitch = 0;
        c.roll = 0;
      }
      driver.step(STEP, c);
    }
    const s = driver.flight.state;
    if (s.status === 'landed' || s.status === 'complete') {
      // No debrief card: the HUD already says SCORE 0250 / FUEL 100% /
      // DAMAGE 0%, and the LANDED toast tells the story — the plane itself
      // should fill the frame, not a panel over it.
      return { screen: 'play', cameraMode: 'chase', overlay: 'none' };
    }
    // The approach did not settle: show the low final instead of a crash.
    return { screen: 'play', cameraMode: 'chase', overlay: 'none' };
  }
  // Default: cover. Chase the rings down the fjord: at ~30 s the jet is
  // mid-fjord, water ahead, walls both sides, the next ring in the open.
  driver.reset(0);
  fly(driver, 30, (d) => d.rings.nextTarget() ?? { x: 0, y: 120, z: 620 });
  return { screen: 'play', cameraMode: 'chase', overlay: 'none' };
}
