## 2024-06-15 - [Missing ARIA labels on modal close buttons]
**Learning:** Found multiple instances of icon-only close buttons ('×') in modals lacking descriptive `aria-label` and `title` attributes, which impairs accessibility for screen reader users.
**Action:** When implementing modal components, always verify that icon-only buttons include an `aria-label="Close"` and `title="Close"` to ensure the action is explicitly described.
