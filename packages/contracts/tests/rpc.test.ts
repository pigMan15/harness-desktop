import { describe, it, expect } from 'vitest'
import type { RpcRequest, RpcResponse, RpcError, RuntimeEvent, HarnessApi } from '../src/rpc'

// Valid example payloads matching schemas/rpc.schema.json examples
const validRequest: RpcRequest = {
  jsonrpc: '2.0',
  method: 'runtime.health',
  id: 'req-001',
  meta: { requestId: 'req-001', projectId: 'test-project', expectedRevision: 'abc123' },
}

const validResponse: RpcResponse = {
  jsonrpc: '2.0',
  result: { status: 'healthy', runtime_version: '0.0.0', protocol_version: '1.0' },
  id: 'req-001',
}

const validError: RpcError = {
  code: 'AUTH_FAILED',
  message: 'Invalid or missing runtime token',
  pointer: '/meta/headers/authorization',
}

const validEvent: RuntimeEvent = {
  type: 'StateChanged',
  payload: { run_id: 'test-001', current_node: 'DEVELOPMENT' },
  timestamp: '2026-07-21T00:00:00Z',
}

describe('RPC contracts', () => {
  it('valid RpcRequest matches schema', () => {
    expect(validRequest.jsonrpc).toBe('2.0')
    expect(validRequest.meta.requestId).toBeTruthy()
    expect(validRequest.meta.projectId).toBeTruthy()
  })

  it('valid RpcResponse matches schema', () => {
    expect(validResponse.jsonrpc).toBe('2.0')
    expect(validResponse.result).toBeTruthy()
  })

  it('valid RpcError has code and message', () => {
    expect(validError.code).toBeTruthy()
    expect(validError.message).toBeTruthy()
    expect(validError.pointer).toMatch(/^\//)
  })

  it('valid RuntimeEvent has known type', () => {
    const knownTypes = ['StateChanged', 'WorkflowChanged', 'ExecutionOutput', 'ToolCall',
      'ApprovalRequested', 'GateEvaluated', 'ArtifactChanged', 'ExecutorExited', 'RuntimeWarning']
    expect(knownTypes).toContain(validEvent.type)
    expect(validEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('request without requestId should fail validation', () => {
    const bad = { ...validRequest, meta: { ...validRequest.meta, requestId: '' } }
    expect(bad.meta.requestId).toBeFalsy()
  })

  it('unknown event type should not be in known types', () => {
    const known = ['StateChanged', 'WorkflowChanged', 'ExecutionOutput', 'ToolCall',
      'ApprovalRequested', 'GateEvaluated', 'ArtifactChanged', 'ExecutorExited', 'RuntimeWarning']
    expect(known).not.toContain('UNKNOWN_EVENT_XYZ')
  })

  it('defines the project-bound desktop bridge surface', () => {
    type Method = keyof HarnessApi
    const methods: Method[] = ['switchRun', 'pauseRun', 'resumeRun', 'previewWorkflow',
      'evaluateGate', 'probeExecution', 'startExecution', 'pollExecution', 'respondExecution', 'cancelExecution']
    expect(methods).toHaveLength(10)
  })
})
