import { useState } from 'react';
import { useAcpList } from '../hooks/useApi';
import { rpc } from '../services/rpc';
import { AcpSession } from '../types';

const AcpManager: React.FC = () => {
  const { data, loading, execute } = useAcpList();
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [formData, setFormData] = useState({
    policy: '',
    runtime: '',
    prompt: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AcpSession | null>(null);
  const [refreshingSession, setRefreshingSession] = useState(false);

  const handleSpawn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await rpc.acpSpawn(
        formData.policy,
        formData.runtime || undefined,
        formData.prompt || undefined
      );
      setShowSpawnModal(false);
      setFormData({ policy: '', runtime: '', prompt: '' });
      execute();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (sessionId: string) => {
    if (!confirm('Are you sure you want to close this session?')) return;

    try {
      await rpc.acpClose(sessionId);
      execute();
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
    } catch (err) {
      console.error('Failed to close session:', err);
    }
  };

  const handleCancel = async (sessionId: string) => {
    if (!confirm('Are you sure you want to cancel this session?')) return;

    try {
      await rpc.acpCancel(sessionId);
      execute();
    } catch (err) {
      console.error('Failed to cancel session:', err);
    }
  };

  const refreshSessionStatus = async (sessionId: string) => {
    setRefreshingSession(true);
    try {
      const session = await rpc.acpStatus(sessionId);
      setSelectedSession(session);
    } catch (err) {
      console.error('Failed to refresh session:', err);
    } finally {
      setRefreshingSession(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ACP Sessions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total: {data?.count || 0} sessions
          </p>
        </div>
        <button
          onClick={() => setShowSpawnModal(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {loading && !data?.sessions.length ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-lg border border-gray-200"></div>
          ))}
        </div>
      ) : !data?.sessions.length ? (
        <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
          <p className="text-gray-500">No ACP sessions found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.sessions.map((session) => (
            <div
              key={session.id}
              className={`bg-white rounded-lg p-6 border transition-colors cursor-pointer ${
                selectedSession?.id === session.id ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedSession(session)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <span className="text-2xl">🔧</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Session {session.id.slice(0, 8)}...
                    </h3>
                    <p className="text-sm text-gray-500">
                      Policy: {session.policy} | Runtime: {session.runtime || 'default'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(session.status)}`}>
                    {session.status}
                  </span>
                  {session.status === 'running' && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCancel(session.id); }}
                        className="p-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClose(session.id); }}
                        className="p-2 bg-red-500 hover:bg-red-600 rounded-lg text-white"
                        title="Close"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Created: {new Date(session.created_at * 1000).toLocaleString()}
                {session.updated_at !== session.created_at && (
                  <> | Updated: {new Date(session.updated_at * 1000).toLocaleString()}</>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session Details */}
      {selectedSession && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Session Details
            </h3>
            <button
              onClick={() => refreshSessionStatus(selectedSession.id)}
              disabled={refreshingSession}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 text-sm flex items-center gap-1"
            >
              <svg className={`w-4 h-4 ${refreshingSession ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400">Session ID</p>
              <p className="text-sm text-gray-900 font-mono">{selectedSession.id}</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400">Policy</p>
              <p className="text-sm text-gray-900">{selectedSession.policy}</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400">Runtime</p>
              <p className="text-sm text-gray-900">{selectedSession.runtime || 'default'}</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400">Status</p>
              <span className={`text-sm font-medium ${getStatusColor(selectedSession.status)}`}>
                {selectedSession.status}
              </span>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400">Created At</p>
              <p className="text-sm text-gray-900">{new Date(selectedSession.created_at * 1000).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400">Updated At</p>
              <p className="text-sm text-gray-900">{new Date(selectedSession.updated_at * 1000).toLocaleString()}</p>
            </div>
          </div>
          {selectedSession.result && (
            <div className="mt-4 bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-400 mb-1">Result</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedSession.result}</p>
            </div>
          )}
        </div>
      )}

      {/* Spawn Modal */}
      {showSpawnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">New ACP Session</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSpawn} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Policy</label>
                <input
                  type="text"
                  value={formData.policy}
                  onChange={(e) => setFormData({ ...formData, policy: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Runtime (optional)</label>
                <input
                  type="text"
                  value={formData.runtime}
                  onChange={(e) => setFormData({ ...formData, runtime: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Prompt (optional)</label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 h-24"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowSpawnModal(false); setError(null); }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 rounded-lg text-white"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcpManager;