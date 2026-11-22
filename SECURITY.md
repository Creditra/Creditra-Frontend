# Security Policy

## Supported Versions

Only the latest code on the `main` branch is actively supported with security updates.

| Version / Branch | Supported |
| --- | --- |
| `main` | Yes |
| Older commits / forks | No |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

To report a vulnerability privately:

1. Use **GitHub Private Vulnerability Reporting**: go to the repository's **Security** tab and click **Report a vulnerability**.
2. **Fallback contact (placeholder — pending maintainer confirmation):** If you are unable to use GitHub's private reporting flow, email `security@creditra.com` (or `support@creditra.com` as currently referenced in the app).

Please include as much of the following as possible to help us reproduce and assess the issue quickly:

- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions, proof-of-concept, or affected URLs/routes.
- Affected files, components, wallet provider(s) (e.g., Freighter, Albedo, xBull, Rabet), or dependency versions.
- Any suggested mitigations or fixes, if known.

## Scope

### In Scope

- **Wallet handling:** Stellar wallet connection flows, address/asset validation, transaction signing/envelope handling, and provider integration issues (Freighter, Albedo, xBull, Rabet).
- **Cross-Site Scripting (XSS) & injection:** Unsafe rendering of user-controlled, API-supplied, or IPFS/NFT content, including SVG or data-URI handling.
- **Redirect & navigation handling:** Open redirects, unsafe external link handling, or client-side routing bypasses.
- **Dependency & supply-chain issues:** Known vulnerabilities in production dependencies or build/tooling configurations affecting the deployed frontend.

### Out of Scope

- **Demo / mock data:** Hardcoded sample accounts, balances, credit lines, or placeholder fixtures used in demo mode (`src/data/mockData.ts`, `src/lib/draw-credit-mock-data.ts`).
- Issues in third-party Stellar wallet extensions themselves (please report those directly to the respective wallet vendor).
- Theoretical vulnerabilities without a demonstrable security impact on the frontend.

## Response Timelines & Disclosure

We aim to follow these target timelines for valid reports:

| Stage | Target Timeline |
| --- | --- |
| Initial acknowledgement | Within 3 business days |
| Triage & severity assessment | Within 7 business days |
| Fix & release (critical / high) | Within 14–30 days, depending on complexity |
| Fix & release (medium / low) | Next scheduled maintenance release |

### Coordinated Disclosure

We follow coordinated vulnerability disclosure:

- Please give maintainers a reasonable window to investigate, develop, and release a fix before publishing details publicly.
- We will keep you updated on triage status and remediation progress, and credit reporters in the advisory if desired.
