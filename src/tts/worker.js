// Own Pocket TTS ONNX worker. The page communicates with this file through a
// narrow message API; no microphone data leaves the browser.

import { SentencePieceTokenizer } from "./tokenizer.js";
import { parseNpyFloat32 } from "./binary.js";

let ort = null;
let config = null;
let metadata = null;
let tokenizer = null;
let bosBeforeVoice = null;
let sessions = {};
let sampleRate = 24000;
let samplesPerFrame = 1920;
let latentDim = 32;
let conditioningDim = 1024;
let maxTokensPerChunk = 50;
let stateTensors = [];
let voiceStates = new Map();
let customEmbeddings = new Map();
let generating = false;

const MODEL_STEMS = ["mimi_encoder", "text_conditioner", "flow_lm_main", "flow_lm_flow", "mimi_decoder"];
const CHUNK_GAP_SEC = 0.25;
const MAX_FRAMES = 500;
const LSD_STEPS = 1;
const TEMPERATURE = 0.7;
const EOS_THRESHOLD = -4.0;

function post(message, transfer) {
  self.postMessage(message, transfer || []);
}

function modelUrl(language, filename) {
  return `${config.modelBaseUrl}/${language}/${filename}`;
}

function modelStem(name) {
  return config.quantized ? `${name}_int8.onnx` : `${name}.onnx`;
}

function makeFilledArray(shape, dtype, fill) {
  const size = shape.reduce((total, value) => total * value, 1);
  if (dtype === "int64") return new BigInt64Array(size);
  if (dtype === "bool") return new Uint8Array(size);
  const data = new Float32Array(size);
  if (fill === "nan") data.fill(NaN);
  else if (fill === "ones") data.fill(1);
  return data;
}

function createTensor(dtype, data, dims) {
  return new ort.Tensor(dtype, data, dims);
}

function initStateFromManifest(manifest) {
  const state = {};
  for (const entry of manifest) {
    state[entry.input_name] = createTensor(
      entry.dtype,
      makeFilledArray(entry.shape, entry.dtype, entry.fill),
      entry.shape,
    );
  }
  return state;
}

function updateStateFromManifestOutputs(state, result, manifest) {
  for (const entry of manifest) state[entry.input_name] = result[entry.output_name];
}

function adaptTypedArray(source, entry) {
  const targetShape = entry.shape;
  const targetSize = targetShape.reduce((total, value) => total * value, 1);
  const target = makeFilledArray(targetShape, entry.dtype, entry.fill);
  const cast = (data) => {
    if (entry.dtype === "int64") return new BigInt64Array(data);
    if (entry.dtype === "bool") return new Uint8Array(data);
    return new Float32Array(data);
  };

  if (source.shape.length === targetShape.length && source.shape.every((dim, index) => dim === targetShape[index])) {
    return cast(source.data);
  }
  if (source.data.length === targetSize) return cast(source.data);
  return target;
}

function deriveStep(moduleState) {
  if (moduleState.step) return { data: BigInt64Array.from([BigInt(moduleState.step.data[0])]), shape: [1], dtype: "int64" };
  if (moduleState.offset && !moduleState.end_offset) return { data: BigInt64Array.from([BigInt(moduleState.offset.data[0])]), shape: [1], dtype: "int64" };
  if (moduleState.current_end) return { data: BigInt64Array.from([BigInt(moduleState.current_end.shape[0])]), shape: [1], dtype: "int64" };
  return { data: BigInt64Array.from([0n]), shape: [1], dtype: "int64" };
}

function groupVoiceRecord(record) {
  const grouped = {};
  for (const [key, value] of Object.entries(record)) {
    const slash = key.indexOf("/");
    if (slash === -1) continue;
    const moduleName = key.slice(0, slash);
    const tensorKey = key.slice(slash + 1);
    if (!grouped[moduleName]) grouped[moduleName] = {};
    grouped[moduleName][tensorKey] = value;
  }
  return grouped;
}

function stateFromVoiceRecord(record) {
  const grouped = groupVoiceRecord(record);
  const state = initStateFromManifest(metadata.flow_lm_state_manifest);
  for (const entry of metadata.flow_lm_state_manifest) {
    const moduleState = grouped[entry.module] || {};
    let source = moduleState[entry.key];
    if (!source && entry.key === "step") source = deriveStep(moduleState);
    if (!source) continue;
    state[entry.input_name] = createTensor(entry.dtype, adaptTypedArray(source, entry), entry.shape);
  }
  return state;
}

