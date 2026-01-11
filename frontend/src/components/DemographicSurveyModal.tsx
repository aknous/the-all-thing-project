'use client';

import { useState } from 'react';

export interface DemographicData {
  ageRange?: string;
  gender?: string;
  race?: string;
  ethnicity?: string;
  state?: string;
  region?: string;
  urbanRuralSuburban?: string;
  politicalParty?: string;
  politicalIdeology?: string;
  religion?: string;
  educationLevel?: string;
}

interface DemographicSurveyModalProps {
  onComplete: (data: DemographicData) => void;
  onSkip: () => void;
  onClose?: () => void; // Optional close without changes
  onClear?: () => void; // Callback when data is cleared
  initialData?: DemographicData; // Pre-populate with existing data
  isEditMode?: boolean; // Whether this is editing existing data
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

export default function DemographicSurveyModal({ onComplete, onSkip, onClose, onClear, initialData, isEditMode = false }: DemographicSurveyModalProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'survey'>(isEditMode && initialData ? 'summary' : 'survey');
  const [step, setStep] = useState(1);
  const [data, setData] = useState<DemographicData>(initialData || {});
  
  const totalSteps = 5;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkipAll = () => {
    onSkip();
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all your demographic data? This cannot be undone.')) {
      setData({});
      if (onClear) {
        onClear();
      } else {
        // Fallback to onComplete with empty data if onClear not provided
        onComplete({});
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">
                {viewMode === 'summary' ? 'Your Demographic Data' : (isEditMode ? 'Edit Demographic Survey' : 'Optional Anonymous Survey')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {viewMode === 'summary' ? (
                  <>View your stored demographic information. You can retake the survey or clear all data.</>
                ) : isEditMode ? (
                  <>All responses are stored locally and only attached to your individual votes. You can update or clear this data at any time.</>
                ) : (
                  <>
                    Help us understand our community better. All responses are stored anonymously and only attached to your individual votes.
                    <strong className="block mt-1">You can skip this survey entirely if you prefer.</strong>
                  </>
                )}
              </p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {viewMode === 'survey' && (
            <div className="mt-4 flex gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => {
                // Calculate gradient segment for each bar to create continuous effect
                // Indigo-600: rgb(79, 70, 229) -> Pink-600: rgb(219, 39, 119)
                const startProgress = i / totalSteps;
                const endProgress = (i + 1) / totalSteps;
                
                const startR = Math.round(79 + (219 - 79) * startProgress);
                const startG = Math.round(70 + (39 - 70) * startProgress);
                const startB = Math.round(229 + (119 - 229) * startProgress);
                
                const endR = Math.round(79 + (219 - 79) * endProgress);
                const endG = Math.round(70 + (39 - 70) * endProgress);
                const endB = Math.round(229 + (119 - 229) * endProgress);
                
                return (
                  <div
                    key={i}
                    className="h-2 flex-1 rounded-full transition-all"
                    style={{
                      background: i + 1 <= step 
                        ? `linear-gradient(to right, rgb(${startR}, ${startG}, ${startB}), rgb(${endR}, ${endG}, ${endB}))`
                        : undefined
                    }}
                  >
                    {i + 1 > step && (
                      <div className="h-full w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Summary View */}
          {viewMode === 'summary' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Age Range</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.ageRange || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Gender</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.gender || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Race</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.race || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ethnicity</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.ethnicity || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">State</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.state || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Region</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.region || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Location Type</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.urbanRuralSuburban || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Political Party</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.politicalParty || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Political Ideology</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.politicalIdeology || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Religion</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.religion || 'Not specified'}</div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg col-span-2">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Education Level</div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">{data.educationLevel || 'Not specified'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Age & Gender */}
          {viewMode === 'survey' && step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Age Range
                </label>
                <select
                  value={data.ageRange || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, ageRange: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55-64">55-64</option>
                  <option value="65+">65+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gender
                </label>
                <select
                  value={data.gender || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, gender: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Race & Ethnicity */}
          {viewMode === 'survey' && step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Race
                </label>
                <select
                  value={data.race || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, race: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="White">White</option>
                  <option value="Black or African American">Black or African American</option>
                  <option value="Asian">Asian</option>
                  <option value="Native American or Alaska Native">Native American or Alaska Native</option>
                  <option value="Native Hawaiian or Pacific Islander">Native Hawaiian or Pacific Islander</option>
                  <option value="Mixed/Multiple">Mixed/Multiple</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ethnicity
                </label>
                <select
                  value={data.ethnicity || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, ethnicity: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Hispanic or Latino">Hispanic or Latino</option>
                  <option value="Not Hispanic or Latino">Not Hispanic or Latino</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {viewMode === 'survey' && step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State (US)
                </label>
                <select
                  value={data.state || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, state: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Region
                </label>
                <select
                  value={data.region || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, region: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Northeast">Northeast</option>
                  <option value="Southeast">Southeast</option>
                  <option value="Midwest">Midwest</option>
                  <option value="Southwest">Southwest</option>
                  <option value="West">West</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Area Type
                </label>
                <select
                  value={data.urbanRuralSuburban || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, urbanRuralSuburban: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Urban">Urban</option>
                  <option value="Suburban">Suburban</option>
                  <option value="Rural">Rural</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Politics */}
          {viewMode === 'survey' && step === 4 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Political Party
                </label>
                <select
                  value={data.politicalParty || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, politicalParty: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Democrat">Democrat</option>
                  <option value="Republican">Republican</option>
                  <option value="Independent">Independent</option>
                  <option value="Libertarian">Libertarian</option>
                  <option value="Green">Green</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Political Ideology
                </label>
                <select
                  value={data.politicalIdeology || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, politicalIdeology: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Very Liberal">Very Liberal</option>
                  <option value="Liberal">Liberal</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Conservative">Conservative</option>
                  <option value="Very Conservative">Very Conservative</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 5: Religion & Education */}
          {viewMode === 'survey' && step === 5 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Religion
                </label>
                <select
                  value={data.religion || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, religion: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Christian">Christian</option>
                  <option value="Catholic">Catholic</option>
                  <option value="Jewish">Jewish</option>
                  <option value="Muslim">Muslim</option>
                  <option value="Hindu">Hindu</option>
                  <option value="Buddhist">Buddhist</option>
                  <option value="Atheist">Atheist</option>
                  <option value="Agnostic">Agnostic</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Education Level
                </label>
                <select
                  value={data.educationLevel || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setData({ ...data, educationLevel: value === '' ? undefined : value });
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Some High School">Some High School</option>
                  <option value="High School Graduate">High School Graduate</option>
                  <option value="Some College">Some College</option>
                  <option value="Associate Degree">Associate Degree</option>
                  <option value="Bachelor's Degree">Bachelor&apos;s Degree</option>
                  <option value="Master's Degree">Master&apos;s Degree</option>
                  <option value="Doctorate">Doctorate</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          {viewMode === 'summary' ? (
            /* Summary View Footer */
            <>
              <button
                onClick={handleClearData}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Clear All Data
              </button>
              <button
                onClick={() => setViewMode('survey')}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:from-indigo-700 hover:to-pink-700"
              >
                Retake Survey
              </button>
            </>
          ) : (
            /* Survey View Footer */
            <>
              <div className="flex gap-3">
                {!isEditMode && (
                  <button
                    onClick={handleSkipAll}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    Skip Survey
                  </button>
                )}
                {isEditMode && (
                  <button
                    onClick={handleClearData}
                    className="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Clear All Data
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    onClick={handleBack}
                    className="px-6 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 text-white rounded-lg hover:from-indigo-700 hover:to-pink-700"
                >
                  {step === totalSteps ? 'Complete' : 'Next'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
