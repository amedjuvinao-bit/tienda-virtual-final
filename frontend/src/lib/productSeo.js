function clean(value) {
  return String(value || '').trim();
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    element.dataset.productSeo = 'true';
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });

  return element;
}

function upsertCanonical(url) {
  let element = document.head.querySelector(
    'link[rel="canonical"]'
  );

  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    element.dataset.productSeo = 'true';
    document.head.appendChild(element);
  }

  element.href = url;
  return element;
}

function buildProductSchema(product, canonicalUrl) {
  const image = clean(product?.seo?.image || product?.image);
  const price = Number(product?.price || 0);
  const available =
    product?.trackInventory === false ||
    product?.allowBackorder === true ||
    Number(product?.stock || product?.availableStock || 0) > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: clean(product?.seo?.title || product?.title),
    description: clean(
      product?.seo?.description || product?.description
    ),
    sku: clean(product?.sku),
    image: image ? [image] : undefined,
    url: canonicalUrl,
    brand: clean(product?.brand)
      ? {
          '@type': 'Brand',
          name: clean(product.brand),
        }
      : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'COP',
      price: Number.isFinite(price) ? price : 0,
      availability: available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: canonicalUrl,
    },
  };
}

export function applyProductSeo(product) {
  if (typeof document === 'undefined' || !product) {
    return () => {};
  }

  const previousTitle = document.title;
  const title = clean(product?.seo?.title || product?.title);
  const description = clean(
    product?.seo?.description || product?.description
  ).slice(0, 320);
  const image = clean(product?.seo?.image || product?.image);
  const keywords = Array.isArray(product?.seo?.keywords)
    ? product.seo.keywords.map(clean).filter(Boolean).join(', ')
    : '';
  const canonicalUrl = clean(product?.seo?.canonicalUrl)
    || window.location.href.split('#')[0];
  const robots = product?.seo?.noIndex === true
    ? 'noindex, nofollow'
    : 'index, follow';

  if (title) document.title = title;

  const managedElements = [
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: description,
    }),
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: robots,
    }),
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'product',
    }),
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: title,
    }),
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    }),
    upsertMeta('meta[property="og:url"]', {
      property: 'og:url',
      content: canonicalUrl,
    }),
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary',
    }),
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: title,
    }),
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    }),
    upsertCanonical(canonicalUrl),
  ];

  if (image) {
    managedElements.push(
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: image,
      }),
      upsertMeta('meta[name="twitter:image"]', {
        name: 'twitter:image',
        content: image,
      })
    );
  }

  if (keywords) {
    managedElements.push(
      upsertMeta('meta[name="keywords"]', {
        name: 'keywords',
        content: keywords,
      })
    );
  }

  const schema = document.createElement('script');
  schema.type = 'application/ld+json';
  schema.dataset.productSeo = 'true';
  schema.textContent = JSON.stringify(
    buildProductSchema(product, canonicalUrl)
  );
  document.head.appendChild(schema);
  managedElements.push(schema);

  return () => {
    document.title = previousTitle;
    managedElements.forEach((element) => {
      if (element?.dataset?.productSeo === 'true') {
        element.remove();
      }
    });
  };
}
