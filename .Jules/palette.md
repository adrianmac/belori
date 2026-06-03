
## 2024-06-03 - Modal Close Buttons Accessibility Pattern
**Learning:** Found a widespread pattern of icon-only `×` close buttons in custom modals lacking `aria-label`s, rendering them completely invisible to screen readers. Relying solely on a textual `×` symbol provides no semantic meaning.
**Action:** When creating or modifying modal close buttons or dynamic action buttons (e.g. "Clear selection" with an X icon), always add an explicit `aria-label` (e.g., `aria-label="Close" title="Close"`) to ensure assistive technologies can announce the interaction properly. I added these to three core modals as a proof of concept.