function prepareVoiceEmbeddingData(voiceEmbedding) {
  let data = voiceEmbedding.data;
  let dims = voiceEmbedding.shape.slice();
  if (metadata.insert_bos_before_voice && bosBeforeVoice) {
    const bosData = bosBeforeVoice.data;
    const combined = new Float32Array(bosData.length + data.length);
    combined.set(bosData, 0);
    combined.set(data, bosData.length);
    data = combined;
    dims = [1, dims[1] + bosBeforeVoice.shape[1], dims[2]];
  }
  return createTensor("float32", data, dims);
}

async function buildVoiceConditionedState(voiceEmbedding) {
  const flowState = initStateFromManifest(metadata.flow_lm_state_manifest);
  const emptySequence = createTensor("float32", new Float32Array(0), [1, 0, latentDim]);
  const result = await sessions.flow_lm_main.run({
    sequence: emptySequence,
    text_embeddings: prepareVoiceEmbeddingData(voiceEmbedding),
    ...flowState,
  });
  updateStateFromManifestOutputs(flowState, result, metadata.flow_lm_state_manifest);
  return flowState;
}

async function encodeVoiceAudio(audioData) {
  if (!sessions.mimi_encoder) throw new Error("Voice cloning is disabled.");
  const pcm = audioData instanceof Float32Array ? audioData : new Float32Array(audioData);
  const input = createTensor("float32", pcm, [1, 1, pcm.length]);
  const outputs = await sessions.mimi_encoder.run({ audio: input });
  const embedding = outputs[sessions.mimi_encoder.outputNames[0]];
  let dims = embedding.dims.slice();
  const data = new Float32Array(embedding.data);
  while (dims.length > 3 && dims[0] === 1) dims = dims.slice(1);
  if (dims.length < 3) dims = [1, dims[0], dims[1]];
  return { data, shape: dims };
}

function precomputeFlowBuffers() {
  stateTensors = [];
  const delta = 1 / LSD_STEPS;
  for (let step = 0; step < LSD_STEPS; step++) {
    const start = step / LSD_STEPS;
    stateTensors.push({
      s: createTensor("float32", new Float32Array([start]), [1, 1]),
      t: createTensor("float32", new Float32Array([start + delta]), [1, 1]),
    });
  }
}

async function openCache() {
  if (!config.cache || typeof caches === "undefined") return null;
  try { return await caches.open(config.cacheName); } catch { return null; }
}

