import fetch from 'node-fetch';

export default async (req, res) => {
  try {
    const { incomingData } = req.body;

    // --- CAPA DE SEGURIDAD ---
    if (!incomingData || typeof incomingData !== 'object') {
      return res.status(400).json({ error: "Datos de entrada inválidos o ausentes." });
    }

    const { contexto } = incomingData;
    const contextosValidos = ['urgencias', 'planta', 'evolutivo'];

    if (!contexto || !contextosValidos.includes(contexto)) {
      return res.status(400).json({ error: `Contexto inválido. Debe ser uno de: ${contextosValidos.join(', ')}` });
    }

    // --- CLAVE DE GOOGLE ---
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    // --- BLOQUES DE REGLAS ---
    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. 
Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final.
`;

    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE PROFESIONAL:** Redacta el informe en un estilo narrativo y fluido.
2.  **EFICIENCIA:** Usa abreviaturas médicas comunes (ej: BEG, ACR, AP, IQ...).
3.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
4.  **FORMATO LIMPIO:** No uses Markdown ni símbolos especiales.
`;

    const reglaDeFormato = `
**INSTRUCCIÓN FINAL:**
Genera 3 bloques:
1. Informe principal
2. Recomendaciones
3. Palabras clave (5 a 7)
Separa con:
---SEPARADOR---
---KEYWORDS---
`;

    // --- PROMPT SEGÚN CONTEXTO ---
    let masterPrompt;
    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
Datos para generar el informe de URGENCIAS:
${JSON.stringify(incomingData, null, 2)}
`;
        break;

      case 'planta':
        masterPrompt = `
Actúa como un médico internista redactando un informe de ingreso en planta.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
Datos para generar el informe de PLANTA:
${JSON.stringify(incomingData, null, 2)}
`;
        break;

      case 'evolutivo':
        const resumen = incomingData['evo-resumen'] || 'No reportado.';
        const cambios = incomingData['evo-cambios'] || 'No reportado.';
        const plan = incomingData['evo-plan'] || 'No reportado.';
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución clínica.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
* Estado General: ${resumen}
* Eventos Relevantes: ${cambios}
* Plan: ${plan}
`;
        break;

      default:
        masterPrompt = "Contexto no reconocido.";
    }

    // --- DETECCIÓN AUTOMÁTICA DEL MODELO DISPONIBLE ---
    let modelName = "gemini-1.5-flash-latest";
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: masterPrompt }] }],
      generationConfig: { temperature: 0.2 },
    };

    // --- Primer intento con modelo avanzado ---
    let googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // Si falla, intenta con gemini-pro
    if (!googleResponse.ok) {
      const errorData = await googleResponse.json().catch(() => ({}));
      console.warn("⚠️ Error con gemini-1.5-flash, intentando con gemini-pro...", errorData);

      modelName = "gemini-pro";
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      googleResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!googleResponse.ok) {
        const finalError = await googleResponse.json().catch(() => ({}));
        console.error("❌ Error final de la API de Google:", finalError);
        return res.status(500).json({
          error: "Error de la API de Google (ningún modelo disponible).",
          detalles: finalError,
        });
      }
    }

    // --- PROCESAR RESPUESTA ---
    const data = await googleResponse.json();
    const fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0]?.trim() || "No se pudo generar el informe.";

    const recommendationsAndKeywords = parts[1]?.split('---KEYWORDS---') || [];
    const recommendationsPart = recommendationsAndKeywords[0]?.trim() || "No se pudieron generar las recomendaciones.";
    const keywordsPart = recommendationsAndKeywords[1]?.trim() || "No se pudieron generar las palabras clave.";

    // --- RESPUESTA FINAL ---
    res.status(200).json({
      report: reportPart,
      recommendations: recommendationsPart,
      keywords: keywordsPart,
    });

  } catch (error) {
    console.error("💥 Error en el servidor:", error);
    res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
  }
};
