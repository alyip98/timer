# Float Timer

A simple installable timer PWA with an always-on-top floating mini window (Document Picture-in-Picture, desktop Chrome/Edge/Brave).

## Desktop app (Electron)

`desktop/` wraps the same page in a frameless window. "Always on top" shrinks it to a tiny floating clock (play/pause only, drag anywhere, double-click the time to restore).

```
cd desktop
npm install
npm start        # run it
npm run dist     # build an installer into desktop/dist
```

The **Build desktop app** GitHub Action builds Mac (.dmg), Windows (.exe) and Linux (.AppImage) installers; run it from the Actions tab and download the artifacts.
