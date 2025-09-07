const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { incomingData } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Netlify.");
    }

    const masterPrompt = `
Actúa como un médico senior con excelentes habilidades de redacción. Tu tarea es generar dos bloques de texto basados en los datos proporcionados.

**BLOQUE 1: NOTA DE EVOLUCIÓN**
Redacta una nota de evolución clínica en párrafos fluidos y coherentes. El texto debe ser fácil de leer, objetivo y profesional. Evita el estilo telegráfico.
- Si el "tipo_nota" es "inicial", incluye los datos del paciente al principio.
- Si el "tipo_nota" es "evolutivo", NO incluyas los datos del paciente.

**BLOQUE 2: RECOMENDACIONES Y PLAN**
Redacta una sección de "Interacciones y Riesgos (RAM)" y otra de "Recomendaciones Clínicas". Sé directo y usa listas con viñetas para las recomendaciones.

**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Separa el BLOQUE 1 del BLOQUE 2 usando una única línea que contenga exactamente: ---SEPARADOR---

A continuación se presentan los datos para generar el informe en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;

    const modelName = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{ parts: [{ text: masterPrompt }] }]
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error de la API de Google:', errorData);
      return { statusCode: response.status, body: JSON.stringify({ error: `Error de la API de Google: ${response.statusText}` }) };
    }

    const data = await response.json();
    const fullText = data.candidates[0].content.parts[0].text;

    // Dividimos el texto en dos partes usando el separador
    const parts = fullText.split('---SEPARADOR---');
    const reportText = parts[0] ? parts[0].trim() : "No se pudo generar el informe.";
    const recommendationsText = parts[1] ? parts[1].trim() : "No se pudieron generar las recomendaciones.";

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        report: reportText,
        recommendations: recommendationsText
      }),
    };

  } catch (error) {
    console.error("Error en la función serverless:", error);
    return { statusCode: 500, body: JSON.stringify({ error: `Error interno en el servidor: ${error.message}` }) };
  }
};