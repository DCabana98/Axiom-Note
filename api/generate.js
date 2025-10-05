export default async (req, res) => {
  try {
    const { incomingData } = req.body;

    if (!incomingData || typeof incomingData !== 'object') {
      return res.status(400).json({ error: "Datos de entrada inválidos o ausentes." });
    }

    const { contexto } = incomingData;
    const contextosValidos = ['urgencias', 'planta', 'evolutivo'];

    if (!contexto || !contextosValidos.includes(contexto)) {
      return res.status(400).json({ error: `Contexto inválido. Debe ser uno de: ${contextosValidos.join(', ')}` });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");

    const reglaDeOro = `
**REGLA DE ORO:** No inventes datos clínicos. Si un campo está vacío, omítelo.
`;
    const reglaDeEstilo = `
**REGLAS DE ESTILO:** Redacción profesional, objetiva, sin Markdown.
`;
    const reglaDeFormato = `
**FORMATO:** Separa con ---SEPARADOR--- y ---KEYWORDS---
`;

    let masterPrompt = '';
    if (contexto === 'urgencias') {
      masterPrompt = `
Actúa como médico de urgencias.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
${JSON.stringify(incomingData, null, 2)}
`;
    } else if (contexto === 'planta') {
      masterPrompt = `
Actúa como médico internista.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
${JSON.stringify(incomingData, null, 2)}
`;
    } else if (contexto === 'evolutivo') {
      const resumen = incomingData['evo-resumen'] || 'No reportado.';
      const cambios = incomingData['evo-cambios'] || 'No reportado.';
      const plan = incomingData['evo-plan'] || 'No reportado.';
      masterPrompt = `
Actúa como médico de planta redactando nota de evolución.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
* Estado General: ${resumen}
* Eventos Relevantes: ${cambios}
* Plan: ${plan}
`;
    }

    let modelName = "gemini-1.5-flash-latest";
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const requestBody = { contents: [{ parts: [{ text: masterPrompt }] }], generationConfig: { temperature: 0.2 } };

    console.log("📡 Solicitando modelo:", modelName);
    let googleResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

    if (!googleResponse.ok) {
      const errorData = await googleResponse.json().catch(() => ({}));
      console.warn("⚠️ gemini-1.5-flash falló, intentando gemini-pro...", errorData);

      modelName = "gemini-pro";
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      googleResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

      if (!googleResponse.ok) {
        const finalError = await googleResponse.json().catch(() => ({}));
        console.error("❌ Error final de la API de Google:", finalError);
        return res.status(500).json({ error: "Error de la API de Google.", detalles: finalError });
      }
    }

    const data = await googleResponse.json();
    const fullText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parts = fullText.split('---SEPARADOR---');
    const report = parts[0]?.trim() || "No se pudo generar el informe.";
    const [recom, keywords] = (parts[1]?.split('---KEYWORDS---') || []).map(s => s?.trim() || "");

    res.status(200).json({ report, recommendations: recom, keywords });

  } catch (error) {
    console.error("💥 Error en la función API /generate:", error);
    res.status(500).json({ error: error.message });
  }
};
