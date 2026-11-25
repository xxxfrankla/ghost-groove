# Ghost Groove

Ghost Groove turns a photograph into an editable beat. The full image suggests the sound palette, and a movable scan band maps the image to a 16-step sequencer.

Built for Kiroween 2026, targeting the Frankenstein category by combining image sampling with music sequencing.

## First playable demo

- Start with a built-in night scene or select a local image.
- Compare two sound palettes. An empty parking lot plays sparse drums and long textures, while a neon street plays a denser beat with short synth notes.
- Drag the scan band to change the positions and velocities of rhythmic accents. Apply new scan results at the next bar while playback is running.
- Toggle individual steps in the sequencer. Keep manual edits when the scan band moves, and provide a way to clear them.
- Keep a sparse base groove when the scan band has too little contrast to produce reliable accents.

## Team split

| Owner | Scope |
| --- | --- |
| Frank, backend and generation | Design the image-feature and pattern contract. Implement deterministic feature-to-mood and feature-to-pattern logic, preset rules, and fixtures for bright, dark, and low-contrast images. |
| Frontend teammate | Build the React interface for image selection, Canvas sampling, the scan band, and the step editor. Integrate Tone.js playback and synchronize the playhead. |

## Frontend and generation contract

The proposed v1 stack is React, TypeScript, Canvas 2D, and Tone.js. The browser decodes the image and passes numeric features to a pure TypeScript generation module. An HTTP backend is optional for v1. The module can be called from the browser while the two pieces are developed independently.

- **Input:** image-level saturation, contrast, and detail density, plus 16 per-step contrast scores from the scan band.
- **Output:** a suggested sound palette, BPM, and tracks with 16 steps each. A step carries a velocity, with zero representing silence, and an optional pitch for synth voices.
- **Manual editing:** the browser stores per-step overrides separately from generated values, so rescanning can update the underlying pattern without erasing edits.

## Submission checklist

- Publish the working demo and make this repository public with an open-source license before submission.
- Commit the root ".kiro" directory with the Kiro materials used during development.
- Document the source and license of each bundled audio sample.

This repository is at kickoff. The application and setup commands will be added with the first playable build.
