import { GoogleGenAI } from '@google/genai'; // Requerirá instalar esta librería

// Inicializa el cliente. Si GEMINI_API_KEY está configurada en el entorno, 
// el SDK la detectará automáticamente.
const ai = new GoogleGenAI({});

export default async (req, res) => {
  try {
    const { incomingData } = req.body;

    // --- INICIO: CAPA DE SEGURIDAD Y VALIDACIÓN DE ENTRADA ---
    if (!incomingData || typeof incomingData !== 'object') {
      return res.status(400).json({ error: "Datos de entrada inválidos o ausentes." });
    }

    const { contexto } = incomingData;
    const contextosValidos = ['urgencias', 'planta', 'evolutivo'];

    if (!contexto || !contextosValidos.includes(contexto)) {
      return res.status(400).json({ error: `Contexto inválido. Debe ser uno de: ${contextosValidos.join(', ')}` });
    }
    // --- FIN: CAPA DE SEGURIDAD Y VALIDACIÓN DE ENTRADA ---

    // El SDK maneja la autenticación, pero verificamos que al menos la clave exista.
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("ERROR DE CONFIGURACIÓN: La variable de entorno GEMINI_API_KEY no está configurada.");
    }

    let masterPrompt;
    
    // --- Definición de Reglas ---
    const reglaDeOro = `
**REGLA DE ORO (LA MÁS IMPORTANTE):** NO INVENTES NINGÚN DATO CLÍNICO NI ESPECULES. Tu credibilidad depende de esto. Si un campo de entrada está vacío, simplemente OMÍTELO en el informe final. Es infinitamente preferible un informe corto y preciso que uno largo e inventado.
`;

    const reglaDeEstilo = `
**REGLAS DE ESTILO Y TONO:**
1.  **LENGUAJE PROFESIONAL:** Redacta el informe en un estilo narrativo y fluido, como lo haría un médico experimentado para una historia clínica oficial. Evita el estilo telegráfico o de lista.
2.  **EFICIENCIA:** Usa abreviaturas médicas comunes cuando sea apropiado (ej: 'BEG' para Buen Estado General, 'ACR' para Auscultación Cardiorrespiratoria, 'tto' para tratamiento, 'AP' para antecedentes personales, 'IQ' para intervenciones quirúrgicas).
3.  **OBJETIVIDAD:** Limítate estrictamente a la información proporcionada.
4.  **FORMATO LIMPIO:** No uses NUNCA formato Markdown (como ** o #) en tu respuesta. El resultado debe ser texto plano y limpio.
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
    // --- Fin Definición de Reglas ---

    // ... (El switch case para masterPrompt es idéntico al anterior) ...
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
1.  **Información Inicial y Motivo:** Empieza presentando al paciente y el motivo de ingreso.
2.  **Contexto del Paciente:** Sintetiza en un párrafo coherente las alergias y los antecedentes.
3.  **Evaluación Clínica:** Describe de forma narrativa los hallazgos de la exploración y los resultados de las pruebas.
4.  **Plan de Actuación:** Detalla el tratamiento, los cuidados de enfermería y la justificación de intervenciones.

A continuación se presentan los datos para generar el informe de INGRESO EN PLANTA en español:
---
${JSON.stringify(incomingData, null, 2)}
---
`;
        break;

      case 'evolutivo':
        masterPrompt = `
Actúa como un médico de planta redactando una nota de evolución concisa y profesional para una historia clínica. Tu tarea es transformar los siguientes puntos esquemáticos en un párrafo narrativo, fluido, coherente y en texto plano.
${reglaDeOro}
${reglaDeEstilo}
${reglaDeFormato}

**Integra la siguiente información en una única nota de evolución fluida:**

* **Estado General del Paciente:** ${incomingData['evo-resumen'] || 'No reportado.'}
* **Eventos Relevantes:** ${incomingData['evo-cambios'] || 'No reportado.'}
* **Plan a Seguir:** ${incomingData['evo-plan'] || 'No reportado.'}

---
**Ejemplo de cómo empezar:** "Paciente que evoluciona favorablemente, manteniéndose hemodinámicamente estable y afebril..."
---
`;
        break;

      default:
        masterPrompt = "Contexto no reconocido."; 
    }
    // ... (Fin del switch case) ...
    
    // 2. LOGGING PARA DEPURACIÓN
    console.log(`[DEBUG] Generando informe con contexto: ${contexto}`);

    // LLAMADA AL SDK OFICIAL (gemini-1.5-flash)
    const modelName = "gemini-1.5-flash"; 

    const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: masterPrompt }] }],
        config: {
            temperature: 0.2,
        },
    });

    // 4. VALIDACIÓN Y EXTRACCIÓN DE TEXTO
    const fullText = response?.text;

    if (!fullText) {
        // El SDK maneja los errores de forma diferente. Si no hay texto, verificamos los posibles motivos.
        let blockReason = 'razón desconocida.';
        if (response.candidates?.[0]?.finishReason) {
            blockReason = `Finalizó con la razón: ${response.candidates[0].finishReason}.`;
        }

        return res.status(500).json({
            error: `La generación del informe fue rechazada por la API (SDK). ${blockReason} Revise los datos de entrada.`
        });
    }

    // 5. PARSEO DEL TEXTO GENERADO
    const parts = fullText.split('---SEPARADOR---');
    const reportPart = parts[0] ? parts[0].trim() : "No se pudo generar el informe principal.";
    
    const recommendationsAndKeywords = parts[1] ? parts[1].split('---KEYWORDS---') : [];
    const recommendationsPart = recommendationsAndKeywords[0] ? recommendationsAndKeywords[0].trim() : "No se pudieron generar las recomendaciones.";
    const keywordsPart = recommendationsAndKeywords[1] ? recommendationsAndKeywords[1].trim() : "No se pudo generar el resumen (Keywords).";

    res.status(200).json({ 
        report: reportPart,
        recommendations: recommendationsPart,
        keywords: keywordsPart
    });

  } catch (error) {
    // 6. CAPTURA DE CUALQUIER OTRO ERROR INTERNO
    console.error("[ERROR CRÍTICO DEL SERVIDOR]", error);
    // IMPORTANTE: Devolvemos el mensaje exacto de la excepción para identificar la causa.
    res.status(500).json({ error: `Error interno al generar el informe. DETALLE: ${error.message}` });
  }
};
