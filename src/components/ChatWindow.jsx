import React, { useState, useEffect, useRef } from 'react';
import { useCrm } from '../context/CrmContext';
import { MessageSquare, FileText, Calendar, PenLine, Send, Loader2, CheckCheck, XCircle, Bot, User } from 'lucide-react';
import AudioPlayer from './AudioPlayer';

export default function ChatWindow() {
  const {
    contacts,
    activeContact,
    setActiveContactId,
    sendMessage,
    changeContactStatus,
    addNoteToContact,
    updateContactTags,
    updateContactValue
  } = useCrm();

  const [channelFilter, setChannelFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  
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
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
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

  const handleInjectTemplate = (text) => {
    sendMessage(activeContact.id, text, 'agent');
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteToContact(activeContact.id, noteText);
    setNoteText('');
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && newTagText.trim()) {
      if (!activeContact.tags.includes(newTagText.trim())) {
        updateContactTags(activeContact.id, [...activeContact.tags, newTagText.trim()]);
      }
      setNewTagText('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    updateContactTags(activeContact.id, activeContact.tags.filter(t => t !== tagToRemove));
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
                  <div className="chat-preview-row">
                    <span className="chat-preview-text">
                      {lastMsg ? (lastMsg.sender === 'agent' ? 'Você: ' : lastMsg.sender === 'bot' ? 'Bot: ' : '') + lastMsg.text : 'Sem mensagens'}
                    </span>
                    {contact.unread && <span className="unread-count-dot"></span>}
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
          {activeContact.messages.map(msg => (
            <div key={msg.id} className={`message-bubble-wrapper ${msg.sender}`}>
              <div className="message-bubble">
                {msg.content_type === 'image' && msg.media_url ? (
                  <div>
                    <img 
                      src={msg.media_url} 
                      alt="Imagem enviada" 
                      style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: '8px', cursor: 'pointer' }}
                      onClick={() => window.open(msg.media_url, '_blank')}
                    />
                    {msg.text && msg.text !== '[Imagem]' && <div>{msg.text}</div>}
                  </div>
                ) : msg.content_type === 'sticker' && msg.media_url ? (
                  <div>
                    <img 
                      src={msg.media_url} 
                      alt="Figurinha enviada" 
                      style={{ width: '120px', height: '120px', objectFit: 'contain', background: 'transparent', display: 'block' }}
                    />
                  </div>
                ) : msg.content_type === 'audio' && msg.media_url ? (
                  <AudioPlayer src={msg.media_url} />
                ) : msg.content_type === 'video' && msg.media_url ? (
                  <div>
                    <video src={msg.media_url} controls style={{ maxWidth: '280px', borderRadius: '8px', display: 'block', marginBottom: '8px' }} />
                    {msg.text && msg.text !== '[Vídeo]' && <div>{msg.text}</div>}
                  </div>
                ) : msg.content_type === 'document' && msg.media_url ? (
                  <div>
                    <a 
                      href={msg.media_url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', textDecoration: 'underline' }}
                    >
                      <FileText size={14} strokeWidth={2.5} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                      {msg.text || 'Documento'}
                    </a>
                  </div>
                ) : (
                  msg.text
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
          <span className="profile-section-title">Dados do Contato</span>
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
              <option value="proposal">Proposta Enviada</option>
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
          <span className="profile-section-title">Tags Personalizadas</span>
          <div className="contact-tags-list" style={{ marginBottom: '8px' }}>
            {activeContact.tags.map(tag => (
              <span key={tag} className="kanban-card-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px' }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            className="glass-input"
            placeholder="Nova tag + Enter..."
            value={newTagText}
            onChange={(e) => setNewTagText(e.target.value)}
            onKeyDown={handleAddTag}
            style={{ padding: '8px 12px', fontSize: '12px' }}
          />
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
            {activeContact.notes.map(note => (
              <div key={note.id} className="note-bubble">
                <span className="note-text">{note.text}</span>
                <div className="note-date">{note.date}</div>
              </div>
            ))}
            {activeContact.notes.length === 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '12px' }}>
                Nenhuma anotação registrada ainda.
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
