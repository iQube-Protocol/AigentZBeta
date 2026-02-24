# Removed duplicate route directories

The following directories were removed to resolve Next.js route conflicts
(resulting in duplicate `/codex/viewer` routes):

- `app/(embed)/triad/`
- `app/(shell)/codex/`
- `app/codex/`
- `app/triad/`

If any of these are needed later, restore them from history or reintroduce
with distinct route group paths.
