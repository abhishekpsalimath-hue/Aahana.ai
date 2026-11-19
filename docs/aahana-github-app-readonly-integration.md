# GitHub App read-only integration

The Phase C evidence collector can be connected to a GitHub App through the server-only client in `github-app-client.server.mjs`.

Configure these variables only in the trusted server runtime (Preview first):

- `AAHANA_GITHUB_REPOSITORY`: exact repository in `owner/name` form.
- `AAHANA_GITHUB_APP_ID`: GitHub App ID.
- `AAHANA_GITHUB_APP_INSTALLATION_ID`: installation ID for the repository.
- `AAHANA_GITHUB_APP_PRIVATE_KEY`: PEM private key, stored as a server-side secret.

Required GitHub App repository permissions are read-only:
- Contents: read (commit trees)
- Pull requests: read (PR metadata and changed files)
- Checks: read (CI check runs)

The client mints short-lived installation tokens server-side, rejects redirects, paginates file/check responses, and marks incomplete pagination or truncated trees as incomplete evidence. The private key and installation token must never enter model context, client responses, task payloads or sandbox environment.

No GitHub App credentials are included in this repository. The client remains inactive until the owner configures the variables in a Preview environment and verifies the App installation permissions.
