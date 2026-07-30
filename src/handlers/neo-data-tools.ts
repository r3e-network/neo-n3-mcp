import * as neonJs from '@cityofzion/neon-js';
import { createSuccessResponse } from '../utils/error-handler';
import { ValidationError } from '../utils/errors';

const MAX_INPUT_BYTES = 64 * 1024;
const MAX_SCRIPT_INSTRUCTIONS = 2_000;
const HEX_RE = /^(?:0x)?[0-9a-fA-F]+$/;
const HASH160_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const HASH256_RE = /^(?:0x)?[0-9a-fA-F]{64}$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const NNS_RE = /^(?=.{3,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+neo$/;
const NEOFS_ID_RE = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const CANONICAL_BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const NEO_DATA_TOOLS = new Set([
  'inspect_neo_value',
  'convert_neo_data',
  'decode_neo_script',
]);

function requireString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_INPUT_BYTES) {
    throw new ValidationError(`${field} exceeds the ${MAX_INPUT_BYTES}-byte limit`);
  }
  return value;
}

function normalizeHex(value: string): string {
  const body = value.replace(/^0x/i, '');
  if (body.length === 0 || body.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(body)) {
    throw new ValidationError('Hex input must contain an even number of hexadecimal characters');
  }
  return body.toLowerCase();
}

function decodeBase64(value: string): Buffer {
  if (!CANONICAL_BASE64_RE.test(value) || Buffer.from(value, 'base64').toString('base64') !== value) {
    throw new ValidationError('Base64 input must use canonical RFC 4648 encoding');
  }
  return Buffer.from(value, 'base64');
}

function neoAddressIsValid(value: string): boolean {
  try {
    return neonJs.wallet.isAddress(value, neonJs.CONST.DEFAULT_ADDRESS_VERSION);
  } catch {
    return false;
  }
}

function publicKeyIsValid(value: string): boolean {
  if (!/^(?:02|03)[0-9a-fA-F]{64}$/.test(value)) return false;
  try {
    return neonJs.wallet.isPublicKey(value, true);
  } catch {
    return false;
  }
}

function canonicalBase64(value: string): boolean {
  if (value.length === 0 || !CANONICAL_BASE64_RE.test(value)) return false;
  try {
    return Buffer.from(value, 'base64').toString('base64') === value;
  } catch {
    return false;
  }
}

function parseNeoFsUri(value: string): { containerId: string; objectId: string | null } | null {
  if (!value.startsWith('neofs://')) return null;
  const parts = value.slice('neofs://'.length).split('/');
  if (!NEOFS_ID_RE.test(parts[0] || '')) return null;
  if (parts.length > 2 || (parts[1] && !NEOFS_ID_RE.test(parts[1]))) return null;
  return { containerId: parts[0], objectId: parts[1] || null };
}

