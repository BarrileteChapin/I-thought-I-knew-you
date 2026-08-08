// Minimal pure-JS SentencePiece Unigram tokenizer used by the Pocket TTS
// browser adapter. It intentionally has no runtime dependency on a package.

const SPACE = "▁";
const UNK_PENALTY = 10.0;
const BYTE_RE = /^<0x([0-9A-Fa-f]{2})$/;

const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
const utf8Encoder = new TextEncoder();

function readVarint(bytes, pos) {
  let shift = 0;
  let result = 0;
  let i = pos;
  for (;;) {
    const b = bytes[i++];
    result += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return [result, i];
}

function parseModelProto(bytes) {
  const pieces = [];
  let i = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (i < bytes.length) {
    let tag;
    [tag, i] = readVarint(bytes, i);
    const field = tag >>> 3;
    const wire = tag & 7;

    if (wire === 2) {
      let len;
      [len, i] = readVarint(bytes, i);
      const end = i + len;
      if (field === 1) {
        let j = i;
        let piece = null;
        let score = 0;
        while (j < end) {
          let ptag;
          [ptag, j] = readVarint(bytes, j);
          const pf = ptag >>> 3;
          const pw = ptag & 7;
          if (pw === 2) {
            let plen;
            [plen, j] = readVarint(bytes, j);
            if (pf === 1) piece = bytes.subarray(j, j + plen);
            j += plen;
          } else if (pw === 5) {
            if (pf === 2) score = view.getFloat32(j, true);
            j += 4;
          } else if (pw === 1) {
            j += 8;
          } else if (pw === 0) {
            [, j] = readVarint(bytes, j);
          }
        }
        pieces.push({ piece, score });
      }
      i = end;
    } else if (wire === 0) {
      [, i] = readVarint(bytes, i);
    } else if (wire === 5) {
      i += 4;
    } else if (wire === 1) {
      i += 8;
    }
  }
  return pieces;
}

export class SentencePieceTokenizer {
  constructor() {
    this.pieceToId = new Map();
    this.idToPiece = [];
    this.scores = [];
    this.byteTokenId = new Int32Array(256).fill(-1);
    this.minScore = 0;
    this.maxPieceChars = 1;
  }

  static fromBytes(bytes) {
    const tokenizer = new SentencePieceTokenizer();
    tokenizer.load(bytes);
    return tokenizer;
  }

  load(modelBytes) {
    const pieces = parseModelProto(modelBytes);
    for (let id = 0; id < pieces.length; id++) {
      const { piece, score } = pieces[id];
      const text = utf8Decoder.decode(piece);
      this.idToPiece.push(text);
      this.scores.push(score);
      this.pieceToId.set(text, id);
      if (score < this.minScore) this.minScore = score;
      const match = BYTE_RE.exec(text);
      if (match) this.byteTokenId[parseInt(match[1], 16)] = id;
      this.maxPieceChars = Math.max(this.maxPieceChars, Array.from(text).length);
    }
  }

  _normalize(text) {
    return SPACE + text.replace(/ /g, SPACE);
  }

  encodeIds(text) {
    if (!text) return [];
    const chars = Array.from(this._normalize(text));
    const n = chars.length;
    const unkScore = this.minScore - UNK_PENALTY;
    const best = new Float64Array(n + 1).fill(-Infinity);
    const backId = new Int32Array(n + 1).fill(-1);
    const backStart = new Int32Array(n + 1).fill(-1);
    best[0] = 0;

    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      const maxLen = Math.min(this.maxPieceChars, n - i);
      let acc = "";
      for (let len = 1; len <= maxLen; len++) {
        acc += chars[i + len - 1];
        const id = this.pieceToId.get(acc);
        if (id === undefined) continue;
        const score = best[i] + this.scores[id];
        if (score > best[i + len]) {
          best[i + len] = score;
          backId[i + len] = id;
          backStart[i + len] = i;
        }
      }
      const fallbackScore = best[i] + unkScore;
      if (fallbackScore > best[i + 1]) {
        best[i + 1] = fallbackScore;
        backId[i + 1] = -1;
        backStart[i + 1] = i;
      }
    }

    const segments = [];
    let pos = n;
    while (pos > 0) {
      const start = backStart[pos];
      segments.push({ id: backId[pos], start, end: pos });
      pos = start;
    }
    segments.reverse();

    const ids = [];
    for (const segment of segments) {
      if (segment.id >= 0) {
        ids.push(segment.id);
        continue;
      }
      const chunk = chars.slice(segment.start, segment.end).join("");
      for (const byte of utf8Encoder.encode(chunk)) {
        const byteId = this.byteTokenId[byte];
        if (byteId >= 0) ids.push(byteId);
      }
    }
    return ids;
  }

  decodeIds(ids) {
    const bytes = [];
    for (const id of ids) {
      const piece = this.idToPiece[id];
      if (piece === undefined) continue;
      const match = BYTE_RE.exec(piece);
      if (match) bytes.push(parseInt(match[1], 16));
      else bytes.push(...utf8Encoder.encode(piece));
    }
    let text = utf8Decoder.decode(new Uint8Array(bytes));
    text = text.split(SPACE).join(" ");
    if (text.startsWith(" ")) text = text.slice(1);
    return text;
  }
}
