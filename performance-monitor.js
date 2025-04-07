let trackingInterval = null;
let trackingData = [];

Hooks.once("init", () => {
	CONFIG.ChatCommands ??= {};
	CONFIG.ChatCommands.perfReport = {
		name: "perfReport",
		description: "Show Foundry performance diagnostics",
		permission: "ASSISTANT",
		execute: () => game.perfMonitor?.showDialog()
	};
});

Hooks.on("ready", () => {
	game.perfMonitor = {
		showDialog,
		generateReport,
		generateSnapshot,
		exportReportAsJSON,
		startTracking,
		stopTracking
	};
});

async function generateReport() {
	const report = {
		timestamp: new Date().toISOString(),
		snapshot: await generateSnapshot()
	};
	return report;
}

async function showDialog() {
	const report = await generateReport();
	const isTracking = trackingInterval !== null;

	const groupA = ["JS Heap (used / total)", "DOM Node Count", "Modules", "Canvas Redraw Time"];
	const groupB = ["World Scenes", "World Actors", "World Items", "World Journals", "Active Scene Tokens/Actors"];


	new foundry.applications.api.DialogV2({
		window: { title: "Performance Monitor", width: 650 },
		content: `
			<div class="perf-report-dialog" style="max-height: 60vh; overflow-y: auto;">
				<h2>Performance Snapshot</h2>
				<div style="display: flex; gap: 1rem; justify-content: space-between;">
					<div style="flex: 1;">
						<ul>
							${groupA.map(label => {
								const value = report.snapshot[label];
								const highlight = getHighlightStyle(label, value);
								return `<li style="${highlight}"><strong>${label}:</strong> ${value}</li>`;
							}).join("")}
						</ul>
					</div>
					<div style="flex: 1;">
						<ul>
							${groupB.map(label => {
								const value = report.snapshot[label];
								const highlight = getHighlightStyle(label, value);
								return `<li style="${highlight}"><strong>${label}:</strong> ${value}</li>`;
							}).join("")}
						</ul>
					</div>
				</div>
			</div>
		`,
		buttons: [
			{
				action: "refresh",
				label: "Refresh",
				icon: "fas fa-sync"
			},
			{
				action: isTracking ? "stop" : "start",
				label: isTracking ? "Stop Tracking" : "Start Tracking",
				icon: isTracking ? "fas fa-stop" : "fas fa-play"
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
			if (action === "start") {
				startTracking();
				ui.notifications.info("Performance tracking started.");
				showDialog();
			}
			if (action === "stop") {
				stopTracking();
				console.log("Performance tracking data:", trackingData);
				ui.notifications.info("Performance tracking stopped. Data logged to console.");
				showDialog();
			}
			if (action === "export") exportReportAsJSON();
			if (action === "close") return;
		}
	}).render(true);
}

function getHighlightStyle(label, value) {
	const numericValue = parseFloat(value);
	switch (label) {
		case "DOM Node Count":
			if (numericValue > 20000) return "color: red; font-weight: bold;";
			if (numericValue > 10000) return "color: orange; font-weight: bold;";
			break;
		case "Canvas Redraw Time":
			if (numericValue > 200) return "color: red; font-weight: bold;";
			if (numericValue > 100) return "color: orange; font-weight: bold;";
			break;
		case "Active Scene Summary":
			const [tokens] = value.split("/").map(Number);
			if (tokens > 200) return "color: red; font-weight: bold;";
			if (tokens > 100) return "color: orange; font-weight: bold;";
			break;
		case "World Actors":
			if (numericValue > 4000) return "color: red; font-weight: bold;";
			if (numericValue > 2000) return "color: orange; font-weight: bold;";
			break;
	}
	return "";
}

function startTracking() {
	if (trackingInterval) return;
	trackingData = [];

	trackingInterval = setInterval(async () => {
		const snapshot = await generateSnapshot();
		trackingData.push({ timestamp: new Date().toISOString(), data: snapshot });
	}, 5 * 60 * 1000);
}

function stopTracking() {
	if (!trackingInterval) return;
	clearInterval(trackingInterval);
	trackingInterval = null;
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
			const used = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
			const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(2);
			snapshot["JS Heap (used / total)"] = `${used} / ${total} MB`;
		} else {
			snapshot["JS Heap (used / total)"] = "Unavailable (Browser Restricted)";
		}
	} catch (e) {
		snapshot["JS Heap"] = "Unavailable (Error)";
	}

	snapshot["DOM Node Count"] = document.querySelectorAll("*").length;

	const totalModules = game.modules.size;
	const enabledModules = [...game.modules.values()].filter(m => m.active).length;
	snapshot["Modules"] = `${enabledModules}/${totalModules}`;

	let canvasTime = "Skipped (Tracking)";
	if (!trackingInterval) {
		try {
			const t0 = performance.now();
			await canvas.draw();
			const t1 = performance.now();
			canvasTime = `${(t1 - t0).toFixed(1)} ms`;
		} catch (e) {
			canvasTime = "Error Measuring";
		}
	}
	snapshot["Canvas Redraw Time"] = canvasTime;

	snapshot["World Actors"] = game.actors.size;
	snapshot["World Items"] = game.items.size;
	snapshot["World Journals"] = game.journal.size;
	snapshot["World Scenes"] = game.scenes.size;

	if (canvas?.ready) {
		const tokens = canvas.tokens.placeables.length;
		const uniqueActors = new Set(canvas.tokens.placeables.map(t => t.actor?.id).filter(Boolean)).size;
		snapshot["Active Scene Tokens/Actors"] = `${tokens}/${uniqueActors}`;
	}

	return snapshot;
}
