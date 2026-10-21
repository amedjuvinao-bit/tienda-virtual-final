# Continuous decorative journey

The storefront now uses one persistent composition of store-configured images across its sections. The path changes continuously with scroll; scrolling back restores the same pose. The ornament nodes stay mounted, and no product content or media players are cloned.

## Administration

Apariencia → General → Animación global → Camino continuo.

- **Adornos**: upload a transparent PNG/WebP as the main decoration, optionally add a second one. There is no business-specific preset or restore button.
- **Recorrido**: choose enveloping curves or side paths, size, density, depth, opacity and the connecting thread.
- **Fondo**: use one continuous background image, the store background color, or the individual section backgrounds.
- **Móvil**: set the size and density used by the adapted mobile mode.

The existing intensity, pace, mobile mode and global enable controls remain available. The old section entrance presets can be selected under “Entradas por sección”. Their identifiers and saved values remain compatible. Existing configurations without an `experience` field use the continuous journey mode. Its initial state has no images, no connecting line and no shared background. Nothing decorative appears until the store configures it. Explicitly saved resources remain intact.

Settings are stored under `theme.global.sectionMotion.experience` and `theme.global.sectionMotion.journey`, using the existing appearance save endpoint. No account credentials or backend setup are required for the decoration.

The admin preview uses the production journey engine, the current store’s images and its configured colors. It does not fall back to a boutique catalog or stock background. The preview scales decoration sizes to its viewport; changing sections keeps the same ornaments. The mobile navigation still targets the natural section starts.

The connecting line follows the store accent color unless the administrator selects an override. Its color can be reset to the store color. A shared background is opt-in and can use a store-uploaded image or its background color. Clearing an image leaves it empty rather than restoring stock artwork.

## Rendering and accessibility

A single SVG world is pinned within the storefront. A continuous cubic curve determines the path and the ornament transforms. Scroll events schedule one animation frame, with no idle rendering loop. Short-lived local transitions update occlusion while they run. A sharp mask places decorations visually behind real text, photos and controls without changing component layout or intercepting pointer events. Neither the source images nor the mask use a blur filter. Near unboxed text, the entire ornament fades out continuously and reappears intact after passing it, avoiding rectangular fragments around headings. Depth comes from movement, scale and a separate shadow composed after the ornament transforms; its dimensions follow viewport pixels and adapt to mobile and preview sizes.

Reduced motion keeps a static decorative pose. The mobile “off” mode removes the decoration and restores the individual backgrounds. The desktop and mobile density limits bound the rendering cost. Changing to a different route, disabling the effect or unmounting releases its observers and listeners.

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

`docs/previews/floral-journey.mp4` is captured from the real Home components with an explicitly configured floral resource and a controlled demonstration catalog; this is an example, not the initial state for stores. It shows a continuous scroll from Categories to Information. The existing four-preset clip remains available as a legacy entrance comparison.
