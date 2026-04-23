## 2024-04-13 - [Missing ARIA on Floating Action Buttons]
**Learning:** Found that custom Floating Action Buttons (FABs) in this app rely purely on visual icons (`+`, emojis) and `title` attributes, lacking screen reader support (`aria-label`) and state communication (`aria-expanded`).
**Action:** Always add `aria-label`, `aria-expanded`, and `aria-haspopup` when building or updating fanning action buttons or dropdowns to ensure screen reader users understand the component's state and actions.
