---
inclusion: always
---
# Team workflow
- Frank owns src/engine, src/audio and .kiro/specs/engine*. Sunny owns src/ui, src/app and .kiro/specs/ui*.
- Never edit files outside the current owner's folders. If a change is needed there, write it as a TODO in the chat instead.
- src/engine/types.ts is the contract. Do not change it unless the user explicitly says both owners agreed.
- Engine code must be pure TypeScript with no DOM access and no randomness.
- Write all specs, comments and commit messages in English.
- Never add .kiro to .gitignore.