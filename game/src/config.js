// Fjord Run — tuning, missions and the ring course.
// One place for every number a designer would tune: speeds in m/s, heights in
// metres, fuel in percent. Nothing here knows about three.js or the DOM.
export const STEP = 1 / 60;

export const WORLD = {
  size: 4200, // terrain spans -2100..2100 on x and z
  seaLevel: 0,
  seed: 20261126,
};

export const PLANE = {
  minSpeed: 38, // below this the wing stops flying
  maxSpeed: 148, // full throttle, level flight
  cruiseSpeed: 82,
  climbRate: 26,
  rollRate: 1.9, // rad/s at full stick
  pitchRate: 1.15,
  yawRate: 0.35,
  fuelBurn: 0.55, // %/s at full throttle, 0.12 at idle
  fuelIdle: 0.12,
  startFuel: 100,
  startAltitude: 260,
};

// Runway: a flat valley strip the terrain flattens itself around.
export const RUNWAY = {
  x: 0,
  z: 620,
  heading: 0, // runway points north (-z); land heading 0 (360)
  length: 620,
  width: 46,
  groundY: 34,
};

// The fjord winds north-south down the west side; the canyon cuts the east.
// These centrelines are shared by the terrain (which carves them) and the
// missions (whose rings hang over them), so the course always follows water
// and valley, never a ridge.
export function fjordCentre(z) {
  return -880 + 260 * Math.sin(z * 0.0011 + 1.2) + 90 * Math.sin(z * 0.0027);
}
export function canyonCentre(z) {
  return 920 + 220 * Math.sin(z * 0.0009 + 0.6);
}

// The three missions. Every mission is a list of targets (rings or beacons)
// plus the rule that ends it: fly every target, then land on the runway.
export const MISSIONS = [
  {
    id: 'fjord-rings',
    key: '1',
    name: 'FJORD RING RUN',
    short: 'Ring Run',
    blurb: 'Thread 8 rings down the fjord, through the canyon, and home.',
    timeLimit: 0, // no clock; fuel is the pressure
    ringRadius: 26,
    targets: [
      { x: -260, y: 250, z: 380 },
      { x: fjordCentre(-150), y: 170, z: -150 },
      { x: fjordCentre(-650), y: 170, z: -650 },
      { x: fjordCentre(-1150), y: 190, z: -1150 },
      { x: fjordCentre(-1550), y: 210, z: -1550 },
      { x: -350, y: 220, z: -1500 },
      { x: canyonCentre(-1050), y: 180, z: -1050 },
      { x: canyonCentre(-450), y: 160, z: -450 },
    ],
  },
  {
    id: 'canyon-dash',
    key: '2',
    name: 'CANYON DASH',
    short: 'Canyon Dash',
    blurb: 'Six low rings through the canyon. Beat 150 seconds.',
    timeLimit: 150,
    ringRadius: 24,
    targets: [
      { x: canyonCentre(200), y: 150, z: 200 },
      { x: canyonCentre(-250), y: 170, z: -250 },
      { x: canyonCentre(-700), y: 150, z: -700 },
      { x: canyonCentre(-1050), y: 170, z: -1050 },
      { x: canyonCentre(-1400), y: 180, z: -1400 },
      { x: 300, y: 230, z: -300 },
    ],
  },
  {
    id: 'island-tour',
    key: '3',
    name: 'ISLAND TOUR',
    short: 'Island Tour',
    blurb: 'Visit all 5 island beacons, then bring her home to runway 36.',
    timeLimit: 0,
    ringRadius: 30,
    targets: [
      { x: -1450, y: 280, z: 300 },
      { x: -1500, y: 320, z: -1100 },
      { x: 200, y: 340, z: -1750 },
      { x: 1560, y: 300, z: -900 },
      { x: 1620, y: 260, z: 480 },
    ],
  },
];

export const SCORE = {
  ring: 100,
  ringComboStep: 25, // +25 per consecutive ring without a miss
  beacon: 150,
  landing: 250,
  missionBonus: 500,
  lowPass: 50, // skimming under 40 m over the runway scores a little
};

export const DAMAGE = {
  hardTouchdown: 34, // vertical speed over 9 m/s on the ground
  scrape: 22, // brushing terrain or water at speed
  max: 100,
};

export const KEYS = {
  throttleUp: ['KeyW'],
  throttleDown: ['KeyS'],
  pitchUp: ['ArrowUp', 'KeyI'],
  pitchDown: ['ArrowDown', 'KeyK'],
  rollLeft: ['ArrowLeft', 'KeyJ'],
  rollRight: ['ArrowRight', 'KeyL'],
  yawLeft: ['KeyA'],
  yawRight: ['KeyD'],
  camera: ['KeyC'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter', 'Space'],
  restart: ['KeyR'],
  gear: ['KeyG'],
  mute: ['KeyM'],
};
