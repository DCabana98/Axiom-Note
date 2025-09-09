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

    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior con más de 20 años de experiencia. Tu tarea es redactar una nota de ingreso desde urgencias, que sea un modelo de claridad, eficiencia y rigor clínico.
**REGLAS:**
1.  **ESTILO:** Redacta en párrafos fluidos y coherentes. Usa un lenguaje activo y profesional. Evita el estilo telegráfico.
2.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
3.  **SEPARACIÓN:** Separa el informe principal de las recomendaciones usando una única línea que contenga exactamente: ---SEPARADOR---
Después del bloque de recomendaciones, añade otra línea separadora que contenga: ---KEYWORDS--- y a continuación una lista de 5-7 palabras clave que resuman el caso.

**ESTRUCTURA DEL INFORME (BLOQUE 1):**
- Inicia con una presentación del paciente (edad, sexo, alergias).
- Describe el motivo de consulta, la historia actual y los antecedentes relevantes.
- Detalla la exploración física y los resultados de las pruebas realizadas.
- Finaliza con la sospecha diagnóstica y el plan inmediato ejecutado.
**ESTRUCTURA DE RECOMENDACIONES (BLOQUE 2):**
- Analiza posibles interacciones o RAMs.
- Proporciona 2-3 recomendaciones clínicas razonadas (ej: "Valorar interconsulta con...", "Monitorizar...").

A continuación se presentan los datos para generar el informe de URGENCIAS:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'planta':
        masterPrompt = `
Actúa como un médico internista experimentado que está redactando un informe de ingreso en planta. El objetivo es crear un documento completo, bien estructurado y con una redacción fluida que sirva como base para toda la estancia hospitalaria.
**REGLAS:**
1.  **ESTILO:** Redacta en párrafos coherentes y profesionales, conectando las ideas. Usa terminología médica estándar.
2.  **OBJETIVIDAD:** Basa el informe estrictamente en los datos proporcionados.
3.  **SEPARACIÓN:** Separa el informe principal de las recomendaciones usando una única línea que contenga exactamente: ---SEPARADOR---
Después del bloque de recomendaciones, añade otra línea separadora que contenga: ---KEYWORDS--- y a continuación una lista de 5-7 palabras clave que resuman el ingreso.

**ESTRUCTURA DEL INFORME (BLOQUE 1):**
- Inicia con el "Resumen del Caso y Motivo de Ingreso".
- Detalla los "Antecedentes Personales" y la "Medicación Domiciliaria".
- Describe de forma narrativa la "Exploración Física" y los resultados de las "Pruebas Complementarias".
- Establece claramente el "Diagnóstico Principal de Ingreso".
**ESTRUCTURA DE RECOMENDACIONES (BLOQUE 2):**
- Describe el "Plan de Tratamiento Inicial en Planta".
- Detalla el "Plan de Cuidados de Enfermería".
- Analiza posibles interacciones o RAMs relevantes.
- Proporciona 2-3 recomendaciones clínicas adicionales si lo consideras necesario.

A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'evolutivo':
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa.
**REGLAS:**
1.  **ESTILO:** Redacta un único párrafo fluido y profesional. Sé directo.
2.  **CONTENIDO:** Describe el estado actual, los eventos relevantes y el plan a seguir. NO incluyas datos demográficos del paciente (nombre, edad, etc.).
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Separa el informe principal (BLOQUE 1) de las recomendaciones (BLOQUE 2) usando una única línea que contenga: ---SEPARADOR---
Después del BLOQUE 2, añade otra línea separadora que contenga: ---KEYWORDS--- y a continuación una lista de 5-7 palabras clave que resuman la evolución actual.

A continuación se presentan los datos para generar el EVOLUTIVO EN PLANTA:
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
      console.error('Error de la API de Google:', errorData);
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