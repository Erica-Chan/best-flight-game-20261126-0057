// The mission course: glowing rings (or beacon pylons) hung over the
// terrain, the next one always lit and pulsing, passed ones turned green.
// check() is called once a step with the aircraft position.
import * as THREE from 'three';

export function buildRings(scene, mission) {
  const group = new THREE.Group();
  const rings = mission.targets.map((t, i) => {
    const isBeacon = mission.id === 'island-tour';
    const ring = new THREE.Group();
    ring.position.set(t.x, t.y, t.z);
    let mesh;
    if (isBeacon) {
      // A beacon is a lit pylon with a beam, not a ring to fly through.
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 3.4, 46, 8),
        new THREE.MeshStandardMaterial({ color: 0x37424e, roughness: 0.6, metalness: 0.4 }),
      );
      pylon.position.y = -20;
      ring.add(pylon);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(4.5, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0x35e0ff }),
      );
      lamp.position.y = 6;
      ring.add(lamp);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 6, 190, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x35e0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      beam.position.y = 100;
      ring.add(beam);
      mesh = lamp;
    } else {
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(mission.ringRadius, 2.2, 12, 40),
        new THREE.MeshStandardMaterial({
          color: 0xff8c1a, emissive: 0xff6a00, emissiveIntensity: 0.9, roughness: 0.4,
        }),
      );
      ring.add(torus);
      mesh = torus;
      // Face the ring along the course: toward the next target (or the runway).
      const next = mission.targets[i + 1] ?? { x: 0, y: 120, z: 620 };
      ring.lookAt(next.x, next.y, next.z);
    }
    ring.userData = { index: i, passed: false, mesh, isBeacon };
    group.add(ring);
    return ring;
  });
  scene.add(group);

  // A thin ribbon of light on the ground under the next ring, so the pilot
  // can find the course from altitude.
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 1.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.75 }),
  );
  scene.add(marker);

  let nextIndex = 0;
  function nextTarget() {
    return mission.targets[nextIndex] ?? null;
  }
  function check(pos, flight) {
    const target = nextTarget();
    if (!target) return null;
    const ring = rings[nextIndex];
    const d = Math.hypot(pos.x - target.x, pos.y - target.y, pos.z - target.z);
    const isBeacon = ring.userData.isBeacon;
    const radius = isBeacon ? 55 : mission.ringRadius;
    if (d < radius) {
      ring.userData.passed = true;
      const points = flight.addRingScore(isBeacon);
      if (!isBeacon) {
        ring.userData.mesh.material = new THREE.MeshStandardMaterial({
          color: 0x2aff66, emissive: 0x0a8a2a, emissiveIntensity: 0.7, roughness: 0.4,
        });
      } else {
        ring.userData.mesh.material = new THREE.MeshBasicMaterial({ color: 0x2aff66 });
      }
      nextIndex += 1;
      return { points, index: ring.userData.index, total: mission.targets.length, isBeacon };
    }
    return null;
  }
  function update(time) {
    const target = nextTarget();
    if (target) {
      marker.position.set(target.x, 3, target.z);
      const pulse = 1 + Math.sin(time * 4) * 0.12;
      marker.scale.set(pulse, 1, pulse);
      const ring = rings[nextIndex];
      if (!ring.userData.isBeacon) {
        ring.userData.mesh.material.emissiveIntensity = 0.7 + Math.sin(time * 4) * 0.35;
      }
    } else {
      marker.visible = false;
    }
    // Passed rings stay green; upcoming ones stay orange.
    for (const ring of rings) {
      if (!ring.userData.passed && ring !== rings[nextIndex]) {
        ring.userData.mesh.material.emissiveIntensity = 0.45;
      }
    }
  }
  return { group, check, update, nextTarget, get nextIndex() { return nextIndex; } };
}
