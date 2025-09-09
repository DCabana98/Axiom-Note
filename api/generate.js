const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { incomingData } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    let masterPrompt;
    const contexto = incomingData.contexto;

    // Usamos un switch para elegir el prompt correcto
    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior... (El prompt de urgencias que ya teníamos) ...
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Separa el informe principal (BLOQUE 1) de las recomendaciones (BLOQUE 2) usando una única línea que contenga: ---SEPARADOR---
Después del BLOQUE 2, añade otra línea separadora que contenga: ---KEYWORDS--- y a continuación una lista de 5-7 palabras clave que resuman el caso (ej: Dolor torácico, SCA, Troponinas elevadas).`;
        break;

      case 'planta':
        masterPrompt = `
Actúa como un médico internista experimentado... (El prompt de ingreso en planta que ya teníamos) ...
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Separa el informe principal (BLOQUE 1) de las recomendaciones (BLOQUE 2) usando una única línea que contenga: ---SEPARADOR---
Después del BLOQUE 2, añade otra línea separadora que contenga: ---KEYWORDS--- y a continuación una lista de 5-7 palabras clave que resuman el ingreso.`;
        break;

      case 'evolutivo':
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa.
**REGLAS:**
1.  **ESTILO:** Redacta un único párrafo fluido y profesional. Sé directo.
2.  **CONTENIDO:** Describe el estado actual, los eventos relevantes y el plan a seguir. NO incluyas datos demográficos del paciente (nombre, edad, etc.).
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Separa el informe principal (BLOQUE 1) de las recomendaciones (BLOQUE 2) usando una única línea que contenga: ---SEPARADOR---
Después del BLOQUE 2, añade otra línea separadora que contenga: ---KEYWORDS--- y a continuación una lista de 5-7 palabras clave que resuman la evolución actual.

A continuación se presentan los datos para generar el EVOLUTIVO EN PLANTA:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      default:
        masterPrompt = "Contexto no reconocido.";
    }

    const modelName = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const requestBody = { contents: [{ parts: [{ text: masterPrompt }] }] };
    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    if (!response.ok) {
      const errorData = await response.json();
      return { statusCode: response.status, body: JSON.stringify({ error: `Error de la API de Google: ${response.statusText}` }) };
    }
    const data = await response.json();
    const fullText = data.candidates[0].content.parts[0].text;

    // Dividimos el texto en hasta 3 partes
    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0] ? parts[0].trim() : "No se pudo generar el informe.";
    
    const recommendationsAndKeywords = parts[1] ? parts[1].split('---KEYWORDS---') : [];
    const recommendationsPart = recommendationsAndKeywords[0] ? recommendationsAndKeywords[0].trim() : "No se pudieron generar las recomendaciones.";
    const keywordsPart = recommendationsAndKeywords[1] ? recommendationsAndKeywords[1].trim() : "No se pudo generar el resumen.";

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        report: reportPart,
        recommendations: recommendationsPart,
        keywords: keywordsPart
      }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: `Error interno en el servidor: ${error.message}` }) };
  }
};