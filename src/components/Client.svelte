<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import json0, { checkOp } from "../json-ot";

  import type { ClientMessage, OpMsg, ServerMessage } from "./message";

  export let prefix: string;

  const dispatch = createEventDispatcher();

  let canSend = true;
  let canRecv = true;
  // 只有服务端会对 baseRev 做自增操作，客户端只会跟进从服务端返回的新 baseRev
  let baseRev: number;
  let data: any;
  let opText: string;
  let error: string;
  let msgId = 0;
  let logs: string[] = [];

  // 接收到服务端发送的OP列表后的回调
  // msg id -> callback
  let batchOpCallbacks: Map<string, (msg: ServerMessage) => void> = new Map

  // 已发送待确认的op
  let pendingOp: OpMsg | null = null;

  // 待发送的op，只有上一个已发送的OP经过服务端确认后才会继续发送OP，剩余的OP会保存在这里
  // json-ot 的 compose 操作组合 OP，所以缓冲区只需要一个 OP
  let bufferedOp: OpMsg | null = null;

  const addLog = (log: string) => {
    logs.unshift(
      new Date().toLocaleTimeString("chinese", { hour12: false }) + " " + log
    );
    logs = logs;
  };

  const sendOp = (op: OpMsg) => {
    if (!canSend) {
      return;
    }
    dispatch("message", <ClientMessage>{
      type: "operation",
      op,
    });
  };

  // 客户端接收服务端发送的消息
  export const receive = (msg: ServerMessage) => {
    if (!canRecv) {
      return;
    }
    switch (msg.type) {
      case "init": {
        baseRev = msg.baseRev;
        data = msg.data;
        break;
      }
      case "operation": {
        // 收到来自服务端的 OP
        if (pendingOp) {
          if (msg.op.baseRev === baseRev) {
            // 服务端 base rev 和本地 base rev 一样
            if (msg.op.id === pendingOp.id) {
              // 收到的OP就是已发送的OP，得到确认，继续发送下一个OP
              addLog("发送的OP得到服务端的确认: " + JSON.stringify(pendingOp));
              pendingOp = null;
              baseRev = msg.newRev;
              if (bufferedOp) {
                pendingOp = bufferedOp;
                bufferedOp = null;
                addLog(
                  "buffer中有OP，继续发送OP: " + JSON.stringify(pendingOp)
                );
                sendOp(pendingOp);
              }
            } else {
              // 收到的OP不是已发送的OP，要对已发送的OP和buffer OP做OT，确保这些OP跟上收到的OP的 base rev
              // NOTE 已发送的OP没必要OT，客户端在收到服务端的确认时不会检查op是否一致

            }
          } else if (msg.op.baseRev > baseRev) {
            // 服务端的 base rev 比本地 base rev 更新
            // TODO
          } else {
            // 服务端的 base rev 比本地 base rev 落后，不可能发生
            console.log(msg);
            alert("服务端 base rev 比本地 base rev 落后！");
            return;
          }
        } else {
          // 没有已发送未确认的OP

          if (bufferedOp) {
            // 没有已发送未确认的OP，但是有缓冲OP，这种情况只会发生在断网后产生新的OP，
            // 然后联网，但是还没来得及把缓冲OP发送出去。对缓冲OP做OT
            // TODO
            return;
          }

          if (msg.op.baseRev === baseRev) {
            // 服务端 base rev 和本地 base rev 一样，apply
            addLog("收到服务端的OP，本地没有OP，直接 apply");
            data = json0.apply(data, msg.op.jsonOp);
            baseRev = msg.newRev;
          } else if (msg.op.baseRev > baseRev) {
            // 服务端的 base rev 比本地 base rev 更新，说明之前漏掉了OP，
            // 先丢弃这个OP, 从服务端请求「从本地 base rev 开始的所有OP」后，
            // 逐个 apply
            dispatch("message", <ClientMessage>{
              clientId: prefix,
              msgId: prefix + ++msgId,
              type: "fetch-op",
              startRev: baseRev,
            });
            // TODO
          } else {
            // 服务端的 base rev 比本地 base rev 落后，不可能发生
            console.log(msg);
            alert("服务端 base rev 比本地 base rev 落后！");
            return;
          }
        }
        break;
      }
      case "batch-op": {
        batchOpCallbacks.get(msg.msgId)?.(msg);
        break;
      }
    }
  };

  const performOp = () => {
    let jsonOp;
    try {
      jsonOp = eval("(" + opText + ")");
    } catch (e) {
      error = "invalid op";
      return;
    }

    if (typeof jsonOp === "object" && !Array.isArray(jsonOp)) {
      jsonOp = [jsonOp];
    }

    if (!checkOp(jsonOp)) {
      error = "invalid op";
      return;
    }

    try {
      data = json0.apply(data, jsonOp);
    } catch (e) {
      error = String(e);
      return;
    }

    opText = "";
    error = "";

    if (canSend) {
      // 联网
      if (!pendingOp) {
        // 没有已经发送且未确认的op，直接发送
        pendingOp = {
          id: prefix + ++msgId,
          baseRev,
          jsonOp,
        };
        addLog("发送OP: " + JSON.stringify(pendingOp));
        sendOp(pendingOp);
      } else {
        // 有已经发送且未确认的op，把新的op加入buffer
        if (!bufferedOp) {
          bufferedOp = {
            id: prefix + ++msgId,
            baseRev,
            jsonOp,
          };
        } else {
          bufferedOp.jsonOp = json0.compose(bufferedOp.jsonOp, jsonOp);
        }
        addLog("有已经发送但未得到确认的OP，把新的OP加入buffer");
      }
    } else {
      addLog("断网了，无法发送OP，把新的OP加入buffer");
      // 断网，加入op buffer
      if (!bufferedOp) {
        bufferedOp = {
          id: prefix + ++msgId,
          baseRev,
          jsonOp,
        };
      } else {
        bufferedOp.jsonOp = json0.compose(bufferedOp.jsonOp, jsonOp);
      }
    }
  };

  const keyPress = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      if (opText) {
        performOp();
      }
    }
  };

  $: if (canSend) {
    // 联网
    // TODO
  } else {
    // 断网
    // TODO
  }
