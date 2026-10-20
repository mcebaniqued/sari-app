# Deferred work

- [ ] Investigate the frontend bundle-size warning. The production build currently emits a JavaScript chunk above Vite's 500 kB warning threshold. Review route-level lazy loading and dependency splitting in `web/src/App.tsx` and the pantry table imports; verify behavior and build output in a separate performance branch.
