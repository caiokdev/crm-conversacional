
import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { useRealtimeMessages } from '../hooks/useSupabase';
import SupabaseService from '../services/supabaseService';
import N8nService from '../services/n8nService';
import * as followUpService from '../services/followUpService';

const CrmContext = createContext();

const META_CHANNEL_ID = '4886443e-4996-4d2a-83e1-d96f503e1a28';
const EVO_CHANNEL_ID = '50df1e49-8f4c-4f90-b3c5-e9b95e37d8ed';

const initialFlowNodes = [
  { id: '1', type: 'trigger', label: 'Mensagem Recebida', x: 80, y: 150, data: { condition: 'Qualquer palavra' } },
  { id: '2', type: 'message', label: 'Saudação Inicial', x: 300, y: 100, data: { text: 'Olá! Que bom ter você aqui. Como posso te ajudar hoje?\n1 - Vendas\n2 - Suporte' } },
  { id: '3', type: 'condition', label: 'Opção Menu', x: 520, y: 150, data: { key: '1 = Vendas, 2 = Suporte' } },
  { id: '4', type: 'message', label: 'Encaminhar Vendas', x: 740, y: 60, data: { text: 'Perfeito! Estou transferindo você para um consultor comercial agora mesmo...' } },
  { id: '5', type: 'webhook', label: 'Conexão n8n', x: 960, y: 120, data: { url: 'https://n8n.cloudcorp.com/webhook/lead' } }
];