</script>

<div class="client">
  <div>
    <span>Revision: {baseRev}</span>
    <pre class="data">{JSON.stringify(data, null, 2)}</pre>
  </div>
  <div>
    网络：<input type="checkbox" bind:checked={canSend} />上行 &nbsp;
    <input type="checkbox" bind:checked={canRecv} />下行
    <br />
    OP：
    <input
      type="text"
      bind:value={opText}
      on:keypress={keyPress}
      placeholder="回车发送OP"
    />
    {#if error}
      <span class="error">{error}</span>
    {/if}
    <br />
    {#if pendingOp}
      已发送且未确认的OP：
      <pre>{JSON.stringify(pendingOp)}</pre>
      <button>发送OP到服务器</button>
    {/if}
    {#if bufferedOp}
      缓冲OP：
      <pre>{JSON.stringify(bufferedOp)}</pre>
    {/if}
  </div>
  日志：
  <div class="logs">
    <pre>{logs.join("\n")}</pre>
  </div>
</div>

<style>
  .client {
    height: 100%;
    margin: 0 20px 0 20px;
    justify-content: start;
    justify-items: center;
    display: flex;
    flex-direction: column;
  }
  .data {
    margin: 10px 0 10px 0;
    border: solid 1px lightgray;
    padding: 5px;
    width: 50%;
    height: 200px;
    overflow-y: scroll;
  }
  .error {
    color: hsl(0, 70%, 60%);
  }
  input[type="text"] {
    font-family: monospace;
    width: 300px;
  }
  .logs {
    flex: 1 auto;
    overflow-y: scroll;
  }
  .logs > pre {
    overflow-y: auto;
  }
</style>
