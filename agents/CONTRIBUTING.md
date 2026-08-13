# Contributing Guide

Thank you for contributing to this project.

This system is built on a unified backend architecture and a shared data contract. Contributions should preserve consistency across FastAPI, Node, the Python agents, and the React client.

## Getting Started

1. Clone the repository.
2. Install Python dependencies from `requirements.txt`.
3. Install Node dependencies from the repository root and from `client/` if needed.
4. Read [README.md](README.md) for the project overview and [client/README.md](client/README.md) for the launch runbook.

## Development Rules

- Use the shared data directory: `client/data/`.
- Keep FastAPI as the canonical backend behavior when aligning routes.
- Add or update tests for backend behavior changes.
- Keep launch and runbook documentation current when startup behavior changes.
- Avoid introducing alternate data paths unless the migration is explicit and documented.

## Pull Requests

1. Describe the change clearly.
2. Reference related issues if they exist.
3. Run the backend tests before submitting:
   - `npm test`
   - `python -m unittest discover -s test -p "test_*.py"`
4. Update documentation when behavior, workflow, or architecture changes.

## Collaboration Philosophy

This project is built around human and AI collaboration.
Contributions should reflect clarity, intention, and respect for the craft.
