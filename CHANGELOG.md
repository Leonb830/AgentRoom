# Changelog

## 0.1.0 — Initial implementation, 21 October 2026

- Record the owner-confirmed architecture and service boundaries.
- Add a responsive private workspace, setup screen, GitHub owner authentication, task composer, replayed history, and explicit execution state.
- Persist request identity before dispatch and retain pending actions for reconciliation after a lost response or a browser restart.
- Integrate pinned Cloudroom Core through a private FastAPI adapter; implement queue pause plus interruption and explicit resume.
- Prepare separate Git worktrees and preserve the original checkout.
- Capture exact changes, including relevant untracked files; export integrity-checked patches and record review decisions against their snapshot.
- Provide pinned runtime setup, PostgreSQL migrations, protected native-service templates, and fixture/browser verification scripts.
- Keep live-account setup and unimplemented alpha requirements visible in the setup and validation guides.
