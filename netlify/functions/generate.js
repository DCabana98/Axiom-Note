const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { prompt: incomingPrompt } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Netlify.");
    }

    const modelName = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // --- NUEVO PROMPT MAESTRO ---
    // Aquí definimos el rol y las instrucciones para la IA
    const masterPrompt = `Actúa como un profesional sanitario (médico o enfermero/a) con vasta experiencia, especializado en la redacción de notas de evolución clínica. Tu objetivo es transformar los siguientes datos esquemáticos en un informe clínico impecable. El tono debe ser objetivo, preciso y formal, utilizando terminología médica estándar. Sigue el orden de los patrones proporcionados y no añadas información especulativa. El resultado debe ser un texto limpio y listo para ser incorporado en una historia clínica.

A continuación se presentan los datos del paciente y las notas de evolución:
\n\n`;

    // Unimos las instrucciones con los datos que nos llegan de la web
    const finalPrompt = masterPrompt + incomingPrompt;

    const requestBody = {
      contents: [{ parts: [{ text: finalPrompt }] }]
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

    return {
      statusCode: 200,
      body: JSON.stringify({ text: generatedText.trim() }),
    };

  } catch (error) {
    console.error("Error en la función serverless:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error interno en el servidor: ${error.message}` }),
    };
  }
};

  } catch (error) {
    console.error("Error CATASTRÓFICO en la función serverless:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error interno en el servidor: ${error.message}` }),
    };
  }
};