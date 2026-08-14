/**
 * Generates example values from JSON schemas. Most specs document their request bodies with a
 * schema and no example at all, which would leave every imported request with an empty body, so
 * the schema is turned into a skeleton the user can fill in.
 */

/**
 * The parts of a JSON schema that the example generator understands. The OpenAPI schema types
 * differ between the specification versions, but all of them are JSON schemas at their core.
 */
export type ExampleSchema = {
  $ref?: string;
  type?: string | string[];
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  readOnly?: boolean;
  properties?: Record<string, ExampleSchema>;
  items?: ExampleSchema;
  allOf?: ExampleSchema[];
  oneOf?: ExampleSchema[];
  anyOf?: ExampleSchema[];
};

/**
 * Generates an example value for the given schema, or undefined if there is no usable schema.
 */
export type ExampleGenerator = (schema: unknown) => unknown;

/**
 * Creates an example generator bound to one document, which schema references are resolved in.
 * @param document the document the schemas belong to
 * @returns the generator to use for all schemas of the document
 */
export function createExampleGenerator(document: unknown): ExampleGenerator {
  /**
   * Generates an example value for a single schema.
   * @param schema the schema to generate a value for
   * @param ancestors the schemas that the current value is nested in, used to stop recursion
   * @returns the generated value, or undefined if the schema describes nothing usable
   */
  function generate(schema: ExampleSchema | undefined, ancestors: Set<ExampleSchema>): unknown {
    // a schema that is part of a reference cycle is left as a reference by the parser
    const resolved = resolveRef(schema);
    if (resolved == null || ancestors.has(resolved)) return;

    if (resolved.example !== undefined) return resolved.example;
    if (resolved.default !== undefined) return resolved.default;
    if (resolved.enum != null && resolved.enum.length > 0) return resolved.enum[0];

    ancestors.add(resolved);
    try {
      // any of the alternatives is valid, so the first one is as good a starting point as any
      const alternative = resolved.oneOf?.[0] ?? resolved.anyOf?.[0];
      if (alternative != null) return generate(alternative, ancestors);

      const type = getSchemaType(resolved);
      if (type === 'array') {
        const item = generate(resolved.items, ancestors);
        return item === undefined ? [] : [item];
      }
      if (type === 'object' || resolved.properties != null || resolved.allOf != null) {
        return generateObject(resolved, ancestors);
      }

      return generatePrimitive(type);
    } finally {
      ancestors.delete(resolved);
    }
  }

  /**
   * Generates an example object. Read-only properties are left out, because they are owned by the
   * server and sending them is pointless at best.
   * @param schema the object schema to generate a value for
   * @param ancestors the schemas that the object is nested in, used to stop recursion
   * @returns the generated object
   */
  function generateObject(schema: ExampleSchema, ancestors: Set<ExampleSchema>) {
    const example: Record<string, unknown> = {};

    // a value has to satisfy every branch of an allOf, so their properties end up in one object
    for (const branch of schema.allOf ?? []) {
      const branchExample = generate(branch, ancestors);
      if (isPlainObject(branchExample)) Object.assign(example, branchExample);
    }

    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      if (property.readOnly) continue;
      const value = generate(property, ancestors);
      if (value !== undefined) example[name] = value;
    }

    return example;
  }

  /**
   * Resolves a schema reference within the document. The parser dereferences the document already,
   * but it leaves the references of recursive schemas in place, which are the ones appearing here.
   * @param schema the schema that may be a reference
   * @returns the referenced schema, the given schema if it is none, or undefined if it is unknown
   */
  function resolveRef(schema: ExampleSchema | undefined) {
    if (schema?.$ref == null) return schema;
    if (!schema.$ref.startsWith('#/')) return;

    let target: unknown = document;
    for (const segment of schema.$ref.slice(2).split('/')) {
      if (!isPlainObject(target)) return;
      target = target[segment.replaceAll('~1', '/').replaceAll('~0', '~')];
    }
    return isPlainObject(target) ? (target as ExampleSchema) : undefined;
  }

  return (schema) => generate(schema as ExampleSchema | undefined, new Set());
}

/**
 * @param type the type of the schema to generate a value for
 * @returns an empty value of the given type, or undefined if the schema has no known type
 */
function generatePrimitive(type?: string) {
  switch (type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
  }
}

/**
 * @param schema the schema to read the type of
 * @returns the type of the schema, ignoring the `null` that OpenAPI 3.1 allows to add to it
 */
function getSchemaType(schema: ExampleSchema) {
  if (!Array.isArray(schema.type)) return schema.type;
  return schema.type.find((type) => type !== 'null') ?? 'null';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
