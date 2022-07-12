<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import type { ClientMessage, OpMsg, ServerMessage } from "./message";
  import json0, { Operation } from "../json-ot";

  const dispatch = createEventDispatcher();

  let baseRev = 0;
  let data: any = {
    foo: {
      bar: ["a", "b", "c"],
    },
    baz: 3,
  };
  let msgId = 0;

  // server op id (array index) -> op
  const opHistory = [];

  onMount(async () => {
    // 初始化，向所有客户端发送完整的快照
    dispatch("message", <ServerMessage>{
      type: "init",
      baseRev,
      data,
    });
  });

  // 服务端接收客户端发送的消息
  export const receive = (msg: ClientMessage) => {
    switch (msg.type) {
      case "operation": {
        let jsonOp = msg.op.jsonOp;
        // 客户端的 op base rev 比服务端的版本落后，对 op 做 OT，把 op base rev 变换到服务端的最新版本
        if (msg.op.baseRev < baseRev) {
          let rightJsonOp: Operation = [];
          // NOTE 要注意 rev id 和 op id 的区别，opHistory 的 key 是 op id，但是 baseRev
          // 是 rev id，由于 op id 直接基于 rev id，所以这里用 revId 索引 opHistory 没有问题。
          for (let revId = msg.op.baseRev; revId < baseRev; revId++) {
            rightJsonOp = json0.compose(rightJsonOp, opHistory[revId]);
          }
          const [newLeftJsonOp, _newRightJsonOp] = json0.transformX(
            jsonOp,
            rightJsonOp
          );
          jsonOp = newLeftJsonOp;
        }

        data = json0.apply(data, jsonOp);

        const op: OpMsg = {
          // TODO 如果客户端的 msg id 不唯一，如何确保服务端的 msg id 唯一？
          id: msg.op.id,
          baseRev,
          jsonOp,
        };

        opHistory.push(op);
        baseRev++;

        // 向所有客户端发送确认 op
        dispatch("message", <ServerMessage>{
          type: "operation",
          newRev: baseRev,
          op,
        });
        break;
      }
      case "fetch-op": {
        // 请求指定区间的 op 列表
        if ("endRev" in msg) {
          dispatch("message", <ServerMessage>{
            clientId: msg.clientId,
            msgId: msg.msgId,
            type: "batch-op",
            startRev: msg.startRev,
            endRev: msg.endRev,
            ops: opHistory.slice(msg.startRev, msg.endRev),
          });
        } else {
          dispatch("message", <ServerMessage>{
            clientId: msg.clientId,
            msgId: msg.msgId,
            type: "batch-op",
            startRev: msg.startRev,
            endRev: msg.endRev,
            ops: opHistory.slice(msg.startRev),
          });
        }
      }
    }
  };
</script>

<div class="server">
  <div class="label">
    <strong><span style="font-size: 30px">Server</span></strong>
    <br />
    Revision: {baseRev}
  </div>
  <pre class="data">{JSON.stringify(data, null, 2)}</pre>
</div>

<style>
  .server {
    height: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    position: relative;
    border-bottom: solid 1px black;
  }
  .data {
    margin: 10px;
    padding: 5px;
    border: solid 1px lightgray;
    width: 30%;
    height: 200px;
    overflow-y: scroll;
  }
  .label {
    position: absolute;
    left: 5px;
    top: 5px;
  }
</style>
