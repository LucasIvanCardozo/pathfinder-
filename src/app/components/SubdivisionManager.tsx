"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import type { z } from "zod";
import {
  type Piece,
  PIECE_CATEGORIES,
  type SubdivisionConfig,
  SubdivisionConfigPieceIdsInputSchema,
} from "@/pieces";
import { createSubdivision, deleteSubdivision, updateSubdivision } from "@/lib/server/actions/subdivision.action";
import { FormField, FormInput, FormNumberInput } from "./form";
import { Modal } from "./Modal";

const FormSchema = SubdivisionConfigPieceIdsInputSchema;
type FormValues = z.infer<typeof FormSchema>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Source-of-truth subdivisions owned by the parent. The modal treats them
   * as an initial snapshot and maintains its own local copy while open so
   * create/update/delete can reflect immediately without round-tripping. */
  subdivisions: SubdivisionConfig[];
  allPieces: Piece[];
};

const DEFAULT_FORM_VALUES: FormValues = {
  name: "",
  pieceIds: [],
  cellSizeRatio: 1,
  order: 0,
};

const CATEGORY_LABELS: Record<string, string> = {
  floor: "Suelo",
  wall: "Paredes",
  door: "Puertas",
  water: "Agua",
  lava: "Lava",
  decoration: "Decoración",
  other: "Otros",
};

/** Form-mode controls whether the right-hand panel is rendered. */
type Mode = "idle" | "creating" | "editing";

