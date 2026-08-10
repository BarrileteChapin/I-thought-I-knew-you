# Pocket TTS Model Bundle

The browser adapter in `src/tts/` expects a versioned, quantized ONNX bundle
generated from the official Kyutai Pocket TTS checkpoint. A compatible public
bundle is already available from `KevinAHM/pocket-tts-onnx`, so this project
does not need to publish a duplicate.

Set this value in `index.html` after publishing the bundle:

```js
window.POCKET_TTS_MODEL_BASE_URL = 'https://huggingface.co/KevinAHM/pocket-tts-onnx/resolve/58a6d00cf13d239b6748cb0769f35c580a8f606c/onnx';
```

For the `english_2026-04` language, the adapter expects these files under the
base URL:

```text
english_2026-04/bundle.json
english_2026-04/tokenizer.model
english_2026-04/bos_before_voice.npy
english_2026-04/mimi_encoder_int8.onnx
english_2026-04/text_conditioner_int8.onnx
english_2026-04/flow_lm_main_int8.onnx
english_2026-04/flow_lm_flow_int8.onnx
english_2026-04/mimi_decoder_int8.onnx
```

The default URL is pinned to the public `58a6d00` revision. The model card
identifies Kyutai's model as the base model and publishes the bundle under
CC-BY-4.0. Keep the revision pinned and verify the files before changing it.
Use a self-hosted mirror only if the public bundle becomes unavailable or the
deployment policy requires one.

The adapter uses ONNX Runtime Web from the pinned jsDelivr URL by default. For
a fully self-hosted runtime, set `window.POCKET_TTS_ORT_BASE_URL` to a local
copy of the matching ONNX Runtime Web distribution.

The quantized voice-cloning files total approximately 146 MB. The model is
cached in the browser after its first download. GitHub Pages does
not provide cross-origin isolation headers, so inference uses one WebAssembly
thread there. It remains client-side and does not upload the player's voice.
