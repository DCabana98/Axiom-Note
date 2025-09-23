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

    // DEBUG: Muestra las claves que llegan para verificar nombres de campos
    console.log("Claves recibidas en incomingData:", Object.keys(incomingData));

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    // --- INICIO: LÓGICA ROBUSTA DE EXTRACCIÓN DE DATOS ---
    const getField = (obj, keys) => {
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
          const value = String(obj[key]).trim();
          if (value.length > 0) return value;
        }
      }
      return null;
    };

    const resumenKeys = ['evo-resumen', 'resumen', 'estado_general'];
    const cambiosKeys = ['evo-cambios', 'cambios', 'eventos_relevantes'];
    const planKeys = ['evo-plan', 'plan', 'plan_a_seguir'];

    const resumen = getField(incomingData, resumenKeys);
    const cambios = getField(incomingData, cambiosKeys);
    const plan = getField(incomingData, planKeys);
    // --- FIN: LÓGICA ROBUSTA DE EXTRACCIÓN DE DATOS ---

    const reglaDeOro = `
NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. Si un campo está ausente, omítelo. Prefiere brevedad y precisión.
`;

    const reglaDeEstilo = `
REGLAS DE ESTILO Y TONO:
1. Lenguaje profesional, narrativo y fluido (como un médico experimentado).
2. Usa abreviaturas médicas comunes cuando corresponda (ej: BEG, ACR, tto).
3. Limítate estrictamente a la información proporcionada.
4. Texto plano: no uses formato Markdown (como ** o #).
`;

    const reglaDeFormato = `
INSTRUCCIÓN FINAL:
Genera SIEMPRE 3 bloques de texto separados:
1) Informe principal (debe contener, si existen: Estado general; Eventos relevantes; y un resumen del Plan).
---SEPARADOR---
2) Recomendaciones y plan a seguir (detallar los pasos prácticos y monitorización).
---KEYWORDS---
3) Lista de 5 a 7 palabras clave separadas por comas.
`;

    let masterPrompt = "";

    switch (contexto) {
      case 'urgencias':
      case 'planta':
        masterPrompt = `
Actúa como un médico experimentado (${contexto === 'urgencias' ? 'de urgencias' : 'internista'}). Transforma las siguientes notas en un informe narrativo y profesional en español.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

Datos para el informe de ${contexto.toUpperCase()}:
---
${JSON.stringify(incomingData, null, 2)}
---`;
        break;

      case 'evolutivo':
        let evoInfo = "";
        if (resumen) evoInfo += `Estado general del paciente: ${resumen}\n`;
        if (cambios) evoInfo += `Eventos relevantes: ${cambios}\n`;
        if (plan) evoInfo += `Plan a seguir: ${plan}\n`;
        
        masterPrompt = `
Actúa como un médico de planta redactando una NOTA DE EVOLUCIÓN concisa y profesional.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

IMPORTANTE: El INFORME PRINCIPAL debe integrar en un párrafo narrativo y fluido la siguiente información: ${evoInfo ? evoInfo.trim() : 'Revisa los datos adjuntos.'}
Si un campo no existe, NO lo menciones.

Información del paciente:
${evoInfo}
---
Ejemplo de inicio: "Paciente que evoluciona favorablemente, manteniéndose hemodinámicamente estable..."
---`;
        break;

      default:
        masterPrompt = "Contexto no reconocido.";
    }

    const modelName = "gemini-1.5-pro-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const generationConfig = { temperature: 0.2 };
    const requestBody = {
      contents: [{ parts: [{ text: masterPrompt }] }],
      generationConfig
    };

    const googleResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json().catch(() => ({}));
      return res.status(googleResponse.status).json({ error: `Error de la API de Google: ${googleResponse.statusText}`, details: errorData });
    }

    const data = await googleResponse.json();
    const fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // --- INICIO: PARSING ROBUSTO Y FALLBACKS ---
    const sepRegex = /---\s*SEPARADOR\s*---/i;
    const keyRegex = /---\s*KEYWORDS\s*---/i;

    let reportPart, recommendationsPart, keywordsPart;

    if (sepRegex.test(fullText)) {
      const [r, rest] = fullText.split(sepRegex);
      reportPart = r.trim();
      if (keyRegex.test(rest)) {
        const [rec, kw] = rest.split(keyRegex);
        recommendationsPart = rec.trim();
        keywordsPart = kw.trim();
      } else {
        recommendationsPart = rest.trim();
        keywordsPart = "No generadas";
      }
    } else {
      // Fallback si no hay separadores
      reportPart = fullText.trim();
      recommendationsPart = plan || "Revisar plan en nota principal.";
      keywordsPart = "No generadas";
    }
    // --- FIN: PARSING ROBUSTO Y FALLBACKS ---

    res.status(200).json({
      report: reportPart || "No se pudo generar el informe.",
      recommendations: recommendationsPart || "No se pudieron generar las recomendaciones.",
      keywords: keywordsPart || "No se pudieron generar las palabras clave."
    });

  } catch (error) {
    console.error("Error en la función del servidor:", error);
    res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
  }
};
