export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { system, prompt, password } = body;

  // Password protection (optional — set APP_PASSWORD in Cloudflare dashboard)
  if (env.APP_PASSWORD && password !== env.APP_PASSWORD) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  if (!system || !prompt) {
    return Response.json({ error: 'Missing system or prompt' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // API key stored securely in Cloudflare dashboard — never exposed to browser
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: prompt  }
        ]
      })
    });

    const rawText = await response.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch {
      return Response.json(
        { error: `Non-JSON from DeepSeek (HTTP ${response.status}): ${rawText.slice(0, 200)}` },
        { status: 500 }
      );
    }

    if (!response.ok || data.error) {
      const msg = data?.error?.message || `HTTP ${response.status}`;
      return Response.json({ error: `DeepSeek: ${msg}` }, { status: 500 });
    }

    return Response.json({ result: data.choices[0].message.content });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
