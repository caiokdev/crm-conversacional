import React, { useState } from 'react';
import { useCrm } from '../context/CrmContext';

export default function ContactsList() {
  const { contacts, addContact, setActiveContactId, setActiveScreen } = useCrm();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadChannel, setNewLeadChannel] = useState('whatsapp');
  const [newLeadMsg, setNewLeadMsg] = useState('Olá, gostaria de saber mais informações.');

  // Financial sum metrics
  const totalLeads = contacts.length;
  const totalRevenue = contacts.filter(c => c.status === 'won').reduce((sum, c) => sum + c.value, 0);
  const conversionRate = totalLeads > 0 
    ? ((contacts.filter(c => c.status === 'won').length / totalLeads) * 100).toFixed(0) 
    : 0;

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateLead = (e) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;
    
    // Add lead and close form
    addContact(newLeadName, newLeadChannel, newLeadMsg);
    setNewLeadName('');
    setNewLeadMsg('Olá, gostaria de saber mais informações.');
    setShowAddForm(false);
  };

  const handleOpenChat = (contactId) => {
    setActiveContactId(contactId);
    setActiveScreen('chat');
  };

  return (
    <div className="content-wrapper animated-fade-in">
      <div className="page-header">
        <div className="page-title">
          <h1>Lista de Contatos</h1>
          <p>Base unificada de leads capturados, históricos e volumes de vendas.</p>
        </div>

        <button onClick={() => setShowAddForm(prev => !prev)} className="glass-btn">
          <span>{showAddForm ? '✕ Fechar Form' : '＋ Novo Lead'}</span>
        </button>
      </div>

      {/* QUICK INLINE LEAD CREATOR FORM */}
      {showAddForm && (
        <form onSubmit={handleCreateLead} className="glass-panel" style={{
          padding: '20px',
          background: 'var(--bg-surface-solid)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) 100px',
          gap: '16px',
          alignItems: 'end'
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
              <option value="telegram">Telegram</option>
              <option value="webchat">Webchat Web</option>
            </select>
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
      <div className="contacts-toolbar">
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
              <tr key={contact.id}>
                {/* Visual profile detail */}
                <td>
                  <div className="contact-profile-cell">
                    <div className="avatar" style={{ background: contact.avatarColor }}>
                      {contact.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="contact-name-bold">{contact.name}</span>
                      <div className="contact-email-sub">{contact.email}</div>
                    </div>
                  </div>
                </td>

                {/* Entry channel */}
                <td>
                  <span className="contact-channel-icon-label">
                    <span className={`kanban-card-channel-icon ${contact.channel}`}>
                      {contact.channel === 'whatsapp' && 'W'}
                      {contact.channel === 'telegram' && 'T'}
                      {contact.channel === 'webchat' && 'C'}
                    </span>
                    <span style={{ fontSize: '13px' }}>
                      {contact.channel === 'whatsapp' ? (
                        contact.provider === 'meta_cloud' ? 'Whats (Oficial)' :
                        contact.provider === 'evolution' ? 'Whats (Evolution)' : 'WhatsApp'
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
                    {contact.status === 'proposal' && 'Proposta'}
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
                  <div className="contact-tags-list">
                    {contact.tags.map(tag => (
                      <span key={tag} className="kanban-card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>

                {/* Interactive links column */}
                <td style={{ textAlign: 'right' }}>
                  <div className="contact-action-btn-row" style={{ justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleOpenChat(contact.id)}
                      className="table-action-btn"
                    >
                      💬 Conversar
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
    </div>
  );
}
