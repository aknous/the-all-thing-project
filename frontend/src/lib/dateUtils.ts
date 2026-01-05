/**
 * Get today's date in America/New_York timezone in YYYY-MM-DD format.
 * This matches the backend's getEasternToday() function.
 */
export function getEasternToday(): string {
  const now = new Date();
  
  // Convert to Eastern Time using toLocaleString
  const easternDateString = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Parse MM/DD/YYYY format
  const [month, day, year] = easternDateString.split('/');
  
  // Return in YYYY-MM-DD format
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}
