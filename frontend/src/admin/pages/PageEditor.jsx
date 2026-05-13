// frontend/src/admin/pages/PageEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BlockConfigPanel from "./BlockConfigPanel";
import { createBlock } from "./pageBlockDefaults";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const BLOCK_OPTIONS = [
  { value: "banner", label: "Banner" },
  { value: "tendencia", label: "En tendencia" },
  { value: "look", label: "Look" },
  { value: "complementos", label: "Complementos" },
  { value: "categorias", label: "Categorías" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "informacion", label: "Información" },
];

export default function PageEditor() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedBlockType, setSelectedBlockType] = useState("banner");
  const [savingBlock, setSavingBlock] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState("");
  const [savingEditor, setSavingEditor] = useState(false);
  const [movingBlockId, setMovingBlockId] = useState("");

  const [editingBlock, setEditingBlock] = useState(null);
  const [editorDirty, setEditorDirty] = useState(false);

  const editorSaveTimeoutRef = useRef(null);

  const isSystemCartPage = useMemo(() => {
    return String(page?.pageType || "").trim().toLowerCase() === "cart-page";
  }, [page?.pageType]);

  const isSystemCheckoutPage = useMemo(() => {
    return String(page?.pageType || "").trim().toLowerCase() === "checkout-page";
  }, [page?.pageType]);

  const isSystemFixedPage = useMemo(() => {
    return isSystemCartPage || isSystemCheckoutPage;
  }, [isSystemCartPage, isSystemCheckoutPage]);

  const sortedBlocks = useMemo(() => {
    const list = Array.isArray(page?.blocks) ? page.blocks : [];
    return [...list].sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
  }, [page]);

  const previewUrl = useMemo(() => {
    const slug = String(page?.slug || "").trim();
    if (!slug) return "";

    if (isSystemCartPage) return "/carrito";
    if (isSystemCheckoutPage) return "/checkout";

    return `/pagina/${slug}`;
  }, [page?.slug, isSystemCartPage, isSystemCheckoutPage]);

  const clearPendingEditorSave = () => {
    if (editorSaveTimeoutRef.current) {
      clearTimeout(editorSaveTimeoutRef.current);
      editorSaveTimeoutRef.current = null;
    }
  };

  const fetchPage = async () => {
    try {
      setLoading(true);
      setNotFound(false);

      const res = await fetch(`${API_BASE}/api/pages/${id}`);

      if (res.status === 404) {
        setPage(null);
        setNotFound(true);
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setPage(data);
    } catch (error) {
      console.error("❌ Error cargando página:", error);
      setPage(null);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const savePage = async (nextPageData) => {
    const res = await fetch(`${API_BASE}/api/pages/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextPageData),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    return data;
  };

  const buildPagePayload = (blocks) => {
    return {
      name: page?.name,
      slug: page?.slug,
      enabled: page?.enabled,
      useHeader: page?.useHeader,
      useFooter: page?.useFooter,
      blocks,
    };
  };

  const handleAddBlock = async () => {
    if (!page) return;

    try {
      clearPendingEditorSave();
      setEditorDirty(false);
      setSavingBlock(true);

      const nextBlocks = [
        ...sortedBlocks,
        createBlock(selectedBlockType, sortedBlocks.length),
      ];

      const updated = await savePage(buildPagePayload(nextBlocks));
      setPage(updated);
    } catch (error) {
      console.error("❌ Error agregando bloque:", error);
      alert(error.message || "No se pudo agregar el bloque.");
    } finally {
      setSavingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!page || !blockId) return;

    const confirmed = window.confirm("¿Seguro que deseas eliminar este bloque?");
    if (!confirmed) return;

    try {
      clearPendingEditorSave();
      setEditorDirty(false);
      setDeletingBlockId(blockId);

      const nextBlocks = sortedBlocks
        .filter((block) => block?.id !== blockId)
        .map((block, index) => ({
          ...block,
          order: index,
        }));

      const updated = await savePage(buildPagePayload(nextBlocks));

      setPage(updated);

      if (editingBlock?.id === blockId) {
        setEditingBlock(null);
      }
    } catch (error) {
      console.error("❌ Error eliminando bloque:", error);
      alert(error.message || "No se pudo eliminar el bloque.");
    } finally {
      setDeletingBlockId("");
    }
  };

  const handleUpdateBlock = (updatedBlock) => {
    if (!page || !updatedBlock) return;

    const nextBlocks = sortedBlocks.map((b) =>
      b.id === updatedBlock.id ? updatedBlock : b
    );

    setPage((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: nextBlocks,
      };
    });

    setEditingBlock(updatedBlock);
    setEditorDirty(true);
  };

  const handleMoveBlock = async (blockId, direction) => {
    if (!page || !blockId) return;

    const currentIndex = sortedBlocks.findIndex((block) => block?.id === blockId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= sortedBlocks.length) {
      return;
    }

    try {
      clearPendingEditorSave();
      setEditorDirty(false);
      setMovingBlockId(blockId);

      const reorderedBlocks = [...sortedBlocks];
      const temp = reorderedBlocks[currentIndex];
      reorderedBlocks[currentIndex] = reorderedBlocks[targetIndex];
      reorderedBlocks[targetIndex] = temp;

      const nextBlocks = reorderedBlocks.map((block, index) => ({
        ...block,
        order: index,
      }));

      const updated = await savePage(buildPagePayload(nextBlocks));

      setPage(updated);

      if (editingBlock?.id) {
        const refreshedEditingBlock =
          (Array.isArray(updated?.blocks) ? updated.blocks : []).find(
            (b) => b?.id === editingBlock.id
          ) || null;

        setEditingBlock(refreshedEditingBlock);
      }
    } catch (error) {
      console.error("❌ Error reordenando bloque:", error);
      alert(error.message || "No se pudo mover el bloque.");
    } finally {
      setMovingBlockId("");
    }
  };

  const handleOpenPreview = () => {
    if (!previewUrl) {
      alert("La página todavía no tiene un slug válido para vista previa.");
      return;
    }

    window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (id) fetchPage();
  }, [id]);

  useEffect(() => {
    if (!editorDirty || !editingBlock || !page) return;

    clearPendingEditorSave();

    editorSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setSavingEditor(true);

        const latestBlocks = Array.isArray(page?.blocks) ? page.blocks : [];
        const updated = await savePage(buildPagePayload(latestBlocks));

        setPage(updated);

        const refreshedBlock =
          (Array.isArray(updated?.blocks) ? updated.blocks : []).find(
            (b) => b?.id === editingBlock.id
          ) || editingBlock;

        setEditingBlock(refreshedBlock);
        setEditorDirty(false);
      } catch (error) {
        console.error("❌ Error actualizando bloque:", error);
        alert("No se pudo guardar la configuración");
      } finally {
        setSavingEditor(false);
        editorSaveTimeoutRef.current = null;
      }
    }, 600);

    return () => {
      clearPendingEditorSave();
    };
  }, [editorDirty, editingBlock, page]);

  useEffect(() => {
    return () => {
      clearPendingEditorSave();
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500">Cargando página...</div>;
  }

  if (notFound || !page) {
    return <div className="p-6 text-red-500">Página no encontrada</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => navigate("/admin/paginas")}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
          >
            ← Volver
          </button>

          <div>
            <h1 className="text-2xl font-bold">Editor de página</h1>
            <p className="text-gray-500">
              {page.name} ({page.slug})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenPreview}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-300 bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
          >
            Vista previa
          </button>
        </div>
      </div>

      {isSystemFixedPage && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta es una página fija del sistema. En esta vista no usa bloques dinámicos.
        </div>
      )}

      {/* AGREGAR BLOQUE */}
      {!isSystemFixedPage && (
        <div className="bg-white rounded-xl p-4 space-y-4">
          <div className="flex gap-2">
            <select
              value={selectedBlockType}
              onChange={(e) => setSelectedBlockType(e.target.value)}
              className="border px-3 py-2 rounded"
            >
              {BLOCK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleAddBlock}
              disabled={savingBlock}
              className="bg-pink-500 text-white px-4 py-2 rounded disabled:opacity-60"
            >
              {savingBlock ? "Agregando..." : "Agregar bloque"}
            </button>
          </div>

          {/* LISTA */}
          {sortedBlocks.map((block, index) => {
            const isFirst = index === 0;
            const isLast = index === sortedBlocks.length - 1;
            const isMoving = movingBlockId === block.id;

            return (
              <div key={block.id} className="border p-3 rounded space-y-2">
                <div className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium">{block.type}</span>
                    <span className="text-xs text-gray-400">#{index + 1}</span>
                  </div>

                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => handleMoveBlock(block.id, "up")}
                      disabled={isFirst || isMoving || deletingBlockId === block.id}
                      className="border px-3 py-1 rounded disabled:opacity-40"
                      title="Subir bloque"
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMoveBlock(block.id, "down")}
                      disabled={isLast || isMoving || deletingBlockId === block.id}
                      className="border px-3 py-1 rounded disabled:opacity-40"
                      title="Bajar bloque"
                    >
                      ↓
                    </button>

                    <button
                      onClick={() => {
                        clearPendingEditorSave();
                        setEditorDirty(false);
                        setEditingBlock(block);
                      }}
                      className="border px-3 py-1 rounded"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleDeleteBlock(block.id)}
                      disabled={deletingBlockId === block.id || isMoving}
                      className="border px-3 py-1 rounded text-red-500 disabled:opacity-60"
                    >
                      {deletingBlockId === block.id
                        ? "Eliminando..."
                        : isMoving
                        ? "Moviendo..."
                        : "Eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL EDITOR */}
      {editingBlock && (
        <div className="fixed inset-0 z-[1000]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!savingEditor) {
                clearPendingEditorSave();
                setEditorDirty(false);
                setEditingBlock(null);
              }
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
            <div className="relative w-full max-w-[1280px] max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-neutral-200">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
                <div>
                  <div className="text-xl font-bold text-neutral-900">
                    Editar bloque: {editingBlock.type}
                  </div>
                  <div className="text-sm text-neutral-500">
                    Configura este bloque sin afectar el resto de la página.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!savingEditor) {
                      clearPendingEditorSave();
                      setEditorDirty(false);
                      setEditingBlock(null);
                    }
                  }}
                  className="rounded-xl border px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
                  disabled={savingEditor}
                >
                  Cerrar
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-73px)] p-4 md:p-5">
                <BlockConfigPanel
                  block={editingBlock}
                  onChange={handleUpdateBlock}
                />
              </div>

              <div className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500">
                {savingEditor
                  ? "Guardando cambios..."
                  : editorDirty
                  ? "Cambios pendientes por guardar..."
                  : "Todo guardado."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}