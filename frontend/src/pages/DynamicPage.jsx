// frontend/src/pages/DynamicPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Header from "../components/Header";
import FooterSection from "../components/FooterSection";
import CarouselBanner from "../components/CarouselBanner";
import TrendingSection from "../components/TrendingSection";
import LookSection from "../components/LookSection";
import ComplementosLook from "../components/ComplementosLook";
import CategoriasSection from "../components/CategoriasSection";
import InstagramSection from "../components/InstagramSection";
import TiktokSection from "../components/TiktokSection";
import InformacionSection from "../components/InformacionSection";
import CatalogPageView from "../components/catalog/CatalogPageView";
import NotFound from "./NotFound";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const FALLBACK_INSTA_POSTS = [
  {
    link: "https://www.instagram.com/reel/DBNciDousld/",
    thumb: "/SeccionInstagram/Imgminiatura1.png",
  },
  {
    link: "https://www.instagram.com/p/DBHSxzsP9RY/",
    thumb: "/SeccionInstagram/Imgminiatura3.png",
  },
  {
    link: "https://www.instagram.com/rosaboutique33/p/DBNd9G9uesi/?img_index=1",
    thumb: "/SeccionInstagram/Imgminiatura2.png",
  },
  {
    link: "https://www.instagram.com/rosaboutique33/p/DBNgXtWuZIC/?img_index=1",
    thumb: "/SeccionInstagram/Imgminiatura4.png",
  },
];

const FALLBACK_TIKTOK_POSTS = [
  {
    link: "https://www.tiktok.com/@rosaboutique35/video/7425748273320725765",
    thumb: "/SeccionTikTok/BLANCO.jpg",
  },
  {
    link: "https://www.tiktok.com/@rosaboutique35/video/7315550010672680197",
    thumb: "/SeccionTikTok/COMPLEMENTO.JPG",
  },
  {
    link: "https://www.tiktok.com/@rosaboutique35/video/7425660258074332422",
    thumb: "/SeccionTikTok/ROJO.JPG",
  },
];

function resolveBlockPayload(block) {
  const rawConfig =
    block?.config && typeof block.config === "object" ? block.config : {};

  const nestedConfig =
    rawConfig?.config && typeof rawConfig.config === "object" ? rawConfig.config : null;

  const nestedStyle =
    rawConfig?.style && typeof rawConfig.style === "object" ? rawConfig.style : null;

  const config = nestedConfig || rawConfig;
  const style = nestedStyle || rawConfig?.style || {};

  return { rawConfig, config, style };
}

function normalizeInstagramPosts(posts) {
  const list = Array.isArray(posts) ? posts : [];

  return list
    .map((post, index) => ({
      id: post?.id || `insta_${index + 1}`,
      image:
        typeof post?.image === "string" && post.image.trim()
          ? post.image.trim()
          : typeof post?.thumb === "string" && post.thumb.trim()
          ? post.thumb.trim()
          : "",
      thumb:
        typeof post?.thumb === "string" && post.thumb.trim()
          ? post.thumb.trim()
          : typeof post?.image === "string" && post.image.trim()
          ? post.image.trim()
          : "",
      link: typeof post?.link === "string" ? post.link.trim() : "",
      enabled: post?.enabled !== false,
    }))
    .filter((post) => post.enabled !== false && (post.thumb || post.image))
    .map((post) => ({
      id: post.id,
      image: post.image || post.thumb,
      thumb: post.thumb || post.image,
      link: post.link || "",
      enabled: true,
    }));
}

function normalizeTiktokPosts(posts) {
  const list = Array.isArray(posts) ? posts : [];

  return list
    .map((post, index) => ({
      id: post?.id || `tiktok_${index + 1}`,
      image:
        typeof post?.image === "string" && post.image.trim() ? post.image.trim() : "",
      thumb:
        typeof post?.thumb === "string" && post.thumb.trim()
          ? post.thumb.trim()
          : typeof post?.image === "string" && post.image.trim()
          ? post.image.trim()
          : "",
      link: typeof post?.link === "string" ? post.link.trim() : "",
      videoUrl:
        typeof post?.videoUrl === "string" && post.videoUrl.trim()
          ? post.videoUrl.trim()
          : "",
      enabled: post?.enabled !== false,
    }))
    .filter(
      (post) =>
        post.enabled !== false &&
        (post.link || post.videoUrl) &&
        (post.thumb || post.image)
    )
    .map((post) => ({
      link: post.link || post.videoUrl,
      thumb: post.thumb || post.image,
      videoUrl: post.videoUrl || "",
    }));
}

