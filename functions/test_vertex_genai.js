const { VertexAI } = require('@google-cloud/vertexai');

async function run() {
  try {
    const vertexAI = new VertexAI({ project: 'ha-sentinel-core-v21', location: 'us-central1' });
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    console.log('Sending request to Vertex AI...');
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Test.' }] }]
    });
    console.log('SUCCESS:', result.response.candidates[0].content.parts[0].text);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

run();
