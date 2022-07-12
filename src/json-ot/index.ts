import json0 from "./json0"

export type Path = (string | number)[]

export type Component = { p: Path } & ({
  si: string,
} | {
  sd: string,
} | {
  li: any,
} | {
  ld: any
} | {
  li: any,
  ld: any,
} | {
  lm: number
} | {
  oi: any
} | {
  od: any
} | {
  t: string,
  o: any
})

export type Operation = Component[]

export default json0 as {
  apply(snapshot: any, op: Operation): any
  append(op: Operation, c: Component): void
  compose(op1: Operation, op2: Operation): Operation
  transformX(leftOp: Operation, rightOp: Operation): [Operation, Operation]
  transform(leftOp: Operation, rightOp: Operation, bias: 'left' | 'right'): Operation
}

export function checkOp(op: Operation): boolean {
  if (!Array.isArray(op)) {
    return false
  }
  if (
    !op.every((c: any) => {
      if (typeof c !== "object") {
        return false;
      }
      const len = Object.keys(c).length;
      if (!Array.isArray(c.p)) {
        return false;
      }
      const last = c.p[c.p.length - 1];
      return (
        (c.li && len === 2 && typeof last === "number") ||
        (c.ld && len == 2 && typeof last == "number") ||
        (c.li && c.ld && len === 3 && typeof last === "number") ||
        (c.lm && len === 2 && typeof last === "number") ||
        (c.oi && len === 2 && typeof last === "string") ||
        (c.od && len === 2 && typeof last === "string") ||
        (c.oi && c.od && len === 3 && typeof last === "string") ||
        (c.si && len === 2 && typeof last === "number") ||
        (c.sd && len === 2 && typeof last === "number")
      );
    })
  ) {
    return false
  }
  return true
}