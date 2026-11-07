# HyperFrames Playful Pop & Modern Caption Design System

`video -> Whisper (word-level) -> captions.json -> deterministic Virtual DOM / GSAP composition -> local MP4`

A high-performance, lightweight, animated kinetic-typography caption engine built on top of [HyperFrames](https://github.com/heygen/hyperframes) and GSAP. Designed specifically for long-form videos (e.g. 34-minute presentations, podcasts, lectures) as well as short-form vertical videos (TikTok, Reels, Shorts), with extreme performance optimizations for hardware with constrained CPU cores and low memory (<= 6 GB RAM).

---

## 3 Professional Caption Presets

Switch between design presets instantly via `pop.config.json` without modifying template code:

1. **Playful Pop (`"preset": "playful-pop"`)**:
   - Bold, vibrant, comic-style typography (Lilita One & Fredoka).
   - High-energy sticker slap, spin-pop, and jelly bounce animations.
   - Dynamic accent rotations, comic burst explosions, halftone backdrop blobs, and colorful confetti.
   - Multi-color cycling across bold saturated hues.

2. **Minimal Professional (`"preset": "minimal-pro"`)**:
   - Clean, elegant, corporate kinetic typography (Inter / System Sans).
   - Crisp modern pill/badge keyword highlighting with soft drop shadows and rounded corners.
   - Translucent dark backdrop card (`rgba(22, 27, 34, 0.78)`) ensuring perfect readability across any video footage.
   - Smooth, subtle opacity and micro-translation transitions (zero 3D, zero motion blur, zero clutter).

3. **Cinematic Modern (`"preset": "cinematic"`)**:
   - Premium cinematic widescreen typography (Montserrat / Editorial Sans) with refined letter-spacing (`0.08em`) and uppercase tracking.
   - Golden amber and platinum accent colors with subtle ambient glow.
   - Soft vertical gradient letterbox backdrop for filmic immersion.
   - Gentle cinematic drift and smooth fade transitions.

---

## Centralized Configuration (`pop.config.json`)

All caption behaviors, aesthetics, positions, and aspect ratios are centrally configured in `pop.config.json`:

```json
{
  "video": "assets/intro.mp4",
  "footageIsLight": false,
  "preset": "playful-pop",
  "position": "bottom",
  "aspectRatio": "16:9",
  "fontSize": 1.0,
  "maxWordsPerCaption": 6,
  "animationStyle": "default",
  "textColor": "cream",
  "highlightColor": "sunGold"
}
```

### Configuration Options
- **`preset`**: `"playful-pop"` | `"minimal-pro"` | `"cinematic"` (default: `"playful-pop"`).
- **`aspectRatio`**:
  - `"16:9"` (1920x1080 - YouTube / widescreen video)
  - `"9:16"` (1080x1920 - TikTok / Instagram Reels / YouTube Shorts, with UI safe area padding)
  - `"1:1"` (1080x1080 - Square social posts)
- **`position`**: `"bottom"` | `"center"` | `"top"` (default: `"bottom"`).
- **`fontSize`**: Multiplier relative to preset base font size (default: `1.0`).
- **`maxWordsPerCaption`**: Maximum words allowed in a single caption chunk (default: `6`).
- **`animationStyle`**: `"default"` | `"clean-fade"` | `"slide-fade-up"` | `"cinematic-drift"` (default: `"default"`).
- **`textColor`**: Base text color token or hex override.
- **`highlightColor`**: Hero keyword highlight color token or hex override.

---

## Ultra-Fast Rendering Architecture (Optimized for 6 GB RAM & Low CPU)

Previous implementations generated separate DOM trees and individual GSAP timeline tweens for every single chunk in the entire video. For a 34-minute video (61,200 frames @ 30 fps, ~1,200 chunks, ~5,000 words), this resulted in over **50,000 DOM elements**, multi-gigabyte memory consumption, and browser crashes on 6 GB RAM systems.

### Key Optimizations:
1. **Virtual DOM Pool Engine**:
   - Rather than creating tens of thousands of DOM nodes upfront, the engine allocates **one single pooled stage of ~15-25 reusable DOM nodes** (`MAX_LINES = 2`, `MAX_WORDS = 8`, reusable backdrop, text, and SVG slots).
   - DOM node count is strictly $O(1)$ and never increases regardless of whether the video is 30 seconds or 34 minutes long.
2. **Single Master Timeline with $O(\log N)$ Binary Search**:
   - A single master tween drives the composition. On each frame update, active chunk lookup uses binary search ($O(\log N)$) rather than scanning or animating thousands of inactive elements.
   - Memory consumption remains ultra-low (< 50 MB heap during rendering).
3. **Pure State & Precomputation**:
   - All layout measurements, word positions, bounding boxes, and transition timings are precalculated once during `npm run build`.
   - Zero layout thrashing, zero network requests, zero remote font fetches, and zero dynamic memory allocations at render time.
4. **Lightweight Transitions**:
   - Restricted to hardware-accelerated transforms (`transform: translate/scale`, `opacity`, `color`).
   - Heavy 3D effects, particle simulations, expensive CSS backdrop filters, and complex motion blurs are strictly avoided.
5. **Exact Video & Audio Preservation**:
   - Video duration, frame rate, and audio quality are 100% preserved. The audio is extracted losslessly at 48,000 Hz, and the video stream is synchronized without downsampling or shortening.

---

## Commands & Workflow

| Task | Command |
|---|---|
| Run unit tests (including 34-minute benchmark) | `npm test` |
| Run section 11 static determinism & lint checks | `npm run check:static` |
| Transcribe video with word-level timestamps | `npm run transcribe` |
| Group words into role-tagged caption chunks | `npm run analyze` |
| Build self-contained HyperFrames composition | `npm run build -- --quality preview\|final` |
| Live browser preview | `npm run dev` |
| Fast preview render | `npm run preview` -> `out/preview.mp4` |
| Final production render | `npm run render` -> `out/final.mp4` |

---

## Testing & Verification

All presets and long-form scalability are verified with automated test suites:
- **18 Unit Tests**: Tests cover PRNG determinism, spring physics, role heuristics, layout bounding, entrance sequencing, preset styling, aspect ratio dimensions, vertical positioning, and a 34-minute (61,200 frames, 4,800 words) scalability benchmark.
- **Section 11 Static Verification**: Validates zero hex color leaks outside `src/tokens.ts`, pure determinism across repeated shuffled frame hashes, strict 8-frame hero readability, zero text overlap collisions, and timing synchronization.
