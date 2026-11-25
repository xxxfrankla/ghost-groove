# Product: Ghost Groove

A web instrument that plays photographs. Tagline: turn a photo into a loop you can play, reshape, and make your own.

## Core idea
- The whole photo sets the mood of the music.
- Two scan bands (A and B) sit on the photo. Each band is cut into 16 cells, and each cell is one step of a 16-step sequencer.
- A bright area under a band becomes a hit on that step. Dragging a band to another part of the photo changes the groove at the next bar.
- Users can add or remove steps by hand. Their edits persist while the photo keeps driving everything else.

## Bands
- **A**: percussion layer (metal hits in Hollow, hats in Neon). Reads 16 contrast scores.
- **B**: pitched layer (bass and synth). Reads 16 contrast scores, and the band's height sets the register.
- Scores are normalized within the band, so a crack of light in a dark room still registers.
- Score above the accent threshold: full-velocity note. Score above only the lower threshold: **ghost note** (quiet, about 0.45 velocity).
- Pitches are quantized to the current mood's scale.
- Band changes apply at the start of the next bar.

## Mood and density
- **Mood** presets: **Hollow** (sparse kick, long tails, metal hits, drone bass) and **Neon** (four-on-the-floor, short bass, hats, short synths). The photo suggests a mood from saturation, contrast and detail density, and the user can override it. More moods may come later as presets.
- **Density** (Quiet to Crowded) moves the thresholds. Higher density lets dimmer cells play and enables ghost notes. At the top end the Hollow kick goes from two hits a bar to four. Density persists across photo switches.

## Sequencer
Rows: Kick, Clap, A, B. Cell states:
- Base groove: bone-white fill.
- From the photo: band color, full height for accent, half height for ghost.
- Added by user: band color with white ring.
- Muted by user: dashed outline, colored if the photo still wants a note, grey otherwise.

Editing rules:
- Click a cell to lock it (it stops following the photo). Shift-click hands it back.
- First edit shows a one-time Shift-click hint.
- An edited row shows a ↺ button to hand the whole row back. **Clear my edits** resets everything.
- Edits survive band drags, density changes, mood changes and photo switches.

## Hard photos
- Dark with contrast: use local contrast only.
- Blurry: a differing blob still reads.
- Near-black or noise: measure signal strength on the raw image first. If too weak, the base groove keeps playing and photo layers fade out (silence is intentional).

## Principles
- Deterministic: the same image, bands, mood and density always give the same pattern. No randomness.
- Photos never leave the user's machine.

## Out of scope for v1
Adding tracks, a continuous mood knob, per-step velocity editing, mobile layout. Stretch: MIDI or WAV export, live webcam input.
