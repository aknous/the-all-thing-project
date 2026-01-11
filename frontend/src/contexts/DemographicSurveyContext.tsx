'use client';

import { createContext, useContext } from 'react';

interface DemographicSurveyContextType {
  onSurveyUpdate: () => void;
}

export const DemographicSurveyContext = createContext<DemographicSurveyContextType | undefined>(undefined);

export function useDemographicSurveyUpdate() {
  const context = useContext(DemographicSurveyContext);
  return context?.onSurveyUpdate;
}
