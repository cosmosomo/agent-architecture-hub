# Security Policy

## Supported versions

Only the latest release receives fixes.

## Scope and design

Agent Architecture Hub is a local tool. Its service listens on `127.0.0.1`, rejects requests whose `Host` is not its own address, sends no CORS headers, answers only `GET` and `HEAD`, serves a fixed set of paths and confines static files to their directories. Sessions are parsed on your machine and are never uploaded; secret-looking strings are masked while parsing. The page carries a Content-Security-Policy. [README](README.md#security-and-privacy) lists the details.

Things worth reporting:

- a way for another web page, or another machine, to read your sessions through the service (DNS rebinding, CORS, a missing `Host` check);
- path traversal out of `hub/`, `concept/` or the viewer's build directory;
- secrets that survive masking in parsed sessions or in the search index;
- script injection through a case document, a session, or a hub-graph file rendered by the page.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on the repository page. If that is not available, open an issue that asks for a private channel and contains no details.

Include the version (`package.json` or the release tag), what you did, and what you saw. Reports are handled on a best-effort basis; a fix is released as a patch version and noted in the [changelog](CHANGELOG.md).
