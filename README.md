# Resonance

A procedural pixel-art world that reacts to music in real time.

**Live:** https://twinkeebs.github.io/resonance/

- A built-in generative lo-fi track (Web Audio synth), or use your own audio: drop a file, use the mic, or capture a tab playing YouTube or Spotify (Chrome/Edge desktop).
- **Bass** makes the mountains pulse and the water ripple. **Mids** drive the wind in the grass, trees and clouds. **Highs** make the stars and sparkles twinkle.
- **Beat detection** (spectral flux with an adaptive threshold) triggers shooting stars, lightning, fireflies, bird flocks and aurora surges.
- **Loudness** builds the aurora and brings rain. **Drops** set off a flash and a burst of events.
- A full day/night cycle takes about 2 minutes. Limited palettes per time of day blend smoothly, with Bayer dithering throughout.

Plain JavaScript, no build step and no dependencies: a 320x180 indexed-color framebuffer scaled with nearest-neighbor.
