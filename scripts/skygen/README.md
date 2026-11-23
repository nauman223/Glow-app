# Sky image generator

Regenerates the original sky artwork in `public/skies/` (used by screen 27 Replace sky and by
One-tap themes). The skies are drawn procedurally (gradients, noise clouds, aurora bands,
stars), so the repo contains no third-party photos.

1. Open `skies.html` in headless Chrome and dump the rendered DOM, for example:
   `chrome --headless --disable-gpu --dump-dom scripts/skygen/skies.html > skies-dom.html`
2. `node scripts/skygen/extract.mjs skies-dom.html public/skies`

This writes `public/skies/<id>.webp` (1280×854) and `public/skies/thumbs/<id>.webp` (136 px).
