---
name: Expo tabs layout convention
description: The app/(tabs)/_layout.tsx file must ONLY define the Tabs navigator — never duplicate providers or Stack navigators.
---

**Rule:** In Expo Router, `app/_layout.tsx` is the root layout (providers + Stack). `app/(tabs)/_layout.tsx` should ONLY export a `<Tabs>` navigator defining the bottom tab bar.

**Why:** Putting providers or a `<Stack>` in `app/(tabs)/_layout.tsx` breaks the routing hierarchy. In this project, a previous agent accidentally put a full root layout (with KitchenMemoryProvider and FamilyProvider) in the tabs layout file, causing bundle errors.

**How to apply:**
```tsx
// app/(tabs)/_layout.tsx — correct minimal form
export default function TabsLayout() {
  return <Tabs screenOptions={...}>{TABS.map(...)}</Tabs>;
}
```
All providers belong in `app/_layout.tsx` only.
