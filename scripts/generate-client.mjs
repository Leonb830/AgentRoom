// Generate the engineType="client" Prisma client using the packaged WASM compiler.
// No native query engine is needed. The migration CLI still requires its schema engine.
import prisma from "@prisma/internals";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const generators = await prisma.getGenerators({ schemaPath: "prisma/schema.prisma", skipDownload: true,
  registry: { "prisma-client-js": { type: "rpc", generatorPath: require.resolve("@prisma/client/generator-build/index.js"), isNode: true } }
});
try { for (const generator of generators) await generator.generate(); }
finally { for (const generator of generators) generator.stop(); }
