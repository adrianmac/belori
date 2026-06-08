## 2024-06-08 - Accessible Close Buttons
**Learning:** Found an icon-only modal close button ("×") without proper ARIA labeling, making it difficult for screen reader users to understand the button's purpose in the `StandaloneAppointmentModal.jsx`. The visual "×" needs `aria-label="Close"` and `title="Close"` to be properly announced by assistive technology.
**Action:** Added `aria-label="Close"` and `title="Close"` to the close button in `src/components/StandaloneAppointmentModal.jsx`. Ensure all icon-only buttons receive descriptive aria labels moving forward.
