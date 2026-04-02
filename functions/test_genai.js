const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: 'AIzaSyDb8Av8eDnKXCcbBv3SkIqVlKePNQxsvU8' });

async function run() {
  try {
    const list = await ai.models.listModels();
    for await (const model of list) {
        if(model.name.includes('gemini') && model.supportedGenerationMethods.includes('generateContent')) {
            console.log(model.name);
        }
    }
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

run();
