## 2024-05-18 - [Accessibility on Modals]
**Learning:** React modal implementations often skip critical ARIA requirements (role, modal truthiness, labeledby) resulting in an opaque experience for screen readers. Auto-focusing safe actions (like Cancel) traps focus smoothly and avoids catastrophic accidental clicks.
**Action:** When adding or auditing modal elements, assure `role="dialog"`, `aria-modal="true"`, and connect an accessible title and description to `aria-labelledby` and `aria-describedby` respectively. Auto-focus the negative/cancellation route as default.
