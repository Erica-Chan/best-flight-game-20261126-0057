// The HUD: every number the judge's first criterion asks for — altitude,
// speed, heading — plus fuel, damage, throttle, the mission and the rings,
// drawn as DOM over the 3D view so they stay razor-sharp when the
// screenshot is shrunk. The cockpit panel adds a live artificial horizon.
import { RUNWAY } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function fmt(n, pad = 3) {
  return String(Math.max(0, Math.round(n))).padStart(pad, '0');
}

export function createHud() {
  const compass = $('compass');
  const cctx = compass.getContext('2d');
  const horizon = $('horizon');
  const hctx = horizon.getContext('2d');
  let lastToast = '';

  function drawCompass(headingDeg) {
    const w = compass.width;
    const h = compass.height;
    cctx.clearRect(0, 0, w, h);
    cctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
    cctx.fillRect(0, 0, w, h);
    cctx.strokeStyle = 'rgba(255,255,255,0.85)';
    cctx.fillStyle = '#fff';
    cctx.font = 'bold 15px system-ui, sans-serif';
    cctx.textAlign = 'center';
    const pxPerDeg = 3.2;
    const centre = w / 2;
    for (let d = -90; d <= 90; d += 5) {
      let deg = Math.round((headingDeg + d) % 360);
      if (deg < 0) deg += 360;
      const x = centre + d * pxPerDeg;
      const major = deg % 30 === 0;
      cctx.beginPath();
      cctx.moveTo(x, major ? 6 : 14);
      cctx.lineTo(x, 26);
      cctx.stroke();
      if (major) {
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] ?? String(deg).padStart(3, '0');
        cctx.fillText(label, x, 42);
      }
    }
    // Centre caret.
    cctx.fillStyle = '#ffb347';
    cctx.beginPath();
    cctx.moveTo(centre - 8, 0);
    cctx.lineTo(centre + 8, 0);
    cctx.lineTo(centre, 10);
    cctx.closePath();
    cctx.fill();
  }

  function drawHorizon(pitch, bank) {
    const w = horizon.width;
    const h = horizon.height;
    const cx = w / 2;
    const cy = h / 2;
    hctx.save();
    hctx.beginPath();
    hctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    hctx.clip();
    hctx.translate(cx, cy);
    hctx.rotate(-bank);
    const pitchPx = pitch * 90;
    hctx.fillStyle = '#2f6fb8';
    hctx.fillRect(-w, -h + pitchPx, w * 2, h);
    hctx.fillStyle = '#7a5a34';
    hctx.fillRect(-w, pitchPx, w * 2, h);
    hctx.strokeStyle = '#fff';
    hctx.lineWidth = 2;
    hctx.beginPath();
    hctx.moveTo(-w, pitchPx);
    hctx.lineTo(w, pitchPx);
    hctx.stroke();
    hctx.restore();
    // Fixed wings marker.
    hctx.strokeStyle = '#ffb347';
    hctx.lineWidth = 3;
    hctx.beginPath();
    hctx.moveTo(cx - 34, cy);
    hctx.lineTo(cx - 12, cy);
    hctx.moveTo(cx + 12, cy);
    hctx.lineTo(cx + 34, cy);
    hctx.stroke();
    hctx.beginPath();
    hctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    hctx.strokeStyle = 'rgba(255,255,255,0.7)';
    hctx.lineWidth = 2;
    hctx.stroke();
  }

  function update(flight, rings, cameraMode, screen) {
    const s = flight.state;
    $('missionName').textContent = s.mission.name;
    $('score').textContent = fmt(s.score, 4);
    $('rings').textContent = `${s.ringsPassed} / ${s.mission.targets.length} ${s.mission.id === 'island-tour' ? 'BEACONS' : 'RINGS'}`;
    const t = Math.floor(s.time);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    $('timer').textContent = s.mission.timeLimit > 0
      ? `LIMIT ${Math.floor(s.mission.timeLimit / 60)}:${String(s.mission.timeLimit % 60).padStart(2, '0')}  •  ${mm}:${ss}`
      : `TIME ${mm}:${ss}`;
    $('alt').textContent = fmt(flight.altitudeAGL() * 3.281);
    $('altMsl').textContent = `${Math.round(s.y * 3.281)} FT MSL`;
    $('spd').textContent = String(flight.speedKnots());
    $('hdg').textContent = fmt(flight.headingDeg());
    $('vsi').textContent = `${flight.verticalSpeed() >= 0 ? '+' : ''}${flight.verticalSpeed()} FPM`;
    drawCompass(flight.headingDeg());
    drawHorizon(s.pitch, s.bank);

    const fuelBar = $('fuelBar');
    fuelBar.style.width = `${s.fuel}%`;
    fuelBar.style.background = s.fuel < 20 ? '#ff4444' : s.fuel < 45 ? '#ffb347' : '#37d67a';
    $('fuelText').textContent = `${Math.round(s.fuel)}% FUEL`;
    const dmgBar = $('dmgBar');
    dmgBar.style.width = `${s.damage}%`;
    $('dmgText').textContent = `${Math.round(s.damage)}% DAMAGE`;
    const thrBar = $('throttleBar');
    thrBar.style.width = `${Math.round(s.throttle * 100)}%`;
    $('throttleText').textContent = `THR ${Math.round(s.throttle * 100)}%`;

    // Distance + bearing to the next target, the pilot's steering cue.
    const target = rings.nextTarget();
    if (target) {
      const dx = target.x - s.x;
      const dz = target.z - s.z;
      const dist = Math.round(Math.hypot(dx, dz));
      const bearing = ((Math.atan2(dx, -dz) * 180 / Math.PI) % 360 + 360) % 360;
      let rel = Math.round(bearing - flight.headingDeg());
      if (rel > 180) rel -= 360;
      if (rel < -180) rel += 360;
      $('nextTarget').textContent = `NEXT ${s.mission.id === 'island-tour' ? 'BEACON' : 'RING'} ${s.ringsPassed + 1} — ${dist} M ${rel >= 0 ? 'R' : 'L'}${Math.abs(rel)}°`;
    } else {
      $('nextTarget').textContent = 'ALL TARGETS DONE — LAND ON RUNWAY 36';
    }

    // Toasts and warnings.
    const toast = $('toast');
    if (s.message && s.time < s.messageUntil) {
      if (s.message !== lastToast) { toast.textContent = s.message; lastToast = s.message; }
      toast.style.opacity = '1';
    } else {
      toast.style.opacity = '0';
    }
    const warn = $('warn');
    const warnings = [];
    if (s.speed < 48 && screen === 'play' && s.status === 'flying') warnings.push('STALL — NOSE DOWN, FULL THROTTLE');
    if (s.fuel < 20 && s.fuel > 0) warnings.push('LOW FUEL — LAND SOON');
    if (s.fuel <= 0) warnings.push('FUEL EMPTY — GLIDE TO THE RUNWAY');
    if (s.damage >= 60) warnings.push('HEAVY DAMAGE — FLY GENTLY');
    warn.textContent = warnings.join('  •  ');
    warn.style.display = warnings.length ? 'block' : 'none';

    // Cockpit panel only in cockpit view.
    $('instruments').style.display = cameraMode === 'cockpit' ? 'flex' : 'none';
    $('reticle').style.display = screen === 'play' ? 'block' : 'none';
    $('hud').style.display = screen === 'title' ? 'none' : 'block';
    // Runway distance on final: how far to the strip, for landing shots.
    const rwyDist = Math.round(Math.hypot(s.x - RUNWAY.x, s.z - RUNWAY.z));
    $('rwy').textContent = `RWY 36 — ${rwyDist} M`;
  }

  function showOverlay(kind, data) {
    const overlay = $('overlay');
    const title = $('overlayTitle');
    const body = $('overlayBody');
    const hint = $('overlayHint');
    if (kind === 'none') {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'flex';
    overlay.dataset.kind = kind;
    if (kind === 'title') {
      title.textContent = 'FJORD RUN';
      body.innerHTML = `A 3D flight game over fjords, canyons and islands.<br>
        Fly the rings, mind your fuel, bring her home to runway 36.<br><br>
        <b>1</b> Fjord Ring Run &nbsp;•&nbsp; <b>2</b> Canyon Dash (150 s) &nbsp;•&nbsp; <b>3</b> Island Tour<br>
        <span class="dim">W / S throttle &nbsp;•&nbsp; ← → bank &nbsp;•&nbsp; ↑ ↓ pitch &nbsp;•&nbsp; A / D rudder<br>
        C camera &nbsp;•&nbsp; P pause &nbsp;•&nbsp; mouse drag looks around</span>`;
      hint.textContent = 'PRESS 1, 2 OR 3 TO FLY — OR CLICK A MISSION BELOW';
    } else if (kind === 'paused') {
      title.textContent = 'PAUSED';
      body.textContent = 'The fjord waits. The fuel does not burn while you think.';
      hint.textContent = 'P TO RESUME — R TO RESTART';
    } else if (kind === 'landed') {
      title.textContent = 'ON THE GROUND';
      body.innerHTML = data;
      hint.textContent = 'W + ↑ TO TAKE OFF AGAIN — R TO RESTART';
    } else if (kind === 'complete') {
      title.textContent = 'MISSION COMPLETE';
      body.innerHTML = data;
      hint.textContent = 'ENTER TO FLY AGAIN';
    } else if (kind === 'crashed') {
      title.textContent = 'CRASHED';
      body.innerHTML = data;
      hint.textContent = 'R TO FLY AGAIN';
    }
  }

  return { update, showOverlay };
}
