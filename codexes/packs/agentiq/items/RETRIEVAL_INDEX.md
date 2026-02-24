# Retrieval Index

## Purpose
The retrieval index is a machine-readable map for agents. It links artifacts to modules, endpoints, owners, and tags.

## Files
- `contracts/index.schema.json` (schema for validation)
- `index.json` (latest generated index)

## Required fields (summary)
- `version`
- `generated_at`
- `repo`
- `entries[]` with `id`, `path`, `type`, `title`, `tags`, `last_updated`

## Update rules
- Regenerated on every merged PR
- Only touched modules should update their entries
