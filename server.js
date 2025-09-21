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
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

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

    // Usamos el prompt optimizado que es más rápido para Vercel
    const prompt = `
      Actúa como un Médico Senior con 20 años de experiencia, experto en redacción de informes.
      Transforma los siguientes datos brutos en una nota de evolución clínica formal, estructurada y clara.
      Expande abreviaturas médicas (ej. 'TA' a 'Tensión Arterial', 'tto' a 'tratamiento') y corrige el estilo y posibles faltas de ortografía.
      Organiza la información en secciones lógicas y omite los campos no rellenados.
      
      Datos del paciente en contexto de '${patientData.contexto}':
      - Nombre: ${patientData.nombre || 'No especificado'}
      - Edad: ${patientData.edad || 'N/A'}
      - Motivo de consulta: ${patientData.motivo || 'N/A'}
      - Historia actual: ${patientData.historia || 'N/A'}
      - Constantes y triaje: ${patientData.triaje || 'N/A'}
      - Antecedentes: ${patientData.antecedentes || 'N/A'}
      - Exploración física: ${patientData.exploracion || 'N/A'}
      - Pruebas realizadas: ${patientData.pruebas || 'N/A'}
      - Sospecha diagnóstica: ${patientData.sospecha || 'N/A'}
      - Plan inmediato: ${patientData.plan || 'N/A'}

      Genera únicamente el texto del informe final, de forma concisa y profesional.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Respuesta recibida de la IA.');

    res.json({ 
      report: text,
      recommendations: "",
      keywords: ""
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