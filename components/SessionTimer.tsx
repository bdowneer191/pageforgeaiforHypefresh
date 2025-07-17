import React, { useState, useEffect } from 'react';
import { getDhakaTime, formatDuration } from '../utils/time.ts';

interface SessionTimerProps {
  startTime: string;
}

const SessionTimer: React.FC<SessionTimerProps> = ({ startTime }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentTimeInDhaka, setCurrentTimeInDhaka] = useState('');

  useEffect(() => {
    const sessionStartDate = new Date(startTime);
    
    const timerInterval = setInterval(() => {
      const now = new Date();
      setElapsedSeconds((now.getTime() - sessionStartDate.getTime()) / 1000);
      setCurrentTimeInDhaka(getDhakaTime(now));
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [startTime]);

  return (
    <div className="p-3 mb-4 bg-green-900/50 border border-green-700 rounded-lg text-center">
        <h3 className="font-semibold text-green-300">Active Session</h3>
        <div className="flex justify-center items-center gap-6 mt-1 text-sm text-gray-300">
            <div>
                <span className="text-xs text-gray-400 block">Session Timer</span>
                <span className="font-mono text-lg">{formatDuration(elapsedSeconds)}</span>
            </div>
             <div>
                <span className="text-xs text-gray-400 block">Current Time (Dhaka)</span>
                <span className="font-mono text-lg">{currentTimeInDhaka}</span>
            </div>
        </div>
    </div>
  );
};

export default SessionTimer;