import React, { useState } from 'react';
import { History, RefreshCw, Filter, CheckCircle2, Radio, Play } from 'lucide-react';
import { BellLog } from '../types/bell';

interface Props {
  logs: BellLog[];
  onRefresh: () => Promise<void>;
}

export const LogsPage: React.FC<Props> = ({ logs, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'played' | 'manual'>('all');

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'played') return log.status === 'played';
    return log.status !== 'played';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>PA Broadcast & Bell Audit Logs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical audit log of all automated bell chimes and manual speaker broadcasts
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-300">Filter:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Events ({logs.length})
            </button>
            <button
              onClick={() => setFilterStatus('played')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterStatus === 'played'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Automated Schedule
            </button>
            <button
              onClick={() => setFilterStatus('manual')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                filterStatus === 'manual'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Manual Broadcast
            </button>
          </div>
        </div>
      </div>

      {/* Log list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <History className="w-6 h-6 opacity-40" />
            </div>
            <h4 className="text-base font-semibold text-slate-200">No activity logs recorded yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Broadcast logs are automatically created in Supabase whenever a scheduled bell rings or when manual chimes are broadcasted.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Timestamp</th>
                  <th className="py-3 px-4">Event Name</th>
                  <th className="py-3 px-4">Trigger Origin</th>
                  <th className="py-3 px-4 text-right sm:pr-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => {
                  const date = new Date(log.triggered_at);
                  const isAutomated = log.status === 'played';

                  return (
                    <tr key={log.id} className="hover:bg-slate-850 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 font-mono text-slate-300 tabular-nums whitespace-nowrap">
                        {date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                        <span className="font-bold text-slate-100">
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-100">{log.event_name}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {log.played_by || (isAutomated ? 'Automated Timetable' : 'Manual Trigger')}
                      </td>

                      <td className="py-3.5 px-4 sm:pr-6 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Broadcast Complete</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