function inspectValue(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  const matches: Array<Record<string, unknown>> = [];

  if (neoAddressIsValid(trimmed)) {
    matches.push({
      type: 'neo_n3_address',
      confidence: 'exact',
      scriptHash: `0x${neonJs.wallet.getScriptHashFromAddress(trimmed).toLowerCase()}`,
    });
  }
  if (EVM_ADDRESS_RE.test(trimmed)) {
    matches.push({ type: 'neo_x_address', confidence: 'shape', normalized: trimmed.toLowerCase() });
  }
  if (HASH160_RE.test(trimmed)) {
    matches.push({
      type: 'hash160',
      confidence: 'shape',
      normalized: `0x${trimmed.replace(/^0x/i, '').toLowerCase()}`,
    });
  }
  if (HASH256_RE.test(trimmed)) {
    matches.push({
      type: 'hash256',
      confidence: 'shape',
      normalized: `0x${trimmed.replace(/^0x/i, '').toLowerCase()}`,
    });
  }
  if (publicKeyIsValid(trimmed)) {
    matches.push({ type: 'compressed_public_key', confidence: 'exact', normalized: trimmed.toLowerCase() });
  }
  if (NNS_RE.test(trimmed.toLowerCase())) {
    matches.push({ type: 'nns_domain', confidence: 'shape', normalized: trimmed.toLowerCase() });
  }
  const neoFs = parseNeoFsUri(trimmed);
  if (neoFs) {
    matches.push({ type: 'neofs_uri', confidence: 'shape', ...neoFs });
  }
  if (/^(?:0|-?[1-9]\d*)$/.test(trimmed) && trimmed !== '-0') {
    matches.push({ type: 'integer', confidence: 'exact', normalized: BigInt(trimmed).toString() });
  }
  if (HEX_RE.test(trimmed) && trimmed.replace(/^0x/i, '').length % 2 === 0) {
    matches.push({
      type: 'hex_bytes',
      confidence: trimmed.startsWith('0x') ? 'exact' : 'possible',
      byteLength: trimmed.replace(/^0x/i, '').length / 2,
    });
  }
  if (canonicalBase64(trimmed)) {
    matches.push({
      type: 'base64_bytes',
      confidence: /[+/=]/.test(trimmed) ? 'exact' : 'possible',
      byteLength: Buffer.from(trimmed, 'base64').length,
    });
  }
  try {
    const parsed = JSON.parse(trimmed);
    matches.push({
      type: Array.isArray(parsed) ? 'json_array' : parsed === null ? 'json_null' : `json_${typeof parsed}`,
      confidence: 'exact',
    });
  } catch {
    // Ordinary text is represented by the fallback below.
  }

  matches.push({
    type: 'utf8_string',
    confidence: matches.length === 0 ? 'exact' : 'fallback',
    byteLength: Buffer.byteLength(value, 'utf8'),
  });

  return {
    input: value,
    primaryType: matches[0]?.type || 'utf8_string',
    matches,
    note: 'Hash-shaped values are classified by shape unless a checksum or curve validation is available.',
  };
}

function integerToSignedLittleEndian(value: bigint): Buffer {
  if (value === 0n) return Buffer.alloc(0);
  const negative = value < 0n;
  let width = 1;
  while (
    value < -(1n << BigInt(width * 8 - 1))
    || value > (1n << BigInt(width * 8 - 1)) - 1n
  ) {
    width += 1;
    if (width > 32) throw new ValidationError('Integer exceeds the Neo VM 256-bit range');
  }
  let encoded = negative ? (1n << BigInt(width * 8)) + value : value;
  const out = Buffer.alloc(width);
  for (let i = 0; i < width; i += 1) {
    out[i] = Number(encoded & 0xffn);
    encoded >>= 8n;
  }
  return out;
}

function signedLittleEndianToInteger(bytes: Buffer): bigint {
  if (bytes.length === 0) return 0n;
  if (bytes.length > 32) throw new ValidationError('Integer byte input exceeds 32 bytes');
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  if ((bytes[bytes.length - 1] & 0x80) !== 0) {
    value -= 1n << BigInt(bytes.length * 8);
  }
  return value;
}

type ByteFormat = 'utf8' | 'hex' | 'base64' | 'integer';
type SemanticFormat = 'neo_address' | 'script_hash';
type DataFormat = ByteFormat | SemanticFormat | 'auto';

function inferInputFormat(value: string, output: string): DataFormat {
  const trimmed = value.trim();
  if (neoAddressIsValid(trimmed)) return 'neo_address';
  if (HASH160_RE.test(trimmed) && output === 'neo_address') return 'script_hash';
  if (/^(?:0|-?[1-9]\d*)$/.test(trimmed) && trimmed !== '-0') return 'integer';
  if (/^0x/i.test(trimmed) && HEX_RE.test(trimmed)) return 'hex';
  if (canonicalBase64(trimmed) && /[+/=]/.test(trimmed)) return 'base64';
  return 'utf8';
}

