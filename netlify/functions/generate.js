const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { incomingData } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Netlify.");
    }

    // --- PROMPT MEJORADO: ENFOQUE EN REDACCIÓN NARRATIVA ---
    const masterPrompt = `
Actúa como un médico senior con excelentes habilidades de redacción, especializado en crear notas de evolución para historias clínicas. Tu tarea es generar un informe que sea a la vez completo y eficiente.

**REGLAS GENERALES:**
1.  **CLARIDAD Y FLUIDEZ:** Redacta el informe en párrafos fluidos y coherentes. El texto debe ser fácil de leer y entender, pero manteniendo un alto nivel de profesionalismo y precisión técnica. **Evita el estilo telegráfico o las listas de palabras sueltas.**
2.  **OBJETIVIDAD:** Limítate a la información proporcionada. No inventes ni especules con datos no presentes.
3.  **FORMATO DE SALIDA:** Utiliza Markdown. Usa títulos en negrita para cada sección (ej: **Datos del Paciente:**). Usa listas con viñetas (-) solo cuando sea estrictamente necesario para enumerar puntos (como en las recomendaciones).

**INSTRUCCIONES ESPECÍFICAS SEGÚN EL TIPO DE NOTA:**
-   Si el "tipo_nota" es "inicial": Crea un informe de ingreso completo y narrativo. Incluye al principio una sección con los datos del paciente.
-   Si el "tipo_nota" es "evolutivo": Crea una nota de evolución corta y fluida. NO repitas los datos del paciente. Céntrate en los cambios y el estado actual, redactando un párrafo coherente.

**SECCIONES ESPECIALES (AÑADIR SIEMPRE AL FINAL):**
1.  **INTERACCIONES Y RIESGOS (RAM):** Analiza la medicación y tóxicos. Menciona posibles interacciones o RAMs relevantes en un párrafo redactado. Si no detectas ninguna, indica "No se aprecian interacciones de riesgo inmediato".
2.  **RECOMENDACIONES CLÍNICAS:** Proporciona 2-3 recomendaciones en una lista con viñetas para mayor claridad.

A continuación se presentan los datos para generar el informe:
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