const normalizeMessage = (rawMsg) => {
  return {
    id: rawMsg.id,
    sender: rawMsg.sender || (rawMsg.direction === 'in' ? 'client' : 'agent'),
    text: rawMsg.text || rawMsg.content || '',
    time: rawMsg.time || (rawMsg.timestamp ? new Date(rawMsg.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')),
    timestamp: rawMsg.timestamp instanceof Date ? rawMsg.timestamp : (rawMsg.timestamp ? new Date(rawMsg.timestamp) : new Date()),
    channel_id: rawMsg.channel_id || null,
    contact_id: rawMsg.contact_id || null,
    content_type: rawMsg.content_type || 'text',
    media_url: rawMsg.media_url || null,
    status: rawMsg.status || (rawMsg.direction === 'out' ? 'sent' : 'received')
  };
};

export const CrmProvider = ({ children }) => {
  const [activeScreen, setActiveScreen] = useState(() => {
    return localStorage.getItem('crm_active_screen') || 'dashboard';
  });
  const [contacts, setContacts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'yesterday', '7days', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [activeContactId, setActiveContactId] = useState(() => {
    return localStorage.getItem('crm_active_contact_id') || null;
  });
  const [flowNodes, setFlowNodes] = useState(initialFlowNodes);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('crm_theme') || 'dark';
  });
  const [isBotEnabled, setIsBotEnabled] = useState(true);
  const [followupRules, setFollowupRules] = useState([]);
  const [globalTags, setGlobalTags] = useState([]);
  const [channels, setChannels] = useState([]);

  // Operator Notification & Audio Speed States (In-Memory Session Only)
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [audioSpeed, setAudioSpeed] = useState(1);

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const notificationsEnabledRef = useRef(notificationsEnabled);
  useEffect(() => { notificationsEnabledRef.current = notificationsEnabled; }, [notificationsEnabled]);

  const activeContactIdRef = useRef(activeContactId);
  useEffect(() => { activeContactIdRef.current = activeContactId; }, [activeContactId]);

  const activeScreenRef = useRef(activeScreen);
  useEffect(() => { activeScreenRef.current = activeScreen; }, [activeScreen]);

  const lastSoundTimeRef = useRef(0);
  const audioCtxRef = useRef(null);

  // Auto-unlock AudioContext on first user interaction (click, keydown, touchstart, pointerdown)
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch (e) {}
    };

    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach(evt => window.addEventListener(evt, unlockAudio, { once: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, unlockAudio));
    };
  }, []);

  // Web Audio API Discrete Sound Chime (Throttled max 1 sound per 3s)
  const playNotificationChime = useCallback(async () => {
    if (!soundEnabledRef.current) return;
    const now = Date.now();
    if (now - lastSoundTimeRef.current < 3000) return;
    lastSoundTimeRef.current = now;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (resErr) {}
      }

      console.log(`[AudioContext] State at chime trigger: ${ctx.state}`);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.error('[AudioContext] Chime play error:', e);
    }
  }, []);

  // Privacy-Compliant Desktop Notification (No Message Snippet, No Preview)
  const sendPrivacyNotification = useCallback((contactName, contactId) => {
    if (!notificationsEnabledRef.current) return;
    if (typeof Notification === 'undefined') return;

    if (Notification.permission === 'granted') {
      try {
        const titleText = contactName || 'Novo Contato';
        const notif = new Notification(titleText, {
          body: 'Nova mensagem',
          icon: '/favicon.ico',
          tag: `crm-msg-${contactId || 'unknown'}`
        });

        notif.onclick = () => {
          try { window.focus(); } catch (e) {}
          if (contactId) {
            setActiveContactId(contactId);
            setActiveScreen('chat');
          }
          notif.close();
        };
      } catch (e) {}
    }
  }, [setActiveContactId, setActiveScreen]);

  // Non-Invasive Notification Permission Request
  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
      }
      return perm;
    } catch (e) {
      return 'denied';
    }
  }, []);

  // AudioContext Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  const lastPollRef = useRef(new Date().toISOString());
  const knownMsgIdsRef = useRef(new Set());
  const migrationDone = useRef(false);

  // Load Initial Data from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const [
          dbContacts, 
          { data: dbMessagesRaw }, 
          dbChannels, 
          dbFollowupRules, 
          dbSettings,
          dbAppointments
        ] = await Promise.all([
          SupabaseService.fetchContacts(),
          supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(500),
          SupabaseService.fetchChannels(),
          followUpService.fetchRules(),
          followUpService.fetchSettings(),
          supabase.from('appointments').select('*, contacts(name, phone)').order('start_time', { ascending: true })
        ]);

        const dbMessages = (dbMessagesRaw || []).reverse();

        if (dbAppointments?.data) {
          setAppointments(dbAppointments.data);
        }

        if (dbChannels && dbChannels.length > 0) {
          setChannels(dbChannels);
        }

        if (dbFollowupRules) {
          setFollowupRules(dbFollowupRules);
        }

        let loadedTags = [];
        const tagsSetting = dbSettings?.find(s => s.key === 'global_tags');
        if (tagsSetting) {
          try {
            loadedTags = JSON.parse(tagsSetting.value);
          } catch(e) {
            console.error("Error parsing global_tags:", e);
          }
        } else {
          // Initialize default tags
          loadedTags = [
            { name: 'Novo Lead', color: '#06B6D4' },
            { name: 'Falar com Atendente', color: '#F59E0B' },
            { name: 'IA Inativa', color: '#F97316' },
            { name: 'Interesse', color: '#8B5CF6' },
            { name: 'Urgente', color: '#EF4444' },
            { name: 'VIP', color: '#3B82F6' }
          ];
          await followUpService.updateSetting('global_tags', JSON.stringify(loadedTags));
        }
        setGlobalTags(loadedTags);

        const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
        const idSet = new Set();
        const mappedContacts = (dbContacts || []).map(c => {
          const contactMeta = meta[c.id] || {};
          const cMsgs = (dbMessages || []).filter(m => m.contact_id === c.id && !(m.content || '').startsWith('[SYSTEM_RESET]')).map(m => {
            idSet.add(m.id);
            return normalizeMessage(m);
          });

          // Compute provider and channel type from last message channel_id
          const lastMsgWithChannel = [...cMsgs].reverse().find(m => m.channel_id);
          let provider = 'unknown';
          let channelType = 'whatsapp';
          if (lastMsgWithChannel) {
            const channel = dbChannels?.find(ch => ch.id === lastMsgWithChannel.channel_id);
            if (channel) {
              if (channel.provider === 'instagram') {
                provider = 'instagram';
                channelType = 'telegram'; // Renders as Instagram in the UI
              } else if (channel.provider === 'meta' || channel.provider === 'meta_cloud') {
                provider = 'meta_cloud';
                channelType = 'whatsapp';
              } else {
                provider = 'evolution';
                channelType = 'whatsapp';
              }
            }
          }

          let defaultStage = 'new';
          const stagesPool = ['new', 'new', 'new', 'contacted', 'contacted', 'proposal', 'won'];
          const charCodeSum = c.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          defaultStage = stagesPool[charCodeSum % stagesPool.length];
          
          let defaultValue = 0;

          const resolvedStatus = c.status || contactMeta.status || defaultStage;
          const resolvedValue = c.value !== undefined ? c.value : defaultValue;
          const rawName = contactMeta.name || c.name || 'Sem nome';
          const resolvedTags = c.tags || contactMeta.tags || [];

          let displayName = rawName;
          let username = '';
          if (rawName) {
            if (rawName.includes(' | @')) {
              const parts = rawName.split(' | @');
              username = parts[parts.length - 1];
              displayName = parts.slice(0, -1).join(' | @') || 'Sem nome';
            } else if (channelType === 'telegram' && !rawName.includes(' ')) {
              username = rawName;
            }
          }
          if (!displayName) displayName = 'Sem nome';

          return { 
            ...c, 
            name: displayName,
            username: username,
            tags: resolvedTags,
            status: resolvedStatus,
            value: resolvedValue,
            notes: contactMeta.notes || c.notes || [],
            messages: cMsgs, 
            provider,
            channel: channelType
          };
        });

        knownMsgIdsRef.current = idSet;
        console.log("CRM loadData mappedContacts status breakdown:", mappedContacts.map(c => ({ id: c.id, status: c.status, value: c.value })));
        setContacts(mappedContacts);
        
        if (mappedContacts.length > 0) {
          const persistedId = localStorage.getItem('crm_active_contact_id');
          if (persistedId && mappedContacts.some(c => c.id === persistedId)) {
            setActiveContactId(persistedId);
          } else {
            setActiveContactId(mappedContacts[0].id);
          }
        }

        // Prevent clock-skew bug by using latest database created_at timestamp
        if (dbMessages && dbMessages.length > 0) {
          lastPollRef.current = dbMessages[dbMessages.length - 1].created_at;
        } else {
          lastPollRef.current = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        }
      } catch (e) {
        console.error("[CrmContext] Error loading initial data:", e);
      }
    }
    loadData();
  }, []);

  // Migração client-side dos valores de leads (localStorage -> Supabase) executada uma única vez
  useEffect(() => {
    if (migrationDone.current) return;
    if (contacts.length === 0) return;
    
    if (localStorage.getItem('crm_value_migrated_v1')) {
      migrationDone.current = true;
      return;
    }
    
    migrationDone.current = true; // Previne execuções simultâneas
    
    const legacy = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
    const updates = Object.entries(legacy)
      .filter(([_, meta]) => meta.value > 0)
      .map(([contactId, meta]) => {
        const contactExists = contacts.some(c => c.id === contactId);
        if (contactExists) {
          return SupabaseService.updateContactValue(contactId, meta.value);
        }
        return Promise.resolve(true);
      });
    
    if (updates.length > 0) {
      Promise.all(updates).then(() => {
        localStorage.setItem('crm_value_migrated_v1', 'true');
        console.log(`[CrmContext] Migrated ${updates.length} legacy values from localStorage to Supabase.`);
      }).catch(err => {
        console.error("[CrmContext] Error migrating legacy values:", err);
      });
    } else {
      localStorage.setItem('crm_value_migrated_v1', 'true');
    }
  }, [contacts]);

  // Realtime subscription for Appointments
  useEffect(() => {
    const channel = supabase
      .channel('public:appointments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch the updated appointment with contact info
            const { data } = await supabase
              .from('appointments')
              .select('*, contacts(name, phone)')
              .eq('id', payload.new.id)
              .single();
              
            if (data) {
              setAppointments(prev => {
                const existing = prev.find(a => a.id === data.id);
                if (existing) {
                  return prev.map(a => a.id === data.id ? data : a);
                }
                return [...prev, data].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setAppointments(prev => prev.filter(a => a.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Synchronize state changes to localStorage
  useEffect(() => {
    localStorage.setItem('crm_active_screen', activeScreen);
  }, [activeScreen]);

  useEffect(() => {
    if (activeContactId) {
      localStorage.setItem('crm_active_contact_id', activeContactId);
    } else {
      localStorage.removeItem('crm_active_contact_id');
    }
  }, [activeContactId]);

  useEffect(() => {
    localStorage.setItem('crm_theme', theme);
  }, [theme]);

  // Keep a ref always sync'd with current contacts state
  const contactsRef = useRef(contacts);
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  // On-Demand Profile Picture Sync with 1.5s Debounce (Anti-Ban & Ref-Based)
  useEffect(() => {
    if (!activeContactId) return;

    const timer = setTimeout(async () => {
      const contact = contactsRef.current.find(c => c.id === activeContactId);
      if (!contact) return;

      // Sync if missing photo OR if photo is expired (> 15 days)
      const needsSync = !contact.avatar_url || (contact.avatar_updated_at && 
        (Date.now() - new Date(contact.avatar_updated_at)) > 15 * 24 * 60 * 60 * 1000);
      if (!needsSync) return;

      try {
        console.log(`[CRM] Secured debounced fetch triggered for contact_id: ${contact.id}`);
        const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n-n8n.rh3fr2.easypanel.host';
        const photoPath = import.meta.env.VITE_N8N_PROFILE_PHOTO_PATH || '/webhook/fetch-profile-photo';
        await fetch(`${n8nUrl}${photoPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: contact.id })
        });
      } catch (err) {
        console.error('[CRM] Fetch avatar error:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeContactId]);

  // Load full message history for active contact on selection
  useEffect(() => {
    if (!activeContactId) return;

    let active = true;
    async function loadActiveMessages() {
      try {
        const { data: dbMessages, error } = await supabase
          .from('messages')
          .select('*')
          .eq('contact_id', activeContactId)
          .order('timestamp', { ascending: true });

        if (error) throw error;
        if (!active) return;

        const cMsgs = (dbMessages || []).map(m => {
          knownMsgIdsRef.current.add(m.id);
          return {
            id: m.id,
            sender: m.direction === 'in' ? 'client' : 'agent',
            text: m.content,
            time: new Date(m.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
            timestamp: new Date(m.timestamp),
            channel_id: m.channel_id,
            content_type: m.content_type,
            media_url: m.media_url,
            status: m.direction === 'out' ? 'sent' : undefined
          };
        });

        // Determine contact channel and provider
        const channelId = dbMessages && dbMessages.length > 0
          ? dbMessages[dbMessages.length - 1].channel_id
          : null;
        const channel = channelId ? channels.find(ch => ch.id === channelId) : null;

        let resolvedProvider = 'unknown';
        let resolvedChannel = 'whatsapp';
        if (channel) {
          if (channel.provider === 'instagram') {
            resolvedProvider = 'instagram';
            resolvedChannel = 'telegram';
          } else if (channel.provider === 'meta' || channel.provider === 'meta_cloud') {
            resolvedProvider = 'meta_cloud';
            resolvedChannel = 'whatsapp';
          } else {
            resolvedProvider = 'evolution';
            resolvedChannel = 'whatsapp';
          }
        }

        setContacts(prev => (prev || []).map(c => {
          if (c.id === activeContactId) {
            return {
              ...c,
              messages: cMsgs,
              provider: resolvedProvider !== 'unknown' ? resolvedProvider : c.provider,
              channel: resolvedChannel
            };
          }
          return c;
        }));
      } catch (e) {
        console.error("[CrmContext] Error loading active messages:", e);
      }
    }

    loadActiveMessages();
    return () => {
      active = false;
    };
  }, [activeContactId, channels]);

  // Merge a new message into contacts state (deduplicating by id)
  const mergeMessage = useCallback((payload) => {
    const rawMsg = payload.new || payload; // support both realtime payload and raw message object
    
    // Ignore invisible system reset messages in the UI
    if ((rawMsg.content || '').startsWith('[SYSTEM_RESET]')) return;

    const newMsg = normalizeMessage(rawMsg);

    if (knownMsgIdsRef.current.has(newMsg.id)) return;
    knownMsgIdsRef.current.add(newMsg.id);

    // Resolve provider and channel type for the incoming message
    const channel = channels.find(ch => ch.id === newMsg.channel_id);
    let resolvedProvider = 'unknown';
    let resolvedChannel = 'whatsapp';
    if (channel) {
      if (channel.provider === 'instagram') {
        resolvedProvider = 'instagram';
        resolvedChannel = 'telegram';
      } else if (channel.provider === 'meta' || channel.provider === 'meta_cloud') {
        resolvedProvider = 'meta_cloud';
        resolvedChannel = 'whatsapp';
      } else {
        resolvedProvider = 'evolution';
        resolvedChannel = 'whatsapp';
      }
    }

    // Trigger privacy-compliant sound & desktop notification for incoming client messages
    if (newMsg.sender === 'client') {
      const isBackground = document.hidden;
      const isOtherChat = newMsg.contact_id !== activeContactIdRef.current || activeScreenRef.current !== 'chat';

      if (isBackground || isOtherChat) {
        playNotificationChime();
        const matchedContact = (contactsRef.current || []).find(c => c.id === newMsg.contact_id);
        sendPrivacyNotification(matchedContact?.name, newMsg.contact_id);
      }
    }

    setContacts(prev => {
      let exists = false;
      const updated = prev.map(c => {
        if (c.id === newMsg.contact_id) {
          exists = true;
          
          // 1. Evita duplicados por ID real
          if (newMsg.id && c.messages && (c.messages || []).some(m => m.id === newMsg.id)) {
            return c;
          }

          // 2. Tenta parear com mensagem otimista temporária pendente de envio
          const optimisticIdx = (c.messages || []).findIndex(m =>
            typeof m.id === 'string' && m.id.startsWith('temp-') &&
            m.sender === newMsg.sender &&
            (m.text === newMsg.text || (m.whatsapp_msg_id && newMsg.whatsapp_msg_id && m.whatsapp_msg_id === newMsg.whatsapp_msg_id))
          );

          if (optimisticIdx !== -1) {
            const newMsgs = [...(c.messages || [])];
            newMsgs[optimisticIdx] = newMsg;
            return {
              ...c,
              messages: newMsgs,
              provider: resolvedProvider !== 'unknown' ? resolvedProvider : c.provider,
              channel: resolvedChannel
            };
          }

          // 3. Insere nova mensagem genuína
          return {
            ...c,
            unread: newMsg.sender === 'client',
            messages: [...(c.messages || []), newMsg],
            provider: resolvedProvider !== 'unknown' ? resolvedProvider : c.provider,
            channel: resolvedChannel
          };
        }
        return c;
      });
      
      if (!exists) {
        // Fetch contact info for brand new contacts
        SupabaseService.fetchContacts().then(dbContacts => {
          const freshC = (dbContacts || []).find(dc => dc.id === newMsg.contact_id);
          if (freshC) {
            const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
            const contactMeta = meta[freshC.id] || {};
            let defaultStage = 'new';
            const stagesPool = ['new', 'new', 'new', 'contacted', 'contacted', 'proposal', 'won'];
            const charCodeSum = freshC.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            defaultStage = stagesPool[charCodeSum % stagesPool.length];
            
            let defaultValue = 0;

            const rawName = contactMeta.name || freshC.name || 'Novo Contato';
            let displayName = rawName;
            let username = '';
            if (rawName) {
              if (rawName.includes(' | @')) {
                const parts = rawName.split(' | @');
                username = parts[parts.length - 1];
                displayName = parts.slice(0, -1).join(' | @') || 'Novo Contato';
              } else if (resolvedChannel === 'telegram' && !rawName.includes(' ')) {
                username = rawName;
              }
            }
            if (!displayName) displayName = 'Novo Contato';
            const mappedFreshC = {
              ...freshC,
              name: displayName,
              username: username,
              tags: freshC.tags || contactMeta.tags || [],
              status: freshC.status || contactMeta.status || defaultStage,
              value: freshC.value !== undefined ? freshC.value : defaultValue,
              notes: contactMeta.notes || freshC.notes || []
            };

            setContacts(prev2 => {
              const existing = prev2.find(c => c.id === mappedFreshC.id);
              if (existing) {
                if (existing.name === 'Novo Contato') {
                   return (prev2 || []).map(c => c.id === mappedFreshC.id ? { ...mappedFreshC, messages: c.messages, provider: resolvedProvider, channel: resolvedChannel, unread: true } : c);
                }
                return prev2;
              }
              return [{ ...mappedFreshC, messages: [newMsg], provider: resolvedProvider, channel: resolvedChannel, unread: true }, ...prev2];
            });
          }
        });
        // For now, add a placeholder
        const freshContact = {
          id: newMsg.contact_id,
          name: 'Novo Contato',
          email: '',
          phone: 'Carregando...',
          status: 'new',
          channel: resolvedChannel,
          value: 0,
          tags: ['Novo Lead'],
          unread: true,
          avatarColor: `hsl(200, 80%, 65%)`,
          notes: [],
          messages: [newMsg],
          provider: resolvedProvider,
          created_at: new Date().toISOString()
        };
        return [freshContact, ...updated];
      }
      return updated;
    });
  }, [channels]);

  // Robust direct realtime subscription (bypasses hook state-array batching)
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('public:messages:direct')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new;
          console.log('[Supabase Realtime] Direct message insert received:', newMsg);
          
          mergeMessage(newMsg);
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime] Direct channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mergeMessage]);

  // Realtime subscription on contacts table to sync pipeline stage & tags in realtime
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('public:contacts:direct')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts' },
        (payload) => {
          const updatedContact = payload.new;
          console.log('[Supabase Realtime] Contact update received:', updatedContact);
          
          setContacts(prev => (prev || []).map(c => {
            if (c.id === updatedContact.id) {
              const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
              const contactMeta = meta[updatedContact.id] || {};
              
              const rawName = contactMeta.name || updatedContact.name || c.name || 'Sem nome';
              let displayName = rawName;
              let username = '';
              if (rawName && rawName.includes(' | @')) {
                const parts = rawName.split(' | @');
                username = parts[parts.length - 1];
                displayName = parts.slice(0, -1).join(' | @') || 'Sem nome';
              }
              if (!displayName) displayName = 'Sem nome';
              
              // Parse notes from raw DB format (string JSON or null) into array
              let parsedNotes = c.notes; // keep existing
              if (updatedContact.notes !== undefined) {
                if (!updatedContact.notes) {
                  parsedNotes = [];
                } else {
                  try {
                    const parsed = JSON.parse(updatedContact.notes);
                    parsedNotes = Array.isArray(parsed) ? parsed : [{ id: 1, text: updatedContact.notes, date: updatedContact.updated_at }];
                  } catch (e) {
                    parsedNotes = [{ id: 1, text: updatedContact.notes, date: updatedContact.updated_at }];
                  }
                }
              }

              return {
                ...c,
                ...updatedContact, // Sobrescreve as colunas brutas do banco
                name: displayName,
                username: username || c.username,
                // Preserva propriedades críticas da interface de UI / em memória após o spread
                messages: c.messages || [],
                notes: parsedNotes,
                tags: Array.isArray(updatedContact.tags) ? updatedContact.tags : (c.tags || []),
                status: updatedContact.pipeline_stage ?? c.status,
                value: updatedContact.value !== undefined ? updatedContact.value : c.value
              };
            }
            return c;
          }));
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Realtime] Contacts channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Realtime subscription on followup_queue to trigger alert when a follow-up is dispatched
  useEffect(() => {
    if (!supabase) return;

    const queueChannel = supabase
      .channel('public:followup_queue:direct')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'followup_queue' },
        (payload) => {
          const updatedItem = payload.new;
          if (updatedItem.status === 'sent') {
            console.log('[Supabase Realtime] Follow-up sent event:', updatedItem);
            
            // Try to find the contact name
            const contact = contacts.find(c => c.id === updatedItem.contact_id);
            const contactName = contact ? contact.name : 'um lead';
            
            console.log(`[Follow-up] Disparado com sucesso para ${contactName}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(queueChannel);
    };
  }, [contacts]);

  // Realtime subscription for global tags in crm_settings
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('public:crm_settings:tags')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'crm_settings', filter: 'key=eq.global_tags' },
        (payload) => {
          console.log('[Supabase Realtime] global_tags update received:', payload.new);
          try {
            const parsed = JSON.parse(payload.new.value || '[]');
            setGlobalTags(parsed);
          } catch (e) {
            console.error("Error parsing realtime global_tags:", e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling fallback: fetch new messages every 5 seconds (uses DB created_at to avoid clock skew)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data: newMsgs } = await supabase
          .from('messages')
          .select('*')
          .gt('created_at', lastPollRef.current)
          .order('timestamp', { ascending: true });

        if (newMsgs && newMsgs.length > 0) {
          // Update lastPollRef to the database-generated timestamp of the last message
          lastPollRef.current = newMsgs[newMsgs.length - 1].created_at;

          for (const m of newMsgs) {
            mergeMessage(m);
          }

          // Also check for new contacts we don't have yet
          const contactIds = [...new Set(newMsgs.map(m => m.contact_id))];
          setContacts(prev => {
            const missing = contactIds.filter(cid => !prev.find(c => c.id === cid));
            if (missing.length > 0) {
              SupabaseService.fetchContacts().then(dbContacts => {
                const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
                setContacts(prev2 => {
                  const toAdd = (dbContacts || []).filter(dc => missing.includes(dc.id) && !prev2.find(c => c.id === dc.id));
                  if (toAdd.length > 0) {
                    const mappedToAdd = toAdd.map(c => {
                      const contactMeta = meta[c.id] || {};
                      let defaultStage = 'new';
                      const stagesPool = ['new', 'new', 'new', 'contacted', 'contacted', 'proposal', 'won'];
                      const charCodeSum = c.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      defaultStage = stagesPool[charCodeSum % stagesPool.length];
                      
                      let defaultValue = 0;

                      return {
                        ...c,
                        name: contactMeta.name || c.name || 'Sem nome',
                        tags: c.tags || contactMeta.tags || [],
                        status: c.status || contactMeta.status || defaultStage,
                        value: contactMeta.value !== undefined ? contactMeta.value : (c.value || defaultValue),
                        notes: contactMeta.notes || c.notes || [],
                        unread: true
                      };
                    });
                    return [...mappedToAdd, ...prev2];
                  }
                  return prev2;
                });
              });
            }
            return prev;
          });
        }
      } catch (e) {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [mergeMessage]);

  const addChannel = async (name, provider, details) => {
    const channelData = {
      name,
      provider,
      url: details.url,
      instance: details.instance,
      apiKey: details.apiKey,
      phoneId: details.phoneId,
      accessToken: details.accessToken
    };

    const newDbChannel = await SupabaseService.addChannel(channelData);
    if (newDbChannel) {
      const mappedChannel = {
        id: newDbChannel.id,
        name: newDbChannel.name,
        provider: newDbChannel.provider === 'meta' ? 'meta_cloud' : 'evolution',
        status: newDbChannel.status,
        url: newDbChannel.url,
        instance: newDbChannel.instance,
        apiKey: newDbChannel.api_key,
        phoneId: newDbChannel.phone_id,
        accessToken: newDbChannel.access_token
      };

      setChannels(prev => [...prev, mappedChannel]);
      return mappedChannel;
    }
  };

  const toggleChannelStatus = async (id) => {
    const chan = channels.find(c => c.id === id);
    if (!chan) return;
    const newStatus = chan.status === 'connected' ? 'disconnected' : 'connected';

    setChannels(prev => (prev || []).map(c => (c.id === id ? { ...c, status: newStatus } : c)));

    if (id && id.toString().includes('-')) {
      try {
        await SupabaseService.updateChannelStatus(id, newStatus);
      } catch (e) {
        console.error("[CrmContext] Error updating channel status in database:", e);
      }
    }
  };

  const deleteChannel = async (id) => {
    setChannels(prev => prev.filter(c => c.id !== id));

    if (id && id.toString().includes('-')) {
      try {
        await SupabaseService.deleteChannel(id);
      } catch (e) {
        console.error("[CrmContext] Error deleting channel from database:", e);
      }
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const changeContactStatus = async (contactId, newStatus) => {
    let updatedTags = null;
    setContacts(prev => (prev || []).map(c => {
      if (c.id === contactId) {
        let tags = c.tags || [];
        if ((newStatus === 'won' || newStatus === 'lost') && !tags.includes('IA Inativa')) {
          updatedTags = [...tags, 'IA Inativa'];
          return { ...c, status: newStatus, tags: updatedTags };
        }
        return { ...c, status: newStatus };
      }
      return c;
    }));

    const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
    if (!meta[contactId]) meta[contactId] = {};
    meta[contactId].status = newStatus;
    
    if (updatedTags) {
      meta[contactId].tags = updatedTags;
    }
    localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));

    if (contactId && contactId.toString().includes('-')) {
      try {
        await SupabaseService.updateContactStatus(contactId, newStatus);
        if (updatedTags) {
          await SupabaseService.updateContactTags(contactId, updatedTags);
        }
      } catch (e) {
        console.error("[CrmContext] Error updating contact status/tags in database:", e);
      }
    }
  };

  const addNoteToContact = async (contactId, text) => {
    if (!text.trim()) return;

    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    const newNote = { 
      id: Date.now(), 
      text, 
      date: new Date().toISOString().replace('T', ' ').substring(0, 16) 
    };
    const updatedNotes = [...(contact.notes || []), newNote];

    setContacts(prev => (prev || []).map(c => (c.id === contactId ? { ...c, notes: updatedNotes } : c)));

    const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
    if (!meta[contactId]) meta[contactId] = {};
    meta[contactId].notes = updatedNotes;
    localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));

    if (contactId && contactId.toString().includes('-')) {
      try {
        await SupabaseService.updateContactNotes(contactId, JSON.stringify(updatedNotes));
        // Log manual de anotação de atividade no banco
        await SupabaseService.logActivity(
          contactId,
          'note',
          'Nota adicionada ao contato',
          `Nota: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
        );
      } catch (e) {
        console.error("[CrmContext] Error updating contact notes in database:", e);
      }
    }
  };

  const updateContactTags = async (contactId, tags) => {
    setContacts(prev => (prev || []).map(c => (c.id === contactId ? { ...c, tags } : c)));
    const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
    if (!meta[contactId]) meta[contactId] = {};
    meta[contactId].tags = tags;
    localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));
    try {
      await SupabaseService.updateContactTags(contactId, tags);
    } catch (e) {
      console.error("[CrmContext] Error saving contact tags to Supabase:", e);
    }
  };

  const addGlobalTag = async (name, color) => {
    if (!name.trim()) return false;
    try {
      // 1. Race condition mitigation: Fetch latest tags from database first
      const currentSettings = await followUpService.fetchSettings();
      const tagsSetting = currentSettings?.find(s => s.key === 'global_tags');
      let tagsList = [];
      if (tagsSetting) {
        tagsList = JSON.parse(tagsSetting.value || '[]');
      }
      
      // 2. Validate input and duplicates case-insensitive
      const cleanedName = name.trim();
      const exists = tagsList.some(t => t.name.toLowerCase() === cleanedName.toLowerCase());
      if (exists) return false;

      const newTag = { name: cleanedName, color: color || '#10B981' };
      const updated = [...tagsList, newTag];
      
      // 3. Persist to DB and update local state
      setGlobalTags(updated);
      await followUpService.updateSetting('global_tags', JSON.stringify(updated));
      return true;
    } catch(e) {
      console.error("[CrmContext] Error adding global tag:", e);
      return false;
    }
  };

  const updateGlobalTag = async (oldName, newName, newColor) => {
    const cleanedOld = oldName.trim();
    const cleanedNew = newName.trim();
    const isNameChange = cleanedOld.toLowerCase() !== cleanedNew.toLowerCase();

    try {
      // 1. Fetch latest catalogue
      const currentSettings = await followUpService.fetchSettings();
      const tagsSetting = currentSettings?.find(s => s.key === 'global_tags');
      let tagsList = [];
      if (tagsSetting) {
        tagsList = JSON.parse(tagsSetting.value || '[]');
      }

      // 2. If name changed, validate that new name does not already exist (unless case-insensitive match of itself)
      if (isNameChange && tagsList.some(t => t.name.toLowerCase() === cleanedNew.toLowerCase())) {
        throw new Error("Uma etiqueta com este nome já existe.");
      }

      // 3. Update the global tags catalogue
      const updated = tagsList.map(t => {
        if (t.name.toLowerCase() === cleanedOld.toLowerCase()) {
          return { name: cleanedNew, color: newColor };
        }
        return t;
      });

      // 4. If name changed, perform atomic batch update in database via RPC
      if (isNameChange) {
        const { data, error } = await supabase.rpc('rename_tag_in_contacts', {
          old_name: cleanedOld,
          new_name: cleanedNew
        });
        if (error) throw error;
        
        // Update local state for contacts immediately to prevent UI lag/flicker
        setContacts(prev => (prev || []).map(c => {
          if (c.tags && (c.tags || []).includes(cleanedOld)) {
            // Replace oldName with newName and deduplicate
            const filtered = (c.tags || []).map(t => t === cleanedOld ? cleanedNew : t);
            const deduplicated = [...new Set(filtered)];
            
            // Also update localStorage metadata
            const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
            if (!meta[c.id]) meta[c.id] = {};
            meta[c.id].tags = deduplicated;
            localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));
            
            return { ...c, tags: deduplicated };
          }
          return c;
        }));
      }

      // 5. Save updated catalogue to database
      setGlobalTags(updated);
      await followUpService.updateSetting('global_tags', JSON.stringify(updated));
      return true;
    } catch(e) {
      console.error("[CrmContext] Error updating global tag:", e);
      throw e;
    }
  };

  const deleteGlobalTag = async (name) => {
    const cleanedName = name.trim();
    try {
      // 1. Fetch latest catalogue
      const currentSettings = await followUpService.fetchSettings();
      const tagsSetting = currentSettings?.find(s => s.key === 'global_tags');
      let tagsList = [];
      if (tagsSetting) {
        tagsList = JSON.parse(tagsSetting.value || '[]');
      }

      // 2. Remove from catalogue
      const updated = tagsList.filter(t => t.name.toLowerCase() !== cleanedName.toLowerCase());

      // 3. Execute atomic delete in database via RPC
      const { data, error } = await supabase.rpc('remove_tag_from_contacts', {
        tag_name: cleanedName
      });
      if (error) throw error;

      // 4. Update local state for contacts immediately to prevent UI lag/flicker
      setContacts(prev => (prev || []).map(c => {
        if (c.tags && (c.tags || []).includes(cleanedName)) {
          const filtered = (c.tags || []).filter(t => t !== cleanedName);
          
          // Also update localStorage metadata
          const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
          if (!meta[c.id]) meta[c.id] = {};
          meta[c.id].tags = filtered;
          localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));

          return { ...c, tags: filtered };
        }
        return c;
      }));

      // 5. Save updated catalogue to database
      setGlobalTags(updated);
      await followUpService.updateSetting('global_tags', JSON.stringify(updated));
      return true;
    } catch(e) {
      console.error("[CrmContext] Error deleting global tag:", e);
      return false;
    }
  };

  const updateContactName = async (contactId, name) => {
    if (!name.trim()) return;
    setContacts(prev => (prev || []).map(c => (c.id === contactId ? { ...c, name } : c)));
    const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
    if (!meta[contactId]) meta[contactId] = {};
    meta[contactId].name = name;
    localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));
    if (contactId && contactId.toString().includes('-')) {
      try {
        await SupabaseService.updateContactName(contactId, name);
      } catch (e) {
        console.error("[CrmContext] Error updating contact name in database:", e);
      }
    }
  };

  const updateContactValue = async (contactId, value) => {
    const valNum = Number(value) || 0;
    setContacts(prev => (prev || []).map(c => (c.id === contactId ? { ...c, value: valNum } : c)));
    
    // Remover o valor do localStorage para usar apenas a DB
    const meta = JSON.parse(localStorage.getItem('crm_contacts_metadata') || '{}');
    if (meta[contactId]) {
      delete meta[contactId].value;
      localStorage.setItem('crm_contacts_metadata', JSON.stringify(meta));
    }

    if (contactId && contactId.toString().includes('-')) {
      try {
        await SupabaseService.updateContactValue(contactId, valNum);
      } catch (e) {
        console.error("[CrmContext] Error updating contact value in database:", e);
      }
    }
  };

  const addContact = async (name, channel, phone, initialText = 'Olá!') => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return;

    try {
      const dbContact = await SupabaseService.createContact({
        name,
        phone: cleanPhone,
        status: 'new',
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        tags: ['Novo Lead']
      });

      if (dbContact) {
        const hue = Math.floor(Math.random() * 360);
        const exists = contacts.find(c => c.id === dbContact.id);
        if (exists) {
          setActiveContactId(dbContact.id);
          setActiveScreen('chat');
          return;
        }

        let firstMsg = null;
        if (initialText) {
          const { data: insertedMsg } = await supabase
            .from('messages')
            .insert([{
              contact_id: dbContact.id,
              direction: 'in',
              content: initialText,
              timestamp: new Date().toISOString()
            }])
            .select();
          if (insertedMsg?.[0]) {
            firstMsg = {
              id: insertedMsg[0].id,
              sender: 'client',
              text: insertedMsg[0].content,
              time: new Date(insertedMsg[0].timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
              timestamp: new Date(insertedMsg[0].timestamp),
              channel_id: insertedMsg[0].channel_id
            };
          }
        }

        const newContact = {
          id: dbContact.id,
          name: dbContact.name,
          email: dbContact.email || '',
          phone: dbContact.phone,
          status: dbContact.pipeline_stage || 'new',
          channel,
          value: 0,
          tags: dbContact.tags || ['Novo Lead'],
          unread: true,
          avatarColor: `hsl(${hue}, 80%, 65%)`,
          notes: [],
          messages: firstMsg ? [firstMsg] : [],
          created_at: dbContact.created_at
        };

        setContacts(prev => [newContact, ...prev]);
        setActiveContactId(dbContact.id);
        setActiveScreen('chat');
      }
    } catch (e) {
      console.error("[CrmContext] Error in addContact:", e);
    }
  };

  const sendMessage = async (contactId, text, sender = 'agent') => {
    if (!text.trim()) return;
    
    const time = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    // Optimistic UI update with "sending" status (fully normalized)
    const newMessage = normalizeMessage({
      id: tempId,
      sender,
      text,
      time,
      timestamp: new Date(),
      status: sender === 'agent' ? 'sending' : 'received'
    });

    setContacts(prev => (prev || []).map(c => {
      if (c.id === contactId) {
        return { ...c, messages: [...(c.messages || []), newMessage], unread: sender === 'client' };
      }
      return c;
    }));

    // Send to n8n Outbound Router if sender is agent
    if (sender === 'agent') {
      const activeC = contacts.find(c => c.id === contactId);
      if (activeC) {
        // Automatically pause AI by adding "IA Inativa" to tags if not already present
        if (!activeC.tags.includes("IA Inativa")) {
          const newTags = [...activeC.tags, "IA Inativa"];
          updateContactTags(contactId, newTags);
        }
        try {
          // Determine channel from the contact's most recent message, or default to provider-specific channel
          const lastMsg = activeC.messages?.findLast(m => m.channel_id);
          let channelId = lastMsg?.channel_id;
          if (!channelId) {
            const matchedChannel = channels.find(ch => {
              if (activeC.provider === 'instagram') return ch.provider === 'instagram';
              if (activeC.provider === 'evolution') return ch.provider === 'evolution';
              return ch.provider === 'meta' || ch.provider === 'meta_cloud';
            });
            channelId = matchedChannel ? matchedChannel.id : (channels[0]?.id || META_CHANNEL_ID);
          }

          await N8nService.sendOutboundMessage(
            channelId,
            activeC.id,
            activeC.phone,
            text
          );

          // Mark as sent
          setContacts(prev => (prev || []).map(c => {
            if (c.id === contactId) {
              return {
                ...c,
                messages: (c.messages || []).map(m => m.id === tempId ? { ...m, status: 'sent' } : m)
              };
            }
            return c;
          }));
        } catch (e) {
          console.error("Failed sending outbound msg:", e);
          // Mark as failed
          setContacts(prev => (prev || []).map(c => {
            if (c.id === contactId) {
              return {
                ...c,
                messages: (c.messages || []).map(m => m.id === tempId ? { ...m, status: 'failed' } : m)
              };
            }
            return c;
          }));
        }
      }
    }
  };

  const sendMedia = async (contactId, file, caption = '') => {
    if (!file) return;

    const time = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const baseType = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 
                     file.type.startsWith('audio/') ? 'audio' : 'document';

    // Optimistic update
    const newMessage = normalizeMessage({
      id: tempId,
      sender: 'agent',
      text: caption || `Arquivo enviado: ${file.name}`,
      time,
      timestamp: new Date(),
      status: 'sending',
      content_type: baseType,
      media_url: '' // will be updated later if needed, or left as sending preview
    });

    setContacts(prev => (prev || []).map(c => {
      if (c.id === contactId) {
        return { ...c, messages: [...(c.messages || []), newMessage], unread: false };
      }
      return c;
    }));

    const activeC = contacts.find(c => c.id === contactId);
    if (!activeC) return;

    if (!activeC.tags.includes("IA Inativa")) {
      updateContactTags(contactId, [...activeC.tags, "IA Inativa"]);
    }

    let mediaUrl = '';
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${contactId}_${Date.now()}.${fileExt}`;
      
      let finalMimeType = file.type;
      if (fileExt.toLowerCase() === 'ogg') {
        finalMimeType = 'audio/ogg; codecs=opus';
      }
      
      console.log("[UPLOAD DIAGNOSTIC] Iniciando upload para bucket 'media'...");
      console.log("[UPLOAD DIAGNOSTIC] fileName:", fileName, "fileType:", finalMimeType, "size:", file.size);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { contentType: finalMimeType, upsert: false });

      console.log("[UPLOAD DIAGNOSTIC] Retorno do upload:", { uploadData, uploadError });

      if (uploadError) {
        console.error("[UPLOAD DIAGNOSTIC] Erro EXATO do Supabase Storage:", uploadError);
        throw new Error("Storage upload failed: " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(fileName);
      console.log("[UPLOAD DIAGNOSTIC] URL Pública gerada:", publicUrlData);
      mediaUrl = publicUrlData.publicUrl;

      // Determine channel
      const lastMsg = activeC.messages?.findLast(m => m.channel_id);
      let channelId = lastMsg?.channel_id;
      if (!channelId) {
        const matchedChannel = channels.find(ch => ch.provider === activeC.provider) || channels.find(ch => ch.provider === 'meta' || ch.provider === 'meta_cloud');
        channelId = matchedChannel ? matchedChannel.id : (channels[0]?.id || META_CHANNEL_ID);
      }

      // 2. Call n8n Webhook
      await N8nService.sendOutboundMedia({
        channelId,
        contactId: activeC.id,
        phone: activeC.phone,
        mediaUrl,
        contentType: baseType,
        mimeType: finalMimeType,
        fileName: file.name,
        caption: caption
      });

      // Mark as sent
      setContacts(prev => (prev || []).map(c => {
        if (c.id === contactId) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === tempId ? { ...m, status: 'sent', media_url: mediaUrl } : m)
          };
        }
        return c;
      }));

    } catch (e) {
      console.error("Failed sending media:", e);
      // Mark as failed
      setContacts(prev => (prev || []).map(c => {
        if (c.id === contactId) {
          return {
            ...c,
            messages: (c.messages || []).map(m => m.id === tempId ? { ...m, status: 'failed', media_url: mediaUrl } : m)
          };
        }
        return c;
      }));
    }
  };

  // Sort contacts by the most recent message timestamp descending (WhatsApp-like order)
  const sortedContacts = [...contacts].sort((a, b) => {
    const lastMsgA = a.messages && a.messages.length > 0 ? a.messages[a.messages.length - 1] : null;
    const lastMsgB = b.messages && b.messages.length > 0 ? b.messages[b.messages.length - 1] : null;
    
    const timeA = lastMsgA ? new Date(lastMsgA.timestamp).getTime() : 0;
    const timeB = lastMsgB ? new Date(lastMsgB.timestamp).getTime() : 0;
    
    return timeB - timeA;
  });

  const activeContact = sortedContacts.find(c => c.id === activeContactId) || sortedContacts[0];

  const updateNodePosition = (id, dx, dy) => setFlowNodes(prev => (prev || []).map(n => (n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n)));
  const updateNodeData = (id, field, value) => setFlowNodes(prev => (prev || []).map(n => (n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n)));
  const addFlowNode = (type) => {
    const id = (flowNodes.length + 1).toString();
    let label = 'Novo Bloco'; let defaultData = {};
    switch (type) {
      case 'message': label = 'Enviar Mensagem'; defaultData = { text: 'Olá!' }; break;
      case 'condition': label = 'Condição'; defaultData = { key: 'Se resposta contém "sim"' }; break;
      case 'webhook': label = 'Webhook'; defaultData = { url: 'https://api.com' }; break;
      default: break;
    }
    setFlowNodes(prev => [...prev, { id, type, label, x: 100, y: 100, data: defaultData }]);
  };
  const deleteFlowNode = (id) => setFlowNodes(prev => prev.filter(n => n.id !== id));

  const getFilteredContacts = useCallback(() => {
    if (dateFilter === 'all') return sortedContacts;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, -1);
    const startOf7DaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    return sortedContacts.filter(c => {
      if (!c.created_at) return true;
      const cDate = new Date(c.created_at);
      
      switch (dateFilter) {
        case 'today':
          return cDate >= startOfToday;
        case 'yesterday':
          return cDate >= startOfYesterday && cDate <= endOfYesterday;
        case '7days':
          return cDate >= startOf7DaysAgo;
        case 'custom': {
          if (!customDateRange.start && !customDateRange.end) return true;
          let start = customDateRange.start ? new Date(customDateRange.start) : null;
          let end = customDateRange.end ? new Date(customDateRange.end) : null;
          if (start) start.setHours(0, 0, 0, 0);
          if (end) end.setHours(23, 59, 59, 999);
          if (start && end) return cDate >= start && cDate <= end;
          if (start) return cDate >= start;
          if (end) return cDate <= end;
          return true;
        }
        default:
          return true;
      }
    });
  }, [sortedContacts, dateFilter, customDateRange]);

  return (
    <CrmContext.Provider value={{
      activeScreen, setActiveScreen, contacts: sortedContacts, activeContactId, setActiveContactId, activeContact,
      flowNodes, theme, toggleTheme, changeContactStatus, addNoteToContact, updateContactTags, updateContactName,
      updateContactValue, addContact, sendMessage, isBotEnabled, setIsBotEnabled, updateNodePosition,
      updateNodeData, addFlowNode, deleteFlowNode, sendMedia, channels, addChannel, toggleChannelStatus, deleteChannel,
      followupRules, setFollowupRules, globalTags, addGlobalTag, updateGlobalTag, deleteGlobalTag,
      dateFilter, setDateFilter, customDateRange, setCustomDateRange, getFilteredContacts,
      appointments, setAppointments,
      soundEnabled, setSoundEnabled, notificationsEnabled, setNotificationsEnabled,
      requestNotificationPermission, audioSpeed, setAudioSpeed
    }}>
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => useContext(CrmContext);
