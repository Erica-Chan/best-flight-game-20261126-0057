// Fjord terrain: one seeded heightfield that is island, fjord, canyon and
// valley at once, plus the water, sky, sun, clouds, pines and the runway
// valley airfield. heightAt(x, z) is the single source of truth — the mesh,
// the trees, the rings and the flight model all ask it the same question.
import * as THREE from 'three';
import { WORLD, RUNWAY, fjordCentre, canyonCentre } from './config.js';
import { makeNoise } from './noise.js';

const noise = makeNoise(WORLD.seed);
const HALF = WORLD.size / 2;

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z) / HALF; // 0 centre, 1 edge
  const island = 1 - smoothstep(0.55, 1.05, r); // fall away to sea at the rim
  let h = 40 + noise.fbm(x * 0.0009, z * 0.0009, 4) * 150;
  h += Math.pow(Math.max(0, noise.ridged(x * 0.0006 + 7, z * 0.0006 - 3)), 2.2) * 330;
  h *= 0.35 + 0.65 * island;
  // Fjord: a deep water channel between steep walls.
  const fd = Math.abs(x - fjordCentre(z));
  const fjordDepth = smoothstep(420, 150, fd);
  h = h * (1 - fjordDepth) + -28 * fjordDepth;
  // Canyon: a dry valley, low but never below the river plain.
  const cd = Math.abs(x - canyonCentre(z));
  const canyonDepth = smoothstep(340, 110, cd);
  h = h * (1 - canyonDepth * 0.8) + 62 * canyonDepth;
  // Sea floor under the water at the rim.
  if (r > 0.72) h = Math.min(h, -18 + (1 - r) * 40);
  // Flat valley floor for the airfield: a wide, forgiving bowl around the
  // strip, so the approach corridor and the runway are one flat valley.
  const dx = Math.max(0, Math.abs(x - RUNWAY.x) - RUNWAY.width / 2);
  const dz = Math.max(0, Math.abs(z - RUNWAY.z) - RUNWAY.length / 2);
  const dRun = Math.hypot(dx, dz);
  const flat = smoothstep(420, 120, dRun);
  h = h * (1 - flat) + RUNWAY.groundY * flat;
  return h;
}

function colourFor(y, slope, out) {
  // slope: 0 flat, 1 vertical (from the normal's y).
  if (y < 2) return out.setRGB(0.76, 0.72, 0.55); // sand
  if (y < 6) return out.setRGB(0.55, 0.62, 0.42); // shore grass
  if (slope < 0.55 && y < 150) return out.setRGB(0.32, 0.48, 0.24); // valley green
  if (slope < 0.75 && y < 210) return out.setRGB(0.38, 0.44, 0.26); // high meadow
  if (y > 235 && slope < 0.8) return out.setRGB(0.93, 0.94, 0.97); // snow
  if (slope > 0.72) return out.setRGB(0.42, 0.39, 0.37); // bare rock face
  return out.setRGB(0.48, 0.45, 0.40); // rock
}

function buildSky(scene, sunDir) {
  const skyGeo = new THREE.SphereGeometry(6000, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: sunDir.clone().normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 sunDir;
      void main(){
        float h = clamp(vDir.y, -0.05, 1.0);
        vec3 zenith = vec3(0.16, 0.38, 0.68);
        vec3 mid = vec3(0.55, 0.72, 0.86);
        vec3 horizon = vec3(1.0, 0.82, 0.58);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, zenith, smoothstep(0.2, 0.75, h));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 90.0);
        col += vec3(1.0, 0.75, 0.45) * sun * 0.9;
        float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 6.0);
        col += vec3(1.0, 0.6, 0.3) * glow * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);
}

export function buildTerrain(scene) {
  const sunDir = new THREE.Vector3(-0.55, 0.38, -0.45);
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
  sun.position.copy(sunDir).multiplyScalar(3000);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbcd6ea, 0x4a5d43, 0.9));
  scene.fog = new THREE.Fog(0xc3d5e2, 900, 5200);
  buildSky(scene, sunDir);

  // Ground mesh with per-vertex colours.
  const segments = 200;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i += 1) {
    colourFor(pos.getY(i), 1 - nrm.getY(i), c);
    // Tonal jitter so the slopes read as terrain, not plastic: a slow
    // patchiness plus a fine grain.
    const j = 0.9 + noise.noise2(pos.getX(i) * 0.004, pos.getZ(i) * 0.004) * 0.1
      + noise.noise2(pos.getX(i) * 0.05, pos.getZ(i) * 0.05) * 0.05;
    colours[i * 3] = c.r * j;
    colours[i * 3 + 1] = c.g * j;
    colours[i * 3 + 2] = c.b * j;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  scene.add(ground);

  // Sea: one translucent sheet at sea level.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size * 2.4, WORLD.size * 2.4),
    new THREE.MeshPhongMaterial({
      color: 0x2a6d9e, transparent: true, opacity: 0.82, shininess: 120, specular: 0x99bbcc,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.seaLevel + 1;
  scene.add(sea);

  buildAirfield(scene);
  const clouds = buildClouds(scene);
  buildForest(scene);
  buildRocks(scene);
  return {
    heightAt,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 3.5;
        if (cloud.position.x > HALF + 400) cloud.position.x = -HALF - 400;
      }
    },
  };
}