export function SubdivisionManager({ isOpen, onClose, subdivisions, allPieces }: Props) {
  // Local copy of subdivisions. Synced with the parent prop on every modal
  // open so external changes (e.g. another tab) still show up next time the
  // user opens the manager.
  const [local, setLocal] = useState<SubdivisionConfig[]>(subdivisions);
  const [mode, setMode] = useState<Mode>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pieceSearch, setPieceSearch] = useState("");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setLocal(subdivisions);
      setMode("idle");
      setEditingId(null);
    }
  }, [isOpen, subdivisions]);


  const piecesByCategory = useMemo(() => {
    const groups = new Map<string, Piece[]>();
    for (const cat of PIECE_CATEGORIES) groups.set(cat, []);
    for (const p of allPieces) {
      groups.get(p.category)?.push(p);
    }
    return groups;
  }, [allPieces]);

  const filteredPieces = useMemo(() => {
    const q = pieceSearch.trim().toLowerCase();
    if (!q) return allPieces;
    return allPieces.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.includes(q),
    );
  }, [allPieces, pieceSearch]);

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const closeForm = () => {
    setEditingId(null);
    setError(null);
    methods.reset(DEFAULT_FORM_VALUES);
    setMode("idle");
  };

  const handleNew = () => {
    setEditingId(null);
    setError(null);
    const maxOrder = local.reduce((max, s) => Math.max(max, s.order), -1);
    methods.reset({ ...DEFAULT_FORM_VALUES, order: maxOrder + 1 });
    setMode("creating");
  };

  const handleEdit = (sub: SubdivisionConfig) => {
    setEditingId(sub.id);
    setError(null);
    methods.reset({
      name: sub.name,
      pieceIds: sub.pieceIds,
      cellSizeRatio: sub.cellSizeRatio,
      order: sub.order,
    });
    setMode("editing");
  };

  const handleDelete = async (sub: SubdivisionConfig) => {
    const used = sub.pieceIds.length > 0;
    if (used) {
      alert(
        `"${sub.name}" no se puede borrar: tiene ${sub.pieceIds.length} pieza(s) usada(s). Primero quitá las piezas.`,
      );
      return;
    }
    if (!confirm(`¿Borrar "${sub.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteSubdivision({ id: sub.id });
      if (!res.success) {
        setError(res.error.message);
      } else {
        setLocal((prev) => prev.filter((s) => s.id !== sub.id));
        if (editingId === sub.id) closeForm();
      }
    });
  };

  const onSubmit = methods.handleSubmit((data) => {
    startTransition(async () => {
      const isEditing = editingId !== null;
      const action = isEditing
        ? await updateSubdivision({ id: editingId!, ...data })
        : await createSubdivision(data);
      if (!action.success) {
        setError(action.error.message);
        return;
      }
      // Reflect the mutation locally so the list updates without waiting for
      // the parent to re-fetch. The parent's handleCloseManager still does a
      // full re-fetch when the modal closes, so we stay in sync.
      if (isEditing) {
        setLocal((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? { ...s, ...data, id: editingId! }
              : s,
          ),
        );
      } else if (action.data) {
        setLocal((prev) => [...prev, action.data]);
      }
      closeForm();
    });
  });

  return (
    <Modal
      isOpen={isOpen}
      title="Administrar subdivisions"
      onClose={() => {
        closeForm();
        onClose();
      }}
    >
      <div className={`subdivision-manager subdivision-manager--mode-${mode}`}>
        {/* ─── LISTA (siempre visible) ─── */}
        <aside className="subdivision-list">
          <div className="subdivision-list-header">
            <h3>Subdivisions</h3>
            <button type="button" className="button primary mini" onClick={handleNew}>
              + Nueva
            </button>
          </div>
          {local.length === 0 ? (
            <p className="empty">No hay subdivisions todavía.</p>
          ) : (
            <ul className="subdivision-list-items">
              {local.map((sub) => {
                const used = sub.pieceIds.length > 0;
                const isEditing = editingId === sub.id;
                return (
                  <li
                    key={sub.id}
                    className={`subdivision-list-item ${isEditing ? "editing" : ""}`}
                  >
                    <button
                      type="button"
                      className="subdivision-list-card"
                      onClick={() => handleEdit(sub)}
                    >
                      <div className="subdivision-list-card-main">
                        <strong>{sub.name}</strong>
                        <span className="subdivision-list-meta">
                          {sub.pieceIds.length} pieza(s) · ratio {sub.cellSizeRatio} · z{" "}
                          {sub.order}
                        </span>
                      </div>
                      <span className={`subdivision-list-badge ${used ? "in-use" : "free"}`}>
                        {used ? "En uso" : "Libre"}
                      </span>
                    </button>
                    <div className="subdivision-list-actions">
                      <button
                        type="button"
                        className="button mini"
                        onClick={() => handleEdit(sub)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button mini danger"
                        onClick={() => handleDelete(sub)}
                      >
                        Borrar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ─── FORM (solo al crear/editar) ─── */}
        {mode !== "idle" ? (
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className="subdivision-form">
              <header className="subdivision-form-header">
                <h3>{editingId ? "Editar" : "Nueva"} subdivision</h3>
                <button
                  type="button"
                  className="button mini"
                  onClick={closeForm}
                  aria-label="Volver a la lista"
                >
                  ← Volver
                </button>
              </header>

              {error ? <p className="error">{error}</p> : null}

              <div className="subdivision-form-grid">
                <FormField label="Nombre" htmlFor="name">
                  <FormInput name="name" placeholder="Ej: Suelo, Objetos…" />
                </FormField>
                <FormField label="cellSizeRatio" htmlFor="cellSizeRatio">
                  <FormNumberInput name="cellSizeRatio" min={1} max={64} />
                </FormField>
                <FormField label="Orden (Z)" htmlFor="order">
                  <FormNumberInput name="order" min={0} max={20} />
                </FormField>
              </div>

              <section className="piece-picker">
                <header className="piece-picker-header">
                  <h4>Piezas disponibles</h4>
                  <span className="piece-picker-count">
                    {methods.watch("pieceIds")?.length ?? 0} seleccionada(s) ·{" "}
                    {allPieces.length} total
                  </span>
                </header>

                <input
                  type="search"
                  placeholder="Buscar piezas…"
                  value={pieceSearch}
                  onChange={(e) => setPieceSearch(e.target.value)}
                  className="piece-picker-search"
                />

                <Controller
                  control={methods.control}
                  name="pieceIds"
                  render={({ field }) => {
                    const selected = new Set(field.value);
                    return (
                      <div className="piece-picker-grid">
                        {PIECE_CATEGORIES.map((cat) => {
                          const inCat =
                            pieceSearch.trim() === ""
                              ? (piecesByCategory.get(cat) ?? [])
                              : filteredPieces.filter((p) => p.category === cat);
                          if (inCat.length === 0) return null;
                          return (
                            <div key={cat} className="piece-picker-group">
                              <h5 className="piece-picker-group-title">
                                {CATEGORY_LABELS[cat] ?? cat}
                              </h5>
                              <div className="piece-picker-cards">
                                {inCat.map((piece) => {
                                  const checked = selected.has(piece.id);
                                  const def =
                                    piece.visualStates.find((v) => v.isDefault) ??
                                    piece.visualStates[0];
                                  if (!def) return null;
                                  return (
                                    <label
                                      key={piece.id}
                                      className={`piece-picker-card ${checked ? "selected" : ""}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          const next = new Set(selected);
                                          if (next.has(piece.id)) next.delete(piece.id);
                                          else next.add(piece.id);
                                          field.onChange(Array.from(next));
                                        }}
                                      />
                                      <div className="piece-picker-preview">
                                        <Image
                                          src={def.imagePath}
                                          alt={piece.name}
                                          width={piece.width}
                                          height={piece.height}
                                          sizes="64px"
                                          draggable={false}
                                        />
                                      </div>
                                      <div className="piece-picker-info">
                                        <span className="piece-picker-name">{piece.name}</span>
                                        {piece.visualStates.length > 1 ? (
                                          <small className="piece-picker-states">
                                            {piece.visualStates.length} estados
                                          </small>
                                        ) : null}
                                        {piece.traits && piece.traits.length > 0 ? (
                                          <div className="piece-picker-traits">
                                            {piece.traits.map((t) => (
                                              <span
                                                key={t.kind}
                                                className="trait-badge"
                                                title={t.kind}
                                              >
                                                {t.kind}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              </section>

              <footer className="subdivision-form-actions">
                <button type="button" className="button" onClick={closeForm}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={methods.formState.isSubmitting}
                >
                  {methods.formState.isSubmitting
                    ? "Guardando…"
                    : editingId
                      ? "Guardar cambios"
                      : "Crear subdivision"}
                </button>
              </footer>
            </form>
          </FormProvider>
        ) : null}
      </div>
    </Modal>
  );
}
