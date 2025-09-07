const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const { incomingData } = JSON.parse(event.body);
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Netlify.");
    }

    // --- NUEVO MEGA-PROMPT SOFISTICADO ---
    let masterPrompt = `
Actúa como un experto clínico (médico o enfermero/a) con más de 15 años de experiencia, especializado en la redacción de informes de evolución para historias clínicas. Tu tarea es generar un informe claro, conciso y profesional a partir de los datos proporcionados.

**REGLAS GENERALES:**
1.  **CONCISIÓN MÁXIMA:** Usa frases cortas y terminología médica precisa. Evita palabras de relleno. El objetivo es transmitir la máxima información con el mínimo texto.
2.  **OBJETIVIDAD:** Limítate a la información proporcionada. No inventes ni especules con datos no presentes.
3.  **ESTRUCTURA:** Sigue el orden de los patrones dados.

**INSTRUCCIONES ESPECÍFICAS SEGÚN EL TIPO DE NOTA:**
-   **Si el "tipo_nota" es "inicial":** Crea un informe de ingreso completo. Incluye al principio una sección con los datos del paciente (edad, sexo, alergias, motivo de ingreso).
-   **Si el "tipo_nota" es "evolutivo":** Crea una nota de evolución corta. NO repitas los datos del paciente del inicio (edad, sexo, etc.). Céntrate solo en los cambios y el estado actual de los patrones.

**SECCIONES ESPECIALES (AÑADIR SIEMPRE AL FINAL):**
1.  **INTERACCIONES Y RIESGOS (RAM):** Basado en la "medicacion_cronica", el "tratamiento_actual" y el "consumo_toxicos", analiza y menciona de forma explícita cualquier posible interacción farmacológica de riesgo o Reacción Adversa a Medicamentos (RAM) relevante. Si no detectas ninguna, indica "No se aprecian interacciones de riesgo inmediato".
2.  **RECOMENDACIONES CLÍNICAS:** Basado en todos los datos, proporciona 2-3 recomendaciones o sugerencias de actuación (ej: "Vigilar diuresis", "Monitorizar constantes cada 8h", "Valorar interconsulta con Cardiología").

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