/**
 * ONNX Runtime Web Integration
 * 
 * This script loads and initializes ONNX Runtime Web for model inference.
 */

// We'll load ONNX Runtime Web from CDN for the MVP
// In a production environment, you might want to bundle it with the extension
const ONNX_RUNTIME_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.min.js';

// State
let ort = null;
let isInitialized = false;

/**
 * Load ONNX Runtime Web from CDN
 * @returns {Promise<void>}
 */
const loadOnnxRuntime = async () => {
  return new Promise((resolve, reject) => {
    if (window.ort) {
      ort = window.ort;
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = ONNX_RUNTIME_CDN;
    script.async = true;
    
    script.onload = () => {
      ort = window.ort;
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load ONNX Runtime Web'));
    };
    
    document.head.appendChild(script);
  });
};

/**
 * Initialize ONNX Runtime Web
 * @returns {Promise<void>}
 */
const initializeOnnxRuntime = async () => {
  if (isInitialized) return;
  
  try {
    await loadOnnxRuntime();
    
    // Configure ONNX Runtime Web
    // For the MVP, we'll use WebAssembly backend
    const config = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
      executionMode: 'sequential'
    };
    
    // Initialize session options
    ort.env.wasm.numThreads = 1; // Use single thread for MVP
    ort.env.wasm.simd = false;   // Disable SIMD for broader compatibility
    
    console.log('ONNX Runtime Web initialized successfully');
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize ONNX Runtime Web:', error);
    throw error;
  }
};

/**
 * Create an ONNX inference session
 * @param {ArrayBuffer} modelBuffer - The ONNX model as an ArrayBuffer
 * @returns {Promise<ort.InferenceSession>} - The inference session
 */
const createSession = async (modelBuffer) => {
  if (!isInitialized) {
    await initializeOnnxRuntime();
  }
  
  try {
    const session = await ort.InferenceSession.create(modelBuffer);
    return session;
  } catch (error) {
    console.error('Failed to create inference session:', error);
    throw error;
  }
};

/**
 * Run inference with the model
 * @param {ort.InferenceSession} session - The ONNX inference session
 * @param {Object} inputs - Input tensors as key-value pairs
 * @returns {Promise<Object>} - Output tensors
 */
const runInference = async (session, inputs) => {
  try {
    // Convert inputs to ONNX tensors
    const feeds = {};
    for (const [name, data] of Object.entries(inputs)) {
      feeds[name] = new ort.Tensor(data.type, data.data, data.dims);
    }
    
    // Run inference
    const results = await session.run(feeds);
    return results;
  } catch (error) {
    console.error('Inference failed:', error);
    throw error;
  }
};

// Export the API
window.onnxRuntime = {
  initialize: initializeOnnxRuntime,
  createSession,
  runInference
}; 