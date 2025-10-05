import { GoogleGenerativeAI } from "@google/generative-ai";

export default async (req, res) => {
  try {
    const { incomingData } = req.body;

    // --- VALIDACIÓN DE ENTRADA ---
    if (!incomingData || typeof incomingData !== "object") {
      return res.status(400).json({ error: "Datos de entrada inválidos o ausentes." });
    }

    const { contexto } = incomingData;
    const contextosValidos = ["urgencias", "planta", "evolutivo"];

    if (!contexto || !contextosValidos.includes(contexto)) {
      return res
        .status(400)
        .json({ error: `Contexto inválido. Debe ser uno de: ${contextosValidos.join(", ")}` });
    }

    // --- CONFIGURACIÓN GEMINI ---
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("La variable GOOGLE_API_KEY no está configurada en Vercel.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // --- PROMPT ---
    const reglaDeOro = `
**REGLA DE ORO:** NO INVENTES NINGÚN DATO CLÍNICO. Si un campo está vacío, omítelo.`;
    const reglaDeEstilo = `
**REGLAS DE ESTILO:**
1. Lenguaje profesional, narrativo.
2. Usa abreviaturas médicas comunes.
3. Sé objetivo y evita formato Markdown.`;
    const reglaDeFormato = `
**FORMATO FINAL:**
1. Informe principal.
2. Recomendaciones.
3. Palabras clave (5-7).
Usa separadores:
---SEPARADOR---
---KEYWORDS---`;

    let masterPrompt;

    switch (contexto) {
      case "urgencias":
        masterPrompt = `
Actúa como un médico de urgencias experimentado. 
Redacta un informe profesional en texto plano.

${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

Datos del paciente:
${JSON.stringify(incomingData, null, 2)}
`;
        break;

      case "planta":
        masterPrompt = `
Actúa como un internista redactando un informe de ingreso en planta.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

Datos del paciente:
${JSON.stringify(incomingData, null, 2)}
`;
        break;

      case "evolutivo":
        const resumen = incomingData["evo-resumen"] || "No reportado.";
        const cambios = incomingData["evo-cambios"] || "No reportado.";
        const plan = incomingData["evo-plan"] || "No reportado.";
        masterPrompt = `
Actúa como un médico redactando una nota de evolución breve y profesional.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

Estado: ${resumen}
Cambios: ${cambios}
Plan: ${plan}
`;
        break;
    }

    // --- GENERAR TEXTO ---
    const result = await model.generateContent(masterPrompt);
    const text = result.response.text();

    // --- PARSEAR RESPUESTA ---
    const parts = text.split("---SEPARADOR---");
    const report = parts[0]?.trim() || "No se pudo generar el informe.";
    const recommendationsAndKeywords = parts[1]?.split("---KEYWORDS---") || [];
    const recommendations = recommendationsAndKeywords[0]?.trim() || "No se generaron recomendaciones.";
    const keywords = recommendationsAndKeywords[1]?.trim() || "Sin palabras clave.";

    res.status(200).json({
      report,
      recommendations,
      keywords,
    });
  } catch (error) {
    console.error("❌ Error en generate.js:", error);
    res.status(500).json({ error: `Error interno: ${error.message}` });
  }
};
