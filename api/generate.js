import fetch from 'node-fetch';

export default async (req, res) => {
  try {
    const { incomingData } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    let masterPrompt;
    const contexto = incomingData.contexto;

    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. Tu credibilidad depende de esto. Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. Es infinitamente preferible un informe corto y preciso que uno largo e inventado.
`;

    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE PROFESIONAL:** Redacta el informe en un estilo narrativo y fluido, como lo haría un médico experimentado para una historia clínica oficial. Evita el estilo telegráfico o de lista.
2.  **EFICIENCIA:** Usa abreviaturas médicas comunes cuando sea apropiado (ej: 'BEG' para Buen Estado General, 'ACR' para Auscultación Cardiorrespiratoria, 'tto' para tratamiento, 'AP' para antecedentes personales, 'IQ' para intervenciones quirúrgicas).
3.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
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


    switch (contexto) {
      case 'urgencias':
        masterPrompt = `
Actúa como un médico de urgencias senior con más de 20 años de experiencia. Tu tarea es transformar las siguientes notas esquemáticas en un párrafo de ingreso narrativo, profesional y bien redactado para la historia clínica.
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
Actúa como un médico internista experimentado redactando un informe de ingreso en planta. El objetivo es crear un documento completo, bien estructurado y con una redacción fluida que sirva como base para toda la estancia hospitalaria, agrupando la información en párrafos lógicos.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

**ESTRUCTURA DEL INFORME (BASADO EN BLOQUES):**
1.  **Información Inicial y Motivo:** Empieza presentando al paciente y el motivo de ingreso.
2.  **Contexto del Paciente:** Sintetiza en un párrafo coherente las alergias y los antecedentes.
3.  **Evaluación Clínica:** Describe de forma narrativa los hallazgos de la exploración y los resultados de las pruebas.
4.  **Plan de Actuación:** Detalla el tratamiento, los cuidados de enfermería y la justificación de intervenciones.

A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'evolutivo':
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa y profesional. Transforma los siguientes puntos en un párrafo narrativo.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}
A continuación se presentan los datos para generar el EVOLUTIVO DE PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      default:
        masterPrompt = "Contexto no reconocido.";
    }
    
    const modelName = "gemini-1.5-pro-latest";
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
    console.error("Error en la función del servidor:", error);
    res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
  }
};

