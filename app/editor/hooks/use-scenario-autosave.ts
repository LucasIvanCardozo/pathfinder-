import { useCallback, useEffect, useState, useTransition } from "react";
import { saveScenario } from "@/lib/server/actions/scenario.action";
import type { Floor, PaintedCell } from "@/lib/shared/types";

const AUTOSAVE_INTERVAL_MS = 60 * 1000;

type UseScenarioAutosaveParams = {
  scenarioName: string;
  scenarioId: string | null;
  mapDims: { baseCellSize: number; width: number; height: number };
  floors: Floor[];
  paintedCells: PaintedCell[];
  isDirty: boolean;
  onSaved: (savedId: string) => void;
};

type UseScenarioAutosaveResult = {
  isSaving: boolean;
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  savedAt: string | null;
  save: (isAutosave?: boolean) => void;
};

export function useScenarioAutosave({
  scenarioName,
  scenarioId,
  mapDims,
  floors,
  paintedCells,
  isDirty,
  onSaved,
}: UseScenarioAutosaveParams): UseScenarioAutosaveResult {
  const [, startSaveTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<UseScenarioAutosaveResult["autosaveStatus"]>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const save = useCallback(
    (isAutosave = false) => {
      if (isAutosave && !isDirty) return;
      startSaveTransition(async () => {
        setAutosaveStatus("saving");
        setIsSaving(true);
        try {
          const result = await saveScenario({
            id: scenarioId ?? undefined,
            name: scenarioName,
            baseCellSize: mapDims.baseCellSize,
            width: mapDims.width,
            height: mapDims.height,
            floors,
            paintedCells,
          });
          if (!result.success) {
            setAutosaveStatus("error");
            return;
          }
          setSavedAt(new Date().toLocaleTimeString("es"));
          setAutosaveStatus("saved");
          onSaved(result.data.id);
        } catch {
          setAutosaveStatus("error");
        } finally {
          setIsSaving(false);
        }
      });
    }, [isDirty, scenarioId, scenarioName, mapDims, floors, paintedCells, onSaved]
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (isDirty) save(true);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isDirty, save]);

  return { isSaving, autosaveStatus, savedAt, save };
}
