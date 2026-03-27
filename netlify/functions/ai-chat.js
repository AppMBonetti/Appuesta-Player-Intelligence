exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: { message: 'Method not allowed' } }) };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not configured' } }) };
  }

  try {
    const body = JSON.parse(event.body);
    if (!body.messages || !body.messages.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: { message: 'No messages provided' } }) };
    }

    // Try up to 3 times with backoff, fall back to Haiku if Sonnet is overloaded
    const models = [
      body.model || 'claude-sonnet-4-20250514',
      body.model || 'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001'
    ];

    for (let attempt = 0; attempt < 3; attempt++) {
      const model = models[attempt];
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: body.max_tokens || 4096,
          system: body.system || '',
          messages: body.messages
        })
      });

      const data = await response.json();

      // If overloaded, wait and retry
      if (data.error && data.error.type === 'overloaded_error') {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
      }

      // If not an error, or final attempt, return result
      if (!data.error) {
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      }

      // On final attempt, return whatever we got
      if (attempt === 2) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ error: { message: data.error?.message || 'API error after 3 retries', type: data.error?.type } })
        };
      }
    }
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: { message: error.message || 'Unknown server error' } })
    };
  }
};
