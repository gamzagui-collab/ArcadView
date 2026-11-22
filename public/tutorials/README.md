# Offline home guide illustrations

Original illustrations for Arcad View, GUI's Arc Industry, under this repository's GPL-3.0-only license. These are drawn demonstrations of the real workflows, not recordings or copies of a customer's drawing. No cloud request, login, token or library import is required to view them.

- `measure.gif`: hold to position the pointer above the fingertip, release the first point, move to the second point, and read 6,000 mm. 10 seconds.
- `takeoff.gif`: trace a 6m wall, Finish, enter 3m height and 200mm thickness, confirm and read 3.600m³. 12 seconds.
- `layers.gif`: open the layer selector, select Takeoff, switch from A to B, hide A and inspect B's current-layer total. The drawn slab is 2.7m x 1.2m x 0.18m = 0.5832m³, displayed as 0.583m³. 11 seconds.
- `*-poster.png`: static final states for paused guides, off-screen slides and reduced-motion users. Text descriptions in the app explain each workflow in Korean, English and Turkish.
- `sample-floor-plan.dxf`: the original 6m x 3m example plan's line/door geometry, drawing units mm. Viewing the guide never adds this file to the user's library.
- `manifest.json`: generated dimensions, actual decoded duration/frame count and file size.

Regenerate from the repository root with `python scripts/generate-home-guides.py`, using Python 3.13 and Pillow 12.0.0 (`python -m pip install Pillow==12.0.0`). It uses only the existing bundled NanumGothic font and procedural drawing geometry. No image generation API is used. The Android app only consumes the generated files; Python/Pillow are not runtime dependencies.
