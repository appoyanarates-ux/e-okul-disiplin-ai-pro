
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Student } from '../types';
import { triggerPersistenceSync } from '../services/persistenceSync';
import { trackDeletedStudentId } from '../services/cloudSyncService';
import { nowIso, stampIfChanged } from '../services/syncMeta';

interface StudentContextType {
  students: Student[];
  addStudent: (student: Student) => void;
  removeStudent: (id: string) => void;
  setStudents: (students: Student[]) => void;
  updateStudent: (id: string, updatedFields: Partial<Student>) => void;
}

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [students, setStudentsState] = useState<Student[]>(() => {
    try {
        const saved = localStorage.getItem('students');
        const parsed = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(parsed)) return [];
        // Sanitize: Null veya bozuk kayıtları filtrele
        return parsed.filter((s: unknown) => s && typeof s === 'object' && 'id' in s);
    } catch {
        return [];
    }
  });

  // Bulut senkronizasyonundan gelen güncellemeleri anında state'e yansıt
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail?.students && Array.isArray(e.detail.students)) {
        setStudentsState(e.detail.students);
      }
    };
    window.addEventListener('app-data-synced', handleSync);
    return () => window.removeEventListener('app-data-synced', handleSync);
  }, []);

  const setStudents = (newStudents: Student[]) => {
    // Değişen kayıtlara zaman damgası ekle (cihazlar arası eşitlemede hangi kaydın yeni olduğu bilinsin)
    setStudentsState(prev => {
      const prevMap = new Map<string, Student>(prev.map(s => [s.id, s] as [string, Student]));
      const ts = nowIso();
      const stamped = newStudents.map(s => stampIfChanged(prevMap.get(s.id), s, ts));
      localStorage.setItem('students', JSON.stringify(stamped));
      triggerPersistenceSync();
      return stamped;
    });
  };

  const addStudent = (student: Student) => {
    setStudentsState(prev => {
        const updated = [...prev, { ...student, updatedAt: nowIso() }];
        localStorage.setItem('students', JSON.stringify(updated));
        triggerPersistenceSync();
        return updated;
    });
  };

  const removeStudent = (id: string) => {
    trackDeletedStudentId(id);
    setStudentsState(prev => {
        const updated = prev.filter(s => s.id !== id);
        localStorage.setItem('students', JSON.stringify(updated));
        triggerPersistenceSync();
        return updated;
    });
  };

  const updateStudent = (id: string, updatedFields: Partial<Student>) => {
    setStudentsState(prev => {
        const ts = nowIso();
        const updated = prev.map(s => s.id === id ? { ...s, ...updatedFields, updatedAt: ts } : s);
        localStorage.setItem('students', JSON.stringify(updated));
        triggerPersistenceSync();
        return updated;
    });
  };

  return (
    <StudentContext.Provider value={{ students, addStudent, removeStudent, setStudents, updateStudent }}>
      {children}
    </StudentContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useStudents = () => {
  const context = useContext(StudentContext);
  if (!context) throw new Error('useStudents must be used within a StudentProvider');
  return context;
};
