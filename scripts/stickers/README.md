# Sticker tools

- `generate-pro-stickers.mjs`: regenerates the original Glow Pro sticker pack.
  `node scripts/stickers/generate-pro-stickers.mjs public/stickers/pro`
- `check-stickers.py`: safety check for every bundled sticker SVG. It checks that each file is
  valid XML with a viewBox, has no scripts, event handlers, external references, embedded
  images, `foreignObject` or styles, and only uses `url(#id)` references to its own gradients.
  Run it after adding or editing stickers: `python -I scripts/stickers/check-stickers.py public/stickers`
