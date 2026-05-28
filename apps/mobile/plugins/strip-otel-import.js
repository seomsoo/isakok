// Hermes AOT compiler cannot handle `import(VARIABLE)` (dynamic import with non-literal argument).
// supabase-js uses `import(OTEL_PKG)` for optional OpenTelemetry — replace with no-op.
module.exports = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        if (
          path.node.callee.type === 'Import' &&
          path.node.arguments.length >= 1 &&
          path.node.arguments[0].type === 'Identifier' &&
          path.node.arguments[0].name === 'OTEL_PKG'
        ) {
          path.replaceWith(
            t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), [
              t.nullLiteral(),
            ]),
          )
        }
      },
    },
  }
}
