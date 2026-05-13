// src/components/CarouselBanner.jsx
import "keen-slider/keen-slider.min.css"
import { useKeenSlider } from "keen-slider/react"
import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { X } from "lucide-react"
import { fetchSiteSettings } from "../lib/siteSettingsApi" // ✅ MISMA RUTA QUE APPEARANCEPAGE

export default function CarouselBanner() {
  const [loaded, setLoaded] = useState(false)
  const intervalRef = useRef(null)
  const rafRef = useRef(null)
  const startTsRef = useRef(0)

  const isPaused = useRef(false)
  const [selectedImage, setSelectedImage] = useState(null)

  // ✅ settings banner
  const [banner, setBanner] = useState(null) // theme.banner
  const [bannerLoading, setBannerLoading] = useState(true)

  // ✅ Para dots / slide actual
  const [currentSlide, setCurrentSlide] = useState(0)

  // ✅ progreso del círculo (0..1)
  const [progress, setProgress] = useState(0)

  // ✅ tick para forzar replay de animación (CLAVE)
  const [slideAnimTick, setSlideAnimTick] = useState(0)

  // ✅ NUEVO: mostrar/ocultar botones para que aparezcan SOLO al terminar la transición de la foto
  const [showButtons, setShowButtons] = useState(true)
  const btnTimerRef = useRef(null)

  // =========================
  // ✅ OPCIÓN A: Botón nunca se recorta
  // =========================
  const bannerBoxRef = useRef(null)
  const [bannerBox, setBannerBox] = useState({ w: 0, h: 0 })

  // ✅ Responsive automático interno
  const [viewportWidth, setViewportWidth] = useState(() => {
    if (typeof window === "undefined") return 1280
    return window.innerWidth || 1280
  })

  // Guardamos tamaños reales de cada botón renderizado
  const btnSizeMapRef = useRef(new Map())
  const [btnSizeTick, setBtnSizeTick] = useState(0)

  // ✅ Guardamos observers por botón para poder limpiar
  const btnObserverMapRef = useRef(new Map())

  // ✅ Evitar setState directo dentro de callback ref
  const pendingBtnTickRef = useRef(false)
  const scheduleBtnTick = useCallback(() => {
    if (pendingBtnTickRef.current) return
    pendingBtnTickRef.current = true
    requestAnimationFrame(() => {
      pendingBtnTickRef.current = false
      setBtnSizeTick((t) => t + 1)
    })
  }, [])

  // ✅ refetch helper (REUTILIZABLE)
  const loadBannerSettings = useCallback(async (opts = { silent: false }) => {
    try {
      if (!opts?.silent) setBannerLoading(true)
      const settings = await fetchSiteSettings()
      const b = settings?.theme?.banner || null
      setBanner(b)

      console.log("RB BANNER LOADED", {
        type: b?.type || "slider",
        slidesLen: Array.isArray(b?.slides) ? b.slides.length : 0,
        heightMode: b?.heightMode || "auto",
        firstSlideKeys: b?.slides?.[0] ? Object.keys(b.slides[0]) : [],
      })

      setSlideAnimTick((t) => t + 1)
    } catch (e) {
      console.error("❌ Error cargando site settings (banner):", e)
    } finally {
      setBannerLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (btnTimerRef.current) clearTimeout(btnTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const onResize = () => {
      setViewportWidth(window.innerWidth || 1280)
    }

    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    const el = bannerBoxRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries?.[0]
      if (!entry) return
      const cr = entry.contentRect
      const w = Math.round(cr.width || 0)
      const h = Math.round(cr.height || 0)
      setBannerBox((prev) => {
        if (prev.w === w && prev.h === h) return prev
        return { w, h }
      })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [bannerLoading, banner?.type, banner?.heightMode])

  const setBtnElRef = useCallback(
    (key) => {
      return (node) => {
        const prevObs = btnObserverMapRef.current.get(key)
        if (!node) {
          if (prevObs) {
            try {
              prevObs.disconnect()
            } catch (_) {}
            btnObserverMapRef.current.delete(key)
          }
          return
        }

        if (prevObs) {
          try {
            prevObs.disconnect()
          } catch (_) {}
          btnObserverMapRef.current.delete(key)
        }

        const rect = node.getBoundingClientRect()
        const w0 = Math.round(rect.width || 0)
        const h0 = Math.round(rect.height || 0)

        const prev = btnSizeMapRef.current.get(key)
        if (!prev || prev.w !== w0 || prev.h !== h0) {
          btnSizeMapRef.current.set(key, { w: w0, h: h0 })
          scheduleBtnTick()
        }

        const ro = new ResizeObserver((entries) => {
          const entry = entries?.[0]
          if (!entry) return
          const cr = entry.contentRect
          const w = Math.round(cr.width || 0)
          const h = Math.round(cr.height || 0)
          const cur = btnSizeMapRef.current.get(key)
          if (!cur || cur.w !== w || cur.h !== h) {
            btnSizeMapRef.current.set(key, { w, h })
            scheduleBtnTick()
          }
        })

        ro.observe(node)
        btnObserverMapRef.current.set(key, ro)
      }
    },
    [scheduleBtnTick]
  )

  const fallbackSlides = useMemo(
    () => [
      { image: "/banner1.jpg", link: "", text: "Descubre lo nuevo" },
      { image: "/banner2.jpg", link: "", text: "Colección especial" },
      { image: "/banner3.jpg", link: "", text: "Estilo y ternura" },
      { image: "/banner4.jpg", link: "", text: "Para cada ocasión" },
      { image: "/banner5.jpg", link: "", text: "Hecho con amor" },
      { image: "/banner6.jpg", link: "", text: "Lo mejor para ti" },
    ],
    []
  )

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted) return
      await loadBannerSettings({ silent: false })
    })()
    return () => {
      mounted = false
    }
  }, [loadBannerSettings])

  useEffect(() => {
    const onStorage = (e) => {
      if (e?.key === "rb_site_settings_tick") {
        loadBannerSettings({ silent: true })
      }
    }
    const onFocus = () => loadBannerSettings({ silent: true })

    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadBannerSettings({ silent: true })
      }
    }, 6000)

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
      clearInterval(poll)
    }
  }, [loadBannerSettings])

  const bannerType = bannerLoading ? "loading" : String(banner?.type || "slider")
  const heightMode = banner?.heightMode || "auto"

  const isMobile = viewportWidth < 640
  const isTablet = viewportWidth >= 640 && viewportWidth < 1024
  const isDesktop = viewportWidth >= 1024

  const autoplayMsRaw =
    Number(banner?.autoplayMs) ||
    Number(banner?.intervalMs) ||
    Number(banner?.durationMs) ||
    Number(banner?.sliderIntervalMs) ||
    3500

  const autoplayMs = Number.isFinite(autoplayMsRaw)
    ? Math.max(1200, Math.min(20000, autoplayMsRaw))
    : 3500

  const heightPxRaw = Number(banner?.heightPx)
  const heightPx = Number.isFinite(heightPxRaw) ? heightPxRaw : 520
  const clampedHeightPx = Math.max(240, Math.min(1200, heightPx))

  // ✅ en móvil y tablet el banner cubre toda la pantalla
  const responsiveHeightPx = useMemo(() => {
    if (isMobile) return Math.max(520, Math.min(860, clampedHeightPx))
    if (isTablet) return Math.max(560, Math.min(920, clampedHeightPx))
    return clampedHeightPx
  }, [isMobile, isTablet, clampedHeightPx])

  const responsiveFullscreenHeight = useMemo(() => {
    if (isMobile || isTablet) return "100dvh"
    return "100vh"
  }, [isMobile, isTablet])

  // ✅ SIN fondo / SIN espacio artificial debajo del header
  const heroWrapStyle = useMemo(() => ({}), [])

  const heroWrapClass =
    "w-full relative overflow-hidden border-t-1 border-[#d4af378f] z-10"

  const heroContainerClass = "w-full relative"

  const heroContainerStyle =
    heightMode === "fullscreen"
      ? { height: responsiveFullscreenHeight }
      : isMobile || isTablet
      ? { height: "100dvh" }
      : { height: `${responsiveHeightPx}px` }

  const heroFullscreenClass = ""

  const clamp0_100 = (n, fallback = 50) => {
    const x = Number(n)
    if (!Number.isFinite(x)) return fallback
    return Math.max(0, Math.min(100, x))
  }

  const normalizeFit = (v) => {
    const t = String(v || "cover").toLowerCase().trim()
    return t === "contain" ? "contain" : "cover"
  }

  const normalizeKind = (v) => {
    const k = String(v || "").toLowerCase().trim()
    if (k === "text" || k === "texto") return "text"
    if (k === "image" || k === "img" || k === "imagen" || k === "picture") return "image"
    return ""
  }

  const resolveImageUrl = (raw) => {
    const u0 = String(raw || "").trim()
    if (!u0) return ""
    const u = u0.replaceAll("\\", "/")
    if (/^(https?:)?\/\//i.test(u) || u.startsWith("data:")) return u
    if (u.startsWith("/")) return u
    return `/ImgBotones/${u}`
  }

  const resolveSlideImage = (s) => {
    const raw =
      s?.image ??
      s?.imageUrl ??
      s?.url ??
      s?.src ??
      s?.imageURL ??
      s?.imageSrc ??
      ""
    const u0 = String(raw || "").trim()
    if (!u0) return ""
    const u = u0.replaceAll("\\", "/")
    if (/^(https?:)?\/\//i.test(u) || u.startsWith("data:")) return u
    if (u.startsWith("/")) return u
    return `/${u}`
  }

  const defaultButton = useMemo(
    () => ({
      enabled: true,
      kind: "image",
      imageUrl: "/ImgBotones/VerMas2.png",
      text: "",
      link: "",
      posX: 50,
      posY: 92,
      widthPx: 200,
      style: "delicate",
      radius: "pill",
      anim: "fadeup",
      animDurationMs: 650,
      animDelayMs: 0,
    }),
    []
  )

  const normalizeButtons = (raw) => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.filter(Boolean)
    if (Array.isArray(raw?.buttons)) return raw.buttons.filter(Boolean)
    return [raw]
  }

  const pickButtons = (many, one) => {
    if (Array.isArray(many) && many.length > 0) return many
    return one || null
  }

  const normalizeAnim = (v) => {
    const t0 = String(v || "").toLowerCase().trim()
    if (!t0) return "fadeup"
    if (t0 === "inherit" || t0 === "heredar") return "fadeup"
    if (t0 === "sin animación" || t0 === "sin animacion" || t0 === "none") return "none"
    if (t0 === "fade") return "fade"
    if (t0 === "slide up" || t0 === "slide-up" || t0 === "slideup") return "slideup"
    if (t0 === "pop" || t0 === "softpop") return "softpop"
    if (t0 === "glow") return "glow"
    if (t0 === "shine") return "shine"
    if (t0 === "float") return "float"
    if (t0 === "fadedown") return "fadedown"
    if (t0 === "slideleft") return "slideleft"
    if (t0 === "slideright") return "slideright"
    if (t0 === "zoomin") return "zoomin"
    if (t0 === "fadeup") return "fadeup"
    if (t0 === "floatin") return "floatin"
    if (t0 === "goldsweep") return "goldsweep"
    if (t0 === "luxpop") return "luxpop"
    return "fadeup"
  }

  const animKeyframeFromPreset = (preset) => {
    const p = normalizeAnim(preset)
    if (p === "none") return ""
    if (p === "fade") return "rbFade"
    if (p === "slideup") return "rbFadeUp"
    if (p === "softpop") return "rbSoftPop"
    if (p === "glow") return "rbShine"
    if (p === "fadeup") return "rbFadeUp"
    if (p === "fadedown") return "rbFadeDown"
    if (p === "slideleft") return "rbSlideLeft"
    if (p === "slideright") return "rbSlideRight"
    if (p === "zoomin") return "rbZoomIn"
    if (p === "float") return "rbFloat"
    if (p === "shine") return "rbShine"
    if (p === "floatin") return "rbFloatIn"
    if (p === "goldsweep") return "rbGoldSweep"
    if (p === "luxpop") return "rbLuxPop"
    return "rbFadeUp"
  }

  const clampMs = (n, fallback) => {
    const x = Number(n)
    if (!Number.isFinite(x)) return fallback
    return Math.max(0, Math.min(5000, Math.round(x)))
  }

  const computeSafePosPercent = (key, desiredPosX, desiredPosY) => {
    const boxW = Number(bannerBox?.w || 0)
    const boxH = Number(bannerBox?.h || 0)

    if (!boxW || !boxH) return { posX: desiredPosX, posY: desiredPosY }

    void btnSizeTick

    const btn = btnSizeMapRef.current.get(key)
    if (!btn?.w || !btn?.h) return { posX: desiredPosX, posY: desiredPosY }

    const halfW = btn.w / 2
    const halfH = btn.h / 2

    const desiredXpx = (desiredPosX / 100) * boxW
    const desiredYpx = (desiredPosY / 100) * boxH

    const clampedXpx = Math.max(halfW, Math.min(boxW - halfW, desiredXpx))
    const clampedYpx = Math.max(halfH, Math.min(boxH - halfH, desiredYpx))

    const safeX = (clampedXpx / boxW) * 100
    const safeY = (clampedYpx / boxH) * 100

    return { posX: safeX, posY: safeY }
  }

  const isClickFromButton = (e) => {
    const t = e?.target
    if (!t || typeof t.closest !== "function") return false
    return !!t.closest("[data-rb-btn]")
  }

  const getResponsiveButtonWidth = useCallback(
    (requestedWidth) => {
      const raw = Number(requestedWidth)
      const safeRequested = Number.isFinite(raw)
        ? Math.max(80, Math.min(520, raw))
        : defaultButton.widthPx

      const measuredBoxW = Number(bannerBox?.w || 0)
      const baseWidth = measuredBoxW || viewportWidth || 1280

      if (isMobile) {
        const mobileMax = Math.max(120, Math.min(220, baseWidth * 0.5))
        return Math.max(90, Math.min(mobileMax, safeRequested))
      }

      if (isTablet) {
        const tabletMax = Math.max(140, Math.min(320, baseWidth * 0.4))
        return Math.max(100, Math.min(tabletMax, safeRequested))
      }

      if (isDesktop) {
        return safeRequested
      }

      return safeRequested
    },
    [bannerBox?.w, viewportWidth, isMobile, isTablet, isDesktop, defaultButton.widthPx]
  )

  const renderOneButton = (
    btnRaw,
    fallbackLink,
    stopPropagation = true,
    key = "btn",
    isActive = true
  ) => {
    const b = btnRaw || null
    if (!b) return null

    const enabled = b.enabled !== false
    if (!enabled) return null

    const kindNormalized = normalizeKind(b.kind) || normalizeKind(defaultButton.kind) || "image"
    const imgUrl = resolveImageUrl(b.imageUrl || defaultButton.imageUrl || "")
    const text = String(b.text || "").trim()

    const link = String(b.link || fallbackLink || "").trim()
    const desiredPosX = clamp0_100(b.posX, defaultButton.posX)
    const desiredPosY = clamp0_100(b.posY, defaultButton.posY)

    const safe = computeSafePosPercent(key, desiredPosX, desiredPosY)
    const posX = safe.posX
    const posY = safe.posY

    const widthPxRaw = Number(b.widthPx)
    const widthPxBase = Number.isFinite(widthPxRaw)
      ? Math.max(80, Math.min(520, widthPxRaw))
      : defaultButton.widthPx

    const widthPx = getResponsiveButtonWidth(widthPxBase)

    const stylePreset = String(b.style || defaultButton.style || "delicate").toLowerCase().trim()
    const radiusPreset = String(b.radius || defaultButton.radius || "pill").toLowerCase().trim()

    const radiusClass =
      radiusPreset === "square"
        ? "rounded-lg"
        : radiusPreset === "soft"
        ? "rounded-2xl"
        : "rounded-full"

    const Wrapper = ({ children }) =>
      link ? (
        <a
          href={link}
          onClick={(e) => {
            if (stopPropagation) e.stopPropagation()
          }}
          className="inline-flex"
          title={link}
        >
          {children}
        </a>
      ) : (
        <span className="inline-flex">{children}</span>
      )

    const textBase =
      stylePreset === "glass"
        ? "bg-white/35 backdrop-blur-md border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
        : "bg-white/70 backdrop-blur-sm border border-[#d4af37]/70 shadow"

    const textHover =
      stylePreset === "glass"
        ? "hover:bg-white/45 hover:shadow-[0_10px_28px_rgba(0,0,0,0.22)]"
        : "hover:bg-white/85 hover:shadow-md"

    const rawAnim =
      b.anim ?? b.animIn ?? b.animation ?? b.animPreset ?? b.effect ?? b.preset ?? defaultButton.anim

    const rawDur =
      b.animDurationMs ??
      b.durationMs ??
      b.animDuration ??
      b.duration ??
      defaultButton.animDurationMs

    const rawDelay =
      b.animDelayMs ?? b.delayMs ?? b.animDelay ?? b.delay ?? defaultButton.animDelayMs

    const animPreset = normalizeAnim(rawAnim)
    const animKf = animKeyframeFromPreset(animPreset)
    const animDurationMs = Math.max(80, clampMs(rawDur, defaultButton.animDurationMs))
    const animDelayMs = clampMs(rawDelay, defaultButton.animDelayMs)

    const shouldAnimate = isActive && !!animKf && animPreset !== "none"

    const textPaddingClass = isMobile ? "px-3 py-1.5" : isTablet ? "px-4 py-2" : "px-4 py-2"
    const textSizeClass = isMobile ? "text-xs" : "text-sm"

    const animKey = `${key}|${isActive ? currentSlide : "off"}|${isActive ? slideAnimTick : 0}`

    const entryAnimStyle = {
      animationName: shouldAnimate ? animKf : "none",
      animationDuration: `${animDurationMs}ms`,
      animationDelay: `${animDelayMs}ms`,
      animationTimingFunction: "cubic-bezier(.2,.9,.2,1)",
      animationFillMode: "both",
      animationIterationCount: 1,
    }

    return (
      <div
        key={animKey}
        className="absolute z-20 pointer-events-auto"
        data-rb-btn
        style={{
          left: `${posX}%`,
          top: `${posY}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div ref={setBtnElRef(key)} className="inline-flex">
          <Wrapper>
            <div
              data-rb-btn={`${animKf}-${key}-${currentSlide}`}
              style={entryAnimStyle}
              className="inline-flex"
            >
              {kindNormalized === "text" ? (
                <div
                  className={[
                    textPaddingClass,
                    radiusClass,
                    textBase,
                    textHover,
                    "transition-all duration-300 ease-out",
                    "will-change-transform will-change-opacity",
                  ].join(" ")}
                  style={{ maxWidth: `${widthPx}px`, opacity: 1 }}
                >
                  <span className={`${textSizeClass} font-semibold text-[#7a4b00] whitespace-nowrap`}>
                    {text || "Ver más"}
                  </span>
                </div>
              ) : (
                <img
                  src={imgUrl || "/ImgBotones/VerMas2.png"}
                  alt={text || "Ver más"}
                  className={[
                    "h-auto cursor-pointer max-w-none",
                    "hover-glow-move",
                    "will-change-transform will-change-opacity",
                  ].join(" ")}
                  style={{
                    width: `${widthPx}px`,
                    maxWidth: "none",
                    opacity: 1,
                    display: "block",
                  }}
                  draggable={false}
                  onError={(e) => {
                    console.warn("❌ No cargó imageUrl del botón:", imgUrl, "-> usando fallback")
                    e.currentTarget.src = "/ImgBotones/VerMas2.png"
                  }}
                />
              )}
            </div>
          </Wrapper>
        </div>
      </div>
    )
  }

  const renderMovableButtons = (btnRaw, fallbackLink, stopPropagation = true, isActive = true) => {
    const list = normalizeButtons(btnRaw)
    if (!list.length) return null
    return list.map((b, i) => renderOneButton(b, fallbackLink, stopPropagation, `btn-${i}`, isActive))
  }

  const slides = useMemo(() => {
    if (bannerType !== "slider") return []
    const bdSlides = Array.isArray(banner?.slides) ? banner.slides : []

    const normalized = bdSlides
      .map((s) => {
        const img = resolveSlideImage(s)
        return {
          image: img,
          link: String(s?.link || s?.href || "").trim(),
          fit: normalizeFit(s?.fit),
          posX: clamp0_100(s?.posX, 50),
          posY: clamp0_100(s?.posY, 50),
          button: s?.button || null,
          buttons: Array.isArray(s?.buttons) ? s.buttons : null,
        }
      })
      .filter((s) => !!s.image)

    if (normalized.length > 0) return normalized.map((s) => ({ ...s, text: "" }))

    return fallbackSlides.map((s) => ({
      image: s.image,
      link: s.link,
      fit: "cover",
      posX: 50,
      posY: 50,
      button: null,
      buttons: null,
      text: s.text || "",
    }))
  }, [bannerType, banner?.slides, fallbackSlides])

  const sliderMountKey = useMemo(() => {
    if (bannerType !== "slider") return "noslider"
    return `rb-slider|len:${slides.length}|loading:${bannerLoading ? 1 : 0}`
  }, [bannerType, slides.length, bannerLoading])

  const slidesLenRef = useRef(slides.length)
  useEffect(() => {
    slidesLenRef.current = slides.length
  }, [slides.length])

  const normalizeRel = useCallback((rel) => {
    const n = Number(slidesLenRef.current || 0)
    if (!n) return 0
    const r = Number(rel || 0)
    return ((r % n) + n) % n
  }, [])

  const [sliderRef, instanceRef] = useKeenSlider(
    bannerType === "slider"
      ? {
          loop: true,
          slides: { perView: 1, spacing: 0 },
          defaultAnimation: { duration: 700 },

          created(s) {
            setLoaded(true)
            setShowButtons(true)
            setSlideAnimTick((t) => t + 1)

            const totalSlides = s?.track?.details?.slides?.length ?? null
            const rel = s?.track?.details?.rel ?? 0
            console.log("RB SLIDER CREATED", {
              totalSlides,
              rel,
              abs: s?.track?.details?.abs ?? 0,
              bannerLoading,
              slidesLenReact: slidesLenRef.current,
            })
          },

          slideChanged(s) {
            setShowButtons(false)
            if (btnTimerRef.current) clearTimeout(btnTimerRef.current)

            const relRaw = s.track.details.rel
            const relSafe = normalizeRel(relRaw)

            setCurrentSlide(relSafe)
            startTsRef.current = performance.now()
            setProgress(0)

            const totalSlides = s?.track?.details?.slides?.length ?? null
            const abs = s?.track?.details?.abs ?? null

            console.log("RB SLIDER CHANGE", {
              rel: relSafe,
              relRaw,
              abs,
              totalSlides,
              bannerLoading,
              bannerType,
              slideImage: slides[relSafe]?.image,
            })
          },

          animationEnded() {
            if (btnTimerRef.current) clearTimeout(btnTimerRef.current)
            btnTimerRef.current = setTimeout(() => {
              setShowButtons(true)
              setSlideAnimTick((t) => t + 1)
            }, 30)
          },
        }
      : null
  )

  useEffect(() => {
    if (bannerType !== "slider") return
    if (!slides.length) return

    startTsRef.current = performance.now()
    setProgress(0)

    if (instanceRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (!isPaused.current) instanceRef.current.next()
      }, autoplayMs)
    }

    const tick = (ts) => {
      if (bannerType !== "slider") return
      if (!startTsRef.current) startTsRef.current = ts

      if (!isPaused.current) {
        const elapsed = ts - startTsRef.current
        const p = elapsed / autoplayMs
        setProgress(p >= 1 ? 1 : p)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      clearInterval(intervalRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [bannerType, instanceRef, autoplayMs, slides.length])

  const dotsWrapperClass = isMobile
    ? "absolute left-1/2 bottom-10 -translate-x-1/2 z-[120] flex flex-row gap-2 pointer-events-auto"
    : isTablet
    ? "absolute left-1/2 bottom-12 -translate-x-1/2 z-[120] flex flex-row gap-2.5 pointer-events-auto"
    : "absolute right-4 top-1/2 -translate-y-1/2 z-[120] flex flex-col gap-3 pointer-events-auto"

  const ringSize = isMobile ? 16 : isTablet ? 17 : 18
  const ringInnerSize = isMobile ? 10 : isTablet ? 11 : 12

  const sharedStyleTag = (
    <style>{`
      .hover-glow-move {transition:all .4s ease-in-out;}
      .hover-glow-move:hover {filter:drop-shadow(0 0 10px #fff);transform:translateY(-4px) scale(1.03);}

      @keyframes rbFade { from { opacity: .90; transform: translate3d(0, 0, 0) scale(.99); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbFadeUp { from { opacity: .90; transform: translate3d(0, 14px, 0) scale(.99); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbFadeDown { from { opacity: .90; transform: translate3d(0, -12px, 0) scale(.99); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbSlideLeft { from { opacity: .90; transform: translate3d(16px, 0, 0) scale(.995); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbSlideRight { from { opacity: .90; transform: translate3d(-16px, 0, 0) scale(.995); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbZoomIn { from { opacity: .90; transform: translate3d(0, 6px, 0) scale(.92); } to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbSoftPop { 0% { opacity: .90; transform: translate3d(0, 10px, 0) scale(.88); } 60% { opacity: 1; transform: translate3d(0, 0, 0) scale(1.04); } 100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); } }
      @keyframes rbFloat { 0%,100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -6px, 0); } }
      @keyframes rbShine { 0% { filter: brightness(1) drop-shadow(0 0 0 rgba(255,255,255,0)); } 55% { filter: brightness(1.06) drop-shadow(0 0 14px rgba(255,255,255,.75)); } 100% { filter: brightness(1) drop-shadow(0 0 6px rgba(255,255,255,.25)); } }

      @keyframes rbFloatIn {
        0% { opacity: 0; transform: translate3d(0, 18px, 0) scale(.98); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
        60% { opacity: 1; transform: translate3d(0, -4px, 0) scale(1.02); filter: drop-shadow(0 0 10px rgba(255,255,255,.55)); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: drop-shadow(0 0 6px rgba(255,255,255,.25)); }
      }
      @keyframes rbGoldSweep {
        0% { opacity: .92; transform: translate3d(0, 10px, 0) scale(.99); filter: brightness(1); }
        55% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: brightness(1.08) drop-shadow(0 0 18px rgba(212,175,55,.75)); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: brightness(1) drop-shadow(0 0 8px rgba(212,175,55,.35)); }
      }
      @keyframes rbLuxPop {
        0% { opacity: 0; transform: translate3d(0, 14px, 0) scale(.92); filter: drop-shadow(0 0 0 rgba(255,255,255,0)); }
        70% { opacity: 1; transform: translate3d(0, -2px, 0) scale(1.03); filter: drop-shadow(0 0 14px rgba(255,255,255,.65)); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: drop-shadow(0 0 8px rgba(255,255,255,.25)); }
      }

      .rb-ring{
        border-radius:9999px;
        display:grid;place-items:center;
        background:rgba(255,255,255,.32);
        backdrop-filter: blur(8px);
        border:1px solid rgba(255,255,255,.42);
        box-shadow: 0 8px 22px rgba(0,0,0,.22);
        transition: transform .2s ease;
      }
      .rb-ring:hover{ transform: scale(1.08); }
      .rb-ring__inner{
        border-radius:9999px;
        background:rgba(255,255,255,.65);
        border:1px solid rgba(212,175,55,.78);
      }
      .rb-ring__inner--active{
        background:rgba(212,175,55,.98);
      }

      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; scroll-behavior: auto !important; }
      }
    `}</style>
  )

  if (bannerType === "loading") {
    return (
      <div className={heroWrapClass} style={heroWrapStyle}>
        {sharedStyleTag}
        <div
          ref={bannerBoxRef}
          className={`${heroContainerClass} ${heroFullscreenClass} bg-[#fff8e1]`}
          style={heroContainerStyle}
        />
      </div>
    )
  }

  if (bannerType === "video") {
    const videoUrl = String(banner?.videoUrl || "").trim()
    const videoBtnPayload = pickButtons(banner?.videoButtons, banner?.videoButton)

    return (
      <div className={heroWrapClass} style={heroWrapStyle}>
        {sharedStyleTag}
        <div
          ref={bannerBoxRef}
          className={`${heroContainerClass} ${heroFullscreenClass} bg-black`}
          style={heroContainerStyle}
        >
          {videoUrl ? (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={videoUrl}
              autoPlay={!!banner?.videoAutoplay}
              muted={!!banner?.videoMuted}
              loop={!!banner?.videoLoop}
              playsInline
              controls={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
              No hay videoUrl configurado en el panel.
            </div>
          )}

          {renderMovableButtons(videoBtnPayload, "", true, true)}
        </div>
      </div>
    )
  }

  if (bannerType === "image") {
    const imageUrl = String(banner?.imageUrl || "").trim()
    const imageLink = String(banner?.imageLink || "").trim()

    const imageFit = normalizeFit(banner?.imageFit)
    const imagePosX = clamp0_100(banner?.imagePosX, 50)
    const imagePosY = clamp0_100(banner?.imagePosY, 50)
    const imageObjectPosition = `${imagePosX}% ${imagePosY}%`

    const imageBtnPayload = pickButtons(banner?.imageButtons, banner?.imageButton)

    const Img = (
      <img
        src={imageUrl}
        alt="Banner"
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: imageFit,
          objectPosition: imageObjectPosition,
          pointerEvents: "none",
        }}
        draggable={false}
      />
    )

    return (
      <div className={heroWrapClass} style={heroWrapStyle}>
        {sharedStyleTag}
        <div
          ref={bannerBoxRef}
          className={`${heroContainerClass} ${heroFullscreenClass} bg-[#fff8e1]`}
          style={heroContainerStyle}
          onClick={() => {
            if (imageUrl) setSelectedImage(imageUrl)
          }}
        >
          {imageUrl ? (
            imageLink ? (
              <a
                href={imageLink}
                className="block w-full h-full"
                onClick={(e) => e.stopPropagation()}
              >
                {Img}
              </a>
            ) : (
              Img
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
              No hay imageUrl configurado en el panel.
            </div>
          )}

          {renderMovableButtons(imageBtnPayload, imageLink, true, true)}
        </div>

        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center overflow-auto animate-fade-in"
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="relative bg-white p-2 rounded-md shadow-lg animate-zoom-in max-w-[90vw] max-h-[90vh] sm:max-w-[85vw] sm:max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow z-10"
              >
                <X className="w-5 h-5 text-black" />
              </button>
              <img
                src={selectedImage}
                alt="Imagen ampliada"
                className="w-full h-auto max-h-[75vh] sm:max-h-[70vh] object-contain"
                draggable={false}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={heroWrapClass}
      style={heroWrapStyle}
      onMouseEnter={() => (isPaused.current = true)}
      onMouseLeave={() => {
        const p = progress
        startTsRef.current = performance.now() - p * autoplayMs
        isPaused.current = false
      }}
    >
      {sharedStyleTag}

      <div
        ref={bannerBoxRef}
        className={`${heroContainerClass} ${heroFullscreenClass} bg-[#fff8e1]`}
        style={heroContainerStyle}
      >
        <div key={sliderMountKey} ref={sliderRef} className="keen-slider h-full w-full">
          {slides.map((slide, idx) => {
            const fit = normalizeFit(slide?.fit)
            const posX = clamp0_100(slide?.posX, 50)
            const posY = clamp0_100(slide?.posY, 50)
            const objectPosition = `${posX}% ${posY}%`

            const slideButtons = pickButtons(slide?.buttons, slide?.button)
            const isActive = idx === currentSlide

            return (
              <div
                key={idx}
                className="keen-slider__slide relative h-full w-full"
                onClick={(e) => {
                  if (isClickFromButton(e)) return
                  setSelectedImage(slide.image)
                }}
                role="button"
                tabIndex={0}
              >
                <img
                  src={slide.image}
                  alt={`Slide ${idx + 1}`}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: fit,
                    objectPosition,
                    pointerEvents: "none",
                  }}
                  draggable={false}
                />

                {showButtons && renderMovableButtons(slideButtons, slide.link, true, isActive)}
              </div>
            )
          })}
        </div>

        {loaded && slides.length > 1 && (
          <div className={dotsWrapperClass}>
            {slides.map((_, i) => {
              const active = i === currentSlide
              const deg = Math.max(0, Math.min(1, active ? progress : 0)) * 360

              return (
                <button
                  key={i}
                  onClick={() => {
                    instanceRef.current?.moveToIdx(i)
                    startTsRef.current = performance.now()
                    setProgress(0)
                    setShowButtons(false)
                    if (btnTimerRef.current) clearTimeout(btnTimerRef.current)
                  }}
                  className="rb-ring"
                  aria-label={`Ir al slide ${i + 1}`}
                  style={{
                    width: `${ringSize}px`,
                    height: `${ringSize}px`,
                    backgroundImage: active
                      ? `conic-gradient(rgba(212,175,55,.95) ${deg}deg, rgba(255,255,255,.15) 0deg)`
                      : "none",
                  }}
                  title={active ? "Reproduciendo" : "Ir al slide"}
                >
                  <span
                    className={"rb-ring__inner " + (active ? "rb-ring__inner--active" : "")}
                    style={{
                      width: `${ringInnerSize}px`,
                      height: `${ringInnerSize}px`,
                    }}
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center overflow-auto animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative bg-white p-2 rounded-md shadow-lg animate-zoom-in max-w-[90vw] max-h-[90vh] sm:max-w-[85vw] sm:max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow z-10"
            >
              <X className="w-5 h-5 text-black" />
            </button>
            <img
              src={selectedImage}
              alt="Imagen ampliada"
              className="w-full h-auto max-h-[75vh] sm:max-h-[70vh] object-contain"
              draggable={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}