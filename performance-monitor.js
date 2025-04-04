Hooks.once("init", () => {
	// Register the macro command
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
		exportReportAsJSON
	};
});

function generateReport() {
	const report = {
		timestamp: new Date().toISOString(),
		hooksPerModule: getHooksPerModule(),
		libWrapperPatches: getLibWrapperPatches(),
		socketlibFunctions: getSocketlibFunctions()
	};
	return report;
}

function showDialog() {
	const report = generateReport();

	const buildContent = (report) => {
		let html = `<div class="perf-report-dialog" style="max-height: 60vh; overflow-y: auto;">`;

		html += `<h2>Hooks Per Module</h2><ul>`;
		for (const [mod, count] of Object.entries(report.hooksPerModule)) {
			html += `<li><strong>${mod}</strong>: ${count}</li>`;
		}
		html += `</ul>`;

		html += `<h2>libWrapper Patches</h2><ul>`;
		for (const [mod, count] of Object.entries(report.libWrapperPatches)) {
			html += `<li><strong>${mod}</strong>: ${count}</li>`;
		}
		html += `</ul>`;

		html += `<h2>Socketlib Registrations</h2><ul>`;
		for (const [mod, count] of Object.entries(report.socketlibFunctions)) {
			html += `<li><strong>${mod}</strong>: ${count}</li>`;
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
			if (action === "refresh") {
				showDialog(); // re-render the dialog with fresh data
			}
			if (action === "export") {
				game.perfMonitor.exportReportAsJSON();
			}
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
	if (!globalThis.libWrapper) return map;
	const wrappers = libWrapper.getWrappers();
	for (const [key, data] of Object.entries(wrappers)) {
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
	const data = generateReport();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `fvtt-perf-report-${Date.now()}.json`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
