require('dotenv').config();
const http = require('http');
const fs = require('fs');


const API_KEY = process.env.OPENROUTER_API_KEY;
// Инструменты агента (определения для API)
const tools = [
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Получает текущее время в указанном городе",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "Город" }
        },
        required: ["location"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "text_length",
      description: "Считает количество символов в тексте",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Текст для анализа" }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Выполняет математическое вычисление",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: "Математическое выражение" }
        },
        required: ["expression"]
      }
    }
  }
];

// Логика выполнения инструментов
async function executeTool(toolCall) {
  const { name, arguments: args } = toolCall.function;
  const parsed = JSON.parse(args);
  
  if (name === "get_current_time") {
    const time = new Date().toLocaleTimeString('ru-RU');
    const date = new Date().toLocaleDateString('ru-RU');
    return `🕐 ${date} ${time} (${parsed.location || 'Москва'})`;
  }
  
  if (name === "text_length") {
    return `📊 Длина текста: ${parsed.text.length} символов`;
  }
  
  if (name === "calculate") {
    try {
      // Безопасное вычисление (для простых выражений)
      const result = eval(parsed.expression);
      return `🧮 ${parsed.expression} = ${result}`;
    } catch (e) {
      return `❌ Ошибка вычисления: ${parsed.expression}`;
    }
  }
  
  return `❌ Инструмент "${name}" не найден`;
}

// HTTP Сервер
http.createServer(async (req, res) => {
  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обработка preflight запросов
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Обработка POST запросов к /chat
  if (req.method === 'POST' && req.url === '/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { messages } = JSON.parse(body);
        let currentMessages = [...messages];
        let iterations = 0;
        const MAX_ITER = 5;

        console.log('📨 Запрос:', messages[messages.length - 1]?.content);

        while (iterations < MAX_ITER) {
          iterations++;
          
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'AI Agent'
            },
            body: JSON.stringify({
              model: 'openrouter/free',
              messages: currentMessages,
              tools: tools,
              tool_choice: 'auto'
            })
          });

          const data = await response.json();
          
          if (!response.ok) {
            console.error('API ошибка:', data);
            throw new Error(data.error?.message || `API ошибка: ${response.status}`);
          }

          const assistantMsg = data.choices[0].message;
          currentMessages.push(assistantMsg);

          // Проверяем, есть ли вызовы инструментов
          if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
            console.log(`🔧 Вызов ${assistantMsg.tool_calls.length} инструмента(ов)...`);
            
            for (const toolCall of assistantMsg.tool_calls) {
              const result = await executeTool(toolCall);
              console.log(`✅ Результат: ${result}`);
              
              currentMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result
              });
            }
            continue; // Продолжаем цикл, чтобы модель обработала результаты
          }

          // Нет вызовов инструментов — отправляем финальный ответ
          console.log('✅ Финальный ответ отправлен');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
          return;
        }

        throw new Error('Превышен лимит вызовов инструментов');
        
      } catch (err) {
        console.error('❌ Ошибка:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/') {
    // Отдаём index.html
    fs.createReadStream('index.html').pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}).listen(3000, () => console.log('🚀 Агент запущен: http://localhost:3000'));