const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  // 1. Recibimos el prompt que nos envía la página web
  const { prompt } = JSON.parse(event.body);
  const apiKey = process.env.GOOGLE_API_KEY; // 2. Leemos la API Key de forma segura
  const modelName = "gemini-pro";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    // 3. Hacemos la llamada a Google desde el servidor de Netlify
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de la API de Google:', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Error de la API de Google: ${response.statusText}` }),
      };
    }

    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;

    // 4. Devolvemos el texto generado a nuestra página web
    return {
      statusCode: 200,
      body: JSON.stringify({ text: generatedText.trim() }),
    };

  } catch (error) {
    console.error("Error en la función serverless:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno en el servidor.' }),
    };
  }
};