// LocalClips secure Gemini transcription endpoint (Vercel Serverless Function).
// Set GEMINI_API_KEY in Vercel Project Settings -> Environment Variables.
// The browser sends only a short extracted WAV clip; the API key never reaches the browser.

const MODEL = 'gemini-3.8-flash';
const MAX_AUDIO_BASE64_CHARS = 7 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'Gemini is not configured yet. Add GEMINI_API_KEY in Vercel Environment Variables.'
    });
  }

  try {
    const body = req.body || {};
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 4000) : '';
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
    const mimeType = body.mimeType === 'audio/wav' ? 'audio/wav' : '';

    if (!prompt || !audioBase64 || !mimeType) {
      return res.status(400).json({ error: 'Prompt and WAV audio are required.' });
    }
    if (audioBase64.length > MAX_AUDIO_BASE64_CHARS) {
      return res.status(413).json({ error: 'Audio segment is too large. Please transcribe a shorter clip.' });
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(audioBase64)) {
      return res.status(400).json({ error: 'Invalid audio encoding.' });
    }

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: audioBase64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini API error:', upstream.status, result?.error?.message || 'Unknown upstream error');
      return res.status(502).json({
        error: result?.error?.message || `Gemini API request failed (${upstream.status}).`
      });
    }

    const text = (result.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || '')
      .join('\n')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Gemini returned an empty transcription.' });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error('LocalClips Gemini backend error:', error);
    return res.status(500).json({ error: 'Gemini transcription failed. Please try again.' });
  }
}
