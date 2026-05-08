// Pure split-tree state machine. No blessed.
// A node is either a leaf {id} or a split {orient: 'h'|'v', a, b}.

let nextId = 1;
export function newLeafId() { return `leaf-${nextId++}`; }

export function makeRoot(leafId = newLeafId()) {
  return { id: leafId };
}

export function findLeaf(node, id) {
  if (node.id) return node.id === id ? node : null;
  return findLeaf(node.a, id) || findLeaf(node.b, id);
}

export function leaves(node) {
  if (node.id) return [node];
  return [...leaves(node.a), ...leaves(node.b)];
}

export function split(root, focusId, orient, newId = newLeafId()) {
  function go(n) {
    if (n.id) {
      if (n.id !== focusId) return n;
      return { orient, a: n, b: { id: newId } };
    }
    return { orient: n.orient, a: go(n.a), b: go(n.b) };
  }
  return { tree: go(root), newId };
}

export function close(root, focusId) {
  if (root.id) {
    return root.id === focusId ? null : root;
  }
  function go(n) {
    if (n.id) return n.id === focusId ? null : n;
    const a = go(n.a);
    const b = go(n.b);
    if (a && b) return { orient: n.orient, a, b };
    return a || b;
  }
  return go(root);
}

// neighbour(root, focusId, dir) — dir ∈ 'h'|'j'|'k'|'l'
// 'h' = left, 'l' = right (vertical splits), 'k' = up, 'j' = down (horizontal splits).
export function neighbour(root, focusId, dir) {
  const path = pathTo(root, focusId);
  if (!path) return null;
  // Walk up: find the nearest ancestor whose split orientation matches the
  // direction and where we came from the appropriate child.
  for (let i = path.length - 1; i >= 1; i--) {
    const parent = path[i - 1].node;
    const cameFrom = path[i].side; // 'a' or 'b'
    if (!parent.orient) continue;
    if ((dir === 'h' || dir === 'l') && parent.orient !== 'v') continue;
    if ((dir === 'k' || dir === 'j') && parent.orient !== 'h') continue;
    if ((dir === 'h' || dir === 'k') && cameFrom === 'b') {
      // Move to deepest leaf on the 'a' side (rightmost / bottommost of left/up)
      return rightmostLeaf(parent.a, dir === 'h' ? 'v' : 'h');
    }
    if ((dir === 'l' || dir === 'j') && cameFrom === 'a') {
      return leftmostLeaf(parent.b, dir === 'l' ? 'v' : 'h');
    }
  }
  return null;
}

function pathTo(root, id, acc = [{ node: root, side: null }]) {
  const cur = acc[acc.length - 1].node;
  if (cur.id === id) return acc;
  if (cur.id) return null;
  return (
    pathTo(root, id, acc.concat({ node: cur.a, side: 'a' })) ||
    pathTo(root, id, acc.concat({ node: cur.b, side: 'b' }))
  );
}

function leftmostLeaf(node) {
  while (!node.id) node = node.a;
  return node.id;
}
function rightmostLeaf(node) {
  while (!node.id) node = node.b;
  return node.id;
}

// Compute pixel rectangles for each leaf given a screen rect.
// Returns Map<leafId, {top,left,width,height}>.
export function layout(node, rect) {
  const out = new Map();
  function place(n, r) {
    if (n.id) { out.set(n.id, r); return; }
    if (n.orient === 'v') {
      const half = Math.floor(r.width / 2);
      place(n.a, { ...r, width: half });
      place(n.b, { ...r, left: r.left + half, width: r.width - half });
    } else {
      const half = Math.floor(r.height / 2);
      place(n.a, { ...r, height: half });
      place(n.b, { ...r, top: r.top + half, height: r.height - half });
    }
  }
  place(node, rect);
  return out;
}
