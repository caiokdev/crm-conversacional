import React, { useState } from 'react';
import { useCrm } from '../context/CrmContext';
import { MessageSquare, Tag, StickyNote, Phone, User } from 'lucide-react';
import TagBadge from './TagBadge';

export default function ContactsList() {
  const { 
    contacts, 
    addContact, 
    setActiveContactId, 
    setActiveScreen,
    changeContactStatus,
    addNoteToContact,
    updateContactTags,
    updateContactName,
    updateContactValue,
    globalTags,
    dateFilter,
    setDateFilter,
    customDateRange,
    setCustomDateRange,
    getFilteredContacts
  } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadChannel, setNewLeadChannel] = useState('whatsapp');
  const [newLeadMsg, setNewLeadMsg] = useState('Olá, gostaria de saber mais informações.');

  // Editing drawer state
  const [selectedContact, setSelectedContact] = useState(null);
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editValue, setEditValue] = useState(0);
  const [editTags, setEditTags] = useState([]);
  const [newTagText, setNewTagText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');

  // Financial sum metrics
  const dateFilteredContacts = getFilteredContacts();
  const totalLeads = dateFilteredContacts.length;
  const totalRevenue = dateFilteredContacts.filter(c => c.status === 'won').reduce((sum, c) => sum + c.value, 0);
  const conversionRate = totalLeads > 0 
    ? ((dateFilteredContacts.filter(c => c.status === 'won').length / totalLeads) * 100).toFixed(0) 
    : 0;
 
  const filteredContacts = dateFilteredContacts.filter(c => 
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateLead = (e) => {
    e.preventDefault();
    if (!newLeadName.trim() || !newLeadPhone.trim()) return;
    
    // Add lead and close form
    addContact(newLeadName, newLeadChannel, newLeadPhone, newLeadMsg);
    setNewLeadName('');
    setNewLeadPhone('');
    setNewLeadMsg('Olá, gostaria de saber mais informações.');
    setShowAddForm(false);
  };

  const handleOpenChat = (contactId) => {
    setActiveContactId(contactId);
    setActiveScreen('chat');
  };

  // Open editing drawer
  const handleEditContact = (contact) => {
    setSelectedContact(contact);
    setEditName(contact.name);
    setEditStatus(contact.status);
    setEditValue(contact.value || 0);
    setEditTags(contact.tags || []);
    setNewTagText('');
    setNewNoteText('');
  };

  // Save details back to context
  const handleSaveContact = () => {
    if (!selectedContact) return;
    
    updateContactName(selectedContact.id, editName);
    changeContactStatus(selectedContact.id, editStatus);
    updateContactValue(selectedContact.id, editValue);
    updateContactTags(selectedContact.id, editTags);
    
    setSelectedContact(null);
  };

  // Tag helper functions
  const handleAddTag = (e) => {
    e.preventDefault();
    if (!newTagText.trim()) return;
    if (editTags.includes(newTagText.trim())) return;
    setEditTags([...editTags, newTagText.trim()]);
    setNewTagText('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setEditTags(editTags.filter(t => t !== tagToRemove));
  };

  // Note helper function
  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    addNoteToContact(selectedContact.id, newNoteText);
    setNewNoteText('');
  };

  // Fetch reactive live contact details from CRM Context
  const liveContact = selectedContact ? contacts.find(c => c.id === selectedContact.id) : null;
  const notesList = liveContact ? liveContact.notes || [] : [];

  return (
    <div className="content-wrapper animated-fade-in" style={{ position: 'relative' }}>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-title">
          <h1>Lista de Contatos</h1>
          <p>Base unificada de leads capturados, históricos e volumes de vendas.</p>
        </div>
 
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Date Range Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="crm-status-dropdown"
              style={{ padding: '6px 32px 6px 12px', fontSize: '12px', height: '34px' }}
            >
              <option value="all">Todo o Período</option>
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="7days">Últimos 7 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="animated-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                className="glass-input"
                style={{ padding: '4px 10px', fontSize: '11px', height: '34px', width: '130px' }}
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                placeholder="De"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>até</span>
              <input
                type="date"
                className="glass-input"
                style={{ padding: '4px 10px', fontSize: '11px', height: '34px', width: '130px' }}
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                placeholder="Até"
              />
            </div>
          )}

          <button onClick={() => setShowAddForm(prev => !prev)} className="glass-btn">
            <span>{showAddForm ? '✕ Fechar Form' : '＋ Novo Lead'}</span>
          </button>
        </div>
      </div>

      {/* QUICK INLINE LEAD CREATOR FORM */}
      {showAddForm && (
        <form onSubmit={handleCreateLead} className="glass-panel" style={{
          padding: '20px',
          background: 'var(--bg-surface-solid)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 100px',
          gap: '16px',
          alignItems: 'end',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Nome do Lead</span>
            <input
              type="text"
              required
              className="glass-input"
              placeholder="Ex: João Souza"
              value={newLeadName}
              onChange={(e) => setNewLeadName(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Canal de Entrada</span>
            <select
              className="crm-status-dropdown"
              value={newLeadChannel}
              onChange={(e) => setNewLeadChannel(e.target.value)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="telegram">Instagram</option>
              <option value="webchat">Tiktok</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Telefone / Celular</span>
            <input
              type="text"
              required
              className="glass-input"
              placeholder="Ex: 5511999998888"
              value={newLeadPhone}
              onChange={(e) => setNewLeadPhone(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Mensagem Inicial</span>
            <input
              type="text"
              className="glass-input"
              placeholder="Olá, gostaria de saber..."
              value={newLeadMsg}
              onChange={(e) => setNewLeadMsg(e.target.value)}
            />
          </div>

          <button type="submit" className="glass-btn" style={{ height: '42px', padding: '0' }}>
            Criar
          </button>
        </form>
      )}

      {/* SEARCH AND METRICS SLIDER BAR */}
      <div className="contacts-toolbar" style={{ marginBottom: '20px' }}>
        <div className="search-field-wrapper">
          <input
            type="text"
            className="glass-input"
            placeholder="Pesquisar por nome, e-mail ou tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="contacts-metrics-summary">
          <div className="contacts-summary-pill">
            Leads: <span>{totalLeads}</span>
          </div>
          <div className="contacts-summary-pill">
            Conversão: <span>{conversionRate}%</span>
          </div>
          <div className="contacts-summary-pill">
            Receita: <span>R$ {totalRevenue.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE DATA TABLE */}
      <div className="contacts-table-wrapper">
        <table className="contacts-table">
          <thead>
            <tr>
              <th>Cliente / Lead</th>
              <th>Canal de Entrada</th>
              <th>Status Funil</th>
              <th>Valor Comercial</th>
              <th>Tags Personalizadas</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map(contact => (
              <tr 
                key={contact.id}
                onClick={() => handleEditContact(contact)}
                style={{ cursor: 'pointer', transition: 'background 0.2s' }}
              >
                {/* Visual profile detail */}
                <td>
                  <div className="contact-profile-cell">
                    <div className="avatar" style={{ background: contact.avatarColor }}>
                      {contact.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="contact-name-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {contact.name}
                        {contact.tags?.includes('IA Inativa') && (
                          <User size={14} strokeWidth={2.5} color="var(--warning-color)" title="Aguardando Atendente Humano" />
                        )}
                      </span>
                      <div className="contact-email-sub">{contact.email}</div>
                    </div>
                  </div>
                </td>

                {/* Entry channel */}
                <td>
                  <span className="contact-channel-icon-label">
                    <span className={`kanban-card-channel-icon ${contact.channel}`}>
                      {contact.channel === 'whatsapp' && 'W'}
                      {contact.channel === 'telegram' && 'I'}
                      {contact.channel === 'webchat' && 'T'}
                    </span>
                    <span style={{ fontSize: '13px' }}>
                      {contact.channel === 'whatsapp' ? (
                        contact.provider === 'meta_cloud' ? 'Whats (Oficial)' :
                        contact.provider === 'evolution' ? 'Whats (Evolution)' : 'WhatsApp'
                      ) : contact.channel === 'telegram' ? (
                        'Instagram'
                      ) : contact.channel === 'webchat' ? (
                        'Tiktok'
                      ) : (
                        contact.channel.charAt(0).toUpperCase() + contact.channel.slice(1)
                      )}
                    </span>
                  </span>
                </td>

                {/* Funnel pipeline stage tag */}
                <td>
                  <span className={`tag status-${contact.status}`}>
                    {contact.status === 'new' && 'Novo Lead'}
                    {contact.status === 'contacted' && 'Em Contato'}
                    {contact.status === 'no_answer' && 'Sem Resposta'}
                    {contact.status === 'proposal' && 'Tem Interesse'}
                    {contact.status === 'won' && 'Vendido'}
                    {contact.status === 'lost' && 'Perdido'}
                  </span>
                </td>

                {/* Monetary transaction scale */}
                <td>
                  <span className="contact-value-display">
                    {contact.value > 0 ? `R$ ${contact.value.toLocaleString('pt-BR')}` : 'R$ ---'}
                  </span>
                </td>

                {/* Personal labels rows */}
                <td>
                  <div className="contact-tags-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(contact.tags || []).map(tag => {
                      const tagColorObj = globalTags?.find(t => t.name.toLowerCase() === tag.toLowerCase());
                      const color = tagColorObj ? tagColorObj.color : '#9CA3AF';
                      return (
                        <TagBadge key={tag} name={tag} color={color} />
                      );
                    })}
                  </div>
                </td>

                {/* Interactive links column */}
                <td style={{ textAlign: 'right' }}>
                  <div className="contact-action-btn-row" style={{ justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenChat(contact.id);
                      }}
                      className="table-action-btn"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MessageSquare size={14} strokeWidth={2.5} />
                      Conversar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                  Nenhum contato coincide com a busca.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* PREMIUM DETAILS DRAWER (SLIDE-IN MODAL PANEL) */}
      {/* ========================================================= */}
      {selectedContact && (
        <>
          {/* Blur backdrop cover */}
          <div 
            onClick={() => setSelectedContact(null)} 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(5px)',
              webkitBackdropFilter: 'blur(5px)',
              zIndex: 999,
              animation: 'fadeIn 0.2s ease-out'
            }}
          />

          {/* Slide-out Panel container */}
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '440px',
            height: '100%',
            background: 'var(--bg-surface-solid)',
            backdropFilter: 'var(--glass-blur)',
            webkitBackdropFilter: 'var(--glass-blur)',
            borderLeft: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            padding: '28px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)'
          }}>
            
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', background: 'linear-gradient(90deg, var(--text-primary), var(--text-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Ficha do Lead
              </h2>
              <button 
                onClick={() => setSelectedContact(null)}
                style={{
                  background: 'var(--bg-surface-hover)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface-hover)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-glass)';
                }}
              >
                ✕
              </button>
            </div>

            {/* Profile Summary Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--bg-surface-hover)', border: '1px solid var(--border-glass)', borderRadius: '12px', marginBottom: '24px' }}>
              <div style={{ 
                width: '54px', 
                height: '54px', 
                borderRadius: '50%', 
                background: selectedContact.avatarColor, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: '700', 
                fontSize: '20px',
                color: '#fff',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}>
                {selectedContact.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '16px', color: 'var(--text-primary)' }}>{editName || selectedContact.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {selectedContact.channel === 'telegram' ? '@' : (
                      <Phone size={12} strokeWidth={2.5} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    )}
                    {selectedContact.phone}
                  </span>
                  <span style={{ color: 'var(--border-glass)' }}>|</span>
                  <span style={{ textTransform: 'capitalize' }}>
                    {selectedContact.channel === 'telegram' ? 'Instagram' : 
                     selectedContact.channel === 'whatsapp' ? 'WhatsApp' : 
                     selectedContact.channel === 'webchat' ? 'Tiktok' : selectedContact.channel}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable Fields area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '4px', marginBottom: '20px' }}>
              
              {/* Field: Client Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Nome do Lead</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              {/* Fields: Value & Status Stage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Valor Comercial</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>R$</span>
                    <input 
                      type="number" 
                      className="glass-input" 
                      value={editValue}
                      onChange={(e) => setEditValue(Number(e.target.value) || 0)}
                      style={{ paddingLeft: '32px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Fase no Funil</label>
                  <select 
                    className="crm-status-dropdown" 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{ width: '100%', height: '42px' }}
                  >
                    <option value="new">Novo Lead</option>
                    <option value="contacted">Em Contato</option>
                    <option value="no_answer">Sem Resposta</option>
                    <option value="proposal">Tem Interesse</option>
                    <option value="won">Vendido</option>
                    <option value="lost">Perdido</option>
                  </select>
                </div>
              </div>

              {/* Tags Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Tag size={12} strokeWidth={2.5} style={{ color: 'var(--accent-primary)' }} />
                  Etiquetas (Tags)
                </label>
                
                {/* Active tags visual lists */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '30px', padding: '10px', background: 'var(--bg-app)', border: '1px dashed var(--border-glass)', borderRadius: '8px', alignItems: 'center' }}>
                  {editTags.map(tag => {
                    const tagColorObj = globalTags?.find(t => t.name.toLowerCase() === tag.toLowerCase());
                    const color = tagColorObj ? tagColorObj.color : '#9CA3AF';
                    return (
                      <TagBadge 
                        key={tag} 
                        name={tag} 
                        color={color} 
                        onDelete={() => handleRemoveTag(tag)}
                      />
                    );
                  })}
                  {editTags.length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2px 4px' }}>Sem etiquetas ainda</span>
                  )}
                </div>

                {/* Add Tag field inline */}
                <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    className="glass-input" 
                    placeholder="Adicionar nova etiqueta..." 
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    style={{ flex: 1, height: '36px', fontSize: '13px' }}
                  />
                  <button 
                    type="submit" 
                    className="glass-btn" 
                    style={{ height: '36px', padding: '0 14px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ＋ Add
                  </button>
                </form>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--border-glass)', margin: '4px 0' }} />

              {/* Notes (Observações) Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <StickyNote size={12} strokeWidth={2.5} style={{ color: 'var(--accent-primary)' }} />
                  Anotações & Observações
                </label>

                {/* Live Notes Timeline list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '2px' }}>
                  {notesList.map(note => (
                    <div 
                      key={note.id} 
                      style={{ 
                        padding: '12px', 
                        background: 'var(--bg-app)', 
                        border: '1px solid var(--border-glass)', 
                        borderRadius: '8px', 
                        fontSize: '13px',
                        lineHeight: '1.4'
                      }}
                    >
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Anotado</span>
                        <span>{note.date}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{note.text}</div>
                    </div>
                  ))}
                  {notesList.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', background: 'var(--bg-app)', border: '1px dashed var(--border-glass)', borderRadius: '8px' }}>
                      Nenhuma anotação registrada ainda.
                    </div>
                  )}
                </div>

                {/* Add new note input box */}
                <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <textarea 
                    className="glass-input" 
                    rows="2" 
                    placeholder="Escrever observações sobre o cliente..." 
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{ resize: 'none', padding: '10px', fontSize: '13px', borderRadius: '8px' }}
                  />
                  <button 
                    type="submit" 
                    className="glass-btn secondary"
                    style={{ height: '34px', fontSize: '12px', width: 'fit-content', alignSelf: 'flex-end', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Salvar Observação
                  </button>
                </form>
              </div>

            </div>

            {/* Save / Footer actions */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
              <button 
                onClick={() => setSelectedContact(null)}
                className="glass-btn secondary"
                style={{ flex: 1, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveContact}
                className="glass-btn"
                style={{ 
                  flex: 2, 
                  height: '44px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'var(--accent-primary)',
                  border: 'none',
                  color: '#fff',
                  boxShadow: '0 0 16px var(--accent-glow)',
                  fontWeight: '600'
                }}
              >
                Salvar Alterações
              </button>
            </div>

          </div>
        </>
      )}

      {/* Sliding and fading keyframes inline stylesheet */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
