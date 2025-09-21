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

// --- VERSIÓN DE DEPURACIÓN DEL ENDPOINT ---
app.post('/api/generate', async (req, res) => {
  try {
    const { incomingData } = req.body;
    if (!incomingData) {
      return res.status(400).json({ error: "No se recibieron datos." });
    }
    
    // Mantenemos el paso de limpieza de datos, que es crucial
    const patientData = {};
    for (const key in incomingData) {
      const cleanKey = key.replace(/^(urg-|planta-|evo-)/, '');
      patientData[cleanKey] = incomingData[key];
    }
    
    console.log('✅ Datos limpios para la prueba de eco:', patientData);

    // --- PRUEBA DE ECO ---
    // En lugar de llamar a la IA, devolvemos los datos que hemos procesado.
    // Usamos JSON.stringify para formatearlo de forma legible.
    res.json({ 
      report: `--- PRUEBA DE DATOS DEL SERVIDOR ---\n\n${JSON.stringify(patientData, null, 2)}`,
      recommendations: "Si en el texto de arriba ves los datos que introdujiste con nombres de campo correctos (ej. 'nombre', 'motivo'), significa que este paso funciona.",
      keywords: "Si los campos de arriba están vacíos o tienen nombres incorrectos (ej. 'urg-nombre'), hemos encontrado el error."
    });
    // ---------------------

  } catch (error) {
    console.error("❌ Error en la función /api/generate:", error);
    res.status(500).json({ error: "Error interno durante la prueba de eco." });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor local escuchando en http://localhost:${PORT}`);
  });
}

export default app;