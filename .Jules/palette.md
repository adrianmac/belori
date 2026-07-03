## 2024-07-03 - Accessible Modal Close Buttons
**Learning:** Found non-semantic `<span onClick={...}>×</span>` close buttons in modal headers (e.g., `src/pages/event-detail/PaymentMilestonesCard.jsx`). These miss keyboard accessibility and screen reader support.
**Action:** Replace them with semantic `<button aria-label="Close" title="Close" onClick={...} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', ... }}>×</button>` to ensure a11y compliance while keeping existing design.
