import React, { createContext, useContext, useEffect, useState } from 'react';
import { WrittenWarning } from '../types';
import { triggerPersistenceSync } from '../services/persistenceSync';
import { markDeleted, nowIso } from '../services/syncMeta';

/**
 * Yazılı Uyarı kayıtları.
 * Bu kayıtlar disiplin cezası DEĞİLDİR: olay/karar kayıtlarından tamamen ayrı tutulur,
 * davranış puanı hesabına ve e-Okul'a giden hiçbir veriye katılmaz.
 */
export const WARNINGS_STORAGE_KEY = 'writtenWarnings';

interface WrittenWarningContextType {
  warnings: WrittenWarning[];
  addWarning: (w: Omit<WrittenWarning, 'createdAt' | 'updatedAt'> & Partial<Pick<WrittenWarning, 'createdAt' | 'updatedAt'>>) => WrittenWarning;
  updateWarning: (id: string, patch: Partial<WrittenWarning>) => void;
  deleteWarning: (id: string) => void;
  getStudentWarnings: (studentId: string) => WrittenWarning[];
}

const WrittenWarningContext = createContext<WrittenWarningContextType | undefined>(undefined);

const loadWarnings = (): WrittenWarning[] => {
  try {
    const raw = localStorage.getItem(WARNINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((w: unknown) => w && typeof w === 'object' && 'id' in (w as object) && 'studentId' in (w as object));
  } catch {
    return [];
  }
};

export const WrittenWarningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [warnings, setWarnings] = useState<WrittenWarning[]>(loadWarnings);

  // Sunucudan / başka cihazdan gelen güncellemeleri uygula
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.writtenWarnings && Array.isArray(detail.writtenWarnings)) {
        setWarnings(detail.writtenWarnings);
      }
    };
    window.addEventListener('app-data-synced', handleSync);
    return () => window.removeEventListener('app-data-synced', handleSync);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WARNINGS_STORAGE_KEY, JSON.stringify(warnings));
    } catch (err) {
      console.error('Yazılı uyarılar yerel depoya yazılamadı:', err);
    }
    triggerPersistenceSync();
  }, [warnings]);

  const addWarning: WrittenWarningContextType['addWarning'] = (w) => {
    const ts = nowIso();
    const record: WrittenWarning = { ...w, createdAt: w.createdAt || ts, updatedAt: ts } as WrittenWarning;
    setWarnings(prev => [record, ...prev.filter(p => p.id !== record.id)]);
    return record;
  };

  const updateWarning = (id: string, patch: Partial<WrittenWarning>) => {
    const ts = nowIso();
    setWarnings(prev => prev.map(w => (w.id === id ? { ...w, ...patch, id, updatedAt: ts } : w)));
  };

  const deleteWarning = (id: string) => {
    markDeleted('writtenWarnings', id);
    setWarnings(prev => prev.filter(w => w.id !== id));
  };

  const getStudentWarnings = (studentId: string) => warnings.filter(w => w.studentId === studentId);

  return (
    <WrittenWarningContext.Provider value={{ warnings, addWarning, updateWarning, deleteWarning, getStudentWarnings }}>
      {children}
    </WrittenWarningContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useWrittenWarnings = () => {
  const ctx = useContext(WrittenWarningContext);
  if (!ctx) throw new Error('useWrittenWarnings must be used within a WrittenWarningProvider');
  return ctx;
};
