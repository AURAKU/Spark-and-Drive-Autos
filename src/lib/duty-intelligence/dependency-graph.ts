import { engineError } from "./errors";
import { expressionDependencies } from "./taxable-base-expression";

export type GraphNode = {
  chargeKey: string;
  dependencyOrder: number;
  taxableBaseExpression: string;
};

export function buildDependencyGraph(nodes: GraphNode[]): {
  ordered: GraphNode[];
  edges: Map<string, string[]>;
} {
  const byKey = new Map(nodes.map((n) => [n.chargeKey, n]));
  const edges = new Map<string, string[]>();

  for (const node of nodes) {
    const deps = expressionDependencies(node.taxableBaseExpression).filter((dep) => byKey.has(dep));
    edges.set(node.chargeKey, deps);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: GraphNode[] = [];

  function visit(key: string): void {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw engineError("RULE_DEPENDENCY_ERROR", `Circular dependency detected at ${key}`, {
        details: { chargeKey: key },
      });
    }
    visiting.add(key);
    for (const dep of edges.get(key) ?? []) {
      visit(dep);
    }
    visiting.delete(key);
    visited.add(key);
    const node = byKey.get(key);
    if (node) ordered.push(node);
  }

  const sortedByExplicitOrder = [...nodes].sort((a, b) => a.dependencyOrder - b.dependencyOrder);
  for (const node of sortedByExplicitOrder) {
    visit(node.chargeKey);
  }

  return { ordered, edges };
}

export function validateDependencyGraph(nodes: GraphNode[]): void {
  buildDependencyGraph(nodes);
}
