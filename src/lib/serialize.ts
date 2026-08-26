// Prisma returns Date and Decimal instances, which aren't safe to pass
// directly from a Server Component into a Client Component prop. This
// walks plain objects/arrays and converts them to JSON-safe primitives.
export function toPlain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (val && typeof val === "object" && typeof val.toFixed === "function") {
        return val.toString();
      }
      return val;
    }),
  );
}
