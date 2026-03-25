import { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';

type CallLogEntry = {
  id: string;
  to_number: string;
  from_number: string | null;
  province: string | null;
  started_at: string;
  duration_seconds: number | null;
  status: string;
};

export default function CallLog({ supabase, userId }: { supabase: any; userId: string }) {
  const [logs, setLogs] = useState<CallLogEntry[]>([]);

  useEffect(() => {
    async function fetchLogs() {
      const { data } = await supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(50);
      if (data) setLogs(data);
    }

    fetchLogs();

    const channel = supabase
      .channel('call_logs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs', filter: `user_id=eq.${userId}` },
        () => fetchLogs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  function formatDuration(seconds: number | null) {
    if (seconds == null) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const statusColor: Record<string, string> = {
    initiated: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
  };

  if (logs.length === 0) {
    return (
      <div className="mt-6 text-center text-zinc-500 text-sm">No call history yet.</div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Call History</h2>
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-2 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Phone size={14} className="text-zinc-400 shrink-0" />
              <span className="font-mono truncate">{log.to_number}</span>
              {log.province && (
                <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
                  {log.province}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-2 text-xs text-zinc-400">
              <span>{formatDuration(log.duration_seconds)}</span>
              <span className={statusColor[log.status] || 'text-zinc-400'}>{log.status}</span>
              <span>{formatDate(log.started_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