function convertValue(input: Record<string, unknown>): Record<string, unknown> {
  const value = requireString(input, 'value');
  const requestedInput = String(input.inputFormat || 'auto') as DataFormat;
  const outputFormat = String(input.outputFormat || '') as DataFormat;
  const allowedInputs = new Set<DataFormat>([
    'auto', 'utf8', 'hex', 'base64', 'integer', 'neo_address', 'script_hash',
  ]);
  const allowedOutputs = new Set<DataFormat>([
    'utf8', 'hex', 'base64', 'integer', 'neo_address', 'script_hash',
  ]);
  if (!allowedInputs.has(requestedInput)) throw new ValidationError('Unsupported inputFormat');
  if (!allowedOutputs.has(outputFormat)) throw new ValidationError('Unsupported outputFormat');

  const inputFormat = requestedInput === 'auto'
    ? inferInputFormat(value, outputFormat)
    : requestedInput;
  const trimmed = value.trim();

  if (inputFormat === 'neo_address') {
    if (outputFormat !== 'script_hash') {
      throw new ValidationError('Neo addresses can only be converted to script_hash');
    }
    if (!neoAddressIsValid(trimmed)) throw new ValidationError('Invalid Neo N3 address checksum');
    return {
      inputFormat,
      outputFormat,
      value: `0x${neonJs.wallet.getScriptHashFromAddress(trimmed).toLowerCase()}`,
    };
  }

  if (inputFormat === 'script_hash') {
    if (outputFormat !== 'neo_address') {
      throw new ValidationError('Script hashes can only be converted to neo_address');
    }
    if (!HASH160_RE.test(trimmed)) throw new ValidationError('script_hash must be 20 bytes');
    const hash = trimmed.replace(/^0x/i, '').toLowerCase();
    return { inputFormat, outputFormat, value: neonJs.wallet.getAddressFromScriptHash(hash) };
  }

  if (outputFormat === 'neo_address' || outputFormat === 'script_hash') {
    throw new ValidationError(`${outputFormat} requires semantic address/hash input`);
  }

  let bytes: Buffer;
  if (inputFormat === 'utf8') bytes = Buffer.from(value, 'utf8');
  else if (inputFormat === 'hex') bytes = Buffer.from(normalizeHex(trimmed), 'hex');
  else if (inputFormat === 'base64') bytes = decodeBase64(trimmed);
  else if (inputFormat === 'integer') {
    if (!/^(?:0|-?[1-9]\d*)$/.test(trimmed) || trimmed === '-0') {
      throw new ValidationError('Integer input must be canonical decimal');
    }
    bytes = integerToSignedLittleEndian(BigInt(trimmed));
  } else {
    throw new ValidationError('Unsupported semantic conversion');
  }

  let converted: string;
  if (outputFormat === 'utf8') {
    const decoded = bytes.toString('utf8');
    if (!Buffer.from(decoded, 'utf8').equals(bytes)) {
      throw new ValidationError('Byte input is not valid round-trippable UTF-8');
    }
    converted = decoded;
  } else if (outputFormat === 'hex') converted = bytes.toString('hex');
  else if (outputFormat === 'base64') converted = bytes.toString('base64');
  else converted = signedLittleEndianToInteger(bytes).toString();

  return {
    inputFormat,
    outputFormat,
    value: converted,
    byteLength: bytes.length,
    integerEncoding: inputFormat === 'integer' || outputFormat === 'integer'
      ? 'Neo VM signed little-endian two\'s-complement'
      : undefined,
  };
}

function opcodeCategory(name: string): string {
  if (name.startsWith('PUSH')) return 'stack/data';
  if (/^(JMP|CALL|TRY|ENDTRY|RET|ABORT|ASSERT)/.test(name)) return 'control-flow';
  if (/^(LD|ST|NEW|PACK|UNPACK|PICK|APPEND|SETITEM|REMOVE|CLEAR)/.test(name)) return 'data-structure';
  if (/^(ADD|SUB|MUL|DIV|MOD|POW|SHL|SHR|INC|DEC|NEGATE|ABS|SIGN)/.test(name)) return 'arithmetic';
  if (/^(EQUAL|NOTEQUAL|LT|LE|GT|GE|NUMEQUAL|NUMNOTEQUAL|BOOLAND|BOOLOR)/.test(name)) return 'comparison';
  if (/^(AND|OR|XOR|NOT|INVERT)/.test(name)) return 'bitwise';
  if (name === 'SYSCALL') return 'interop';
  if (/^(CONVERT|ISTYPE)/.test(name)) return 'type';
  return 'vm';
}

