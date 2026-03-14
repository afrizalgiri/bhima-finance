const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const generateDocText = async (req, res) => {
  try {
    const { items, docType = 'sph', clientName, companyName } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items required' });
    }

    const itemList = items.map(i => `- ${i.name}${i.description ? ` (${i.description})` : ''}${i.unit ? `, satuan: ${i.unit}` : ''}`).join('\n');
    const isInvoice = docType === 'invoice';

    const prompt = `Kamu adalah asisten profesional untuk perusahaan keuangan Indonesia.
Buatkan paragraf pembuka dan penutup untuk ${isInvoice ? 'invoice/tagihan' : 'Surat Penawaran Harga (SPH)'} dalam Bahasa Indonesia yang formal dan profesional.

Perusahaan pengirim: ${companyName || 'kami'}
Klien: ${clientName || 'Bapak/Ibu'}
Item yang ${isInvoice ? 'ditagihkan' : 'ditawarkan'}:
${itemList}

Perhatikan jenis item:
- Jika item berupa produk/barang fisik, gunakan kata yang sesuai (pengiriman, pembelian, dll)
- Jika item berupa layanan/jasa, gunakan kata yang sesuai (penyediaan layanan, implementasi, dll)
- Sesuaikan tone dan diksi berdasarkan jenis item

Berikan response dalam format JSON:
{
  "openingText": "paragraf pembuka (2-3 kalimat)",
  "closingText": "paragraf penutup (2-3 kalimat)"
}

Hanya berikan JSON, tanpa penjelasan tambahan.`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, message: 'AI response format error' });
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('AI generate error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate text' });
  }
};

module.exports = { generateDocText };
