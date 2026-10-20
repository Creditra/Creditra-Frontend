## Transaction Status Accessibility

Transaction history status chips use both color and CSS patterns to ensure
statuses remain distinguishable for users with color-vision deficiencies.

Patterns are defined in:

src/styles/patterns.css

Current mappings:

| Status | Pattern |
|---------|---------|
| Completed | Diagonal stripes |
| Pending | Dotted pattern |
| Failed | Cross-hatch pattern |

When adding new transaction statuses:

- Do not rely on color alone.
- Add a unique pattern variant.
- Ensure WCAG 2.1 AA compliance.
- Update associated tests in TransactionHistory.test.tsx.