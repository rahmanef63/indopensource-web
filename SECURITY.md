# Security Policy

## Supported Versions

This repository builds and deploys a single, continuously released static site
(`https://indopensource.org`). Only the current `main` branch is supported;
fixes are applied there and shipped on the next deploy.

## Reporting a Vulnerability

Please **do not** open a public issue, pull request, or discussion for
security-sensitive reports — that would disclose the problem before a fix is
available.

Use one of these private channels instead, in order of preference:

1. **GitHub Private Vulnerability Reporting (preferred).**
   Go to the repository's **Security** tab → **Report a vulnerability**, or open
   <https://github.com/IndopenSource/indopensource.org/security/advisories/new>.
   This creates a private advisory visible only to you and the maintainers, with
   a built-in space to discuss and patch the issue, and to credit you on
   disclosure. (Private reporting is enabled for this repository under
   *Settings → Code security and analysis*.)

2. **Private channels of the IndopenSource organization.**
   If you cannot use GitHub Security Advisories, contact the maintainers
   privately via the organization at <https://github.com/IndopenSource>
   (for example, an organization owner listed there). Do not post vulnerability
   details in public org discussions.

When you report, please include:

- A summary of the issue and its type (e.g. XSS, content injection, supply
  chain, leaked secret).
- Steps to reproduce, including the affected URL(s) or build step.
- Impact and the affected pages or workflows.
- A suggested fix or mitigation, if known.

## What to Expect

- **Acknowledgement** of a valid report within a few days.
- A **coordinated fix**: we will work with you on a patch and agree on a
  disclosure timeline before any public details are shared.
- **Credit** for the reporter in the published advisory, unless you ask to
  remain anonymous.

Because this site is a static, public open-source project, there are no user
accounts or private data stored by the site itself. The most relevant classes
of issue are content/HTML injection in rendered Markdown, leaked credentials in
the repository or build, and supply-chain risk in dependencies.
