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
    
    // --- PASO DE LIMPIEZA DE DATOS ---
    // Creamos un objeto limpio para los datos del paciente, sin los prefijos 'urg-', 'planta-', etc.
    const patientData = {};
    for (const key in incomingData) {
      // Reemplazamos el prefijo por una cadena vacía
      const cleanKey = key.replace(/^(urg-|planta-|evo-)/, '');
      patientData[cleanKey] = incomingData[key];
    }
    // ------------------------------------

    console.log('✅ Datos limpios, preparando para enviar a la IA:', patientData);

    const prompt = `
      Actúa como un Médico Senior con 20 años de experiencia, experto en redacción de informes.
      Transforma los siguientes datos brutos, que pueden contener lenguaje coloquial o errores, en una nota de evolución clínica formal, estructurada y clara.
      Expande abreviaturas médicas (ej. 'TA' a 'Tensión Arterial', 'tto' a 'tratamiento') y corrige el estilo.
      Organiza la información en secciones lógicas y omite los campos no rellenados.
      
      Datos del paciente en contexto de '${patientData.contexto}':
      - Motivo: ${patientData.motivo || 'N/A'}
      - Historia: ${patientData.historia || 'N/A'}
      - Constantes: ${patientData.triaje || 'N/A'}
      - Antecedentes: ${patientData.antecedentes || 'N/A'}
      - Exploración: ${patientData.exploracion || 'N/A'}
      - Pruebas: ${patientData.pruebas || 'N/A'}
      - Sospecha: ${patientData.sospecha || 'N/A'}
      - Plan: ${patientData.plan || 'N/A'}

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