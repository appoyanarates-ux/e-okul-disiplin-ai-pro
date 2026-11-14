
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Incident, InvolvedStudent } from '../types';
import { triggerPersistenceSync } from '../services/persistenceSync';
import { trackDeletedIncidentId } from '../services/cloudSyncService';

interface IncidentContextType {
  incidents: Incident[];
  addIncident: (incident: Incident) => void;
  updateIncident: (incident: Incident) => void;
  deleteIncident: (id: string) => void;
  updateIncidentStudent: (incidentId: string, studentId: string, data: Partial<InvolvedStudent>) => void;
  getNextIncidentCode: () => string;
}

const IncidentContext = createContext<IncidentContextType | undefined>(undefined);

export const IncidentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
        const saved = localStorage.getItem('incidents');
        const parsed = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(parsed)) return [];
        // Sanitize: Null veya bozuk kayıtları filtrele
        return parsed.filter((i: unknown) => i && typeof i === 'object' && 'id' in i);
    } catch {
        return [];
    }
  });

  // Bulut senkronizasyonundan gelen güncellemeleri anında state'e yansıt
  useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail?.incidents && Array.isArray(e.detail.incidents)) {
        setIncidents(e.detail.incidents);
      }
    };
    window.addEventListener('app-data-synced', handleSync);
    return () => window.removeEventListener('app-data-synced', handleSync);
  }, []);

  useEffect(() => {
    localStorage.setItem('incidents', JSON.stringify(incidents));
    triggerPersistenceSync();
  }, [incidents]);

  const addIncident = (incident: Incident) => {
    setIncidents(prev => [incident, ...prev]);
  };

  const updateIncident = (updatedIncident: Incident) => {
    setIncidents(prev => prev.map(inc => inc.id === updatedIncident.id ? updatedIncident : inc));
  };

  const updateIncidentStudent = (incidentId: string, studentId: string, data: Partial<InvolvedStudent>) => {
    setIncidents(prev => prev.map(inc => {
        if (inc.id !== incidentId) return inc;
        
        const updatedStudents = inc.involvedStudents.map(s => {
            if (s.studentId !== studentId) return s;
            return { ...s, ...data };
        });

        // Eğer tüm öğrenciler karara bağlandıysa olay statüsünü güncelle
        const allDecided = updatedStudents.every(s => s.role !== 'suspect' || (s.role === 'suspect' && s.decision));
        
        return { 
            ...inc, 
            involvedStudents: updatedStudents,
            status: allDecided ? 'decided' : 'investigating'
        };
    }));
  };

  const deleteIncident = (id: string) => {
    trackDeletedIncidentId(id);
    setIncidents(prev => prev.filter(inc => inc.id !== id));
  };

  const getNextIncidentCode = () => {
    const year = new Date().getFullYear();
    const count = incidents.length + 1;
    return `OLAY${year}-${String(count).padStart(3, '0')}`;
  };

  return (
    <IncidentContext.Provider value={{ incidents, addIncident, updateIncident, deleteIncident, updateIncidentStudent, getNextIncidentCode }}>
      {children}
    </IncidentContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useIncidents = () => {
  const context = useContext(IncidentContext);
  if (!context) throw new Error('useIncidents must be used within an IncidentProvider');
  return context;
};
