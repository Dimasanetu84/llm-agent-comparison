require('dotenv').config();
const http = require('http');
const fs = require('fs');

const API_KEY = process.env.OPENROUTER_API_KEY;
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body);

        console.log('📨 Запрос:', messages[messages.length - 1]?.content);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Simple LLM Chat'
          },
          body: JSON.stringify({
            model: 'openrouter/free',
            messages: messages
            // ⬅️ НЕТ tools и tool_choice!
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || `API ошибка: ${response.status}`);
        }

        console.log('✅ Ответ отправлен');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));

      } catch (err) {
        console.error('❌ Ошибка:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/') {
    fs.createReadStream('index.html').pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(3000, () => console.log('🚀 Обычный LLM-чат запущен: http://localhost:3000'));
