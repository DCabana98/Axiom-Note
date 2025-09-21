import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// El puerto lo gestiona Vercel, pero lo dejamos para pruebas locales
const PORT = 3000; 

// Verificamos que la API Key esté cargada
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
    
    console.log('✅ Datos recibidos, preparando para enviar a la IA:', incomingData);

    // Prompt simplificado para ser más rápido, pero manteniendo la esencia profesional
    const prompt = `
      Actúa como un Médico Senior con 20 años de experiencia, experto en redacción de informes.
      Transforma los siguientes datos brutos en una nota de evolución clínica formal, estructurada y clara.
      Expande abreviaturas médicas (ej. 'TA' a 'Tensión Arterial', 'tto' a 'tratamiento') y corrige el estilo.
      Organiza la información en secciones lógicas y omite los campos no rellenados.
      
      Datos del paciente en contexto de '${incomingData.contexto}':
      - Motivo: ${incomingData.motivo || 'N/A'}
      - Historia: ${incomingData.historia || 'N/A'}
      - Constantes: ${incomingData.triaje || 'N/A'}
      - Antecedentes: ${incomingData.antecedentes || 'N/A'}
      - Exploración: ${incomingData.exploracion || 'N/A'}
      - Pruebas: ${incomingData.pruebas || 'N/A'}
      - Sospecha: ${incomingData.sospecha || 'N/A'}
      - Plan: ${incomingData.plan || 'N/A'}

      Genera únicamente el texto del informe final, de forma concisa.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Respuesta recibida de la IA.');

    res.json({ 
      report: text,
      recommendations: "", // Dejamos estos vacíos por ahora
      keywords: ""
    });

  } catch (error) {
    console.error("❌ Error en la función /api/generate:", error);
    res.status(500).json({ error: "Error interno al generar el informe." });
  }
});

// Esta parte solo se usa en local, Vercel gestiona el puerto por su cuenta.
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor local escuchando en http://localhost:${PORT}`);
  });
}

// Exportamos la app para que Vercel pueda usarla
export default app;