function getInstagramPostsFromBlock(rawConfig, config) {
  const sources = [
    config?.posts,
    rawConfig?.posts,
    config?.items,
    rawConfig?.items,
  ];

  for (const source of sources) {
    const normalized = normalizeInstagramPosts(source);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

function getTiktokPostsFromBlock(rawConfig, config) {
  const sources = [
    config?.posts,
    rawConfig?.posts,
    config?.items,
    rawConfig?.items,
  ];

  for (const source of sources) {
    const normalized = normalizeTiktokPosts(source);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

export default function DynamicPage({ theme }) {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPage = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const res = await fetch(`${API_BASE}/api/pages/${slug}`);
        if (res.status === 404) {
          if (mounted) {
            setPage(null);
            setNotFound(true);
          }
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (mounted) {
          setPage(data);
        }
      } catch (error) {
        console.error("Error cargando página dinámica:", error);
        if (mounted) {
          setPage(null);
          setNotFound(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const sortedBlocks = useMemo(() => {
    const list = Array.isArray(page?.blocks) ? page.blocks : [];
    return [...list]
      .filter((block) => block && block.enabled !== false && block.type)
      .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
  }, [page]);

  const renderBlock = (block) => {
    const type = String(block?.type || "").trim().toLowerCase();
    const { rawConfig, config, style } = resolveBlockPayload(block);

    if (type === "instagram") {
      const instagramPosts = getInstagramPostsFromBlock(rawConfig, config);

      const instagramTheme = {
        ...theme,
        sections: [
          {
            id: "instagram",
            type: "instagram",
            enabled: true,
            config: {
              ...config,
              titleText: config?.titleText || config?.title || "Síguenos en Instagram",
              profileUser: config?.profileUser || rawConfig?.profileUser || "",
              posts: instagramPosts,
            },
            style,
          },
        ],
      };

      return (
        <InstagramSection
          theme={instagramTheme}
          posts={instagramPosts.length ? instagramPosts : FALLBACK_INSTA_POSTS}
        />
      );
    }

    if (type === "tiktok") {
      const tiktokPosts = getTiktokPostsFromBlock(rawConfig, config);

      const tiktokTheme = {
        ...theme,
        sections: [
          {
            id: "tiktok",
            type: "tiktok",
            enabled: true,
            config: {
              ...config,
              titleText: config?.titleText || config?.title || "Síguenos en TikTok",
              profileUser: config?.profileUser || rawConfig?.profileUser || "",
              posts: tiktokPosts,
            },
            style,
          },
        ],
      };

      return (
        <TiktokSection
          theme={tiktokTheme}
          posts={tiktokPosts.length ? tiktokPosts : FALLBACK_TIKTOK_POSTS}
        />
      );
    }

    const blockTheme = {
      ...theme,
      sections: [
        {
          id: type,
          type,
          enabled: true,
          config,
          items: Array.isArray(config?.items) ? config.items : [],
          style,
          titleImage: config?.titleImage || "",
          title: config?.title || config?.titleText || "",
          subtitle: config?.subtitle || "",
        },
      ],
      banner: config || theme?.banner,
    };

    switch (type) {
      case "banner":
        return <CarouselBanner />;

      case "tendencia":
        return <TrendingSection theme={blockTheme} />;

      case "look":
        return <LookSection theme={blockTheme} />;

      case "complementos":
        return (
          <ComplementosLook
            theme={blockTheme}
            imageSrc={
              config?.imageSrc ||
              (Array.isArray(config?.items) && config.items[0]?.image
                ? config.items[0].image
                : "/SeccionComplementos/Complementos.png")
            }
          />
        );

      case "categorias":
        return <CategoriasSection theme={blockTheme} />;

      case "informacion":
      case "info":
        return <InformacionSection theme={blockTheme} />;

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="p-6">Cargando página…</div>;
  }

  if (notFound || !page || page.enabled === false) {
    return <NotFound />;
  }

  if (String(page?.pageType || "custom").toLowerCase() === "catalog") {
    return (
      <div className="flex min-h-screen flex-col">
        {page.useHeader !== false && <Header />}

        <CatalogPageView
          page={page}
          catalogConfig={page?.catalogConfig || {}}
          theme={theme}
        />

        {page.useFooter !== false && <FooterSection theme={theme} />}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {page.useHeader !== false && <Header />}

      <div className="flex-grow">
        {sortedBlocks.map((block) => (
          <section
            key={block.id || `${block.type}-${block.order}`}
            id={block.id || undefined}
            className="w-full"
          >
            {renderBlock(block)}
          </section>
        ))}
      </div>

      {page.useFooter !== false && <FooterSection theme={theme} />}
    </div>
  );
}