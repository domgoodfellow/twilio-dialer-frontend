import { useState, useEffect, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { Phone, PhoneOff, LogOut } from 'lucide-react';

type Status = 'connecting' | 'ready' | 'calling' | 'on-call' | 'error';

export default function Dialer({ supabase, session }: { supabase: any; session: any }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<Status>('connecting');
  const [statusMessage, setStatusMessage] = useState('Connecting to Twilio...');
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);

  useEffect(() => {
    let device: Device;

    async function initDevice() {
      try {
        const identity = session?.user?.email ?? 'agent';
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity }),
          }
        );
        if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
        const { token } = await res.json();

        device = new Device(token, { logLevel: 1 });

        device.on('ready', () => {
          setStatus('ready');
          setStatusMessage('Ready');
        });
        device.on('error', (err: Error) => {
          setStatus('error');
          setStatusMessage(`Error: ${err.message}`);
        });
        device.on('connect', () => {
          setStatus('on-call');
          setStatusMessage('On call');
        });
        device.on('disconnect', () => {
          setStatus('ready');
          setStatusMessage('Call ended');
          callRef.current = null;
        });

        await device.register();
        deviceRef.current = device;
      } catch (err: any) {
        setStatus('error');
        setStatusMessage(`Failed to connect: ${err.message}`);
      }
    }

    initDevice();

    return () => {
      device?.destroy();
    };
  }, [session]);

  const handleCall = async () => {
    if (!deviceRef.current || !phoneNumber.trim()) return;
    setStatus('calling');
    setStatusMessage(`Calling ${phoneNumber}...`);
    try {
      const call = await deviceRef.current.connect({ params: { To: phoneNumber.trim() } });
      callRef.current = call;
      call.on('disconnect', () => {
        setStatus('ready');
        setStatusMessage('Call ended');
        callRef.current = null;
      });
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(`Call failed: ${err.message}`);
    }
  };

  const handleHangup = () => {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
  };

  const handleLogout = () => supabase.auth.signOut();

  const isOnCall = status === 'on-call' || status === 'calling';
  const canCall = status === 'ready' && phoneNumber.trim().length > 0;

  const statusColor: Record<Status, string> = {
    connecting: 'text-yellow-400',
    ready: 'text-green-400',
    calling: 'text-blue-400',
    'on-call': 'text-green-300',
    error: 'text-red-400',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Twilio Dialer</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        {/* User + status */}
        <div className="space-y-1">
          <p className="text-zinc-400 text-sm">{session?.user?.email}</p>
          <p className={`text-sm font-medium ${statusColor[status]}`}>{statusMessage}</p>
        </div>

        {/* Phone input */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canCall && handleCall()}
          placeholder="+1 555 000 0000"
          disabled={isOnCall}
          className="w-full bg-zinc-800 p-4 rounded-xl text-lg tracking-wider disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-600"
        />

        {/* Call / Hangup button */}
        {!isOnCall ? (
          <button
            onClick={handleCall}
            disabled={!canCall}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed py-4 rounded-xl text-xl font-medium transition-colors"
          >
            <Phone size={22} />
            Call
          </button>
        ) : (
          <button
            onClick={handleHangup}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 py-4 rounded-xl text-xl font-medium transition-colors"
          >
            <PhoneOff size={22} />
            Hang Up
          </button>
        )}
      </div>
    </div>
  );
}
