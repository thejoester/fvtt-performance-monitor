Hooks.once("init", () => {
	CONFIG.ChatCommands ??= {};
	CONFIG.ChatCommands.perfReport = {
		name: "perfReport",
		description: "Show Foundry performance diagnostics",
		permission: "ASSISTANT",
		execute: () => game.perfMonitor?.showDialog()
	};
});

Hooks.once("ready", () => {
	game.perfMonitor = {
		showDialog,
		generateReport,
		exportReportAsJSON,
		generateSnapshot
	};
});

async function generateReport() {
	const report = {
		timestamp: new Date().toISOString(),
		hooksPerModule: getHooksPerModule(),
		libWrapperPatches: getLibWrapperPatches(),
		socketlibFunctions: getSocketlibFunctions(),
		snapshot: await generateSnapshot()
	};
	return report;
}

async function showDialog() {
	const report = await generateReport();

	const buildContent = (report) => {
		let html = `<div class="perf-report-dialog" style="max-height: 60vh; overflow-y: auto;">`;

		html += `<h2>Hooks Per Module</h2><ul>`;
		for (const [mod, count] of Object.entries(report.hooksPerModule)) {
			html += `<li><strong>${mod}</strong>: ${count}</li>`;
		}
		html += `</ul>`;

		html += `<h2>libWrapper Patches</h2>`;
		if (Object.keys(report.libWrapperPatches).length > 0) {
			html += `<ul>`;
			for (const [mod, count] of Object.entries(report.libWrapperPatches)) {
				html += `<li><strong>${mod}</strong>: ${count}</li>`;
			}
			html += `</ul>`;
		} else {
			html += `<p><em>libWrapper did not expose patch info.</em></p>`;
		}

		html += `<h2>Socketlib Registrations</h2><ul>`;
		for (const [mod, count] of Object.entries(report.socketlibFunctions)) {
			html += `<li><strong>${mod}</strong>: ${count}</li>`;
		}
		html += `</ul>`;

		html += `<h2>Performance Snapshot</h2><ul>`;
		for (const [label, value] of Object.entries(report.snapshot)) {
			const warnLabels = [
				label === "DOM Node Count" && parseInt(value) > 10000,
				label === "Canvas Redraw Time" && parseFloat(value) > 100,
				label === "Active Scene Tokens" && parseInt(value) > 100,
				label === "World Actors" && parseInt(value) > 2000
			];
			const highlight = warnLabels.some(Boolean) ? " style=\"color: orange; font-weight: bold;\"" : "";
			html += `<li${highlight}><strong>${label}:</strong> ${value}</li>`;
		}
		html += `</ul></div>`;

		return html;
	};

	new foundry.applications.api.DialogV2({
		window: { title: "Performance Monitor" },
		content: buildContent(report),
		buttons: [
			{
				action: "refresh",
				label: "Refresh",
				icon: "fas fa-sync"
			},
			{
				action: "export",
				label: "Export to JSON",
				icon: "fas fa-file-export"
			},
			{
				action: "close",
				label: "Close"
			}
		],
		submit: async (action) => {
			if (action === "refresh") showDialog();
			if (action === "export") game.perfMonitor.exportReportAsJSON();
		}
	}).render({ force: true });
}

function getHooksPerModule() {
	const map = {};
	const hooks = Hooks?._hooks ?? {};
	for (const [hookName, fns] of Object.entries(hooks)) {
		if (!Array.isArray(fns)) continue;
		for (const fn of fns) {
			const mod = fn?.__moduleName || fn?.module || "unknown";
			map[mod] = (map[mod] || 0) + 1;
		}
	}
	return map;
}

function getLibWrapperPatches() {
	const map = {};
	if (!globalThis.libWrapper || !libWrapper.registeredWrappers) {
		console.warn("libWrapper does not expose patch data");
		return map;
	}
	for (const [target, data] of libWrapper.registeredWrappers.entries()) {
		const mod = data?.module || "unknown";
		map[mod] = (map[mod] || 0) + 1;
	}
	return map;
}

function getSocketlibFunctions() {
	const map = {};
	if (!globalThis.socketlib) return map;
	for (const [mod, api] of Object.entries(socketlib.registeredModules ?? {})) {
		map[mod] = Object.keys(api?.functions ?? {}).length;
	}
	return map;
}

function exportReportAsJSON() {
	generateReport().then(data => {
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `fvtt-perf-report-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	});
}

async function generateSnapshot() {
	const snapshot = {};

	try {
		if (performance?.memory?.usedJSHeapSize && performance.memory.totalJSHeapSize) {
			snapshot["JS Heap Used"] = `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`;
			snapshot["JS Heap Total"] = `${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`;
		} else {
			snapshot["JS Heap Used"] = "Unavailable (Browser Restricted)";
			snapshot["JS Heap Total"] = "Unavailable";
		}
	} catch (e) {
		snapshot["JS Heap Used"] = "Unavailable (Error)";
		snapshot["JS Heap Total"] = "Unavailable";
	}

	snapshot["DOM Node Count"] = document.querySelectorAll("*").length;

	const hookKeys = Hooks?._hooks ? Object.keys(Hooks._hooks) : [];
	snapshot["Hook Count"] = hookKeys.length;

	const socketEvents = game.socket?._events ? Object.keys(game.socket._events).length : "Not Available";
	snapshot["Socket Listeners"] = socketEvents;

	let canvasTime = "Not Measured";
	try {
		const t0 = performance.now();
		await canvas.draw();
		const t1 = performance.now();
		canvasTime = `${(t1 - t0).toFixed(1)} ms`;
	} catch (e) {
		canvasTime = "Error Measuring";
	}
	snapshot["Canvas Redraw Time"] = canvasTime;

	snapshot["World Actors"] = game.actors.size;
	snapshot["World Items"] = game.items.size;
	snapshot["World Journals"] = game.journal.size;
	snapshot["World Scenes"] = game.scenes.size;

	if (canvas?.ready) {
		const tokens = canvas.tokens.placeables;
		snapshot["Active Scene Tokens"] = tokens.length;
		const linkedActors = new Set(tokens.map(t => t.actor?.id).filter(Boolean));
		snapshot["Active Scene Unique Actors"] = linkedActors.size;
	}

	return snapshot;
}
