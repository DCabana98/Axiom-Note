import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

if (!process.env.GEMINI_API_KEY) {
  throw new Error("La variable de entorno GEMINI_API_KEY no está definida.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/generate', async (req, res) => {
  try {
    const { incomingData } = req.body;
    if (!incomingData) {
      return res.status(400).json({ error: "No se recibieron datos." });
    }
    
    const patientData = {};
    for (const key in incomingData) {
      const cleanKey = key.replace(/^(urg-|planta-|evo-)/, '');
      patientData[cleanKey] = incomingData[key];
    }
    
    console.log('✅ Datos limpios enviados a la IA:', patientData);

    const prompt = `
      Actúa como un Jefe de Servicio de Medicina Interna con 25 años de experiencia clínica, experto en la redacción de informes claros, concisos y estructurados.

      Tu misión es convertir los siguientes datos brutos en un informe clínico impecable y, además, generar un plan de recomendaciones y un resumen de palabras clave.

      Reglas de Oro que NUNCA debes romper:
      1.  **Analiza y Estructura:** Transforma los datos en un informe clínico formal usando terminología médica precisa. Expande abreviaturas comunes ('tto' -> 'tratamiento') y corrige errores.
      2.  **Genera Recomendaciones:** Basado en la sospecha diagnóstica y el plan, crea una lista de 2-4 recomendaciones claras para el seguimiento del paciente.
      3.  **Extrae Palabras Clave:** Identifica y lista entre 3 y 5 palabras o conceptos clave del caso.
      4.  **Formato de Salida Obligatorio:** Debes devolver tu respuesta exclusivamente como un objeto JSON válido, sin texto adicional antes o después, con la estructura {"informe": "...", "recomendaciones": "...", "palabrasClave": "..."}.
      5.  **Regla de Omisión Estricta:** Si un campo de datos de entrada está vacío, es '', 'N/A' o no se especifica, NO incluyas esa sección o titular en el informe final. NO escribas frases como 'No se especifica', 'No se ha establecido' o 'La información es insuficiente'. Simplemente omite la sección por completo.

      Aquí están los datos brutos del paciente:
      - Nombre: ${patientData.nombre || ''}
      - Edad: ${patientData.edad || ''}
      - Sexo: ${patientData.sexo || ''}
      - Fecha y Hora: ${patientData['fecha-hora'] || ''}
      - Contexto: ${patientData.contexto || ''}
      - Motivo: ${patientData.motivo || ''}
      - Historia: ${patientData.historia || ''}
      - Constantes: ${patientData.triaje || ''}
      - Antecedentes: ${patientData.antecedentes || ''}
      - Exploración: ${patientData.exploracion || ''}
      - Pruebas: ${patientData.pruebas || ''}
      - Sospecha: ${patientData.sospecha || ''}
      - Plan: ${patientData.plan || ''}
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Respuesta de texto crudo de la IA:', text);

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("La IA no devolvió un JSON válido.");
    }
    const jsonString = match[0];
    const structuredResponse = JSON.parse(jsonString);
    
    console.log('✅ Respuesta JSON parseada con éxito.');

    res.json({ 
      report: structuredResponse.informe,
      recommendations: structuredResponse.recomendaciones,
      keywords: structuredResponse.palabrasClave
    });

  } catch (error) {
    console.error("❌ Error en la función /api/generate:", error.message);
    res.status(500).json({ error: "Error interno al generar el informe." });
  }
});

// Esta parte solo se usa en local, Vercel gestiona el puerto por su cuenta.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor local escuchando en http://localhost:${PORT}`);
  });
}

export default app;