const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

class N8nService {
  static async sendOutboundMessage(channelId, contactId, phone, content) {
    if (!N8N_URL) {
      console.warn('[N8nService] VITE_N8N_WEBHOOK_URL not configured.');
      return { success: false, reason: 'VITE_N8N_WEBHOOK_URL not configured' };
    }

    const response = await fetch(`${N8N_URL}/webhook/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channelId,
        contact_id: contactId,
        phone: phone,
        content: content
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true };
  }
}

export default N8nService;
