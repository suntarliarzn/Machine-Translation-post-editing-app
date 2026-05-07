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

  const modelsToTry = ['qwen-plus', 'qwen-turbo'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // API key stored securely in Cloudflare dashboard — never exposed to browser
            'Authorization': `Bearer ${env.QWEN_API_KEY}`
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            messages: [
              { role: 'system', content: system },
              { role: 'user',   content: prompt  }
            ]
          })
        }
      );

      const rawText = await response.text();
      let data;
      try { data = JSON.parse(rawText); }
      catch {
        throw new Error(`Non-JSON from Qwen (HTTP ${response.status}): ${rawText.slice(0, 200)}`);
      }

      if (!response.ok || data.error || data.code) {
        const msg = data?.error?.message || data?.message || data?.code || `HTTP ${response.status}`;
        throw new Error(`Qwen (${model}): ${msg}`);
      }

      if (!data.choices?.[0]?.message?.content) {
        throw new Error(`Unexpected Qwen response: ${JSON.stringify(data).slice(0, 200)}`);
      }

      return Response.json({ result: data.choices[0].message.content });

    } catch (err) {
      lastError = err;
      // try next model
    }
  }

  return Response.json({ error: lastError?.message || 'Qwen request failed' }, { status: 500 });
}
