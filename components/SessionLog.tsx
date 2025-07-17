



import React, { useState, useMemo } from 'react';
import Icon from './Icon.tsx';
import { getDhakaDate, formatDuration, isTodayInDhaka } from '../utils/time.ts';
import { Session } from '../types.ts';
import type { User } from 'netlify-identity-widget';

interface SessionLogProps {
    sessions: Session[];
    setSessions: (sessions: Session[]) => void;
    user: User | null;
}

const ScoreDiff = ({ before, after }) => {
    if (before === undefined || after === undefined) return null;
    const diff = Math.round(after * 100) - Math.round(before * 100);
    const color = diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
    const sign = diff > 0 ? '+' : '';
    return (
        <span>
            {Math.round(before * 100)} &rarr; {Math.round(after * 100)} <span className={`font-bold ${color}`}>({sign}{diff})</span>
        </span>
    );
}

const convertToCSV = (sessions: Session[]): string => {
    if (sessions.length === 0) return '';
    
    const headers = [
        "Date (Dhaka)", "URL", "Duration (HH:MM:SS)",
        "Mobile Score Before", "Mobile Score After", "Desktop Score Before", "Desktop Score After"
    ];

    const rows = sessions.map(s => {
        const row = [
            getDhakaDate(new Date(s.startTime)),
            `"${s.url}"`,
            formatDuration(s.duration),
            Math.round(s.beforeScores.mobile * 100),
            Math.round(s.afterScores.mobile * 100),
            Math.round(s.beforeScores.desktop * 100),
            Math.round(s.afterScores.desktop * 100)
        ];
        return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

const SessionLog: React.FC<SessionLogProps> = ({ sessions, setSessions, user }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isClearing, setIsClearing] = useState(false);
    const [showAll, setShowAll] = useState(false);

    const todaySessions = useMemo(() => {
        return sessions.filter(s => isTodayInDhaka(new Date(s.startTime)));
    }, [sessions]);

    const displayedSessions = showAll ? sessions : todaySessions;

    const handleDownload = () => {
        if (displayedSessions.length === 0) return;
        
        const csvData = convertToCSV(displayedSessions);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
        link.setAttribute('href', url);
        link.setAttribute('download', `PageForge_History_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
    const handleClear = async () => {
        if (!user || sessions.length === 0 || !window.confirm('Are you sure you want to permanently delete all your session history from the server? This action cannot be undone.')) {
            return;
        }
        setIsClearing(true);
        try {
            const token = await (user as any).jwt();
            const response = await fetch('/.netlify/functions/sessions', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to clear history.');
            }
            setSessions([]);
        } catch (error: any) {
            console.error('Error clearing sessions:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsClearing(false);
        }
    };


    return (
        <div className="bg-gray-900 rounded-xl border border-gray-800">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-lg font-semibold text-left text-teal-300"
                aria-expanded={isOpen}
            >
                <span className="flex items-center gap-2"><Icon name="history" className="w-5 h-5" />Session History</span>
                <Icon name="chevronDown" className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] p-4' : 'max-h-0'}`}
            >
                <div className="border-t border-gray-800 pt-4 text-gray-400 text-sm space-y-4">
                   {sessions.length === 0 ? (
                       <p>No completed sessions yet. Complete a full "Measure" and "Compare" cycle to log a session.</p>
                   ) : (
                       <>
                        <div className="p-4 bg-gray-850 rounded-lg flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h4 className="font-semibold text-gray-200">Your Session Log</h4>
                                <p className="text-xs text-gray-400 mt-1">
                                    {showAll ? `Showing all ${sessions.length} sessions.` : `Showing ${todaySessions.length} of ${sessions.length} total sessions from today.`}
                                </p>
                            </div>
                           <div className="flex gap-2 flex-wrap">
                             {sessions.length > todaySessions.length && (
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className="text-sm font-semibold py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                                >
                                    {showAll ? 'Show Today Only' : `Show All History (${sessions.length})`}
                                </button>
                             )}
                             <button
                                   onClick={handleDownload}
                                   disabled={displayedSessions.length === 0}
                                   className="flex items-center justify-center gap-1.5 text-sm py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                               >
                                  <Icon name="sheet" className="w-4 h-4" /> Download CSV
                               </button>
                               <button
                                   onClick={handleClear}
                                   disabled={isClearing || sessions.length === 0}
                                   className="flex items-center justify-center gap-1.5 text-sm py-2 px-4 bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                               >
                                   {isClearing ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Icon name="trash" className="w-4 h-4" />}
                                   Clear History
                               </button>
                           </div>
                       </div>
                        {displayedSessions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px] text-left">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase">
                                            <th className="py-2 pr-2">Date (Dhaka)</th>
                                            <th className="py-2 px-2">URL</th>
                                            <th className="py-2 px-2">Duration</th>
                                            <th className="py-2 pl-2">Mobile Perf.</th>
                                            <th className="py-2 pl-2">Desktop Perf.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedSessions.map(session => (
                                            <tr key={session.id || session.startTime} className="border-b border-gray-800 hover:bg-gray-850">
                                                <td className="py-2 pr-2">{getDhakaDate(new Date(session.startTime))}</td>
                                                <td className="py-2 px-2 truncate max-w-xs text-blue-400" title={session.url}>{session.url}</td>
                                                <td className="py-2 px-2 font-mono">{formatDuration(session.duration)}</td>
                                                <td className="py-2 pl-2"><ScoreDiff before={session.beforeScores.mobile} after={session.afterScores.mobile} /></td>
                                                <td className="py-2 pl-2"><ScoreDiff before={session.beforeScores.desktop} after={session.afterScores.desktop} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                           ) : (
                                <p className="text-center py-4">No sessions found for the selected period.</p>
                           )}
                       </>
                   )}
                </div>
            </div>
        </div>
    );
};

export default SessionLog;