---
name: camelcase-files
description: Enforce camelCase file naming convention across the project. File names must start with a lowercase letter and use uppercase for subsequent words (e.g. userController.ts, userRoutes.ts). Use this skill when creating, renaming, or reviewing files.
license: MIT
compatibility: opencode
---

## File Naming Convention: camelCase

All source files in this project must follow **camelCase** naming:

- First letter **lowercase**
- Each subsequent word starts with an **uppercase** letter
- No hyphens, underscores, or PascalCase (unless exceptions apply)

### Examples

| Wrong | Correct |
|-------|---------|
| `UserController.ts` | `userController.ts` |
| `AuthMiddleware.ts` | `authMiddleware.ts` |
| `FirebaseConfig.ts` | `firebaseConfig.ts` |

### Exceptions (do NOT rename these)

- **Config files**: `README.md`, `package.json`, `tsconfig.json`, `jest.config.js`, `.env`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- **Test helpers/mocks**: files inside `__mocks__/` — keep them matching the module they mock
- **Markdown docs**: `*.md` files (e.g. `PROFILES.md`)

### When creating new files

1. Always start the filename with a **lowercase** letter
2. Use camelCase for multi-word names: `userController.ts`, `userRoutes.ts`, `ruralProducer.ts`
3. Check if the file you're creating already exists under a different case — rename it if so
4. Update all imports that reference renamed files

### When renaming files

1. Rename the file to camelCase
2. Search the entire codebase for imports referencing the old name
3. Update every import to use the new filename
4. Run `npm run build` or `tsc --noEmit` to confirm no broken imports remain