function buildAirfield(scene) {
  const field = new THREE.Group();
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.9 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(RUNWAY.width, 1, RUNWAY.length), asphalt);
  strip.position.set(RUNWAY.x, RUNWAY.groundY + 0.4, RUNWAY.z);
  field.add(strip);
  // Centre dashes and threshold bars.
  const paint = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  for (let dz = -RUNWAY.length / 2 + 40; dz < RUNWAY.length / 2 - 20; dz += 60) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 26), paint);
    dash.position.set(RUNWAY.x, RUNWAY.groundY + 1.1, RUNWAY.z + dz);
    field.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7, 0.4, 18), paint);
      bar.position.set(RUNWAY.x + k * 8.5, RUNWAY.groundY + 1.1, RUNWAY.z + end * (RUNWAY.length / 2 - 22));
      field.add(bar);
    }
  }
  // Hangar, tower and windsock so the field reads as an airfield from the air.
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 });
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 46), hangarMat);
  hangar.position.set(-95, RUNWAY.groundY + 11, RUNWAY.z + 120);
  field.add(hangar);
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 24, 70, 12, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x5d6b7a, roughness: 0.6, metalness: 0.3 }),
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(-95, RUNWAY.groundY + 22, RUNWAY.z + 120);
  field.add(roof);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 9, 52, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }),
  );
  tower.position.set(72, RUNWAY.groundY + 26, RUNWAY.z - 140);
  field.add(tower);
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(22, 12, 22),
    new THREE.MeshStandardMaterial({ color: 0x2e4a66, roughness: 0.3, metalness: 0.4 }),
  );
  cab.position.set(72, RUNWAY.groundY + 56, RUNWAY.z - 140);
  field.add(cab);
  // Windsock: pole + orange cone pointing into the wind.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 16, 6),
    new THREE.MeshStandardMaterial({ color: 0xdddddd }),
  );
  pole.position.set(38, RUNWAY.groundY + 8, RUNWAY.z + 260);
  field.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 11, 8),
    new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 }),
  );
  sock.rotation.z = Math.PI / 2 - 0.25;
  sock.position.set(44, RUNWAY.groundY + 15, RUNWAY.z + 260);
  field.add(sock);
  scene.add(field);
}

function buildClouds(scene) {
  const clouds = [];
  // Unlit white puffs: in golden-hour light, shaded clouds read grey and
  // flat, so the clouds carry their own brightness.
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0.85, fog: false });
  for (let i = 0; i < 22; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(noise.random() * 3);
    for (let k = 0; k < puffs; k += 1) {
      const r = 26 + noise.random() * 42;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      puff.position.set((noise.random() - 0.5) * 120, (noise.random() - 0.5) * 12, (noise.random() - 0.5) * 60);
      puff.scale.y = 0.42;
      cloud.add(puff);
    }
    cloud.position.set(
      (noise.random() - 0.5) * WORLD.size * 0.9,
      400 + noise.random() * 160,
      (noise.random() - 0.5) * WORLD.size * 0.9,
    );
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

function buildForest(scene) {
  // Instanced pines: one trunk draw and one foliage draw for the whole forest.
  const spots = [];
  let guard = 0;
  while (spots.length < 520 && guard < 6000) {
    guard += 1;
    const x = (noise.random() - 0.5) * WORLD.size * 0.92;
    const z = (noise.random() - 0.5) * WORLD.size * 0.92;
    const y = heightAt(x, z);
    if (y < 8 || y > 165) continue;
    if (Math.hypot(x - RUNWAY.x, z - RUNWAY.z) < 260) continue;
    spots.push([x, y, z]);
  }
  const dummy = new THREE.Object3D();
  const trunkGeo = new THREE.CylinderGeometry(1.1, 1.6, 7, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4230, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const coneGeo = new THREE.ConeGeometry(7, 24, 7);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x356b38, roughness: 1 });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, spots.length);
  spots.forEach(([x, y, z], i) => {
    const s = 0.8 + noise.random() * 0.9;
    dummy.position.set(x, y + 3 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = noise.random() * Math.PI * 2;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, y + (7 + 11) * s, z);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);
  });
  scene.add(trunks);
  scene.add(cones);
}

function buildRocks(scene) {
  const geo = new THREE.DodecahedronGeometry(9, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(geo, mat, 130);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 130; i += 1) {
    const x = (noise.random() - 0.5) * WORLD.size * 0.9;
    const z = (noise.random() - 0.5) * WORLD.size * 0.9;
    const y = heightAt(x, z);
    if (y < 3) { dummy.position.set(x, -40, z); }
    else dummy.position.set(x, y + 2, z);
    dummy.scale.set(0.6 + noise.random() * 1.8, 0.5 + noise.random() * 1.1, 0.6 + noise.random() * 1.8);
    dummy.rotation.set(noise.random() * 3, noise.random() * 3, noise.random() * 3);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);
}
