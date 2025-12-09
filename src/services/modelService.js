const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

let model = null;
let isModelLoading = false;

/**
 * Load the TensorFlow.js model
 * The model should be converted from .h5 to TensorFlow.js format
 * Expected location: model/tfjs_model/model.json
 */
async function loadModel() {
  if (model) {
    return model;
  }

  if (isModelLoading) {
    // Wait for ongoing load to complete
    while (isModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return model;
  }

  try {
    isModelLoading = true;
    
    // Try to load from TensorFlow.js format (converted model)
    const modelPath = path.join(__dirname, '..', 'model', 'tfjs_model', 'model.json');
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(
        `Model not found at ${modelPath}. ` +
        `Please convert the .h5 model to TensorFlow.js format. ` +
        `See MODEL_SETUP.md for instructions.`
      );
    }

    console.log('Loading TensorFlow.js model from:', modelPath);
    // Normalize path for file:// protocol (use forward slashes)
    const normalizedPath = modelPath.replace(/\\/g, '/');
    model = await tf.loadLayersModel(`file://${normalizedPath}`);
    console.log('Model loaded successfully');
    
    isModelLoading = false;
    return model;
  } catch (error) {
    isModelLoading = false;
    console.error('Error loading model:', error.message);
    throw error;
  }
}

/**
 * Preprocess image for model input
 * @param {string} imagePath - Path to the image file
 * @returns {tf.Tensor} Preprocessed tensor
 */
function preprocessImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const tensor = tf.node
    .decodeImage(imageBuffer, 3) // 3 channels (RGB)
    .resizeNearestNeighbor([224, 224]) // Resize to 224x224
    .expandDims() // Add batch dimension
    .toFloat()
    .div(255); // Normalize to [0, 1]
  
  return tensor;
}

/**
 * Get class names for predictions
 * Update this array based on your model's output classes
 */
const CLASS_NAMES = [
  'Healthy',
  'Koilonychia (Spoon Nails)',
  "Terry's Nails",
  'Clubbing',
  'Beau\'s Lines',
  'Onycholysis',
  'Yellow Nail Syndrome',
  'Nail Psoriasis'
];

/**
 * Run inference on an image
 * @param {string} imagePath - Path to the uploaded image
 * @returns {Promise<{prediction: string, confidence: number}>}
 */
async function predict(imagePath) {
  try {
    // Load model if not already loaded
    const loadedModel = await loadModel();
    
    // Preprocess image
    const tensor = preprocessImage(imagePath);
    
    // Run prediction
    const prediction = loadedModel.predict(tensor);
    
    // Get prediction values
    const predictionData = await prediction.data();
    
    // Clean up tensor
    tensor.dispose();
    prediction.dispose();
    
    // Find the class with highest confidence
    let maxIndex = 0;
    let maxConfidence = predictionData[0];
    
    for (let i = 1; i < predictionData.length; i++) {
      if (predictionData[i] > maxConfidence) {
        maxConfidence = predictionData[i];
        maxIndex = i;
      }
    }
    
    // Get class name (handle case where we have more predictions than class names)
    const className = CLASS_NAMES[maxIndex] || `Class ${maxIndex}`;
    const confidence = maxConfidence;
    
    return {
      prediction: className,
      confidence: Math.round(confidence * 100) / 100 // Round to 2 decimal places
    };
  } catch (error) {
    console.error('Prediction error:', error);
    throw new Error(`AI prediction failed: ${error.message}`);
  }
}

module.exports = {
  loadModel,
  predict,
  preprocessImage
};

