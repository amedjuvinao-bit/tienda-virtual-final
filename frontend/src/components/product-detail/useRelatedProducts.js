import { useEffect, useState } from "react";
import api from "../../lib/api";

const productKey = (product) =>
  String(product?._id || product?.id || product?.slug || "");
const categoryValue = (value) =>
  typeof value === "string" ? value.trim() : String(value?._id || "").trim();
export default function useRelatedProducts(product, presentation) {
  const key = productKey(product);
  const categories = [
    ...new Set(
      [
        product.category,
        ...(Array.isArray(product.categories) ? product.categories : []),
        product.primaryCategoryRef,
        ...(Array.isArray(product.categoryRefs) ? product.categoryRefs : []),
      ]
        .map(categoryValue)
        .filter(Boolean),
    ),
  ]
    .slice(0, 20)
    .join(",");
  const limit = Math.max(presentation.relatedCount, presentation.relatedLimit);
  const requestKey = JSON.stringify([
    key,
    categories,
    limit,
    presentation.showRelated,
  ]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ key: "", products: [], error: "" });
  useEffect(() => {
    if (!presentation.showRelated || !key || key === "preview") return;
    const controller = new AbortController();
    const rows = new Map();
    const add = (data) => {
      for (const item of Array.isArray(data?.products) ? data.products : []) {
        const id = productKey(item);
        if (id && id !== key && item.active !== false && !rows.has(id))
          rows.set(id, item);
      }
    };
    const query = (category) => {
      const params = new URLSearchParams({
        limit: String(limit + 1),
        status: "published",
      });
      if (category) params.set("categories", category);
      return api.get(`/api/products?${params}`, { signal: controller.signal });
    };
    (async () => {
      try {
        if (categories) {
          try {
            add((await query(categories)).data);
          } catch (error) {
            if (controller.signal.aborted) return;
          }
        }
        if (controller.signal.aborted) return;
        if (!categories || rows.size < limit) {
          try {
            add((await query("")).data);
          } catch (error) {
            if (!rows.size) throw error;
          }
        }
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            products: [...rows.values()].slice(0, limit),
            error: "",
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            products: [],
            error: "No pudimos cargar los productos relacionados.",
          });
      }
    })();
    return () => controller.abort();
  }, [key, categories, limit, presentation.showRelated, requestKey, attempt]);
  const current =
    result.key === requestKey ? result : { products: [], error: "" };
  return {
    ...current,
    loading:
      presentation.showRelated &&
      key !== "preview" &&
      result.key !== requestKey,
    retry: () => {
      setResult({ key: "", products: [], error: "" });
      setAttempt((value) => value + 1);
    },
  };
}
