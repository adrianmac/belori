## 2024-05-20 - [Add generic loading state to PrimaryBtn]
**Learning:** Hard-coding "Saving..." or similar state logic inside consumers causes bloated code across files, and often leads to skipping aria-busy attributes because of the hassle.
**Action:** Always provide a native `loading={bool}` property for interactive core UI elements. This keeps consumers simpler, creates a consistent loading experience visually (e.g. using the same spinner), and guarantees the `aria-busy` tag is attached automatically when it's loading.