function opcodeExplanation(name: string, syscall?: string): string {
  if (name.startsWith('PUSH')) return 'Pushes a constant or byte sequence onto the evaluation stack.';
  if (name === 'SYSCALL') return syscall
    ? `Calls the Neo runtime interop service ${syscall}.`
    : 'Calls a Neo runtime interop service identified by the operand.';
  if (name === 'RET') return 'Returns from the current call frame.';
  if (name.startsWith('CALL')) return 'Invokes another location, method token, or contract call path.';
  if (name.startsWith('JMP')) return 'Changes control flow, optionally based on a stack condition.';
  if (name.startsWith('LD')) return 'Loads a value into the evaluation stack.';
  if (name.startsWith('ST')) return 'Stores a value from the evaluation stack.';
  if (/^(ADD|SUB|MUL|DIV|MOD|POW)/.test(name)) return 'Performs an integer arithmetic operation.';
  if (/^(EQUAL|NOTEQUAL|LT|LE|GT|GE|NUMEQUAL|NUMNOTEQUAL)/.test(name)) {
    return 'Compares stack values and pushes a Boolean result.';
  }
  if (/^(PACK|UNPACK|NEW|APPEND|SETITEM|REMOVE|CLEAR)/.test(name)) {
    return 'Creates or mutates a VM collection value.';
  }
  return `Executes the NeoVM ${name} instruction.`;
}

function decodeScript(input: Record<string, unknown>): Record<string, unknown> {
  const value = requireString(input, 'script').trim();
  const requested = String(input.inputFormat || 'auto');
  if (!['auto', 'hex', 'base64'].includes(requested)) {
    throw new ValidationError('inputFormat must be auto, hex, or base64');
  }
  const format = requested === 'auto'
    ? (/^(?:0x)?[0-9a-fA-F]+$/.test(value) ? 'hex' : 'base64')
    : requested;
  const scriptHex = format === 'hex'
    ? normalizeHex(value)
    : decodeBase64(value).toString('hex');
  const syscallNames = new Map(
    Object.entries(neonJs.sc.InteropServiceCode).map(([name, code]) => [String(code).toLowerCase(), name]),
  );

  let tokens: InstanceType<typeof neonJs.sc.OpToken>[];
  try {
    tokens = neonJs.sc.OpToken.fromScript(scriptHex);
  } catch (error) {
    throw new ValidationError(`Invalid NeoVM script: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (tokens.length > MAX_SCRIPT_INSTRUCTIONS) {
    throw new ValidationError(`Script exceeds the ${MAX_SCRIPT_INSTRUCTIONS}-instruction limit`);
  }

  let offset = 0;
  const instructions = tokens.map((token, index) => {
    const encoded = token.toScript();
    const name = neonJs.sc.OpCode[token.code] || `UNKNOWN_0x${token.code.toString(16).padStart(2, '0')}`;
    const syscall = name === 'SYSCALL' && token.params
      ? syscallNames.get(token.params.toLowerCase()) || null
      : null;
    const instruction = {
      index,
      offset,
      size: encoded.length / 2,
      opcode: name,
      operand: token.params || null,
      syscall,
      category: opcodeCategory(name),
      explanation: opcodeExplanation(name, syscall || undefined),
    };
    offset += encoded.length / 2;
    return instruction;
  });

  const categories = instructions.reduce<Record<string, number>>((acc, instruction) => {
    acc[instruction.category] = (acc[instruction.category] || 0) + 1;
    return acc;
  }, {});

  return {
    inputFormat: format,
    scriptHex,
    byteLength: scriptHex.length / 2,
    instructionCount: instructions.length,
    categories,
    instructions,
    caveat:
      'This is deterministic NeoVM disassembly, not source-code recovery. Runtime values and contract intent require manifest and on-chain execution context.',
  };
}

export async function dispatchNeoDataTool(
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (name === 'inspect_neo_value') {
    return createSuccessResponse(inspectValue(requireString(input, 'value')));
  }
  if (name === 'convert_neo_data') {
    return createSuccessResponse(convertValue(input));
  }
  if (name === 'decode_neo_script') {
    return createSuccessResponse(decodeScript(input));
  }
  throw new ValidationError(`Unknown Neo data tool: ${name}`);
}
