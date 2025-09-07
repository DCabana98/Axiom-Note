const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { incomingData } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Netlify.");
    }

    // --- PROMPT v3: EL ESPECIALISTA EN RAZONAMIENTO CLÍNICO ---
    const masterPrompt = `
Actúa como un médico senior con más de 20 años de experiencia en un servicio de urgencias. Eres un experto en redactar notas de evolución que son un modelo de claridad, eficiencia y rigor clínico.

**MISIÓN:**
Transforma los siguientes datos esquemáticos en una nota de evolución clínica impecable, lista para ser incluida en una historia clínica electrónica.

**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE ACTIVO Y DIRECTO:** Utiliza un estilo de redacción activo y profesional. En lugar de "Se mantiene la pauta de Paracetamol", escribe "Se mantiene tratamiento con Paracetamol".
2.  **FLUIDEZ NARRATIVA:** Redacta en párrafos coherentes y bien conectados. Evita el estilo telegráfico, pero sé conciso.
3.  **FORMATO:** Usa Markdown. Los títulos de sección deben ir en negrita (ej: **Evolución:**). Las recomendaciones en una lista con viñetas.

**INSTRUCCIONES DE CONTENIDO:**
-   **TIPO DE NOTA:** Adapta la longitud y el contenido según sea "inicial" (informe completo) o "evolutivo" (solo cambios y estado actual).
-   **ANÁLISIS DE RIESGOS (RAM):** Analiza la medicación, alergias y tóxicos. En lugar de frases genéricas, sé específico. Si un paciente alérgico a AINEs toma Paracetamol, menciona que es una alternativa segura. Si un hábito (ej: tabaquismo) es un factor de riesgo relevante para el motivo de consulta, menciónalo.
-   **RECOMENDACIONES CLÍNICAS (RAZONADAS):** No te limites a repetir el plan. Basado en los datos, proporciona 2-3 recomendaciones que demuestren razonamiento clínico. Si el paciente tiene dolor en hipocondrio derecho, una recomendación podría ser "Valorar ecografía abdominal si la analítica no es concluyente".

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