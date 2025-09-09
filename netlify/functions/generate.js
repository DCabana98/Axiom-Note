const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { incomingData } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    // --- PROMPT ADAPTATIVO SEGÚN EL CONTEXTO ---
    let masterPrompt;

    if (incomingData.contexto === 'urgencias') {
      masterPrompt = `
Actúa como un médico de urgencias senior con más de 20 años de experiencia. Tu tarea es redactar una nota de ingreso desde urgencias, que sea un modelo de claridad, eficiencia y rigor clínico.

**REGLAS:**
1.  **ESTILO:** Redacta en párrafos fluidos y coherentes. Usa un lenguaje activo y profesional. Evita el estilo telegráfico.
2.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
3.  **SEPARACIÓN:** Separa el informe principal de las recomendaciones usando una única línea que contenga exactamente: ---SEPARADOR---

**ESTRUCTURA DEL INFORME (BLOQUE 1):**
-   Inicia con una presentación del paciente (edad, sexo, alergias).
-   Describe el motivo de consulta, la historia actual y los antecedentes relevantes.
-   Detalla la exploración física y los resultados de las pruebas realizadas.
-   Finaliza con la sospecha diagnóstica y el plan inmediato ejecutado.

**ESTRUCTURA DE RECOMENDACIONES (BLOQUE 2):**
-   Analiza posibles interacciones o RAMs.
-   Proporciona 2-3 recomendaciones clínicas razonadas (ej: "Valorar interconsulta con...", "Monitorizar...").

A continuación se presentan los datos para generar el informe de URGENCIAS:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
    } else {
      // (Aquí iría en el futuro el prompt para 'Ingreso en Planta')
      masterPrompt = "Contexto no reconocido. Por favor, especifica un contexto válido.";
    }

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
      return { statusCode: response.status, body: JSON.stringify({ error: `Error de la API de Google: ${response.statusText}` }) };
    }

    const data = await response.json();
    const fullText = data.candidates[0].content.parts[0].text;

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
    return { statusCode: 500, body: JSON.stringify({ error: `Error interno en el servidor: ${error.message}` }) };
  }
};