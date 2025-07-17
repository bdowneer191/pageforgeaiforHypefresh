// Options for formatting time in Dhaka
const dhakaTimeOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Dhaka',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
};

// Options for formatting date in Dhaka
const dhakaDateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

export const getDhakaTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', dhakaTimeOptions);
};

export const getDhakaDate = (date: Date): string => {
  return date.toLocaleDateString('en-GB', dhakaDateOptions);
};


export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00:00';
  }
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

export const isTodayInDhaka = (date: Date): boolean => {
    const todayInDhaka = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka'}); // YYYY-MM-DD format
    const dateInDhaka = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    return todayInDhaka === dateInDhaka;
}