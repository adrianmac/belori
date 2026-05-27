## 2025-02-14 - Add loading spinners to primary buttons
**Learning:** Changing button text from 'Save' to 'Saving...' is a common anti-pattern that can cause layout shifts. Passing a `loading={true}` prop to a standardized button component that adds a visual spinner and `aria-busy={true}` provides better accessibility and interaction design.
**Action:** Replaced dynamic text with a generic loading prop on `PrimaryBtn` and `GhostBtn`.
