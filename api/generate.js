import fetch from 'node-fetch';

export default async (req, res) => {
  try {
    const { incomingData } = req.body;

    // --- INICIO: CAPA DE SEGURIDAD Y VALIDACIÓN DE ENTRADA ---
    if (!incomingData || typeof incomingData !== 'object') {
      return res.status(400).json({ error: "Datos de entrada inválidos o ausentes." });
    }

    const { contexto } = incomingData;
    const contextosValidos = ['urgencias', 'planta', 'evolutivo'];

    if (!contexto || !contextosValidos.includes(contexto)) {
      return res.status(400).json({ error: `Contexto inválido. Debe ser uno de: ${contextosValidos.join(', ')}` });
    }
    // --- FIN: CAPA DE SEGURIDAD Y VALIDACIÓN DE ENTRADA ---

    // 1. VERIFICACIÓN CRÍTICA DE LA API KEY
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      // Si la clave no existe, lanzamos este error. Este error será capturado por el catch final.
      throw new Error("ERROR DE CONFIGURACIÓN: La variable de entorno GEMINI_API_KEY no está configurada. Revise su .env o el panel de variables del servidor.");
    }

    let masterPrompt;
    
    // --- Definición de Reglas ---
    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. Tu credibilidad depende de esto. Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. Es infinitamente preferible un informe corto y preciso que uno largo e inventado.
`;

    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE PROFESIONAL:** Redacta el informe en un estilo narrativo y fluido, como lo haría un médico experimentado para una historia clínica oficial. Evita el estilo telegráfico o de lista.
2.  **EFICIENCIA:** Usa abreviaturas médicas comunes cuando sea apropiado (ej: 'BEG' para Buen Estado General, 'ACR' para Auscultación Cardiorrespiratoria, 'tto' para tratamiento, 'AP' para antecedentes personales, 'IQ' para intervenciones quirúrgicas).
3.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
4.  **FORMATO LIMPIO:** No uses NUNCA formato Markdown (como ** o #) en tu respuesta. El resultado debe ser texto plano y limpio.
`;

    const reglaDeFormato = `
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Debes generar 3 bloques de texto separados.
1.  El informe principal.
2.  Las recomendaciones y el plan a seguir.
3.  Una lista de 5 a 7 palabras clave.

Separa el informe principal de las recomendaciones usando una única línea que contenga exactamente: ---SEPARADOR---
Después de las recomendaciones, añade OBLIGATORIAMENTE otra línea separadora que contenga: ---KEYWORDS---
`;
    // --- Fin Definición de Reglas ---


    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior con más de 20 años de experiencia. Tu tarea es transformar las siguientes notas esquemáticas en un informe de urgencias narrativo, profesional y bien redactado para la historia clínica, con un estilo de texto plano y limpio.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
A continuación se presentan los datos para generar el informe de URGENCIAS en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'planta':
        masterPrompt = `
Actúa como un médico internista experimentado redactando un informe de ingreso en planta. El objetivo es crear un documento completo, bien estructurado y con una redacción fluida que sirva como base para toda la estancia hospitalaria, agrupando la información en párrafos lógicos y en texto plano.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

**ESTRUCTURA DEL INFORME (BASADO EN BLOQUES):**
1.  **Información Inicial y Motivo:** Empieza presentando al paciente y el motivo de ingreso.
2.  **Contexto del Paciente:** Sintetiza en un párrafo coherente las alergias y los antecedentes.
3.  **Evaluación Clínica:** Describe de forma narrativa los hallazgos de la exploración y los resultados de las pruebas.
4.  **Plan de Actuación:** Detalla el tratamiento, los cuidados de enfermería y la justificación de intervenciones.

A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'evolutivo':
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa y profesional para una historia clínica. Tu tarea es transformar los siguientes puntos esquemáticos en un párrafo narrativo, fluido, coherente y en texto plano.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

**Integra la siguiente información en una única nota de evolución fluida:**

* **Estado General del Paciente:** ${incomingData['evo-resumen'] || 'No reportado.'}
* **Eventos Relevantes:** ${incomingData['evo-cambios'] || 'No reportado.'}
* **Plan a Seguir:** ${incomingData['evo-plan'] || 'No reportado.'}

---
**Ejemplo de cómo empezar:** "Paciente que evoluciona favorablemente, manteniéndose hemodinámicamente estable y afebril..."
---
`;
        break;

      default:
        // Este caso ya se maneja con la validación de contexto al inicio, pero por si acaso.
        masterPrompt = "Contexto no reconocido."; 
    }
    
    // 2. LOGGING PARA DEPURACIÓN
    console.log(`[DEBUG] Generando informe con contexto: ${contexto}`);
    // console.log(`[DEBUG] Prompt Master: ${masterPrompt.substring(0, 500)}...`); // Imprime solo los primeros 500 caracteres del prompt

    const modelName = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`; 

    const generationConfig = {
      "temperature": 0.2, // Mantener baja para un informe médico objetivo
    };

    const requestBody = { 
      contents: [{ parts: [{ text: masterPrompt }] }],
      generationConfig: generationConfig 
    };

    const googleResponse = await fetch(apiUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(requestBody) 
    });

    if (!googleResponse.ok) {
      // 3. MANEJO DE ERRORES DE LA API DE GOOGLE (4xx, 5xx)
      const errorData = await googleResponse.json();
      const detailedMessage = errorData.error?.message || googleResponse.statusText;
      
      return res.status(googleResponse.status).json({ 
          error: `Error de la API de Google (${googleResponse.status}): ${detailedMessage}` 
      });
    }

    const data = await googleResponse.json();
    
    // 4. VALIDACIÓN DE RESPUESTA DE GEMINI (Contenido Bloqueado/Vacío)
    const candidate = data.candidates?.[0];
    const fullText = candidate?.content?.parts?.[0]?.text;

    if (!fullText) {
        let blockReason = 'razón desconocida.';
        if (candidate?.finishReason) {
            blockReason = `Finalizó con la razón: ${candidate.finishReason}.`;
        } else if (data.promptFeedback?.blockReason) {
            blockReason = `Bloqueado por filtro de seguridad: ${data.promptFeedback.blockReason}.`;
        }

        return res.status(500).json({
            error: `La generación del informe fue rechazada por la API. ${blockReason} Revise los datos de entrada.`
        });
    }

    // 5. PARSEO DEL TEXTO GENERADO
    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0] ? parts[0].trim() : "No se pudo generar el informe principal.";
    
    const recommendationsAndKeywords = parts[1] ? parts[1].split('---KEYWORDS---') : [];
    const recommendationsPart = recommendationsAndKeywords[0] ? recommendationsAndKeywords[0].trim() : "No se pudieron generar las recomendaciones.";
    const keywordsPart = recommendationsAndKeywords[1] ? recommendationsAndKeywords[1].trim() : "No se pudo generar el resumen (Keywords).";

    res.status(200).json({ 
        report: reportPart,
        recommendations: recommendationsPart,
        keywords: keywordsPart
    });

  } catch (error) {
    // 6. CAPTURA DE CUALQUIER OTRO ERROR INTERNO (Errores síncronos, errores de red, etc.)
    console.error("[ERROR CRÍTICO DEL SERVIDOR]", error);
    // IMPORTANTE: Devolvemos el mensaje exacto de la excepción para identificar la causa.
    res.status(500).json({ error: `Error interno al generar el informe. DETALLE: ${error.message}` });
  }
};
