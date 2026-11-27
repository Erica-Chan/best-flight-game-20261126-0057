// The camera rig: a chase camera that trails the jet without ever fighting
// it, and a cockpit camera that sits where the pilot sits. Both smooth their
// motion so a bank or a gust never whips the view.
import * as THREE from 'three';

export function createCameraRig(camera, aircraft) {
  const chasePos = new THREE.Vector3(0, 300, 700);
  const lookTarget = new THREE.Vector3(0, 200, 0);
  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let mode = 'chase'; // chase | cockpit
  let lookYaw = 0;
  let lookPitch = 0;

  function forwardOf(s) {
    const cp = Math.cos(s.pitch);
    return fwd.set(Math.sin(s.heading) * cp, Math.sin(s.pitch), -Math.cos(s.heading) * cp);
  }

  function update(dt, s) {
    const f = forwardOf(s);
    if (mode === 'cockpit') {
      aircraft.visible = false;
      // Sit just behind the canopy glass, eyes forward.
      camera.position.set(
        s.x + f.x * 1.5,
        s.y + 1.15,
        s.z + f.z * 1.5,
      );
      // Mouse look: a little freedom without losing the nose.
      const yaw = lookYaw * 0.6;
      const pitch = lookPitch * 0.4;
      tmp.set(s.x, s.y, s.z)
        .addScaledVector(f, 120)
        .add(new THREE.Vector3(Math.cos(s.heading) * yaw * 40, pitch * 40, Math.sin(s.heading) * yaw * 40));
      camera.up.set(0, 1, 0);
      camera.lookAt(tmp);
      camera.rotation.z += -s.bank * 0.12; // the horizon tilts a touch with the wing
      return;
    }
    aircraft.visible = true;
    // Chase: trail behind and above, easing into place. A touch to the
    // side, so the jet shows its flank and canopy, not just its tail.
    const back = 42 + s.speed * 0.09;
    const height = 7 + s.speed * 0.02;
    const rightX = Math.cos(s.heading);
    const rightZ = Math.sin(s.heading);
    tmp.set(s.x - f.x * back + rightX * 7, s.y + height, s.z - f.z * back + rightZ * 7);
    // Never let the camera sink under the terrain.
    const k = 1 - Math.exp(-dt * 4.5);
    chasePos.lerp(tmp, k);
    camera.position.copy(chasePos);
    lookTarget.lerp(new THREE.Vector3(s.x + f.x * 60, s.y + f.y * 60 + 2, s.z + f.z * 60), 1 - Math.exp(-dt * 7));
    camera.up.set(Math.sin(s.bank) * 0.3, 1, 0);
    camera.lookAt(lookTarget);
  }

  return {
    get mode() { return mode; },
    toggle() {
      mode = mode === 'chase' ? 'cockpit' : 'chase';
      return mode;
    },
    setMode(m) { mode = m; },
    setLook(yaw, pitch) { lookYaw = yaw; lookPitch = pitch; },
    snapTo(s) {
      const f = forwardOf(s);
      chasePos.set(s.x - f.x * 32, s.y + 9, s.z - f.z * 32);
      lookTarget.set(s.x + f.x * 60, s.y + 2, s.z + f.z * 60);
      camera.position.copy(chasePos);
      camera.lookAt(lookTarget);
    },
    update,
  };
}
