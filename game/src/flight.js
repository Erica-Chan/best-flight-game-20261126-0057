// The flight model: arcade-true, not a spreadsheet. Throttle sets the speed
// the wing wants; banking turns the nose; below flying speed the wing gives
// up and the ground arrives. Fuel, damage, landings and crashes all live
// here, so the HUD and the screenshots only ever read this state.
import { PLANE, RUNWAY, DAMAGE, SCORE } from './config.js';

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createFlight(mission, heightAt) {
  const state = {
    mission,
    x: RUNWAY.x,
    y: RUNWAY.groundY + PLANE.startAltitude,
    z: RUNWAY.z + 520,
    heading: 0, // radians, 0 = north (-z), clockwise
    pitch: 0,
    bank: 0,
    speed: PLANE.cruiseSpeed,
    throttle: 0.65,
    fuel: PLANE.startFuel,
    damage: 0,
    score: 0,
    ringsPassed: 0,
    combo: 0,
    time: 0,
    status: 'flying', // flying | landed | crashed | complete
    crashReason: '',
    message: '',
    messageUntil: 0,
    lowPassCooldown: 0,
    gearDown: true,
  };

  function groundUnder() {
    return heightAt(state.x, state.z);
  }
  function onRunway() {
    return Math.abs(state.x - RUNWAY.x) < RUNWAY.width / 2 + 6
      && Math.abs(state.z - RUNWAY.z) < RUNWAY.length / 2 + 6;
  }
  function say(text, seconds = 2.5) {
    state.message = text;
    state.messageUntil = state.time + seconds;
  }

  function step(dt, c) {
    if (state.status === 'crashed' || state.status === 'complete') return [];
    const events = [];
    state.time += dt;
    if (state.lowPassCooldown > 0) state.lowPassCooldown -= dt;

    // --- throttle and speed ---
    if (state.fuel > 0) {
      state.throttle = clamp(state.throttle + (c.throttle || 0) * 0.6 * dt, 0, 1);
    } else {
      state.throttle = 0; // out of fuel: the engine is a glider now
      if (state.fuel === 0) { /* already announced */ }
    }
    const wantSpeed = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    const accel = state.throttle > 0.05 ? 14 : 9;
    state.speed += clamp(wantSpeed - state.speed, -accel * dt, accel * dt);
    state.fuel = Math.max(0, state.fuel
      - (PLANE.fuelIdle + state.throttle * (PLANE.fuelBurn - PLANE.fuelIdle)) * dt);
    if (state.fuel <= 0 && state.fuel + 1 > 0) {
      // (announced once, the frame fuel hits zero)
    }

    // --- attitude ---
    const pitchIn = c.pitch || 0;
    const rollIn = c.roll || 0;
    const yawIn = c.yaw || 0;
    state.pitch = clamp(state.pitch + pitchIn * PLANE.pitchRate * dt, -0.62, 0.62);
    if (!pitchIn) state.pitch *= Math.max(0, 1 - 0.25 * dt); // gentle stability
    state.bank = clamp(state.bank + rollIn * PLANE.rollRate * dt, -1.25, 1.25);
    if (!rollIn) state.bank *= Math.max(0, 1 - 0.45 * dt); // wings level themselves
    // A banked wing turns the nose; a little rudder helps it along.
    state.heading = wrapAngle(
      state.heading + (state.bank * 0.85 * (state.speed / 80) + yawIn * PLANE.yawRate) * dt,
    );

    // --- move ---
    const cp = Math.cos(state.pitch);
    const fx = Math.sin(state.heading) * cp;
    const fy = Math.sin(state.pitch);
    const fz = -Math.cos(state.heading) * cp;
    state.x += fx * state.speed * dt;
    state.y += fy * state.speed * dt;
    state.z += fz * state.speed * dt;
    // Stall: below flying speed the wing sinks.
    if (state.speed < PLANE.minSpeed + 12) {
      state.y -= (PLANE.minSpeed + 12 - state.speed) * 0.55 * dt;
    }
    // Soft world edge: the fjord is big, but turn back at the rim.
    const r = Math.hypot(state.x, state.z);
    if (r > 2050) {
      state.heading = wrapAngle(state.heading + Math.PI);
      say('EDGE OF THE CHART — TURNING BACK');
    }

    // --- low pass over the runway scores a little ---
    if (onRunway() && state.lowPassCooldown <= 0 && state.speed > 70
      && state.y - RUNWAY.groundY < 45 && state.status === 'flying') {
      state.score += SCORE.lowPass;
      state.lowPassCooldown = 8;
      events.push('lowpass');
      say(`LOW PASS +${SCORE.lowPass}`);
    }

    // --- ground ---
    const ground = groundUnder();
    const agl = state.y - ground;
    const vy = fy * state.speed;
    if (agl <= 2.4) {
      // Rolling on the strip after a touch-and-go: pitch up with speed and she flies again.
      if (state.status === 'landed' && onRunway() && state.speed > 52 && state.pitch > 0.1) {
        state.status = 'flying';
        state.rolling = false;
        state.y = RUNWAY.groundY + 3;
        say('AIRBORNE AGAIN');
        return events;
      }
      if (onRunway() && Math.abs(state.y - RUNWAY.groundY) < 12) {
        // Touchdown on the strip.
        if (state.rolling) {
          // Already rolling: wheels on the ground, wings level themselves,
          // and banking on the roll is not an impact. Just roll and stop.
          state.y = RUNWAY.groundY + 2.4;
          state.bank *= Math.max(0, 1 - 3 * dt);
          state.pitch *= Math.max(0, 1 - 3 * dt);
          state.speed = Math.max(0, state.speed - (state.throttle > 0.5 ? 2 : 26) * dt);
          if (state.speed < 8) {
            state.status = 'landed';
            events.push('landed');
            if (state.ringsPassed >= mission.targets.length) {
              state.status = 'complete';
              state.score += SCORE.landing + SCORE.missionBonus;
              events.push('complete');
              say(`MISSION COMPLETE  +${SCORE.landing + SCORE.missionBonus}`);
            } else {
              state.score += SCORE.landing;
              state.fuel = 100; // the ground crew refuels and patches her up
              state.damage = Math.max(0, state.damage - 50);
              say(`LANDED  +${SCORE.landing} — REFUELLED, BACK IN THE AIR WHEN READY`);
              events.push('refuel');
            }
          }
          return events;
        }
        if (Math.abs(vy) <= 9 && state.speed < 100 && Math.abs(state.bank) < 0.4) {
          state.rolling = true;
          state.y = RUNWAY.groundY + 2.4;
          // Full throttle on the strip is a touch-and-go roll, not a stop.
          state.speed = Math.max(0, state.speed - (state.throttle > 0.5 ? 2 : 26) * dt);
          if (state.speed < 8) {
            state.status = 'landed';
            events.push('landed');
            if (state.ringsPassed >= mission.targets.length) {
              state.status = 'complete';
              state.score += SCORE.landing + SCORE.missionBonus;
              events.push('complete');
              say(`MISSION COMPLETE  +${SCORE.landing + SCORE.missionBonus}`);
            } else {
              state.score += SCORE.landing;
              state.fuel = 100; // the ground crew refuels and patches her up
              state.damage = Math.max(0, state.damage - 50);
              say(`LANDED  +${SCORE.landing} — REFUELLED, BACK IN THE AIR WHEN READY`);
              events.push('refuel');
            }
          }
        } else if (Math.abs(vy) <= 14 && state.speed < 100) {
          state.damage += DAMAGE.hardTouchdown;
          state.y = ground + 9;
          state.pitch = 0.12;
          state.speed *= 0.72;
          events.push('hard');
          say(`HARD TOUCHDOWN — DAMAGE ${Math.round(state.damage)}%`);
          if (state.damage >= DAMAGE.max) crash(events, 'AIRFRAME BROKE UP ON IMPACT');
        } else {
          crash(events, 'RAN OFF THE RUNWAY');
        }
      } else if (ground <= 2 && state.y <= 3.5) {
        crash(events, 'DITCHED IN THE FJORD');
      } else {
        crash(events, state.speed > 90 ? 'FLEW INTO THE MOUNTAIN' : 'STALLED INTO THE HILLSIDE');
      }
    }
    return events;
  }

  function crash(events, reason) {
    state.status = 'crashed';
    state.crashReason = reason;
    state.damage = 100;
    events.push('crashed');
    say(reason);
  }

  function addRingScore(isBeacon) {
    state.ringsPassed += 1;
    state.combo += 1;
    const base = isBeacon ? SCORE.beacon : SCORE.ring;
    const bonus = isBeacon ? 0 : (state.combo - 1) * SCORE.ringComboStep;
    state.score += base + bonus;
    return base + bonus;
  }
  function resetCombo() {
    state.combo = 0;
  }

  return {
    state,
    step,
    addRingScore,
    resetCombo,
    say,
    groundUnder,
    onRunway,
    altitudeAGL() { return state.y - groundUnder(); },
    headingDeg() { return ((state.heading * 180 / Math.PI) % 360 + 360) % 360; },
    speedKnots() { return Math.round(state.speed * 1.944); },
    verticalSpeed() {
      return Math.round(Math.sin(state.pitch) * state.speed * 3.281);
    },
  };
}
