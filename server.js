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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

app.use(express.static(__dirname));
app.use(express.json());

// --- NUEVO BLOQUE DE CÓDIGO ---
// Esta es la ruta explícita que soluciona el problema en Vercel.
// Le dice a Express que cuando reciba una petición GET a la ruta raíz ('/')...
app.get('/', (req, res) => {
  // ...debe responder enviando el archivo 'index.html' que se encuentra en nuestro directorio.
  res.sendFile(path.join(__dirname, 'index.html'));
});
// --------------------------------

app.post('/api/generate', async (req, res) => {
  try {
    const { incomingData } = req.body;
    console.log('✅ Datos recibidos, preparando para enviar a la IA:', incomingData);

    const prompt = `
      Eres un asistente médico experto en redacción de informes clínicos.
      A partir de los siguientes datos de un paciente en un contexto de '${incomingData.contexto}', 
      redacta una nota de evolución clínica estructurada, profesional y coherente.
      
      Datos del Paciente:
      - Nombre: ${incomingData.nombre || 'No especificado'}
      - Edad: ${incomingData.edad || 'No especificado'}
      - Sexo: ${incomingData.sexo || 'No especificado'}
      - Motivo de consulta: ${incomingData.motivo || ''}
      - Historia actual: ${incomingData.historia || ''}
      - Constantes y triaje: ${incomingData.triaje || ''}
      - Antecedentes: ${incomingData.antecedentes || ''}
      - Exploración física: ${incomingData.exploracion || ''}
      - Pruebas realizadas: ${incomingData.pruebas || ''}
      - Sospecha diagnóstica: ${incomingData.sospecha || ''}
      - Plan inmediato: ${incomingData.plan || ''}

      Genera solo el texto del informe, sin incluir saludos ni despedidas.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Respuesta recibida de la IA.');

    res.json({ 
      report: text,
      recommendations: "Recomendaciones pendientes de generar.",
      keywords: "Palabras clave pendientes."
    });

  } catch (error) {
    console.error("❌ Error al contactar con la API de Google:", error);
    res.status(500).json({ error: "Error al generar el informe." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});