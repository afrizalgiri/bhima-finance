const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateDocText = async (req, res) => {
  try {
    const { items, clientName, companyName } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items required' });
    }

    const itemList = items.map(i => `- ${i.name}${i.description ? ` (${i.description})` : ''}${i.unit ? `, satuan: ${i.unit}` : ''}`).join('\n');

    const prompt = `Kamu adalah asisten profesional untuk perusahaan keuangan Indonesia.
Buatkan paragraf pembuka dan penutup untuk Surat Penawaran Harga (SPH) dalam Bahasa Indonesia yang formal dan profesional.

Perusahaan pengirim: ${companyName || 'kami'}
Klien: ${clientName || 'Bapak/Ibu'}
Item yang ditawarkan:
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, message: 'AI response format error' });
    }

    const data = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data });
  } catch (error) {
    console.error('AI generate error:', error);
    if (error.status === 429) {
      return res.status(429).json({ success: false, message: 'Batas request AI tercapai, tunggu 1 menit lalu coba lagi.' });
    }
    res.status(500).json({ success: false, message: 'Gagal generate teks AI' });
  }
};

module.exports = { generateDocText };
