const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  // AÑADIDO PARA DEPURAR: Ver si la función se inicia
  console.log("Función 'generate' iniciada.");

  try {
    const { prompt } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    const modelName = "gemini-pro";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // AÑADIDO PARA DEPURAR: Confirmar que recibimos el prompt y la API Key
    console.log("Prompt recibido:", prompt ? "Sí, con contenido." : "No, está vacío.");
    console.log("¿API Key encontrada?:", apiKey ? `Sí, termina en ...${apiKey.slice(-4)}` : "¡NO, ESTÁ VACÍA O INDEFINIDA!");

    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Netlify.");
    }

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }]
    };

    // AÑADIDO PARA DEPURAR: Ver el cuerpo de la petición que enviamos a Google
    console.log("Enviando petición a Google...");
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // AÑADIDO PARA DEPURAR: Ver el estado de la respuesta de Google
    console.log(`Respuesta de Google recibida con estado: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json();
      // AÑADIDO PARA DEPURAR: Ver el cuerpo completo del error de Google
      console.error('Cuerpo completo del error de Google:', JSON.stringify(errorData, null, 2));
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Error de la API de Google: ${response.statusText}. Revisa los logs de la función en Netlify.` }),
      };
    }

    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;

    console.log("Texto generado con éxito.");

    return {
      statusCode: 200,
      body: JSON.stringify({ text: generatedText.trim() }),
    };

  } catch (error) {
    console.error("Error CATASTRÓFICO en la función serverless:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error interno en el servidor: ${error.message}` }),
    };
  }
};