async function readBody(response, label, fromCache) {
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || !total) {
    const buffer = await response.arrayBuffer();
    post({ type: "progress", label, loaded: buffer.byteLength, total: buffer.byteLength, fromCache });
    return new Uint8Array(buffer);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    post({ type: "progress", label, loaded, total, fromCache });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function fetchBytes(url, label) {
  const cache = await openCache();
  if (cache) {
    try {
      const hit = await cache.match(url);
      if (hit) return readBody(hit, label, true);
    } catch {}
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${label}: ${response.status}`);
  const cachedResponse = cache ? response.clone() : null;
  const bytes = await readBody(response, label, false);
  if (cache && cachedResponse) {
    try { await cache.put(url, cachedResponse); } catch {}
  }
  return bytes;
}

async function loadRuntime() {
  if (ort) return;
  post({ type: "status", status: "loading-runtime" });
  const module = await import(/* @vite-ignore */ `${config.ortBaseUrl}ort.min.mjs`);
  ort = module.default || module;
  ort.env.wasm.wasmPaths = config.ortBaseUrl;
  ort.env.wasm.simd = true;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(navigator.hardwareConcurrency || 4, config.maxThreads) : 1;
  precomputeFlowBuffers();
}

async function createSession(language, name) {
  const bytes = await fetchBytes(modelUrl(language, modelStem(name)), name);
  return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
}

async function init(nextConfig) {
  config = nextConfig;
  sessions = {};
  await loadRuntime();
  const language = config.language;
  post({ type: "status", status: "loading-bundle" });
  const metadataBytes = await fetchBytes(modelUrl(language, "bundle.json"), "bundle");
  metadata = JSON.parse(new TextDecoder().decode(metadataBytes));
  sampleRate = Number(metadata.sample_rate);
  samplesPerFrame = Number(metadata.samples_per_frame);
  latentDim = Number(metadata.latent_dim);
  conditioningDim = Number(metadata.conditioning_dim);
  maxTokensPerChunk = Number(metadata.max_token_per_chunk || 50);

  const tokenizerBytes = await fetchBytes(modelUrl(language, metadata.tokenizer_file), "tokenizer");
  tokenizer = SentencePieceTokenizer.fromBytes(tokenizerBytes);
  const needed = ["text_conditioner", "flow_lm_main", "flow_lm_flow", "mimi_decoder"];
  if (config.voiceCloning) needed.unshift("mimi_encoder");
  for (const name of needed) sessions[name] = await createSession(language, name);
  bosBeforeVoice = null;
  if (config.voiceCloning && metadata.bos_before_voice_file) {
    try {
      bosBeforeVoice = parseNpyFloat32((await fetchBytes(modelUrl(language, metadata.bos_before_voice_file), "bos")).buffer);
    } catch {}
  }
  voiceStates = new Map();
  customEmbeddings = new Map();
  post({ type: "ready", sampleRate, language });
}

function prepareText(text) {
  let prompt = text.trim().replace(/\r/g, " ").replace(/\n/g, " ").replace(/\s+/g, " ");
  if (metadata.remove_semicolons) prompt = prompt.replace(/;/g, ",");
  const wordCount = prompt.split(/\s+/).filter(Boolean).length;
  let framesAfterEos = wordCount <= 4 ? 3 : 1;
  if (metadata.model_recommended_frames_after_eos != null) framesAfterEos = Number(metadata.model_recommended_frames_after_eos);
  if (prompt && !/[A-ZÀ-Þ]/.test(prompt[0])) prompt = prompt[0].toUpperCase() + prompt.slice(1);
  if (prompt && /[0-9A-Za-zÀ-ÿ]/.test(prompt[prompt.length - 1])) prompt += ".";
  if (metadata.pad_with_spaces_for_short_inputs && wordCount < 5) prompt = `        ${prompt}`;
  return { text: prompt, framesAfterEos };
}

function splitText(text) {
  const prepared = prepareText(text);
  if (!prepared.text) return { chunks: [], framesAfterEos: prepared.framesAfterEos };
  const matches = prepared.text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  const chunks = [];
  let current = "";
  for (const sentence of matches.map((item) => item.trim()).filter(Boolean)) {
    if (!current) { current = sentence; continue; }
    const combined = `${current} ${sentence}`;
    if (tokenizer.encodeIds(combined).length > maxTokensPerChunk) {
      chunks.push(current);
      current = sentence;
    } else current = combined;
  }
  if (current) chunks.push(current);
  return { chunks, framesAfterEos: prepared.framesAfterEos };
}

function cloneState(state) {
  return { ...state };
}

async function cloneVoice(audioData, ref) {
  const embedding = await encodeVoiceAudio(audioData);
  customEmbeddings.set(ref, embedding);
  voiceStates.set(ref, await buildVoiceConditionedState(embedding));
  return ref;
}

async function generate(text, voiceRef) {
  if (!voiceStates.has(voiceRef)) throw new Error(`Voice '${voiceRef}' is not prepared.`);
  generating = true;
  const { chunks, framesAfterEos } = splitText(text);
  if (!chunks.length) throw new Error("No text to generate.");
  const baseFlowState = voiceStates.get(voiceRef);
  let mimiState = initStateFromManifest(metadata.mimi_state_manifest);
  const emptySequence = createTensor("float32", new Float32Array(0), [1, 0, latentDim]);
  const emptyText = createTensor("float32", new Float32Array(0), [1, 0, conditioningDim]);
  let totalFrames = 0;
  let totalTime = 0;
  let firstAudio = true;

  for (let chunkIndex = 0; chunkIndex < chunks.length && generating; chunkIndex++) {
    let flowState = cloneState(baseFlowState);
    mimiState = initStateFromManifest(metadata.mimi_state_manifest);
    const tokenIds = tokenizer.encodeIds(chunks[chunkIndex]);
    const textInput = createTensor("int64", BigInt64Array.from(tokenIds.map((id) => BigInt(id))), [1, tokenIds.length]);
    const textResult = await sessions.text_conditioner.run({ token_ids: textInput });
    let textEmb = textResult[sessions.text_conditioner.outputNames[0]];
    if (textEmb.dims.length === 2) {
      textEmb = createTensor('float32', new Float32Array(textEmb.data), [1, textEmb.dims[0], textEmb.dims[1]]);
    }
    const conditioned = await sessions.flow_lm_main.run({ sequence: emptySequence, text_embeddings: textEmb, ...flowState });
    updateStateFromManifestOutputs(flowState, conditioned, metadata.flow_lm_state_manifest);
    let current = createTensor("float32", new Float32Array(latentDim).fill(NaN), [1, 1, latentDim]);
    const latentFrames = [];
    let decodedFrames = 0;
    let eosStep = null;

    for (let step = 0; step < MAX_FRAMES && generating; step++) {
      const start = performance.now();
      const result = await sessions.flow_lm_main.run({ sequence: current, text_embeddings: emptyText, ...flowState });
      totalTime += performance.now() - start;
      const eosLogit = result.eos_logit.data[0];
      if (eosLogit > EOS_THRESHOLD && eosStep == null) eosStep = step;
      const shouldStop = eosStep != null && step >= eosStep + framesAfterEos;
      const latent = new Float32Array(latentDim);
      for (let i = 0; i < latentDim; i++) {
        let u = 0; let v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        latent[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * Math.sqrt(TEMPERATURE);
      }
      const flow = await sessions.flow_lm_flow.run({
        c: result.conditioning,
        s: stateTensors[0].s,
        t: stateTensors[0].t,
        x: createTensor("float32", latent, [1, latentDim]),
      });
      const direction = flow.flow_dir.data;
      for (let i = 0; i < latentDim; i++) latent[i] += direction[i];
      latentFrames.push(latent);
      totalFrames++;
      current = createTensor("float32", latent, [1, 1, latentDim]);
      updateStateFromManifestOutputs(flowState, result, metadata.flow_lm_state_manifest);

      const pending = latentFrames.length - decodedFrames;
      const decodeSize = shouldStop ? pending : firstAudio ? (pending >= 3 ? 3 : 0) : (pending >= 12 ? 12 : 0);
      if (decodeSize > 0) {
        const decodeLatents = new Float32Array(decodeSize * latentDim);
        for (let frame = 0; frame < decodeSize; frame++) decodeLatents.set(latentFrames[decodedFrames + frame], frame * latentDim);
        const decoded = await sessions.mimi_decoder.run({
          latent: createTensor("float32", decodeLatents, [1, decodeSize, latentDim]),
          ...mimiState,
        });
        for (const entry of metadata.mimi_state_manifest) mimiState[entry.input_name] = decoded[entry.output_name];
        decodedFrames += decodeSize;
        const audio = new Float32Array(decoded[sessions.mimi_decoder.outputNames[0]].data);
        post({ type: "chunk", audio, meta: { isFirst: firstAudio, isLast: shouldStop && chunkIndex === chunks.length - 1, chunkDuration: audio.length / sampleRate } }, [audio.buffer]);
        firstAudio = false;
      }
      if (shouldStop) break;
    }
    if (generating && chunkIndex < chunks.length - 1) {
      const silence = new Float32Array(Math.floor(CHUNK_GAP_SEC * sampleRate));
      post({ type: "chunk", audio: silence, meta: { isFirst: false, isLast: false, isSilence: true } }, [silence.buffer]);
    }
  }
  generating = false;
  const audioDuration = (totalFrames * samplesPerFrame) / sampleRate;
  post({ type: "metrics", metrics: { audioDuration, genTime: totalTime / 1000, rtfx: totalTime ? audioDuration / (totalTime / 1000) : 0 } });
}

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  try {
    if (type === "init") {
      await init(payload);
      post({ id, type: "result", result: { ok: true, sampleRate } });
    } else if (type === "cloneVoice") {
      const ref = await cloneVoice(new Float32Array(payload.audio), payload.ref);
      post({ id, type: "result", result: { ref } });
    } else if (type === "generate") {
      await generate(payload.text, payload.voiceRef);
      post({ id, type: "result", result: { ok: true } });
    } else if (type === "stop") {
      generating = false;
      post({ id, type: "result", result: { ok: true } });
    }
  } catch (error) {
    generating = false;
    post({ id, type: "error", error: error && error.message ? error.message : String(error) });
  }
};
