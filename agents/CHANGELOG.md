# CHANGELOG

## v1.0.0 - Human x AI Collaboration Release (2026-08-01)

### Added
- Top-level README with full project identity and collaboration philosophy
- Human x AI workflow diagram
- Project Manifesto and Creator's Promise
- Proof of Work section documenting backend alignment and hardening
- Unified data layer under `client/data/`
- Startup integrity checks for FastAPI and Node
- Shared loaders in `client/integrity.py` and `lib/data_store.js`
- Endpoint tests for Python and Node
- Full-stack runbook and launch instructions
- Branding footer and collaboration statement

### Changed
- Rebuilt backend entrypoints for clarity and testability
- Updated `client/README.md` to link to the project overview
- Standardized JSON read and write paths across all services

### Fixed
- Divergent Git histories between local `main` and `origin/main`
- Path resolution issues in the FastAPI loader
- Node loader inconsistencies with the working directory
