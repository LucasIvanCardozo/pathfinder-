import type React from 'react';
import type { Floor } from '@/lib/shared/types';
import { findPlantaBajaIndex, floorNameForIndex } from '@/lib/shared/floors/naming';
import { newId } from '@/lib/shared/utils/generateId';

type UseFloorHeuristicsParams = {
  floors: Floor[];
  activeFloorId: string;
  setActiveFloorId: (id: string) => void;
  setFloors: React.Dispatch<React.SetStateAction<Floor[]>>;
  markDirty: () => void;
};

export function useFloorHeuristics({
  floors,
  activeFloorId,
  setActiveFloorId,
  setFloors,
  markDirty,
}: UseFloorHeuristicsParams) {
  const activeFloorIndex = floors.findIndex((floor) => floor.id === activeFloorId);
  const activeFloor = floors[activeFloorIndex] ?? floors[0] ?? { id: '', name: '' };
  const makeFloor = (name: string): Floor => ({ id: newId('floor'), name });

  const handleAddFloorAbove = () => {
    const newFloor = makeFloor(floorNameForIndex(floors, floors.length));
    setFloors((previous) => [...previous, newFloor]);
    setActiveFloorId(newFloor.id);
    markDirty();
  };
  const handleAddFloorBelow = () => {
    const newFloor = makeFloor(`Subsuelo ${findPlantaBajaIndex(floors) + 1}`);
    setFloors((previous) => [newFloor, ...previous]);
    setActiveFloorId(newFloor.id);
    markDirty();
  };
  const handleFloorUp = () => {
    const floor = floors[activeFloorIndex + 1];
    if (floor) setActiveFloorId(floor.id);
  };
  const handleFloorDown = () => {
    const floor = floors[activeFloorIndex - 1];
    if (floor) setActiveFloorId(floor.id);
  };

  return {
    activeFloorIndex,
    activeFloor,
    handleAddFloorAbove,
    handleAddFloorBelow,
    handleFloorUp,
    handleFloorDown,
  };
}
