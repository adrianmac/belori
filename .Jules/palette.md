## 2024-05-29 - [Loading states in PrimaryBtn]
**Learning:** Hardcoding loading labels (e.g. `saving ? 'Saving…' : 'Add'`) forces translations to occur manually everywhere, causing inconsistencies in user experience (spinner vs text) and accessibility (aria-busy missing).
**Action:** Created `loading` prop in `PrimaryBtn` and `GhostBtn` to handle visual loading feedback with an inline `SpinnerIcon` while implicitly assigning the `aria-busy={true}` accessibility and standardizing disablement (`disabled={disabled || loading}`). Applied these to modal buttons.
