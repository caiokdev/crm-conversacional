import React, { useState, useEffect, useRef } from 'react';
import { useCrm } from '../context/CrmContext';
import { MessageSquare, FileText, Calendar, PenLine, Send, Loader2, CheckCheck, XCircle, Bot, User, Tag, Brain } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import TagBadge from './TagBadge';
import ErrorBoundary from './ErrorBoundary';

const tagColorsPalette = [
  '#10B981', // Emerald
  '#3B82F6', // Cobalt
  '#8B5CF6', // Amethyst
  '#EF4444', // Crimson
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#F97316', // Salmon
  '#EC4899'  // Coral
];

const sanitizeUrl = (url) => {
  if (!url) return '#';
  const trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return '#';
  }
  return trimmed;
};

import SupabaseService from '../services/supabaseService';

export default function ChatWindow() {
  const {
    contacts,
    activeContact,
    setActiveContactId,
    sendMessage,
    changeContactStatus,
    addNoteToContact,
    updateContactTags,
    updateContactValue,
    globalTags,
    addGlobalTag,
    updateGlobalTag,
    deleteGlobalTag
  } = useCrm();

  const [channelFilter, setChannelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [selectedNewColor, setSelectedNewColor] = useState('#10B981');
  const [editingTag, setEditingTag] = useState(null);
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null);
  
  const scrollRef = useRef(null);

  // Scroll to bottom on active message update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeContact?.messages?.length, activeContact?.id]);

  if (contacts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1, color: 'var(--text-secondary)', padding: '40px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Caixa de Entrada Vazia</h2>
        <p>Aguardando a primeira mensagem chegar...</p>
        <p style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Envie uma mensagem de teste para o número configurado no Chatwoot/Meta para ver a mágica acontecer!</p>
      </div>
    );
  }

  if (!activeContact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flex: 1, color: 'var(--text-secondary)' }}>
        Carregando conversas...
      </div>
    );
  }

  // Filters contacts list
  const filteredContacts = contacts.filter(c => {
    const matchesChannel = channelFilter === 'all' || c.channel === channelFilter;
    const matchesSearch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesChannel && matchesSearch;
  });

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(activeContact.id, inputText, 'agent');
    setInputText('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleResetAiMemory = async () => {
    if (window.confirm("Isso fará com que a IA esqueça todo o histórico desta conversa e comece um novo atendimento do zero. Continuar?")) {
      try {
        await SupabaseService.resetAiMemory(activeContact.id);
        alert("Memória da IA resetada com sucesso para este contato!");
      } catch (e) {
        console.error(e);
        alert("Erro ao resetar memória.");
      }
    }
  };

  const handleInjectTemplate = (text) => {
    sendMessage(activeContact.id, text, 'agent');
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteToContact(activeContact.id, noteText);
    setNoteText('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const activeTags = activeContact.tags || [];
    updateContactTags(activeContact.id, activeTags.filter(t => t !== tagToRemove));
  };

  const handleAddTagDirect = (tagName) => {
    const activeTags = activeContact.tags || [];
    if (!activeTags.includes(tagName)) {
      updateContactTags(activeContact.id, [...activeTags, tagName]);
    }
  };

  const handleCreateNewTag = async () => {
    const cleaned = tagSearch.trim().substring(0, 24);
    if (!cleaned) return;
    
    // Check validation (remove special chars < > ")
    const regex = /[<>"]/g;
    if (regex.test(cleaned)) {
      alert("Caracteres especiais inválidos (<, >, \") não são permitidos.");
      return;
    }

    const success = await addGlobalTag(cleaned, selectedNewColor);
    if (success) {
      // Automatically assign to current contact
      handleAddTagDirect(cleaned);
      setTagSearch('');
    }
  };

  const handleSaveTagEdit = async () => {
    if (!editingTag) return;
    const cleanedNew = editingTag.newName.trim().substring(0, 24);
    if (!cleanedNew) return;

    // Check validation (remove special chars < > ")
    const regex = /[<>"]/g;
    if (regex.test(cleanedNew)) {
      alert("Caracteres especiais inválidos (<, >, \") não são permitidos.");
      return;
    }

    try {
      // Check duplicate merge
      const isNameChange = editingTag.name.toLowerCase() !== cleanedNew.toLowerCase();
      if (isNameChange && globalTags.some(t => t.name.toLowerCase() === cleanedNew.toLowerCase())) {
        const confirmMerge = window.confirm(`A etiqueta "${cleanedNew}" já existe. Deseja mesclar as duas etiquetas? Esta ação atualizará todos os contatos associados.`);
        if (!confirmMerge) return;
      }

      await updateGlobalTag(editingTag.name, cleanedNew, editingTag.color);
      setEditingTag(null);
    } catch(e) {
      alert(e.message || "Erro ao atualizar etiqueta.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTag) return;
    await deleteGlobalTag(confirmDeleteTag.name);
    setConfirmDeleteTag(null);
  };

  const getContactsWithTagCount = (tagName) => {
    return contacts.filter(c => c.tags && c.tags.includes(tagName)).length;
  };

  // Simulate client inbound message
  const handleSimulateClient = () => {
    const simulationMsgs = [
      "Quais são os prazos de entrega?",
      "Gostei muito do atendimento comercial!",
      "Vocês integram com n8n?",
      "Qual o valor final com desconto?",
      "Preciso de suporte técnico com minha hospedagem"
    ];
    const text = simulationMsgs[Math.floor(Math.random() * simulationMsgs.length)];
    sendMessage(activeContact.id, text, 'client');
  };

  const isAiPaused = activeContact.tags?.includes('IA Inativa');
  const toggleAi = () => {
    if (isAiPaused) {
      updateContactTags(activeContact.id, activeContact.tags.filter(t => t !== 'IA Inativa'));
    } else {
      updateContactTags(activeContact.id, [...activeContact.tags, 'IA Inativa']);
    }
  };

  return (
    <ErrorBoundary>
      <div className="chat-workspace animated-fade-in" style={{ 
      position: 'absolute', 
      top: '24px', 
      bottom: '24px', 
      left: '24px', 
      right: '24px',
      margin: 0,
      height: 'auto',
      width: 'auto'
    }}>
      
      {/* COLUMN 1: CHATS DIRECTORY */}
      <div className="chat-list-panel">
        <div className="chat-list-header">
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Conversas</h2>
          
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Buscar por nome ou tag..."
              className="glass-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '12px' }}
            />
          </div>

          <div className="chat-channels-filter">
            <button
              onClick={() => setChannelFilter('all')}
              className={`channel-tab-btn ${channelFilter === 'all' ? 'active' : ''}`}
            >
              Todos
            </button>
            <button
              onClick={() => setChannelFilter('whatsapp')}
              className={`channel-tab-btn ${channelFilter === 'whatsapp' ? 'active' : ''}`}
            >
              Whatsapp
            </button>
            <button
              onClick={() => setChannelFilter('telegram')}
              className={`channel-tab-btn ${channelFilter === 'telegram' ? 'active' : ''}`}
            >
              Instagram
            </button>
            <button
              onClick={() => setChannelFilter('webchat')}
              className={`channel-tab-btn ${channelFilter === 'webchat' ? 'active' : ''}`}
            >
              Tiktok
            </button>
          </div>
        </div>

        <div className="chat-scroll-area">
          {filteredContacts.map(contact => {
            const isSelected = activeContact.id === contact.id;
            const lastMsg = contact.messages[contact.messages.length - 1];
            return (
              <div
                key={contact.id}
                onClick={() => {
                  setActiveContactId(contact.id);
                  contact.unread = false; // Mark read on click
                }}
                className={`chat-item-row ${isSelected ? 'active' : ''} ${contact.unread ? 'unread' : ''}`}
              >
                <div className="chat-avatar-wrapper">
                  <div className="avatar" style={{ background: contact.avatarColor }}>
                    {contact.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className={`channel-icon-badge ${contact.channel}`}>
                    {contact.channel === 'whatsapp' && 'W'}
                    {contact.channel === 'telegram' && 'I'}
                    {contact.channel === 'webchat' && 'T'}
                  </span>
                </div>

                <div className="chat-info">
                  <div className="chat-info-header">
                    <span className="chat-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {contact.name}
                      {contact.tags?.includes('IA Inativa') && (
                        <User size={12} strokeWidth={2.5} color="var(--warning-color)" title="Aguardando Atendente Humano" />
                      )}
                    </span>
                    <span className="chat-time">{lastMsg?.time || ''}</span>
                  </div>
                  <div className="chat-preview-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start', height: 'auto', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="chat-preview-text" style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {lastMsg ? (lastMsg.sender === 'agent' ? 'Você: ' : lastMsg.sender === 'bot' ? 'Bot: ' : '') + lastMsg.text : 'Sem mensagens'}
                      </span>
                      {contact.unread && <span className="unread-count-dot" style={{ marginLeft: '6px', flexShrink: 0 }}></span>}
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px', width: '100%' }}>
                        {contact.tags.map(tag => {
                          const tagColorObj = globalTags?.find(t => t.name.toLowerCase() === tag.toLowerCase());
                          const color = tagColorObj ? tagColorObj.color : '#9CA3AF';
                          return (
                            <span
                              key={tag}
                              style={{
                                padding: '1px 5px',
                                backgroundColor: `${color}15`,
                                borderColor: `${color}30`,
                                color: color,
                                border: '1px solid',
                                borderRadius: '3px',
                                fontSize: '9px',
                                fontWeight: '600',
                                lineHeight: '1.2',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredContacts.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
              Nenhum contato encontrado.
            </div>
          )}
        </div>
      </div>

      {/* COLUMN 2: ACTIVE DIALOG PANEL */}
      <div className="chat-active-panel">
        <div className="active-chat-header">
          <div className="active-contact-title">
            <div className="avatar" style={{ background: activeContact.avatarColor }}>
              {activeContact.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="active-contact-name">{activeContact.name}</span>
              <div className="active-contact-channel">
                <span className={`tag tag-${activeContact.channel}`}>
                  {activeContact.channel === 'whatsapp' ? (
                    activeContact.provider === 'meta_cloud' ? 'WhatsApp Oficial' : 'WhatsApp'
                  ) : activeContact.channel === 'telegram' ? 'Instagram' :
                      activeContact.channel === 'webchat' ? 'Tiktok' : activeContact.channel}
                </span>
                <span className={`tag status-${activeContact.status}`}>
                  {activeContact.status}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={toggleAi}
              className={`glass-btn ${isAiPaused ? 'primary' : ''}`}
              style={{ padding: '8px 12px', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center', background: isAiPaused ? 'var(--warning-color)' : 'var(--bg-surface-hover)', borderColor: isAiPaused ? 'transparent' : 'var(--border-glass)' }}
              title={isAiPaused ? "Retornar atendimento para a Inteligência Artificial" : "Pausar IA e assumir a conversa"}
            >
              {isAiPaused ? <User size={12} strokeWidth={2.5} color="#fff" /> : <Bot size={12} strokeWidth={2.5} />}
              {isAiPaused ? <span style={{ color: '#fff' }}>Humano Ativo</span> : 'IA Ativa'}
            </button>

            <button
              onClick={handleSimulateClient}
              className="glass-btn secondary"
              style={{ padding: '8px 12px', fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}
              title="Simula uma nova mensagem chegando do cliente"
            >
              <MessageSquare size={12} strokeWidth={2.5} />
              Simular Cliente
            </button>
          </div>
        </div>

        {/* MESSAGES VIEW */}
        <div className="messages-scroller" ref={scrollRef}>
          {(activeContact.messages || []).map(msg => (
            <div key={msg.id} className={`message-bubble-wrapper ${msg.sender}`}>
              <div className="message-bubble">
                {msg.content_type === 'image' ? (
                  msg.media_url ? (
                    <div>
                      <img 
                        src={msg.media_url} 
                        alt="Imagem enviada" 
                        style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: '8px', cursor: 'pointer' }}
                        onClick={() => window.open(msg.media_url, '_blank')}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div className="media-error-fallback" style={{ display: 'none', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px dashed var(--border-glass)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <XCircle size={16} /> Mídia indisponível
                      </div>
                      {msg.text && msg.text !== '[Imagem]' && <div>{typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}</div>}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '8px' }}>
                      <div className="media-error-fallback" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px dashed var(--border-glass)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <XCircle size={16} /> Mídia indisponível
                      </div>
                      {msg.text && msg.text !== '[Imagem]' && <div>{typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}</div>}
                    </div>
                  )
                ) : msg.content_type === 'sticker' && msg.media_url ? (
                  <div>
                    <img 
                      src={msg.media_url} 
                      alt="Figurinha enviada" 
                      style={{ width: '120px', height: '120px', objectFit: 'contain', background: 'transparent', display: 'block' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                ) : msg.content_type === 'audio' ? (
                  msg.media_url ? (
                    <AudioPlayer src={msg.media_url} />
                  ) : (
                    <div className="media-error-fallback" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px dashed var(--border-glass)', color: 'var(--text-secondary)' }}>
                      <XCircle size={16} /> Áudio não disponível
                    </div>
                  )
                ) : msg.content_type === 'video' ? (
                  msg.media_url ? (
                    <div>
                      <video src={msg.media_url} controls style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: '8px' }} />
                      {msg.text && msg.text !== '[Vídeo]' && <div>{typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}</div>}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '8px' }}>
                      <div className="media-error-fallback" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px dashed var(--border-glass)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <XCircle size={16} /> Vídeo não disponível
                      </div>
                      {msg.text && msg.text !== '[Vídeo]' && <div>{typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}</div>}
                    </div>
                  )
                ) : msg.content_type === 'document' && msg.media_url ? (
                  <div>
                    <a 
                      href={sanitizeUrl(msg.media_url)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'underline' }}
                    >
                      <FileText size={14} strokeWidth={2.5} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                      {typeof msg.text === 'string' ? msg.text : (msg.text ? JSON.stringify(msg.text) : 'Documento')}
                    </a>
                  </div>
                ) : (
                  typeof msg.text === 'string' ? msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      <br />
                    </React.Fragment>
                  )) : (msg.text ? JSON.stringify(msg.text) : '')
                )}
              </div>
              <div className="message-meta-row">
                <span>{msg.sender === 'agent' ? 'Agente' : msg.sender === 'bot' ? 'Automação Bot' : 'Cliente'}</span>
                <span>•</span>
                <span>{msg.time}</span>
                {msg.sender === 'agent' && msg.status && (
                  <span className={`msg-status msg-status-${msg.status}`}>
                    {msg.status === 'sending' && (
                      <span className="status-sending" title="Enviando...">
                        <Loader2 size={12} strokeWidth={2.5} className="spin-animation" />
                      </span>
                    )}
                    {msg.status === 'sent' && (
                      <span className="status-sent" title="Enviado">
                        <CheckCheck size={14} strokeWidth={2.5} />
                      </span>
                    )}
                    {msg.status === 'failed' && (
                      <span className="status-failed" title="Falha ao enviar. Tente novamente.">
                        <XCircle size={12} strokeWidth={2.5} />
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* INPUT AND QUICK TEMPLATES */}
        <div className="chat-input-footer">
          <div className="quick-reply-wrapper">
            <button
              onClick={() => handleInjectTemplate('Olá! Como posso te ajudar hoje?')}
              className="quick-reply-pill"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <MessageSquare size={12} strokeWidth={2.5} />
              Saudação
            </button>
            <button
              onClick={() => handleInjectTemplate('Aqui está a nossa proposta comercial para o seu plano.')}
              className="quick-reply-pill"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <FileText size={12} strokeWidth={2.5} />
              Proposta
            </button>
            <button
              onClick={() => handleInjectTemplate('Podemos agendar uma demonstração por vídeo amanhã às 14h?')}
              className="quick-reply-pill"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Calendar size={12} strokeWidth={2.5} />
              Agendar Call
            </button>
            <button
              onClick={() => handleInjectTemplate('Perfeito! Seu contrato foi gerado. Estou enviando por e-mail.')}
              className="quick-reply-pill"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <PenLine size={12} strokeWidth={2.5} />
              Fechamento
            </button>
          </div>

          <div className="chat-input-bar">
            <input
              type="text"
              placeholder="Digite sua mensagem aqui..."
              className="glass-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button onClick={handleSend} className="glass-btn" style={{ padding: '12px 20px' }}>
              <span>Enviar</span>
              <Send size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 3: CONTACT SUMMARY PROFILE */}
      <div className="chat-profile-sidebar">
        <div className="profile-header-card">
          <div className="avatar" style={{
            width: '64px',
            height: '64px',
            fontSize: '22px',
            background: activeContact.avatarColor,
            border: '2px solid var(--border-glass)'
          }}>
            {activeContact.name.substring(0, 2).toUpperCase()}
          </div>
          <span className="profile-name">{activeContact.name}</span>
          <div className="profile-meta-chips">
            <span className={`tag tag-${activeContact.channel}`}>
              {activeContact.channel === 'whatsapp' ? (
                activeContact.provider === 'meta_cloud' ? 'WhatsApp Oficial' : 'WhatsApp'
              ) : activeContact.channel === 'telegram' ? 'Instagram' :
                  activeContact.channel === 'webchat' ? 'Tiktok' : activeContact.channel}
            </span>
            <span className={`tag status-${activeContact.status}`}>{activeContact.status}</span>
          </div>
        </div>

        {/* CONTACT DATA INFO */}
        <div className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="profile-section-title" style={{ margin: 0 }}>Dados do Contato</span>
            <button 
              onClick={handleResetAiMemory}
              title="Resetar Memória da IA (inicia novo atendimento)"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              <Brain size={12} /> Resetar IA
            </button>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">E-mail</span>
            <span className="profile-field-value">{activeContact.email}</span>
          </div>
          {activeContact.channel === 'telegram' ? (
            <>
              {activeContact.username ? (
                <div className="profile-field">
                  <span className="profile-field-label">Username</span>
                  <span className="profile-field-value">@{activeContact.username}</span>
                </div>
              ) : (
                <div className="profile-field">
                  <span className="profile-field-label">Username / Instagram ID</span>
                  <span className="profile-field-value">{activeContact.phone}</span>
                </div>
              )}
              {activeContact.username && (
                <div className="profile-field">
                  <span className="profile-field-label">Instagram ID</span>
                  <span className="profile-field-value">{activeContact.phone}</span>
                </div>
              )}
            </>
          ) : (
            <div className="profile-field">
              <span className="profile-field-label">Telefone</span>
              <span className="profile-field-value">{activeContact.phone}</span>
            </div>
          )}
        </div>

        {/* PIPELINE & FINANCIAL DETAILS */}
        <div className="profile-section">
          <span className="profile-section-title">Funil & Negócios</span>
          <div className="profile-field">
            <span className="profile-field-label">Fase no CRM</span>
            <select
              className="crm-status-dropdown"
              value={activeContact.status}
              onChange={(e) => changeContactStatus(activeContact.id, e.target.value)}
            >
              <option value="new">Novo Lead</option>
              <option value="contacted">Em Contato</option>
              <option value="proposal">Tem Interesse</option>
              <option value="won">Ganho (Venda)</option>
              <option value="lost">Perdido</option>
            </select>
          </div>

          <div className="profile-field">
            <span className="profile-field-label">Valor do Negócio (R$)</span>
            <input
              type="number"
              className="glass-input"
              value={activeContact.value || ''}
              onChange={(e) => updateContactValue(activeContact.id, e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>
        </div>

        {/* TAGS MANAGER */}
        <div className="profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="profile-section-title" style={{ margin: 0 }}>Tags do Contato</span>
            <button
              onClick={() => setIsTagPanelOpen(!isTagPanelOpen)}
              className="glass-btn"
              style={{
                padding: '4px 8px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '24px',
                background: isTagPanelOpen ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                borderColor: 'var(--border-glass)'
              }}
            >
              <Tag size={10} />
              {isTagPanelOpen ? 'Fechar' : 'Gerenciar'}
            </button>
          </div>

          {/* Active Tags list on the contact */}
          <div className="contact-tags-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {activeContact.tags && activeContact.tags.length > 0 ? (
              activeContact.tags.map(tagName => {
                const tagColorObj = globalTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                const color = tagColorObj ? tagColorObj.color : '#9CA3AF';
                return (
                  <TagBadge
                    key={tagName}
                    name={tagName}
                    color={color}
                    onDelete={() => handleRemoveTag(tagName)}
                  />
                );
              })
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sem tags vinculadas.</span>
            )}
          </div>

          {/* Expansible Tag Catalog & Control Panel */}
          {isTagPanelOpen && (
            <div 
              style={{
                marginTop: '12px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
              className="animated-fade-in"
            >
              {/* Direct tag creation panel */}
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Criar Nova Tag</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Nome da tag..."
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    className="glass-input"
                    style={{
                      fontSize: '11px',
                      padding: '6px 10px',
                      flex: 1
                    }}
                  />
                  <button
                    onClick={async () => {
                      const cleaned = newTagText.trim().substring(0, 24);
                      if (!cleaned) return;
                      const regex = /[<>"]/g;
                      if (regex.test(cleaned)) {
                        alert("Caracteres especiais inválidos (<, >, \") não são permitidos.");
                        return;
                      }
                      const success = await addGlobalTag(cleaned, selectedNewColor);
                      if (success) {
                        handleAddTagDirect(cleaned);
                        setNewTagText('');
                      } else {
                        alert("Esta tag já existe ou ocorreu um erro.");
                      }
                    }}
                    className="glass-btn primary"
                    style={{
                      padding: '6px 10px',
                      fontSize: '10px',
                      fontWeight: '600',
                      background: 'var(--accent-color)',
                      color: '#000',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Criar
                  </button>
                </div>
                
                {/* Color Selector circles */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Cor:</span>
                  {tagColorsPalette.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedNewColor(color)}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: selectedNewColor === color ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: selectedNewColor === color ? '0 0 6px ' + color : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.05)', margin: '2px 0' }} />

              {/* Search tag catalogue */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>Buscar & Vincular</span>
                <input
                  type="text"
                  placeholder="Buscar no catálogo..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  className="glass-input"
                  style={{
                    fontSize: '11px',
                    padding: '6px 10px',
                    width: '100%'
                  }}
                />
              </div>

              {/* Tag Catalog List */}
              <div 
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  paddingRight: '4px'
                }}
              >
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Catálogo de Tags</span>
                {globalTags
                  .filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                  .map(tag => {
                    const isAttached = activeContact.tags?.some(at => at.toLowerCase() === tag.name.toLowerCase());
                    const isEditing = editingTag && editingTag.name.toLowerCase() === tag.name.toLowerCase();

                    if (isEditing) {
                      return (
                        <div 
                          key={tag.name}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            padding: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            border: '1px solid rgba(255, 255, 255, 0.1)'
                          }}
                        >
                          <input
                            type="text"
                            value={editingTag.newName}
                            onChange={(e) => setEditingTag({ ...editingTag, newName: e.target.value })}
                            className="glass-input"
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                            maxLength={24}
                          />
                          
                          {/* Color Palette Selector for Editing */}
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {tagColorsPalette.map(color => (
                              <button
                                key={color}
                                onClick={() => setEditingTag({ ...editingTag, color })}
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  backgroundColor: color,
                                  border: editingTag.color === color ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.2)',
                                  cursor: 'pointer',
                                  padding: 0,
                                  transition: 'all 0.1s ease'
                                }}
                              />
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                            <button
                              onClick={handleSaveTagEdit}
                              className="glass-btn"
                              style={{
                                padding: '4px 8px',
                                fontSize: '9px',
                                flex: 1,
                                background: 'rgba(16, 185, 129, 0.2)',
                                borderColor: 'rgba(16, 185, 129, 0.4)',
                                color: '#10B981'
                              }}
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setConfirmDeleteTag(tag)}
                              className="glass-btn"
                              style={{
                                padding: '4px 8px',
                                fontSize: '9px',
                                flex: 1,
                                background: 'rgba(239, 68, 68, 0.2)',
                                borderColor: 'rgba(239, 68, 68, 0.4)',
                                color: '#EF4444'
                              }}
                            >
                              Excluir
                            </button>
                            <button
                              onClick={() => setEditingTag(null)}
                              className="glass-btn"
                              style={{
                                padding: '4px 8px',
                                fontSize: '9px',
                                flex: 1
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={tag.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          background: 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div 
                          onClick={() => {
                            if (isAttached) {
                              handleRemoveTag(tag.name);
                            } else {
                              handleAddTagDirect(tag.name);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flex: 1
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={isAttached}
                            readOnly
                            style={{ cursor: 'pointer' }}
                          />
                          <TagBadge name={tag.name} color={tag.color} />
                        </div>

                        <button
                          onClick={() => setEditingTag({ name: tag.name, newName: tag.name, color: tag.color })}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            fontSize: '10px'
                          }}
                          title="Editar etiqueta"
                        >
                          ✎
                        </button>
                      </div>
                    );
                  })}
                {globalTags.filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
                    Nenhuma tag encontrada no catálogo.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CUSTOM NOTES REPOSITORY */}
        <div className="profile-section" style={{ borderBottom: 'none' }}>
          <span className="profile-section-title">Anotações do Cliente</span>
          
          <div className="notes-input-wrapper" style={{ marginBottom: '12px' }}>
            <input
              type="text"
              className="glass-input"
              placeholder="Escrever anotação..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{ fontSize: '12px', padding: '8px 12px' }}
            />
            <button onClick={handleAddNote} className="glass-btn" style={{ padding: '8px 12px' }}>
              Salvar
            </button>
          </div>

          <div className="notes-history-list">
            {(activeContact.notes || []).map(note => (
              <div key={note.id} className="note-bubble">
                <span className="note-text">{note.text}</span>
                <div className="note-date">{note.date}</div>
              </div>
            ))}
            {(activeContact.notes || []).length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '12px' }}>
                Nenhuma anotação registrada ainda.
              </span>
            )}
          </div>
        </div>

      </div>

      {/* GLOBAL DELETE TAG CONFIRMATION MODAL */}
      {confirmDeleteTag && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}
        className="animated-fade-in"
        >
          <div style={{
            background: 'rgba(20, 20, 25, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#EF4444', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Excluir Etiqueta Globalmente
            </h3>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
              Você tem certeza que deseja excluir a etiqueta <strong>"{confirmDeleteTag.name}"</strong>?
              <br /><br />
              Esta ação é <strong>irreversível</strong> e irá removê-la permanentemente do catálogo e de todos os contatos associados no CRM (atualmente em <strong>{getContactsWithTagCount(confirmDeleteTag.name)}</strong> contatos).
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={handleConfirmDelete}
                className="glass-btn"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderColor: 'rgba(239, 68, 68, 0.5)',
                  color: '#EF4444',
                  fontWeight: '600',
                  fontSize: '12px'
                }}
              >
                Sim, Excluir de tudo
              </button>
              <button
                onClick={() => setConfirmDeleteTag(null)}
                className="glass-btn"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  fontWeight: '600',
                  fontSize: '12px'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
