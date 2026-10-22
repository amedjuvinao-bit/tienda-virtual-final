# Continuous decorative journey

One store-owned transparent image follows a continuous, reversible path between the real storefront sections. The same SVG image stays mounted throughout the journey; no content or media players are duplicated. Artwork and backgrounds remain store-specific, with no built-in business motif.

## Background composition

The ornament uses empty background space. Photographs, product cards, complete Instagram panels (including every highlight), text, controls and the visible header are protected. A placement pass searches for a whole free pocket near the section's intended path and reduces the image to fit. Text protection follows actual text lines rather than the full block width. A hidden header does not reserve an invisible exclusion area.

There is one ornament, without repeated small copies. During a passage behind dense content, the whole image is concealed instead of showing cut-up fragments or placing it over photos. The configured artwork stays sharp; its shadow is separate. Movement settles with bounded interpolation and stops when scrolling stops. The SVG never intercepts input.

Each section retains its own path, measured order, actual height, position override, relative scale and enable switch. The main image continues between them, including reordered sections and short footers. Mobile has adapted compositions. Reduced motion freezes the pose, and the mobile off mode removes the effect. Observers and listeners are released on unmount.

## Administration

Apariencia → General → Animación global → Camino continuo.

- **Adornos**: upload one transparent PNG/WebP. A previously saved secondary image remains a fallback if there is no primary image; replacing or clearing the displayed resource clears that fallback too.
- **Recorrido**: path, maximum size, depth, opacity and optional path line, with the store accent color or an override.
- **Secciones**: select a section, choose automatic/left/right/lower composition, adjust relative scale or disable that section's ornament.
- **Fondo**: keep individual backgrounds or opt into a shared store image/color.
- **Móvil**: maximum size in adapted mode.

The maximum size adapts to the available background space. Old density and accompaniment values are retained in saved configuration for compatibility, but no longer generate repeated artwork or appear as inactive controls. Existing legacy entrance presets remain selectable.

Settings use the existing appearance save endpoint under `theme.global.sectionMotion.journey`. The admin preview uses the production engine and current store resources. No credentials or backend setup are required.

## Verification

Placement tests cover occupied photos, full social panels, resizing into free space and complete concealment during a covered passage. Engine tests cover a single persistent node, reversible scroll, mobile/reduced motion, input behavior and cleanup. Admin tests verify resource replacement and persistence. Browser review uses the actual Home components with a controlled catalog; it does not represent the user's live store configuration.

## Optional demonstration resource

- Example asset (not referenced by runtime defaults): `frontend/public/story/floral-spray-v1.webp`.
- True alpha, 640 × 768, optimized WebP. The original generated PNG is preserved outside the repository.
- Generated using the built-in image generation tool, with `frontend/public/looks-editorial-background.webp` as a style and palette reference. This is new artwork, rather than an extraction of the original background.

Final generation prompt:

> Use case: stylized-concept. Asset type: transparent botanical cutout for a continuous floral garland animated across a luxury boutique website. The reference image is STYLE and PALETTE REFERENCE ONLY. Create ONE single exquisite botanical spray: 3 blush pink garden roses, one small cream rose, tiny ivory baby's breath flowers, subtle soft lavender buds, sparse warm olive-gold leaves and fine gracefully curved stems. The spray should be light, airy, asymmetrical, elongated along a gently rising diagonal, the stems visible at the bottom, with natural petal texture and soft dimensional lighting matching the reference. All flowers and leaves intact inside the canvas with clear transparent margins around every tip. Photorealistic botanical arrangement, refined sculptural depth, soft warm light from upper left, no hard shadows. True transparent background with clean alpha edges, no ground, no container, no ribbon, no frame, no text, no satin, no baked backdrop, no checkerboard drawn into the image. This will be repeated along a curving vine, so it must work as a delicate independent botanical sprig rather than a rectangular border or massive bouquet.

## Verification

- Persistent ornament identity, reversible scroll, occlusion geometry, media uniqueness, mobile density, reduced motion and event cleanup.
- Admin uploads and settings persistence, including toggling between the journey and legacy entrances.
- Actual Home in Chromium: desktop and mobile, section traversal, clickable cards, no horizontal overflow, mobile guide arrival and interruption.
- Admin preview in Chromium: desktop/mobile, interactive scrubber, settings persistence and reduced motion.
- Production build.

`docs/previews/floral-journey.mp4` is a historical example recorded before the section-specific choreography. It was captured from the real Home components with an explicitly configured floral resource and a controlled demonstration catalog; this is an example, not the initial state for stores. It shows a continuous scroll from Categories to Information. The existing four-preset clip remains available as a legacy entrance comparison.
