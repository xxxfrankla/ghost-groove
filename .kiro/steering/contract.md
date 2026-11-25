# Contract

`src/engine/types.ts` is the boundary between engine/audio and UI. Change it only by agreement.

Rules the contract relies on:

- An `'on'` override plays at velocity 1 and uses the pitch the engine already computed for that step. That's why track B carries a pitch on every step.
- The UI keeps both the auto pattern and the resolved one. Comparing them is how it draws the four cell states.
- The same image, bands, mood and density always produce the same pattern. No randomness.

#[[file:src/engine/types.ts]]
