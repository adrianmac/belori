## 2024-07-09 - Accessible Close Buttons
**Learning:** Replacing `<span>&times;</span>` or bare `<button>×</button>` with semantic buttons containing `aria-label="Close"` and `title="Close"` makes modal dialogs much more accessible to screen readers, while preserving visual styling. Added to modal components. Found that automated script replacement helps ensure consistency across many modals.
**Action:** Always ensure close buttons in modals have proper ARIA attributes, especially when they only contain a visual icon or character.
