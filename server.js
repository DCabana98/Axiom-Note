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
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Usando el modelo Pro

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

      Sigue estas reglas estrictamente:
      1.  **Analiza y Estructura:** Transforma los datos en un informe clínico formal usando terminología médica precisa. Expande abreviaturas comunes ('tto' -> 'tratamiento') y corrige errores.
      2.  **Genera Recomendaciones:** Basado en la sospecha diagnóstica y el plan, crea una lista de 2-4 recomendaciones claras para el seguimiento del paciente.
      3.  **Extrae Palabras Clave:** Identifica y lista entre 3 y 5 palabras o conceptos clave del caso (ej. 'Dolor torácico', 'SCA', 'Troponinas').
      4.  **Formato de Salida Obligatorio:** Debes devolver tu respuesta exclusivamente como un objeto JSON válido, sin texto adicional antes o después. La estructura del JSON debe ser la siguiente:
          {
            "informe": "El texto completo del informe clínico aquí...",
            "recomendaciones": "Las recomendaciones generadas aquí...",
            "palabrasClave": "Las palabras clave separadas por comas aquí..."
          }

      Aquí están los datos brutos del paciente:
      - Contexto: ${patientData.contexto || 'No especificado'}
      - Motivo: ${patientData.motivo || 'N/A'}
      - Historia: ${patientData.historia || 'N/A'}
      - Constantes: ${patientData.triaje || 'N/A'}
      - Antecedentes: ${patientData.antecedentes || 'N/A'}
      - Exploración: ${patientData.exploracion || 'N/A'}
      - Pruebas: ${patientData.pruebas || 'N/A'}
      - Sospecha: ${patientData.sospecha || 'N/A'}
      - Plan: ${patientData.plan || 'N/A'}
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Respuesta JSON recibida de la IA.');

    // Parseamos el texto de la IA, que ahora es un string JSON
    const structuredResponse = JSON.parse(text);

    // Mapeamos la respuesta JSON a los campos que espera el frontend
    res.json({ 
      report: structuredResponse.informe,
      recommendations: structuredResponse.recomendaciones,
      keywords: structuredResponse.palabrasClave
    });

  } catch (error) {
    console.error("❌ Error en la función /api/generate:", error);
    res.status(500).json({ error: "Error interno al generar el informe." });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor local escuchando en http://localhost:${PORT}`);
  });
}

export default app;