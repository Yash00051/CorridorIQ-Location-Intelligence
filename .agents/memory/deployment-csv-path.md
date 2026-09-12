---
name: Deployment asset paths
description: Runtime working directories differ between local artifact workflows and deployed artifact processes.
---

For file-backed API data, resolve assets against both the service working directory and the repository-root artifact path.

**Why:** Local artifact workflows start inside the service directory, while deployed artifact processes can start from the repository root, causing relative asset reads to fail only after deployment.

**How to apply:** Use explicit candidate paths and fail with the checked locations if none exists; do not assume `process.cwd()` is stable across environments.