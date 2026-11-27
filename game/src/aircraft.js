// The aircraft: a low-poly twin-tail jet trainer built from primitives, in
// a white / sunset-orange livery with a dark glass canopy. Nose points -Z,
// so the flight model can aim it with one Euler (pitch, -heading, -bank).
import * as THREE from 'three';

export function buildAircraft() {
  const group = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2ede4, roughness: 0.45, metalness: 0.25 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe85d1f, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x16283c, roughness: 0.08, metalness: 0.85,
  });
  const grey = new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.5, metalness: 0.5 });

  // Fuselage: a tapered tube, nose cone, tail cone.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 9.5, 12), white);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.4;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 3.4, 12), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -6.0;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 0.55, 2.6, 12), orange);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 6.4;
  group.add(tailCone);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 1.1, 10), dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 7.9;
  group.add(nozzle);
  // Engine glow, visible from behind at throttle.
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 12),
    new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  );
  glow.position.z = 8.46;
  glow.rotation.y = Math.PI;
  glow.name = 'engineGlow';
  group.add(glow);

  // Canopy: a stretched dark-glass dome.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), glass);
  canopy.scale.set(0.95, 0.85, 2.3);
  canopy.position.set(0, 1.05, -1.6);
  group.add(canopy);
  // Spine stripe down the back.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 7.6), orange);
  stripe.position.set(0, 1.32, 1.6);
  group.add(stripe);

  // Main wings: tapered slabs with orange tips.
  function wing(side) {
    const w = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 2.6), white);
    panel.position.x = side * 3.6;
    panel.rotation.y = side * 0.22; // sweep back
    w.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 2.0), orange);
    tip.position.x = side * 6.4;
    tip.rotation.y = side * 0.22;
    w.add(tip);
    return w;
  }
  group.add(wing(-1));
  group.add(wing(1));
  // Tailplane and twin fins.
  for (const side of [-1, 1]) {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 1.5), white);
    stab.position.set(side * 1.7, 0.15, 6.2);
    stab.rotation.y = side * 0.25;
    group.add(stab);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 2.2), orange);
    fin.position.set(side * 1.05, 1.5, 6.3);
    fin.rotation.x = -0.28;
    group.add(fin);
  }
  // Belly intakes.
  for (const side of [-1, 1]) {
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 2.6), dark);
    intake.position.set(side * 1.35, -0.75, 0.6);
    group.add(intake);
  }
  // Landing gear: nose wheel + two mains, always down (a trainer).
  function wheel(x, z) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), grey);
    leg.position.set(x, -1.7, z);
    group.add(leg);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), dark);
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(x, -2.45, z);
    group.add(tyre);
  }
  wheel(0, -3.4);
  wheel(-1.5, 1.8);
  wheel(1.5, 1.8);

  // Navigation lights: red port, green starboard, white strobe.
  const nav = [];
  function light(x, y, z, color) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    m.position.set(x, y, z);
    group.add(m);
    nav.push(m);
  }
  light(-6.9, 0.1, 0.9, 0xff2a2a);
  light(6.9, 0.1, 0.9, 0x2aff66);
  light(0, 0.4, 8.5, 0xffffff);
  group.userData.navLights = nav;
  group.userData.engineGlow = glow;
  return group;
}
