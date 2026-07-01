import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { KEYS, load, save } from "@/services/storage";
import type { AgeGroup, FamilyMember, SpiceLevel } from "@/types";

export interface AddMemberParams {
  name: string;
  photo?: string;
  ageGroup: AgeGroup;
  likes: string[];
  dislikes: string[];
  allergies: string[];
  spiceLevel: SpiceLevel;
  favoriteCuisines: string[];
}

interface FamilyState {
  members: FamilyMember[];
  isLoaded: boolean;
  addMember: (params: AddMemberParams) => void;
  updateMember: (id: string, params: Partial<AddMemberParams>) => void;
  removeMember: (id: string) => void;
}

const FamilyContext = createContext<FamilyState | null>(null);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    load<FamilyMember[]>(KEYS.FAMILY_MEMBERS, []).then((saved) => {
      setMembers(saved);
      setIsLoaded(true);
    });
  }, []);

  const addMember = useCallback((params: AddMemberParams) => {
    const trimmed = params.name.trim();
    if (!trimmed) return;
    setMembers((prev) => {
      const next: FamilyMember[] = [
        ...prev,
        {
          id: generateId(),
          name: trimmed,
          photo: params.photo,
          ageGroup: params.ageGroup,
          likes: params.likes,
          dislikes: params.dislikes,
          allergies: params.allergies,
          spiceLevel: params.spiceLevel,
          favoriteCuisines: params.favoriteCuisines,
        },
      ];
      save(KEYS.FAMILY_MEMBERS, next);
      return next;
    });
  }, []);

  const updateMember = useCallback((id: string, params: Partial<AddMemberParams>) => {
    setMembers((prev) => {
      const next = prev.map((m) =>
        m.id === id ? { ...m, ...params, name: (params.name ?? m.name).trim() } : m
      );
      save(KEYS.FAMILY_MEMBERS, next);
      return next;
    });
  }, []);

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => {
      const next = prev.filter((m) => m.id !== id);
      save(KEYS.FAMILY_MEMBERS, next);
      return next;
    });
  }, []);

  return (
    <FamilyContext.Provider value={{ members, isLoaded, addMember, updateMember, removeMember }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be inside FamilyProvider");
  return ctx;
}
