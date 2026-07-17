const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
const OUTBOUND_PATH = import.meta.env.VITE_N8N_OUTBOUND_PATH || '/webhook/send';
const OUTBOUND_MEDIA_PATH = import.meta.env.VITE_N8N_OUTBOUND_MEDIA_PATH || '/webhook/send-media';

class N8nService {
  static async sendOutboundMessage(channelId, contactId, phone, content) {
    if (!N8N_URL) {
      console.warn('[N8nService] VITE_N8N_WEBHOOK_URL not configured.');
      return { success: false, reason: 'VITE_N8N_WEBHOOK_URL not configured' };
    }

    const response = await fetch(`${N8N_URL}${OUTBOUND_PATH}`, {
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

  static async sendOutboundMedia({ channelId, contactId, phone, mediaUrl, contentType, mimeType, fileName, caption }) {
    if (!N8N_URL) {
      console.warn('[N8nService] VITE_N8N_WEBHOOK_URL not configured.');
      return { success: false, reason: 'VITE_N8N_WEBHOOK_URL not configured' };
    }

    const response = await fetch(`${N8N_URL}${OUTBOUND_MEDIA_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: channelId,
        contact_id: contactId,
        phone: phone,
        media_url: mediaUrl,
        content_type: contentType,
        mime_type: mimeType,
        file_name: fileName,
        caption: caption
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { success: true };
  }
}

export default N8nService;
