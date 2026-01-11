// lib/demographicSurvey.ts
import { DemographicData } from '@/components/DemographicSurveyModal';

const SURVEY_COMPLETED_KEY = 'demographic_survey_completed';
const SURVEY_DATA_KEY = 'demographic_survey_data';

export function hasDemographicSurvey(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SURVEY_COMPLETED_KEY) === 'true';
}

export function hasDemographicData(): boolean {
  if (typeof window === 'undefined') return false;
  const data = getDemographicData();
  if (!data) return false;
  // Check if data has any non-empty values
  return Object.values(data).some(value => value !== undefined && value !== '');
}

export function getDemographicData(): DemographicData | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(SURVEY_DATA_KEY);
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function saveDemographicData(data: DemographicData): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(SURVEY_DATA_KEY, JSON.stringify(data));
  localStorage.setItem(SURVEY_COMPLETED_KEY, 'true');
}

export function markSurveySkipped(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(SURVEY_COMPLETED_KEY, 'true');
  // Don't save any data - user opted out
}

export function clearDemographicData(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(SURVEY_DATA_KEY);
  localStorage.removeItem(SURVEY_COMPLETED_KEY);
}
