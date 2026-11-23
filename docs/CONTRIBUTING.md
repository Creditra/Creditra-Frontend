# Contributing

Thanks for taking the time to contribute to Creditra Frontend. This guide is the rules of
the road: branching, commits, PR conventions, review checklists, and the discipline that
keeps the design system intact.

If you're new to the codebase, read [`ARCHITECTURE.md`](ARCHITECTURE.md) and
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) first. They tell you *where* things go and *why*.

---

## 1. Branching

- Feature branches off `main`.
- Use a short kebab-case prefix that mirrors the conventional-commit category:
  - `feat/draw-credit-confirm`
  - `fix/landing-cta-focus-ring`
  - `refactor/wallet-context-reducer`
  - `docs/architecture-data-flow`
  - `test/amount-validation-edge-cases`
  - `chore/upgrade-vite`

Branch names show up in PR lists; treat them as documentation.

---

## 2. Commits

We use [Conventional Commits](https://www.conventionalcommits.org/). The subject is **≤ 72 characters**, **imperative mood**, **no trailing period**.

| Type | Use for |
| --- | --- |
| `feat:` | User-visible new capability |
| `fix:` | Bug fix |
| `refactor:` | Non-behavioural code change |
| `perf:` | Performance improvement that doesn't change behaviour |
| `docs:` | Documentation only |
| `test:` | Tests only |
| `chore:` | Tooling, dependencies, repo hygiene |
| `style:` | Formatting, whitespace, no logic change |
| `revert:` | Revert a previous commit |

Optional scope in parentheses for clarity: `feat(draw): add APR + total-cost to preview`.

### Atomic commits

One logical change per commit. If your commit message includes "and", you probably want
two commits. Reviewers can read 20 lines of focused diff; they cannot read 800 lines of
mixed concerns.

### Body

Use the body to explain *why* the change was made and what trade-offs you considered. The
*what* is in the diff. The *why* survives the diff.

---

## 3. Pull requests

- Title in conventional-commit form (matches the squash subject).
- Body includes:
  - **Summary** — what changed and why
  - **Screenshots / GIFs** for any UI change (before + after)
  - **Test plan** — bulleted checklist of how you verified the change
  - **Linked issue** — `Closes #123` or `Refs #456`
- Keep PRs **small and focused**. 200 lines of diff or fewer is the sweet spot. If a
  feature genuinely needs more, split it: introduce types and tests first, then wire up
  the UI, then add the polish.

### Review checklist

Reviewers paste this into their first review comment:

```markdown
### Review checklist

- [ ] PR is one logical change, not a stack
- [ ] Conventional-commit title
- [ ] Tests added or updated for new behaviour
- [ ] Screenshots for UI change
- [ ] No new TypeScript errors (`npm run build` passes)
- [ ] Lint clean (`npm run lint`)
- [ ] Existing test count is neutral or higher

### Accessibility check (UI changes only)

- [ ] Keyboard navigation works (Tab, Shift+Tab, Enter, Escape)
- [ ] Focus indicators are visible
- [ ] Contrast ratios meet WCAG AA (4.5:1 text, 3:1 large/icons)
- [ ] Touch targets are at least 44x44 px
- [ ] Semantic HTML; ARIA only where no native element fits
- [ ] prefers-reduced-motion is respected

### Design-token check (UI changes only)

- [ ] No new inline hex values; tokens used from src/index.css or src/utils/tokens.ts
- [ ] No new inline spacing values; CSS custom properties used (--space-*)
- [ ] New tokens, if any, are added to both src/utils/tokens.ts and Design System/tokens.md
```

### Squash on merge

We squash-merge to `main`. The PR title becomes the squash commit subject; the PR body
becomes the squash body. Title hygiene matters because it is what `git log` shows.

---

## 4. Design-token discipline

A new component must not introduce a new color, spacing value, or radius. The tokens
exist exactly so that components stay visually consistent.

- **If the value already exists in a token**: use the token.
- **If the value doesn't exist but is genuinely needed**: add it to
  `src/index.css` (CSS variable) and `src/utils/tokens.ts` (JS constant), document it in
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), and update [`../Design System/tokens.md`](../Design%20System/tokens.md)
  in the same PR.
- **If the value exists but doesn't fit the new use**: the design system needs a
  conversation, not a one-off override.

Hard-coded hex values in a CSS file or `style={{ color: '#abc' }}` are a review blocker.

---

## 5. Accessibility discipline

