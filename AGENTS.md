# Architecture rules
- Video scene production uses the server-only Lovable adapter with inline private references, authenticated downloads, and app-owned private storage; external provider credentials are not required.
- Video generation stays admin-authorized and explicitly initiated; status polling never creates replacement jobs.