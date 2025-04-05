const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
	// Validating what frontend (renderer) can send to backend (main process)
	send: (command) => {
		const validChannels = [
			'start-listen', 
			'stop-listen',
			'update-orb-size'
		];

		if (validChannels.includes(command.command)) {
			ipcRenderer.send('command', command);
		} else {
			console.error(`Invalid command: ${command}`);
		}
	},
	

	// Validating what backend (main process) can send to frontend (renderer)
	receive: (channel, func) => {
		const validChannels = [
			'system-response', 
			'error-response'
		];

		if (validChannels.includes(channel)) {
			ipcRenderer.on(channel, (event, ...args) => func(...args));
		}
	}
});