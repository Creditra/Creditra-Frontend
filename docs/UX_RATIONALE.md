# UX rationale

## Dashboard borrower risk score

The dashboard excludes Closed credit lines because they no longer represent
current exposure. If every remaining line carries the same backend risk score,
the gauge uses that shared borrower-level score directly. When scores differ,
it computes a limit-weighted mean across every non-Closed line, including
Suspended and Defaulted lines, so larger exposures contribute proportionally
and delinquent exposure is not hidden.

The weighted result is rounded once to the nearest integer. With no eligible
lines, the gauge shows its no-data state instead of displaying `0`, which
would incorrectly imply a measured worst-possible score. Its caption states
the basis used, and the same caption is included in the gauge's accessible
name.
