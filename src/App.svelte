<script lang="ts">
	import Server from "./components/Server.svelte";
	import Client from "./components/Client.svelte";
	import type { ServerMessage } from "./components/message";
	import type { SvelteComponent } from "svelte";

	let server: SvelteComponent;
	let clients = [void 0, void 0];

	const clientInit = [{ prefix: "p" }, { prefix: "q" }];

	const serverMessage = (event: CustomEvent<ServerMessage>) => {
		if ("clientId" in event.detail) {
			for (const client of clients) {
				if (event.detail.clientId === client.prefix) {
					client.receive(event.detail);
				}
			}
		} else {
			for (const client of clients) {
				client.receive(event.detail);
			}
		}
	};

	const clientMessage = (event: CustomEvent<ServerMessage>) => {
		server.receive(event.detail);
	};
</script>

<main>
	<div class="server">
		<Server bind:this={server} on:message={serverMessage} />
	</div>
	<div class="client-area">
		{#each clientInit as client, i}
			<div class="client">
				<Client
					prefix={client.prefix}
					bind:this={clients[i]}
					on:message={clientMessage}
				/>
			</div>
		{/each}
	</div>
</main>

<style>
	main {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	.client-area {
		flex: 0 0 75%;
		display: flex;
		flex-direction: row;
		overflow: hidden;
	}
	.client {
		flex: 1;
		padding: 0;
		border-right: solid 1px black;
	}
	.client:last-child {
		border-right: none;
	}
	.server {
		flex: 0 0 25%;
	}
</style>
