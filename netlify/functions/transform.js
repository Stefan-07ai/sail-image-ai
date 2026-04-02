export default async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { imageBase64, imageMime, prompt } = body;

  if (!imageBase64 || !prompt) {
    return new Response(JSON.stringify({ error: 'Missing imageBase64 or prompt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } },
              { text: prompt }
            ]
          }]
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return new Response(JSON.stringify({
        error: data?.error?.message || 'Gemini API error',
        code: data?.error?.code || geminiResponse.status
      }), {
        status: geminiResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    let imageData = null;
    let outMime = 'image/png';

    for (const part of parts) {
      if (part.inline_data?.data) {
        imageData = part.inline_data.data;
        outMime = part.inline_data.mime_type || 'image/png';
        break;
      }
    }

    if (!imageData) {
      const reason = data?.candidates?.[0]?.finishReason || 'UNKNOWN';
      const text = parts.filter(p => p.text).map(p => p.text).join(' ');
      return new Response(JSON.stringify({
        error: `No image returned. Reason: ${reason}. Model says: ${text}`
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ imageData, imageMime: outMime }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/transform' };
