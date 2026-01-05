'use client';

import { useState, useRef } from 'react';
import { adminFetch } from '@/lib/adminAuth';

interface ImportResultItem {
  type: string;
  action: string;
  key: string;
  name: string;
  error?: string;
}

interface ImportResult {
  categoriesCreated: number;
  templatesCreated: number;
  errors: string[];
  details: ImportResultItem[];
}

interface ImportData {
  categories?: Array<{
    key: string;
    name: string;
    emoji?: string;
    sortOrder?: number;
  }>;
  templates?: Array<{
    categoryKey: string;
    key: string;
    title: string;
    question?: string;
    pollType: string;
    maxRank?: number;
    audience?: string;
    durationDays?: number;
    isActive?: boolean;
    options: Array<{
      key: string;
      label: string;
      sortOrder: number;
    }>;
  }>;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setPreview(null);

    // Preview the JSON
    try {
      const text = await selectedFile.text();
      const json = JSON.parse(text);
      setPreview(json);
    } catch (err) {
      setError('Invalid JSON file');
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL;
      const response = await adminFetch(`${API_URL}/admin/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Import failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Import Data
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Upload a JSON file to import categories and poll templates
        </p>
      </div>

      {/* File Upload */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800 mb-6">
        <label className="block mb-4">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">
            Select JSON File
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-900 dark:text-zinc-100
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              dark:file:bg-blue-900/20 dark:file:text-blue-300
              dark:hover:file:bg-blue-900/30"
          />
        </label>

        {file && preview && !result && (
          <div className="mt-4">
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Preview
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-4 max-h-96 overflow-auto">
              <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                📁 {preview.categories?.length || 0} categories
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                📋 {preview.templates?.length || 0} templates
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import Data'}
              </button>
              <button
                onClick={handleReset}
                disabled={importing}
                className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Import Results
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {result.categoriesCreated}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Categories Created
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {result.templatesCreated}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Templates Created
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                Errors ({result.errors.length})
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-1">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="text-sm text-red-600 dark:text-red-400">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
              Details
            </h3>
            <div className="space-y-2">
              {result.details.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    item.error
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : item.action === 'created'
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-zinc-50 dark:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {item.type === 'category' ? '📁' : '📋'}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.key}
                      </div>
                      {item.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {item.error}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      item.action === 'created'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : item.action === 'updated'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {item.action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Import Another File
            </button>
            <a
              href="/admin/operations"
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-medium rounded-lg transition-colors inline-block"
            >
              Go to Operations
            </a>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-zinc-50 dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          JSON Format Example
        </h2>
        <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto">
{`{
  "categories": [
    {
      "key": "daily-polls",
      "name": "Daily Polls",
      "emoji": "📊",
      "sortOrder": 1
    }
  ],
  "templates": [
    {
      "categoryKey": "daily-polls",
      "key": "favorite-color",
      "title": "What's your favorite color?",
      "question": "Pick your favorite!",
      "pollType": "SINGLE",
      "maxRank": null,
      "audience": "EVERYONE",
      "durationDays": 1,
      "isActive": true,
      "options": [
        { "key": "red", "label": "Red", "sortOrder": 1 },
        { "key": "blue", "label": "Blue", "sortOrder": 2 },
        { "key": "green", "label": "Green", "sortOrder": 3 }
      ]
    }
  ]
}`}
        </pre>
      </div>
    </div>
  );
}
