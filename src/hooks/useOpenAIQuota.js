import { useState, useEffect, useCallback } from 'react';
import SupabaseService from '../services/supabaseService';
import N8nService from '../services/n8nService';

/**
 * Hook que checa o status da cota OpenAI via n8n Proxy seguro.
 * Não carrega a chave API no frontend.
 * Retorna: { status, errorType, isChecking, lastChecked, recheck }
 * status: 'ok' | 'quota_exceeded' | 'invalid_key' | 'unknown' | 'no_key' | 'loading'
 */
export function useOpenAIQuota(intervalMs = 600000) { // Default 10 min
  const [status, setStatus] = useState('loading');
  const [errorType, setErrorType] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [channelId, setChannelId] = useState(null);

  // Load the first available channel ID
  useEffect(() => {
    async function loadChannel() {
      try {
        const channels = await SupabaseService.fetchChannels();
        if (!channels || channels.length === 0) {
          setStatus('no_key');
          return;
        }
        setChannelId(channels[0].id);
      } catch (e) {
        setStatus('unknown');
      }
    }
    loadChannel();
  }, []);

  const checkQuota = useCallback(async (chId) => {
    if (!chId) return;
    setIsChecking(true);
    try {
      const res = await N8nService.checkOpenAIQuota(chId);
      const resStatus = res?.status || 'unknown';
      setStatus(resStatus);
      if (resStatus === 'quota_exceeded') {
        setErrorType('insufficient_quota');
      } else if (resStatus === 'invalid_key') {
        setErrorType('invalid_key');
      } else {
        setErrorType(null);
      }
    } catch (e) {
      console.error('[useOpenAIQuota] error:', e);
      setStatus('unknown');
      setErrorType('network_error');
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, []);

  // Check when channelId is loaded
  useEffect(() => {
    if (channelId) {
      checkQuota(channelId);
    }
  }, [channelId, checkQuota]);

  // Re-check at interval
  useEffect(() => {
    if (!channelId) return;
    const timer = setInterval(() => checkQuota(channelId), intervalMs);
    return () => clearInterval(timer);
  }, [channelId, intervalMs, checkQuota]);

  return {
    status,
    errorType,
    isChecking,
    lastChecked,
    recheck: () => channelId && checkQuota(channelId)
  };
}
