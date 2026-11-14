import React, { createContext, useContext, useState, useEffect } from 'react';
import { Institution, BoardMember } from '../types';
import { getCurrentAcademicYear } from '../services/academicYear';
import { triggerPersistenceSync } from '../services/persistenceSync';
import { cleanApiKey } from '../services/geminiService';

interface SettingsContextType {
  institution: Institution;
  boardMembers: BoardMember[];
  apiKey: string; // User's personal Gemini API key
  hasApiKey: boolean;
  updateInstitution: (data: Institution) => void;
  updateBoardMembers: (data: BoardMember[]) => void;
  updateApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const defaultInstitution: Institution = {
  name: '',
  code: '',
  type: 'Lise',
  year: getCurrentAcademicYear(),
  province: '',
  district: '',
  managerName: '',
  counselorName: '',
  counselorTitle: 'Psikolojik Danışman / Rehberlik Öğretmeni',
  address: '',
  phone: '',
  fax: '',
  headerText: '',
  ebysCode: ''
};

const defaultBoardMembers: BoardMember[] = [
  { id: '1', role: 'BAŞKAN', mainName: '', mainTitle: 'Müdür Başyardımcısı', reserveName: '', reserveTitle: 'Müdür Yardımcısı' },
  { id: '2', role: '1. ÜYE', mainName: '', mainTitle: 'Öğretmen', reserveName: '', reserveTitle: 'Öğretmen' },
  { id: '3', role: '2. ÜYE', mainName: '', mainTitle: 'Öğretmen', reserveName: '', reserveTitle: 'Öğretmen' },
  { id: '4', role: '3. ÜYE', mainName: '', mainTitle: 'Öğretmen', reserveName: '', reserveTitle: 'Öğretmen' },
  { id: '5', role: '4. ÜYE (VELİ)', mainName: '', mainTitle: 'Okul Aile Bir. Üyesi', reserveName: '', reserveTitle: 'Yedek Veli' },
];

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [institution, setInstitution] = useState<Institution>(defaultInstitution);
  const [boardMembers, setBoardMembers] = useState<BoardMember[]>(defaultBoardMembers);
  const [apiKey, setApiKey] = useState<string>('');

  const hasApiKey = Boolean(apiKey && apiKey.trim().length > 0);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedInst = localStorage.getItem('institutionSettings');
      const savedBoard = localStorage.getItem('boardSettings');
      const savedKey = localStorage.getItem('gemini_api_key');
      
      if (savedInst) {
        const parsed = JSON.parse(savedInst);
        if (!parsed.year) {
          parsed.year = getCurrentAcademicYear();
        }
        setInstitution(parsed);
      }
      if (savedBoard) setBoardMembers(JSON.parse(savedBoard));
      if (savedKey) setApiKey(savedKey.trim());
    } catch (e) {
      console.error("Failed to load settings", e);
    }

    const handleSync = (e: any) => {
      if (e.detail?.institutionSettings && typeof e.detail.institutionSettings === 'object') {
        setInstitution(e.detail.institutionSettings);
      }
      if (Array.isArray(e.detail?.boardSettings)) {
        setBoardMembers(e.detail.boardSettings);
      }
      if (e.detail?.gemini_api_key !== undefined) {
        setApiKey(e.detail.gemini_api_key);
      }
    };
    window.addEventListener('app-data-synced', handleSync);
    return () => window.removeEventListener('app-data-synced', handleSync);
  }, []);

  const updateInstitution = (data: Institution) => {
    setInstitution(data);
    localStorage.setItem('institutionSettings', JSON.stringify(data));
    triggerPersistenceSync();
  };

  const updateBoardMembers = (data: BoardMember[]) => {
    setBoardMembers(data);
    localStorage.setItem('boardSettings', JSON.stringify(data));
    triggerPersistenceSync();
  };

  const updateApiKey = (key: string) => {
    const cleaned = cleanApiKey(key);
    setApiKey(cleaned);
    if (cleaned) {
      localStorage.setItem('gemini_api_key', cleaned);
    } else {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('gemini_preferred_model');
    }
    triggerPersistenceSync();
  };

  const clearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
    localStorage.removeItem('gemini_preferred_model');
    triggerPersistenceSync();
  };

  return (
    <SettingsContext.Provider
      value={{
        institution,
        boardMembers,
        apiKey,
        hasApiKey,
        updateInstitution,
        updateBoardMembers,
        updateApiKey,
        clearApiKey,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
