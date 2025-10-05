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

    // --- CLAVE API ---
    const apiKey = process.env.GOOGLE_API_KEY; 

    if (!apiKey) {
      throw new Error("La variable de entorno GOOGLE_API_KEY no está configurada.");
    }

    let masterPrompt;

    // Reglas de Prompt
    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. Tu credibilidad depende de esto. Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. Es infinitamente preferible un informe corto y preciso que uno largo e inventado.
`;

    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE PROFESIONAL:** Redacta el informe en un estilo narrativo y fluido, como lo haría un médico experimentado para una historia clínica oficial. Evita el estilo telegráfico o de lista.
2.  **EFICIENCIA:** Usa abreviaturas médicas comunes cuando sea apropiado (ej: 'BEG' para Buen Estado General, 'ACR' para Auscultación Cardiorrespiratoria, 'tto' para tratamiento, 'AP' para antecedentes personales, 'IQ' para intervenciones quirúrgicas).
3.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
4.  **FORMATO LIMPIO:** No uses NUNCA formato Markdown (como ** o #) en tu respuesta. El resultado debe ser texto plano y limpio.
`;

    const reglaDeFormato = `
**INSTRUCCIÓN FINAL MUY IMPORTANTE:**
Debes generar 3 bloques de texto separados.
1.  El informe principal.
2.  Las recomendaciones y el plan a seguir.
3.  Una lista de 5 a 7 palabras clave.

Separa el informe principal de las recomendaciones usando una única línea que contenga exactamente: ---SEPARADOR---
Después de las recomendaciones, añade OBLIGATORIAMENTE otra línea separadora que contenga: ---KEYWORDS---
`;

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
1.  **Información Inicial y Motivo:** Empieza presentando al paciente y el motivo de ingreso.
2.  **Contexto del Paciente:** Sintetiza en un párrafo coherente las alergias y los antecedentes.
3.  **Evaluación Clínica:** Describe de forma narrativa los hallazgos de la exploración y los resultados de las pruebas.
4.  **Plan de Actuación:** Detalla el tratamiento, los cuidados de enfermería y la justificación de intervenciones.

A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'evolutivo':
        const resumen = incomingData['evo-resumen'] || 'No reportado.';
        const cambios = incomingData['evo-cambios'] || 'No reportado.';
        const plan = incomingData['evo-plan'] || 'No reportado.';

        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa y profesional para una historia clínica. Tu tarea es transformar los siguientes puntos esquemáticos en un párrafo narrativo, fluido, coherente y en texto plano.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

**Integra la siguiente información en una única nota de evolución fluida:**

* **Estado General del Paciente:** ${resumen}
* **Eventos Relevantes:** ${cambios}
* **Plan a Seguir:** ${plan}

---
**Ejemplo de cómo empezar:** "Paciente que evoluciona favorablemente, manteniéndose hemodinámicamente estable y afebril..."
---
`;
        break;

      default:
        return res.status(400).json({ error: "Contexto no reconocido." });
    }

    const modelName = "gemini-1.5-flash-latest";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const generationConfig = {
      "temperature": 0.2,
    };

    const requestBody = {
      contents: [{ parts: [{ text: masterPrompt }] }],
      generationConfig: generationConfig
    };

    // USANDO EL FETCH GLOBAL
    const googleResponse = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

    if (!googleResponse.ok) {
      // Si la API de Google falla, devolvemos su error y estado
      const errorData = await googleResponse.json();
      console.error("Error de la API de Google:", errorData);
      return res.status(googleResponse.status).json({
        error: `Error de la API de Google: ${googleResponse.statusText}. Revisar logs para más detalles.`,
        details: errorData.error ? errorData.error.message : 'No se encontraron detalles.'
      });
    }

    const data = await googleResponse.json();

    // --- MEJORA DE ROBUSTEZ: Verifica la estructura antes de acceder
    const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!fullText) {
      // Si la respuesta es exitosa (200) pero no hay texto generado, es un fallo de contenido.
      console.error("Respuesta vacía o incompleta de la API:", data);
      return res.status(500).json({ error: "La API de Google no devolvió el texto esperado. Posiblemente el prompt fue bloqueado o no generó contenido." });
    }
    // --- FIN DE MEJORA DE ROBUSTEZ ---

    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0] ? parts[0].trim() : "No se pudo generar el informe (Error de formato).";

    const recommendationsAndKeywords = parts[1] ? parts[1].split('---KEYWORDS---') : [];
    const recommendationsPart = recommendationsAndKeywords[0] ? recommendationsAndKeywords[0].trim() : "No se pudieron generar las recomendaciones (Error de formato).";
    const keywordsPart = recommendationsAndKeywords[1] ? recommendationsAndKeywords[1].trim() : "No se pudo generar el resumen (Error de formato).";

    res.status(200).json({
      report: reportPart,
      recommendations: recommendationsPart,
      keywords: keywordsPart
    });

  } catch (error) {
    // Si cualquier otra cosa falla (network, parsing, etc.), se devuelve un 500 controlado.
    console.error("Error en la función del servidor:", error);
    
    // Si la clave no está configurada, devolvemos un mensaje específico
    if (error.message.includes("La variable de entorno GOOGLE_API_KEY no está configurada")) {
        res.status(500).json({ error: "Error de configuración: La clave API no está establecida en el servidor." });
    } else {
        res.status(500).json({ error: `Error interno en el servidor: ${error.message}` });
    }
  }
};
