import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
// Nuevas importaciones
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Cargar las variables de entorno (tu clave de API)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Inicializar el modelo de IA de Google
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

app.use(express.static(__dirname));
app.use(express.json());

// Modificamos el endpoint para que sea asíncrono y llame a la IA
app.post('/api/generate', async (req, res) => {
  try {
    const { incomingData } = req.body;
    console.log('✅ Datos recibidos, preparando para enviar a la IA:', incomingData);

    // --- INGENIERÍA DE PROMPTS ---
    // Creamos un texto (prompt) claro para que la IA entienda qué hacer.
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

    // Llamada a la API de Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('✅ Respuesta recibida de la IA.');

    // Enviamos la respuesta de la IA al frontend
    res.json({ 
      report: text,
      recommendations: "Recomendaciones pendientes de generar.", // Podríamos hacer otra llamada a la IA para esto
      keywords: "Palabras clave pendientes." // O procesar el texto para extraerlas
    });

  } catch (error) {
    console.error("❌ Error al contactar con la API de Google:", error);
    res.status(500).json({ error: "Error al generar el informe." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});