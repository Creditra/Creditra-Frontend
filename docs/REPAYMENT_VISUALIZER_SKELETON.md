# RepaymentVisualizer — First-Paint Loading Skeleton

Themed shimmer placeholder shown on the first paint of `RepaymentVisualizer`
while the repayment schedule chart is preparing to commit.

---

## Why this exists

Without a skeleton, the chart card can pop in after layout work, causing a
visible jump (CLS). The skeleton occupies the same card geometry — header row,
220px chart plane, legend row — so the transition to real content is stable.

---

## Components involved

| File | Role |
|---|---|
| `src/components/RepaymentVisualizer.tsx` | Hosts `RepaymentVisualizerSkeleton` and the `loading` / first-paint gate. |
| `src/components/Skeleton.tsx` | Shared shimmer primitive (tokens + reduced-motion). |
| `src/pages/RepaymentVisualizer.tsx` | Re-exports component + skeleton for the route module path. |

---

## How the loading state works

```ts
// loading omitted → one-frame first-paint skeleton
const [bootstrapping, setBootstrapping] = useState(true);
useEffect(() => {
  const id = setTimeout(() => setBootstrapping(false), 0);
  return () => clearTimeout(id);
}, [principal, apr, monthlyPayment]);

if (loading === true || bootstrapping) {
  return <RepaymentVisualizerSkeleton />;
}
```

| `loading` prop | Behavior |
|---|---|
| omitted | First-paint skeleton for one macrotask, then chart |
| `true` | Skeleton stays until the prop flips |
| `false` | Skip skeleton (preferred in sync unit tests) |

---

## Accessibility

- Wrapper: `role="status"`, `aria-busy="true"`,
  `aria-label="Loading repayment plan visualizer"` (WCAG 2.1 AA — SC 4.1.3).
- Placeholder shapes are `aria-hidden` so assistive tech does not narrate them.
- Shimmer respects `prefers-reduced-motion` / `[data-motion="reduced"]` via
  `Skeleton.css`.

---

## Tests

| File | Coverage |
|---|---|
| `src/components/__tests__/RepaymentVisualizer.skeleton.test.tsx` | Skeleton a11y, shape parity, `loading` prop, first-paint timer |
