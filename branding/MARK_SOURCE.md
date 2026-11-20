# Arcad View document mark

The user's folded-document/crosshair reference replaces the previous A-shaped
mark. The selected color master is `arcad-mark-metal-master.png`, produced using
the built-in image generation tool from the supplied reference. Two discarded
transparent drafts are not part of the project. The opaque navy master avoids
matting artifacts and keeps the silver crosshair legible at small sizes.

`scripts/generate-android-icons.ps1` exports all bitmap density variants, the
web mark, and the square Play icon using Windows System.Drawing. It resizes and
packages the selected master; it does not reconstruct the artwork. The adaptive
foreground places the source at 72dp within its 108dp layer, leaving the actual
approximately 53dp emblem within the central 66dp safe zone described in the
[Android adaptive-icon guide](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
The monochrome drawable is a simplified document/crosshair silhouette for themed
icons. Android 13 themed rendering requires testing on a supporting device.

The web UI uses `/arcad-mark.png` for the home, viewer, loader, information and
update-dialog marks. App text and company text remain UI text, so small launcher
icons contain only the symbol. Original drawing files are unrelated and unchanged.

## Final built-in image-generation prompt

Create the final production Android app icon from this reference. Preserve the
reference's blue folded-document outline with an opening at the bottom center and
a centered white/silver four-arm crosshair with a hollow square at its intersection.
Remove ALL lettering, all company text, and the two decorative horizontal lines.
Center and enlarge only that emblem on a square canvas. The emblem should occupy
about 72% of the canvas width and height, with equal margins, designed for readability
at 48 pixels. Refine the document frame into elegant blue anodized metal using only
broad smooth cobalt/cyan gradients, modest crisp bevels and thin clean edge highlights
INSIDE its silhouette; make the folded corner light cyan metal and the crosshair
satin platinum silver. This is precise clean graphic logo artwork, not a photograph,
no distressed or noisy texture. Background: completely opaque, uniform SOLID dark navy
hexadecimal #071A30 across the entire canvas, including the document interior, all
margins, and the hollow central square. Do NOT remove background or introduce
transparency. No checkerboard, no rounded-square outer tile or white corners:
edge-to-edge navy square. No text, no letters, no A shape, no triangles except the
folded page corner, no sparks, no scattered fragments, no glow, no drop shadows.
Keep smooth crisp anti-aliased edges and the original folded-document/crosshair
identity. Return ONE square app icon, not a mockup or presentation.
