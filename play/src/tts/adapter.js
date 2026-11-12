// Small, local adapter for the Pocket TTS ONNX worker.
//
// This file intentionally does not import a third-party TTS package. The only
// runtime outside this project is the pinned ONNX Runtime Web module loaded by
// the worker. Model files are configured by the static site at deploy time.

const DEFAULT_ORT_BASE_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
const DEFAULT_CACHE_NAME = 'i-thought-i-knew-you-pocket-tts-v1';

function resampleLinear(data, sourceRate, targetRate) {
  if (sourceRate === targetRate) return data;
  const ratio = sourceRate / targetRate;
  const out = new Float32Array(Math.floor(data.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const sourceIndex = i * ratio;
    const floor = Math.floor(sourceIndex);
    const ceil = Math.min(floor + 1, data.length - 1);
    const t = sourceIndex - floor;
    out[i] = data[floor] * (1 - t) + data[ceil] * t;
  }
  return out;
}

function chunksToWavBlob(chunks, sampleRate) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pcm = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    pcm.set(chunk, offset);
    offset += chunk.length;
  }

  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (start, text) => { for (let i = 0; i < text.length; i++) view.setUint8(start + i, text.charCodeAt(i)); };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0, cursor = 44; i < pcm.length; i++, cursor += 2) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(cursor, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export class PocketTtsAdapter {
  constructor(options = {}) {
    this.language = options.language || 'english_2026-04';
    this.quantized = options.quantized !== false;
    this.voiceCloning = options.voiceCloning !== false;
    this.modelBaseUrl = (options.modelBaseUrl || window.POCKET_TTS_MODEL_BASE_URL || '').replace(/\/$/, '');
    this.ortBaseUrl = options.ortBaseUrl || window.POCKET_TTS_ORT_BASE_URL || DEFAULT_ORT_BASE_URL;
    this.cacheName = options.cacheName || DEFAULT_CACHE_NAME;
    this.maxThreads = options.maxThreads || 8;
    this.worker = null;
    this.ready = false;
    this.sampleRate = 24000;
    this.nextId = 1;
    this.pending = new Map();
    this.onChunk = null;
    this.metrics = null;
  }

  ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event) => this.handleMessage(event.data);
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Pocket TTS worker error');
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    };
  }

  handleMessage(message) {
    if (message.type === 'ready') {
      this.sampleRate = message.sampleRate || this.sampleRate;
      return;
    }
    if (message.type === 'chunk') {
      if (this.onChunk) this.onChunk(new Float32Array(message.audio), message.meta || {});
      return;
    }
    if (message.type === 'metrics') {
      this.metrics = message.metrics;
      return;
    }
    if (message.type === 'progress' || message.type === 'status') {
      if (this.onProgress) this.onProgress(message);
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.type === 'error') pending.reject(new Error(message.error));
    else pending.resolve(message.result);
  }

  request(type, payload, transfer) {
    this.ensureWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload }, transfer || []);
    });
  }

  async load(onProgress) {
    if (!this.modelBaseUrl) {
      throw new Error('Pocket TTS model is not configured. Set window.POCKET_TTS_MODEL_BASE_URL.');
    }
    this.onProgress = onProgress || null;
    await this.request('init', {
      language: this.language,
      quantized: this.quantized,
      voiceCloning: this.voiceCloning,
      modelBaseUrl: this.modelBaseUrl,
      ortBaseUrl: this.ortBaseUrl,
      cache: true,
      cacheName: this.cacheName,
      maxThreads: this.maxThreads,
    });
    this.ready = true;
    return { sampleRate: this.sampleRate, language: this.language };
  }

  async cloneVoice(audio, inputSampleRate) {
    if (!this.ready) throw new Error('Pocket TTS is not loaded.');
    const pcm = resampleLinear(audio, inputSampleRate || this.sampleRate, this.sampleRate);
    const copy = pcm.length > this.sampleRate * 10 ? pcm.slice(0, this.sampleRate * 10) : pcm.slice();
    const result = await this.request('cloneVoice', { audio: copy.buffer, ref: `player-${Date.now()}` }, [copy.buffer]);
    return result.ref;
  }

  async generate(text, voice, onChunk) {
    if (!this.ready) throw new Error('Pocket TTS is not loaded.');
    this.metrics = null;
    this.onChunk = onChunk || null;
    try {
      await this.request('generate', { text, voiceRef: voice });
      return this.metrics || { audioDuration: 0, genTime: 0, rtfx: 0 };
    } finally {
      this.onChunk = null;
    }
  }

  async stop() {
    if (this.worker) await this.request('stop', {});
  }

  destroy() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.ready = false;
    this.pending.clear();
    this.onChunk = null;
    this.onProgress = null;
  }

  static async clearCache(cacheName = DEFAULT_CACHE_NAME) {
    if (typeof caches === 'undefined') return false;
    return caches.delete(cacheName);
  }
}

export { chunksToWavBlob, resampleLinear };
window.PocketTtsAdapter = PocketTtsAdapter;
window.PocketTtsAudio = { chunksToWavBlob, resampleLinear };
