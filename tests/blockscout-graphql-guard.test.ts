/**
 * Adversarial tests for the Neo X Blockscout GraphQL guard
 * (src/indexer/blockscout-graphql-guard.ts).
 *
 * This guard is the second line of defense behind the gated-off `x_graphql` tool: it bounds
 * an arbitrary, model-authored GraphQL document to a conservative read-only envelope. It is
 * a HEURISTIC (no GraphQL parser), so the tests assert both that it accepts a normal read
 * query and that it rejects the dangerous shapes — writes, subscriptions, introspection,
 * directives, deep nesting, huge selection sets, oversize documents, and non-object
 * variables — always with a typed `ValidationError` and never an uncaught crash.
 */

import {
  validateGraphqlQuery,
  MAX_GRAPHQL_QUERY_LENGTH,
  MAX_GRAPHQL_DEPTH,
  MAX_GRAPHQL_FIELDS,
} from '../src/indexer/blockscout-graphql-guard';
import { ValidationError } from '../src/utils/errors';

/** A well-formed, shallow read query used as the "known good" baseline. */
const NORMAL_QUERY = `query GetAddress {
  address(hash: "0xabc") {
    hash
    transactions {
      hash
      value
    }
  }
}`;

/** Build a query nested `levels` field-deep (plus the outer operation brace). */
function nestedQuery(levels: number): string {
  let inner = 'id';
  for (let i = 0; i < levels; i += 1) {
    inner = `f${i} { ${inner} }`;
  }
  return `query { ${inner} }`;
}

describe('validateGraphqlQuery — accepts a normal read query', () => {
  it('accepts a shallow depth-3 query and returns it unchanged', () => {
    const out = validateGraphqlQuery(NORMAL_QUERY);
    expect(out).toEqual({ query: NORMAL_QUERY });
  });

  it('accepts an anonymous operation', () => {
    const q = '{ stats { totalBlocks } }';
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });

  it('accepts the harmless __typename meta-field (not treated as introspection)', () => {
    const q = 'query { address(hash: "0x1") { __typename hash } }';
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });

  it('returns the original query verbatim (no rewriting/normalization)', () => {
    const q = 'query   {   address(hash:"0x1"){hash}   }';
    expect(validateGraphqlQuery(q).query).toBe(q);
  });
});

describe('validateGraphqlQuery — operation kind (read-only)', () => {
  it('rejects a mutation operation', () => {
    expect(() =>
      validateGraphqlQuery('mutation { setThing(id: 1) { ok } }'),
    ).toThrow(ValidationError);
  });

  it('rejects a subscription operation', () => {
    expect(() =>
      validateGraphqlQuery('subscription { newBlocks { hash } }'),
    ).toThrow(ValidationError);
  });

  it('does not over-reject a field whose name merely contains a keyword', () => {
    // 'subscriptionPlans' / 'mutationLog' are field names, not operations.
    const q = 'query { subscriptionPlans { id } mutationLog { id } }';
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });

  it('does not treat a keyword hidden in a comment as an operation', () => {
    // Comments are stripped before the operation scan, so this inert text is ignored.
    const q = 'query { hash } # mutation subscription';
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });
});

describe('validateGraphqlQuery — introspection (schema mining)', () => {
  it('rejects __schema introspection', () => {
    expect(() =>
      validateGraphqlQuery('query { __schema { types { name } } }'),
    ).toThrow(ValidationError);
  });

  it('rejects __type introspection', () => {
    expect(() =>
      validateGraphqlQuery('query { __type(name: "Address") { name } }'),
    ).toThrow(ValidationError);
  });

  it('does not treat __schema inside a string value as introspection', () => {
    // The reserved token lives in an inert string argument, so it is stripped first.
    const q = 'query { search(q: "__schema") { hash } }';
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });
});

describe('validateGraphqlQuery — directives', () => {
  it('rejects an @directive', () => {
    expect(() =>
      validateGraphqlQuery('query { address(hash: "0x1") { hash @skip(if: true) } }'),
    ).toThrow(ValidationError);
  });

  it('does not reject an @ that only appears inside a string value', () => {
    const q = 'query { search(q: "a@b.com") { hash } }';
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });
});

