"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  SubdivisionConfigInputSchema,
  type SubdivisionConfig,
  type Texture,
  PIECE_CATEGORIES,
} from "@/pieces";
import { filterVisibleSubdivisions } from "@/canvas";
import { Modal } from "./Modal";
import { FormField, FormInput, FormNumberInput } from "./form";
import { createSubdivision, updateSubdivision, deleteSubdivision } from "../actions/subdivisions";

const FormSchema = SubdivisionConfigInputSchema;
type FormValues = z.infer<typeof FormSchema>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  subdivisions: SubdivisionConfig[];
  allTextures: Texture[];
};

const INPUT_CLASS = "form-control";

export function SubdivisionManager({ isOpen, onClose, subdivisions, allTextures }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: {
      name: "",
      textureIds: [],
      cellSizeRatio: 2,
      order: subdivisions.length,
    },
  });

  const startNew = () => {
    setEditingId(null);
    setError(null);
    form.reset({
      name: "",
      textureIds: [],
      cellSizeRatio: 2,
      order: subdivisions.length,
    });
  };

  const startEdit = (sub: SubdivisionConfig) => {
    setEditingId(sub.id);
    setError(null);
    form.reset({
      name: sub.name,
      textureIds: sub.textureIds,
      cellSizeRatio: sub.cellSizeRatio,
      order: sub.order,
    });
  };

  const handleSubmit = (data: FormValues) => {
    setError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateSubdivision(editingId, data)
        : await createSubdivision(data);
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Borrar esta subdivision?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSubdivision(id);
      if (!result.success) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  };

  const visibleTextures = useMemo(() => {
    if (filterCategory === "all") return allTextures;
    return allTextures.filter((t) => t.category === filterCategory);
  }, [allTextures, filterCategory]);

  return (
    <Modal isOpen={isOpen} title="Administrar subdivisions" onClose={onClose}>
      <FormProvider {...form}>
        <div className="subdivision-manager">
          <div className="subdivision-manager-list">
            <h3>Existentes</h3>
            {subdivisions.length === 0 ? (
              <p className="empty">No hay subdivisions todavía.</p>
            ) : (
              <ul>
                {filterVisibleSubdivisions(subdivisions).map((s) => (
                  <li key={s.id} className={editingId === s.id ? "editing" : ""}>
                    <div className="subdivision-row-info">
                      <strong>{s.name}</strong>
                      <span className="subdivision-row-meta">
                        {s.textureIds.length} textura(s) · ratio: {s.cellSizeRatio} · order:{" "}
                        {s.order}
                      </span>
                    </div>
                    <div className="subdivision-row-actions">
                      <button type="button" className="button mini" onClick={() => startEdit(s)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button danger mini"
                        onClick={() => handleDelete(s.id)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="subdivision-manager-form">
            <div className="form-row-between">
              <h3>{editingId ? "Editar" : "Nueva"}</h3>
              {editingId ? (
                <button type="button" className="button mini" onClick={startNew}>
                  Limpiar
                </button>
              ) : null}
            </div>

            <FormField label="Nombre" required error={form.formState.errors.name?.message}>
              <FormInput name="name" placeholder="Ej: Decoraciones" />
            </FormField>

            <div className="form-row">
              <FormField
                label="Ratio"
                required
                error={form.formState.errors.cellSizeRatio?.message}
                hint="1=64px, 2=32px, 4=16px, 8=8px"
              >
                <FormNumberInput name="cellSizeRatio" min={1} max={64} />
              </FormField>
              <FormField label="Order (z)" required error={form.formState.errors.order?.message}>
                <FormNumberInput name="order" min={0} max={20} />
              </FormField>
            </div>

            <div className="texture-picker">
              <div className="texture-picker-header">
                <span>
                  Texturas{" "}
                  <span className="texture-picker-count">
                    ({form.watch("textureIds")?.length ?? 0}/{allTextures.length})
                  </span>
                </span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={INPUT_CLASS}
                  style={{ width: "auto", padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                >
                  <option value="all">Todas las categorías</option>
                  {PIECE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Controller
                control={form.control}
                name="textureIds"
                render={({ field }) => {
                  const selected = new Set(field.value ?? []);
                  const toggle = (id: string) => {
                    const next = new Set(selected);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    field.onChange([...next]);
                  };
                  return (
                    <div className="texture-picker-list">
                      {visibleTextures.map((texture) => (
                        <label
                          key={texture.id}
                          className={`texture-picker-row ${selected.has(texture.id) ? "selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(texture.id)}
                            onChange={() => toggle(texture.id)}
                          />
                          <img src={texture.imagePath} alt={texture.name} draggable={false} />
                          <div className="texture-picker-info">
                            <span className="texture-picker-name">{texture.name}</span>
                            <span className="texture-picker-meta">{texture.category}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  );
                }}
              />
            </div>

            {error ? <p className="form-error">{error}</p> : null}

            <div className="form-actions">
              <button type="button" className="button" onClick={onClose}>
                Cerrar
              </button>
              <button type="submit" className="button primary" disabled={isPending}>
                {isPending ? "Guardando…" : editingId ? "Guardar" : "Crear"}
              </button>
            </div>
          </form>
        </div>
      </FormProvider>
    </Modal>
  );
}
