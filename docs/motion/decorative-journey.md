# Continuous decorative journey

The storefront uses the selected **Capas con parallax** handover: photographs, type and secondary pieces move on different planes as sections overlap. The shared store background and configured ornaments remain continuous. No product content or media players are cloned.

## Composition and rendering

`storefrontJourneyParallax.js` translates the real content without changing its dimensions, opacity, rotation or native component transforms. Photographs lead the arrival, type follows, and secondary pieces travel on a separate plane. Arrival combines scroll progress with a finishing timeline, so stopping the scroll does not leave the incoming content displaced indefinitely. Outgoing movement reverses when scrolling back. Frames stop scheduling when settled.

Sections pin at the end of their natural height, preserving long-section reading and navigation targets. Only outgoing content is clipped as the next section arrives; no opaque cover hides the shared ornament layer. Completed sections remain covered until revisited. Layout measurements temporarily release pinning and use local element dimensions, including the optical rims in Looks.

Carousels and footer columns move as whole interactive groups. Pointer gestures hold their current position through release; keyboard focus restores the readable layout. Preview viewports, reduced motion and disabled mobile motion use the same engine and cleanup path. Saved entrance presets remain separate from the journey.

Artwork keeps the existing rigid cinematic movement, intrinsic image proportions, independent vertical length, 3D depth and spacing controls. The connecting cord remains hidden. Primary and secondary resources remain store-configured; this effect introduces no default business images or branding.

The curved background curtain is no longer mounted by `StorefrontStory`. The administration preview renders the same parallax layers as the storefront. Existing curtain source files remain available without affecting this selected experience.

## Administration

Apariencia → General → Animación global → Camino continuo.

- **Adornos**: primary transparent PNG/WebP and optional secondary artwork. No fixed brand, business motif or stock image is inserted.
- **Recorrido**: artwork size, independent vertical length, density, depth and opacity. Global intensity controls layer travel; pace controls arrival and smoothing.
- **Secciones**: section selection, enable switch, automatic/left/right/lower framing, relative size and presence.
- **Fondo**: individual backgrounds or an opt-in shared store image/color.
- **Móvil**: artwork size, independent vertical length and density in adapted mode. Content travel is moderated on narrow viewports.

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
