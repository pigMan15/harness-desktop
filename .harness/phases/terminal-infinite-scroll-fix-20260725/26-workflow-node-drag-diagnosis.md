# Workflow Node Drag Diagnosis

## Symptom

Workflow Studio route nodes appeared not to drag.

## Cause

`WorkflowCanvas` rendered React Flow as a controlled component with a `nodes` prop, but did not provide `onNodesChange` or maintain React Flow node state. Node positions were recomputed from route order on each render:

```text
position: { x: 100, y: i * 80 + 20 }
```

Without React Flow state updates, drag interactions could not persist during pointer movement and appeared stuck or snapped back.

## Fix

`WorkflowCanvas` now uses React Flow's `useNodesState` and passes `onNodesChange` to `<ReactFlow>`. Route order is still updated on drag stop using the dragged node's Y position.

Follow-up: after dragging, node positions were initially preserved while edges still represented route order, causing visually tangled connections. Workflow routes are ordered pipelines rather than freeform diagrams, so positions are now normalized back to the vertical route lane after the route order updates.

Follow-up: dragging a node over another node should not replace it. Drop ordering now sorts all current node Y positions and moves the dragged node to that sorted index. This makes "drag above target" behave as "insert before target".

Current edge behavior is intentional for the existing schema: `routes[intent][risk]` is an ordered array of node IDs, so edges are derived from adjacent route nodes. Deleting or manually adding arbitrary edges would require a workflow schema change from linear routes to an explicit graph/DAG representation.

## Verification

Command:

```powershell
.\node_modules\.bin\tsc.CMD --project apps\renderer\tsconfig.json --noEmit
```

Result: exit code 0.
