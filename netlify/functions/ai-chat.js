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
    return { statusCode: 200, headers, body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not configured in Netlify environment variables' } }) };
  }

  try {
    const body = JSON.parse(event.body);
    
    if (!body.messages || !body.messages.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: { message: 'No messages provided' } }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 4096,
        system: body.system || '',
        messages: body.messages
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: { message: data.error?.message || 'Anthropic API error ' + response.status, type: data.error?.type || 'api_error' } })
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: { message: error.message || 'Unknown server error' } })
    };
  }
};