UI changes must pass the accessibility checklist in section 3. See
[`ACCESSIBILITY.md`](ACCESSIBILITY.md) for per-pattern guidance.

- Every modal composes `useFocusTrap` + `useBodyScrollLock` + `useInertBackdrop`.
- Every icon-only button has `aria-label`.
- Color is never the sole signal.
- Touch targets ≥ 44 × 44 px.

---

## 6. Local checks before opening a PR

```bash
npm run lint
npm test -- --run
npm run build
npm audit --omit=dev --audit-level=high
```

If any fail, fix the underlying problem rather than silencing it.

- **Lint failure** — fix the code, don't add `// eslint-disable-next-line`.
- **Test failure** — fix the code or the test (whichever is wrong); never `.skip` a test
  to make a PR green.
- **TypeScript error** — fix the type, don't reach for `as any` or `@ts-ignore`. The
  project sets `strict: true` for a reason.
- **Audit failure** — upgrade or replace the affected production dependency rather than
  ignoring the advisory.

Exception: when working on docs-only or comment-only PRs, you may inherit existing
failures from `main`. You may **not worsen** them. The neutral-or-positive bar from the
checklist applies.

### CI security & dependency checks

In addition to `build`, Frontend CI runs two security checks using the shared `npm`
dependency cache:

- **`security` (`npm audit --omit=dev --audit-level=high`)** — runs on pushes to `main`
  and on pull requests. It audits only production dependencies (`--omit=dev`) so that
  dev-only tooling (test runners, linters, build plugins) does not block PRs when it is
  not shipped to users.
- **`dependency-review` (`actions/dependency-review-action@v4`)** — runs on pull requests
  only, with `fail-on-severity: high` and job-scoped `contents: read` / `pull-requests: write`
  permissions. It inspects dependency changes introduced by the PR and comments on the PR
  if a vulnerable package is added.

**Why `high` severity?** Failing on `high` and `critical` advisories blocks meaningful
production risk while avoiding frequent false-positive CI breaks from `low` or `moderate`
advisories that have low exploitability in a client-side bundle or no upstream fix yet.

**Reproducing locally:**

```bash
# View all production dependency advisories
npm audit --omit=dev

# Match the exact CI failure threshold (exits non-zero on high/critical)
npm audit --omit=dev --audit-level=high
```

`dependency-review` compares the PR's lockfile diff against `main` on GitHub. Before
pushing dependency changes, run `npm audit --omit=dev --audit-level=high` locally and
review `git diff main -- package-lock.json` to ensure no high- or critical-severity
packages are introduced.

---

## 7. Types and modelling

- Discriminated unions for state machines (`ConnectionStatus`, `WalletError`,
  `NotificationType`).
- `type` for object shapes; `interface` only when declaration merging is needed.
- Component props in the same file as the component (`interface Props { … }`).
- Public utility return types are explicit — don't rely on inference for an exported
  function.

---

## 8. File and naming conventions

| Kind | Convention | Example |
| --- | --- | --- |
| React component file | PascalCase `.tsx` | `WalletButton.tsx` |
| Hook file | camelCase `.ts` with `use` prefix | `useFocusTrap.ts` |
| Util file | kebab-case `.ts` or camelCase `.ts` | `amount-validation.ts` or `tokens.ts` |
| Type file | kebab-case `.ts` with `.types` suffix where it disambiguates | `draw-credit.types.ts` |
| Test file | matches the file it covers, `.test.ts(x)` | `WalletButton.test.tsx` |
| CSS module / stylesheet | matches the component | `WalletButton.css` |

Co-locate test and CSS files with the code they belong to.

---

## 9. Importing

- `@/` is the alias for `src/`. Prefer absolute aliased imports over deep relative paths
  (`../../../`).
- Import order: React → third-party → `@/` → relative `./`.
- One import per line in long lists.
- Don't import from `index.ts` barrels we haven't introduced — there are none today,
  and we'd like to defer the decision.

---

## 10. Documentation

- Every exported component, hook, or utility has TSDoc explaining purpose, params (or
  props), return shape, and side effects.
- If your change touches a documented decision (e.g. why we have an onboarding stepper),
  update [`UX_RATIONALE.md`](UX_RATIONALE.md) in the same PR.
- New tokens go into both `src/index.css` (or `src/utils/tokens.ts`) and
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).
- New a11y patterns go into [`ACCESSIBILITY.md`](ACCESSIBILITY.md).
- New performance trade-offs go into [`PERFORMANCE.md`](PERFORMANCE.md).

Docs are part of the product. PRs that ship code without docs are incomplete.
