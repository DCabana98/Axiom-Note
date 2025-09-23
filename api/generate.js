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
NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. 
Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. 
Es preferible un informe corto y preciso que uno largo e inventado.
`;

    const reglaDeEstilo = `
REGLAS DE ESTILO Y TONO:
1.  LENGUAJE PROFESIONAL: redacta el informe en estilo narrativo y fluido, como un médico experimentado. 
2.  EFICIENCIA: usa abreviaturas médicas comunes cuando corresponda (ej: BEG, ACR, tto, AP, IQ).
3.  OBJETIVIDAD: limita el informe estrictamente a la información proporcionada.
4.  FORMATO LIMPIO: no uses formato Markdown ni símbolos especiales. Solo texto plano.
`;

    const reglaDeFormato = `
INSTRUCCIÓN FINAL:
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
Transforma las siguientes notas esquemáticas en un informe narrativo y profesional en español.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

Datos para el informe de URGENCIAS:
---
${JSON.stringify(incomingData, null, 2)}
---`;
        break;

      case 'planta':
        masterPrompt = `
Actúa como un médico internista experimentado redactando un informe de ingreso en planta. 
Crea un documento completo, estructurado y con redacción fluida en español.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

ESTRUCTURA DEL INFORME:
1. Información inicial y motivo de ingreso.
2. Contexto del paciente: alergias y antecedentes.
3. Evaluación clínica: exploración y resultados.
4. Plan de actuación: tratamiento, cuidados y justificación.

Datos para el informe de INGRESO EN PLANTA:
---
${JSON.stringify(incomingData, null, 2)}
---`;
        break;

      case 'evolutivo':
        // Construir texto dinámicamente
        let evoInfo = "";
        if (incomingData['evo-resumen']) {
          evoInfo += `Estado general del paciente: ${incomingData['evo-resumen']}\n`;
        }
        if (incomingData['evo-cambios']) {
          evoInfo += `Eventos relevantes: ${incomingData['evo-cambios']}\n`;
        }
        if (incomingData['evo-plan']) {
          evoInfo += `Plan a seguir: ${incomingData['evo-plan']}\n`;
        }

        masterPrompt = `
Actúa como un médico de planta redactando una NOTA DE EVOLUCIÓN concisa y profesional para la historia clínica. 
Tu tarea es transformar la información disponible en un texto narrativo y coherente en español.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

IMPORTANTE: Usa TODA la información disponible (estado general, eventos relevantes y plan), reorganizándola de manera lógica y fluida. 
Si alguno de los campos está vacío, simplemente no lo incluyas.

Información del paciente:
${evoInfo}

---
Ejemplo de inicio: "Paciente que evoluciona favorablemente, manteniéndose hemodinámicamente estable..."
---`;
        break;

      default:
        masterPrompt = "Contexto no reconocido.";
    }

    // --- Configuración del modelo ---
    const modelName = "gemini-1.5-pro-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const generationConfig = { temperature: 0.2 };

    const requestBody = { 
      contents: [{ parts: [{ text: masterPrompt }] }],
      generationConfig
    };

    // --- Llamada a la API ---
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

  } catch (error) {
    console.error("Error en la función del servidor:", error);
    res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
  }
};
