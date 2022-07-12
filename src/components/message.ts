import type { Operation } from "../json-ot"

export type OpMsg = {
  id: string
  baseRev: number
  jsonOp: Operation
}

export type BatchOpMessage = {
  clientId: string,
  msgId: string,
  type: 'batch-op',
  startRev: number
  endRev: number
  ops: OpMsg[]
}

export type ServerMessage = {
  type: 'init'
  baseRev: number
  data: any
} | {
  type: 'operation',
  newRev: number,
  op: OpMsg
} | BatchOpMessage

export type ClientMessage = {
  type: 'operation',
  op: OpMsg
} | {
  // 获取从 startRev 开始到 envRev 之间的所有 op
  clientId: string,
  msgId: string,
  type: 'fetch-op',
  /** inclusive */
  startRev: number,
  /** exclusive */
  endRev?: number
}