describe('validateGraphqlQuery — depth cap (DoS)', () => {
  it('rejects depth-12 nesting', () => {
    expect(() => validateGraphqlQuery(nestedQuery(12))).toThrow(ValidationError);
  });

  it('accepts nesting exactly at the depth cap', () => {
    // MAX_GRAPHQL_DEPTH total braces: outer `query {` + (cap - 1) field levels.
    const q = nestedQuery(MAX_GRAPHQL_DEPTH - 1);
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });

  it('does not count braces that live inside a string value', () => {
    const q = `query { search(q: "${'}'.repeat(40)}") { hash } }`;
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });
});

describe('validateGraphqlQuery — complexity cap (DoS)', () => {
  it('rejects a 200-field query', () => {
    const fields = Array.from({ length: 200 }, (_, i) => `f${i}`).join(' ');
    expect(() => validateGraphqlQuery(`query { ${fields} }`)).toThrow(ValidationError);
  });

  it('accepts a query near but under the field cap', () => {
    const fields = Array.from({ length: MAX_GRAPHQL_FIELDS - 2 }, (_, i) => `f${i}`).join(' ');
    const q = `query { ${fields} }`;
    expect(validateGraphqlQuery(q)).toEqual({ query: q });
  });
});

describe('validateGraphqlQuery — length + shape', () => {
  it('rejects a document over the length cap', () => {
    const q = `query { ${'a'.repeat(MAX_GRAPHQL_QUERY_LENGTH + 100)} }`;
    expect(q.length).toBeGreaterThan(MAX_GRAPHQL_QUERY_LENGTH);
    expect(() => validateGraphqlQuery(q)).toThrow(ValidationError);
  });

  it('rejects an empty or whitespace-only query', () => {
    expect(() => validateGraphqlQuery('')).toThrow(ValidationError);
    expect(() => validateGraphqlQuery('   \n\t ')).toThrow(ValidationError);
  });

  it('rejects a non-string query without crashing', () => {
    expect(() => validateGraphqlQuery(123 as unknown as string)).toThrow(ValidationError);
    expect(() => validateGraphqlQuery(null as unknown as string)).toThrow(ValidationError);
    expect(() => validateGraphqlQuery({ query: 'x' } as unknown as string)).toThrow(ValidationError);
  });
});

describe('validateGraphqlQuery — variables must be a plain JSON object', () => {
  it('accepts and passes through a plain variables object unchanged', () => {
    const query = 'query ($h: String!) { address(hash: $h) { hash } }';
    const variables = { h: '0x1', nested: { limit: 10, flags: [true, false] } };
    expect(validateGraphqlQuery(query, variables)).toEqual({ query, variables });
  });

  it('treats absent/undefined/null variables as no variables', () => {
    const query = 'query { stats { totalBlocks } }';
    expect(validateGraphqlQuery(query)).toEqual({ query });
    expect(validateGraphqlQuery(query, undefined)).toEqual({ query });
    expect(validateGraphqlQuery(query, null as unknown as object)).toEqual({ query });
  });

  it('rejects an array as variables', () => {
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', [] as unknown as object),
    ).toThrow(ValidationError);
  });

  it('rejects a primitive as variables', () => {
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', 'nope' as unknown as object),
    ).toThrow(ValidationError);
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', 42 as unknown as object),
    ).toThrow(ValidationError);
  });

  it('rejects variables carrying a function value (no functions)', () => {
    const hostile = { evil: () => 'boom' };
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', hostile as unknown as object),
    ).toThrow(ValidationError);
  });

  it('rejects variables carrying a function nested deep in the tree', () => {
    const hostile = { a: { b: { c: [{ d: () => 1 }] } } };
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', hostile as unknown as object),
    ).toThrow(ValidationError);
  });

  it('rejects oversize variables without crashing', () => {
    const hostile = { blob: 'x'.repeat(9 * 1024) };
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', hostile),
    ).toThrow(ValidationError);
  });

  it('rejects a cyclic variables object as a bounded rejection (no infinite loop)', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      validateGraphqlQuery('query { stats { totalBlocks } }', cyclic),
    ).toThrow(ValidationError);
  });
});
