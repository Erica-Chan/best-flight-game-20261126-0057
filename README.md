# Fjord Run — a 3D flight game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Erica-Chan/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Erica-Chan/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Fly a low-poly jet trainer over a seeded fjord: steep snow-capped walls, a
winding sea inlet, a dry canyon and green islands, all in one golden-hour
style. Three missions, one airfield:

- **1 · Fjord Ring Run** — thread 8 glowing rings down the fjord, through the canyon, and home.
- **2 · Canyon Dash** — six low rings through the canyon. Beat 150 seconds.
- **3 · Island Tour** — visit all 5 island beacons, then land on runway 36.

Flying rewards throttle and turn discipline: bank to turn, hold speed to
keep the wing flying, watch fuel and damage — out of fuel you glide, and a
hard touchdown costs airframe. Land gently on the strip to refuel and
repair, or finish the mission there for the bonus.

## Controls

- **W / S** throttle · **← →** bank · **↑ ↓** pitch · **A / D** rudder
- **C** chase / cockpit camera · **P** pause · **R** restart · **M** mute
- Mouse drag looks around. **1 / 2 / 3** picks a mission.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

Static files only — `game/index.html` plays offline in desktop Chrome.
Three.js is vendored under `game/vendor/three.min.js`. No network requests,
no build step.

## Screenshots

`shots.json` lists the four staged scenes (`?shot=cover|ring|cockpit|landing`);
each is flown forward by the game's own autopilot from a fresh start, so
every screenshot is a real render of the game's code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=96p1ekwa&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
