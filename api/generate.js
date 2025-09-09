import fetch from 'node-fetch';

export default async (req, res) => {
  try {
    const { incomingData } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada en Vercel.");
    }

    let masterPrompt;
    const contexto = incomingData.contexto;

    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. Tu credibilidad depende de esto. Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. Es infinitamente preferible un informe corto y preciso que uno largo e inventado.
`;

    // ##### NUEVA REGLA DE ESTILO PARA EFICIENCIA #####
    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **EFICIENCIA:** Usa abreviaturas médicas comunes cuando sea apropiado (ej: 'BEG' para Buen Estado General, 'ACR' para Auscultación Cardiorrespiratoria, 'tto' para tratamiento, 'AP' para antecedentes personales, 'IQ' para intervenciones quirúrgicas).
2.  **CLARIDAD Y FLUIDEZ:** Redacta en párrafos coherentes y profesionales. Evita el estilo telegráfico.
3.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
`;

    // ##### NUEVA REGLA DE FORMATO MÁS ESTRICTA #####
    const reglaDeFormato = `
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Debes generar 3 bloques de texto separados. Primero el informe, luego las recomendaciones y finalmente las palabras clave.
1.  Separa el informe principal de las recomendaciones usando una única línea que contenga exactamente: ---SEPARADOR---
2.  Después de las recomendaciones, añade OBLIGATORIAMENTE otra línea separadora que contenga: ---KEYWORDS---
3.  Después de ---KEYWORDS---, escribe una lista de 5 a 7 palabras clave separadas por comas.
`;


    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior con más de 20 años de experiencia. Tu tarea es redactar una nota de ingreso desde urgencias.
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
Actúa como un médico internista experimentado que está redactando un informe de ingreso en planta.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'evolutivo':
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
A continuación se presentan los datos para generar el EVOLUTIVO EN PLANTA en español:
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
    const googleResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json();
      res.status(googleResponse.status).json({ error: `Error de la API de Google: ${googleResponse.statusText}` });
      return;
    }

    const data = await googleResponse.json();
    const fullText = data.candidates[0].content.parts[0].text;

    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0] ? parts[0].trim() : "No se pudo generar el informe.";
    
    const recommendationsAndKeywords = parts[1] ? parts[1].split('---KEYWORDS---') : [];
    const recommendationsPart = recommendationsAndKeywords[0] ? recommendationsAndKeywords[0].trim() : "No se pudieron generar las recomendaciones.";
    const keywordsPart = recommendationsAndKeywords[1] ? recommendationsAndKeywords[1].trim() : "No se pudo generar el resumen.";

    res.status(200).json({ 
        report: reportPart,
        recommendations: recommendationsPart,
        keywords: keywordsPart
    });

  } catch (error) {
    console.error("Error en la función de Vercel:", error);
    res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
  }
};