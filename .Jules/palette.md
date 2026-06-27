
## 2024-06-27 - Add ARIA Labels to POS Page Icon Buttons
**Learning:** Icon-only buttons without `aria-label`s are inaccessible to screen readers, making it difficult for users to interact with critical features like cart quantity adjustments and item removal.
**Action:** When working on point-of-sale or cart features, always ensure that all icon-only interactive elements (`+`, `-`, `×`) have descriptive `aria-label`s (e.g. `aria-label="Increase quantity"`).
