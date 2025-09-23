import fetch from 'node-fetch';

export default async (req, res) => {
  try {
    const { incomingData } = req.body;

    // --- INICIO: CAPA DE SEGURIDAD ---
    if (!incomingData || typeof incomingData !== 'object') {
      return res.status(400).json({ error: "Datos de entrada inválidos o ausentes." });
    }
    const { contexto } = incomingData;
    const contextosValidos = ['urgencias', 'planta', 'evolutivo'];
    if (!contexto || !contextosValidos.includes(contexto)) {
      return res.status(400).json({ error: `Contexto inválido. Debe ser uno de: ${contextosValidos.join(', ')}` });
    }
    // --- FIN: CAPA DE SEGURIDAD ---

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    let masterPrompt;
    
    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. 
Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. 
Es preferible un informe corto y preciso que uno largo e inventado.
`;

    // --- INICIO: REGLA DE ESTILO MODIFICADA ---
    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE PROFESIONAL:** Redacta el informe en un estilo narrativo y fluido, como lo haría un médico experimentado. 
2.  **EFICIENCIA:** Usa abreviaturas médicas comunes cuando corresponda (ej: BEG, ACR, tto, AP, IQ).
3.  **OBJETIVIDAD:** Limita el informe estrictamente a la información proporcionada.
4.  **FORMATO LIMPIO:** No uses NUNCA formato Markdown (como ** o #) en tu respuesta. El resultado debe ser texto plano y limpio.
`;
    // --- FIN: REGLA DE ESTILO MODIFICADA ---

    const reglaDeFormato = `
**INSTRUCCIÓN FINAL:**
Debes generar SIEMPRE 3 bloques de texto separados:
1. Informe principal.
2. Recomendaciones y plan a seguir.
3. Una lista de 5 a 7 palabras clave.

Separa el informe principal de las recomendaciones con:
---SEPARADOR---
Después de las recomendaciones, añade otra línea que contenga:
---KEYWORDS---
`;

    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior con más de 20 años de experiencia. 
Transforma las siguientes notas esquemáticas en un informe de urgencias narrativo, profesional y bien redactado para la historia clínica, con un estilo de texto plano y limpio.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
A continuación se presentan los datos para generar el informe de URGENCIAS en español:
---
${JSON.stringify(incomingData, null, 2)}
---`;
        break;

      case 'planta':
        masterPrompt = `
Actúa como un médico internista experimentado redactando un informe de ingreso en planta. 
El objetivo es crear un documento completo, bien estructurado y con una redacción fluida que sirva como base para toda la estancia hospitalaria, agrupando la información en párrafos lógicos y en texto plano.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

**ESTRUCTURA DEL INFORME (BASADO EN BLOQUES):**
1.  Información Inicial y Motivo: Empieza presentando al paciente y el motivo de ingreso.
2.  Contexto del Paciente: Sintetiza en un párrafo coherente las alergias y los antecedentes.
3.  Evaluación Clínica: Describe de forma narrativa los hallazgos de la exploración y los resultados de las pruebas.
4.  Plan de Actuación: Detalla el tratamiento, los cuidados de enfermería y la justificación de intervenciones.

A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---`;
        break;

      case 'evolutivo':
        const subjetivoObjetivo = incomingData['evo-subjetivo-objetivo'] || 'Sin datos.';
        const analisis = incomingData['evo-analisis'] || 'Sin datos.';
        const plan = incomingData['evo-plan'] || 'Sin datos.';

        masterPrompt = `
Actúa como un médico de planta que redacta una NOTA DE EVOLUCIÓN concisa y profesional en formato SOAP.
Tu tarea es tomar los siguientes datos y redactar cada sección de forma narrativa, profesional y fluida en español.
El informe principal debe ser un único párrafo que integre la información de las 3 secciones (S/O, A y P).
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

Redacta la nota de evolución integrando la siguiente información en las secciones correspondientes del formato SOAP:

S/O (Datos Subjetivos y Objetivos):
${subjetivoObjetivo}

A (Análisis de la Evolución):
${analisis}

P (Plan a Seguir):
${plan}
`;
        break;

      default:
        masterPrompt = "Contexto no reconocido.";
    }
    
    const modelName = "gemini-1.5-pro-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // --- INICIO: CONFIGURACIÓN DE CONSISTENCIA (TEMPERATURA) ---
    const generationConfig = {
      "temperature": 0.2,
    };

    const requestBody = { 
      contents: [{ parts: [{ text: masterPrompt }] }],
      generationConfig: generationConfig // <-- Se añade la nueva configuración aquí
    };
    // --- FIN: CONFIGURACIÓN DE CONSISTENCIA ---

    const googleResponse = await fetch(apiUrl, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(requestBody) 
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      res.status(googleResponse.status).json({ error: `Error de la API de Google: ${googleResponse.statusText}`, details: errorData });
      return;
    }

    const data = await googleResponse.json();
    const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // --- Parsing de la respuesta ---
    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0]?.trim() || "No se pudo generar el informe.";
    
    const recommendationsAndKeywords = parts[1] ? parts[1].split('---KEYWORDS---') : [];
    const recommendationsPart = recommendationsAndKeywords[0]?.trim() || "No se pudieron generar las recomendaciones.";
    const keywordsPart = recommendationsAndKeywords[1]?.trim() || "No se pudo generar el resumen.";

    res.status(200).json({ 
      report: reportPart,
      recommendations: recommendationsPart,
      keywords: keywordsPart
    });

  } catch (error)