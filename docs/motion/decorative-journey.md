# Continuous decorative journey

The storefront shares one continuous curved route, a chain of store-configured ornaments and a moving trace between its sections. The same ornament nodes remain mounted. Scrolling forward advances the chain and the illuminated line; scrolling back reverses both. No product content or media players are cloned.

## Composition and rendering

The original multi-ornament route is restored. Artwork keeps its configured size, with moderate perspective variation; it is not shrunk into isolated empty pockets. Arc-length spacing and a stable count derived from density and artwork size prevent overlapping clusters and redistribution between frames. Density changes the chain's spacing, rather than promising an exact number of visible pieces.

Each section frames the shared curve according to its structure. The measured section order and actual heights control progress. Compositions morph during handoff, including custom left/right/lower placement. Relative size, presence and the section enable switch remain configurable. Mobile has its own artwork size and density.

A base line connects the ornaments, and a brighter segment traces its progress. The trace reverses with scroll and shares the exact same curve as the chain. Configured resources automatically restore the line, including legacy settings that had it off. The administrator can explicitly turn it off using `trailLine:false`; this choice survives normalization and reloading. Empty stores still have no art or line until configured.

Photographs, cards, highlights, text and controls protect their pixels with an SVG mask. Text protection follows actual text lines, not full-width heading blocks. Small remnants behind a photograph fade as whole ornaments. The images remain sharp; shadows are applied separately. The SVG never intercepts input. Scroll smoothing settles and stops without an idle animation loop. Reduced motion freezes the decorative world; mobile off removes it. Observers and listeners are released on unmount.

## Administration

Apariencia → General → Animación global → Camino continuo.

- **Adornos**: primary transparent PNG/WebP and optional secondary artwork. No fixed brand, business motif or stock image is inserted.
- **Recorrido**: curve style, artwork size, density, depth, opacity, line enable and line color. The line uses the store accent unless overridden.
- **Secciones**: section selection, enable switch, automatic/left/right/lower framing, relative size and presence.
- **Fondo**: individual backgrounds or an opt-in shared store image/color.
- **Móvil**: size and density in adapted mode.

All settings use the existing appearance save endpoint under `theme.global.sectionMotion.journey`. Legacy entrance presets remain selectable. The admin preview uses the production engine and current store assets. No credentials or backend setup are needed.

## Verification

Tests cover persistent nodes, reversible movement, trace progress, mobile density, reduced motion, input protection, cleanup and saved line visibility. Admin tests cover uploads and persistence. Browser review uses actual Home components with a controlled catalog; it is not the user's live store configuration.

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
