/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/main/preload.ts"
/*!*****************************!*\
  !*** ./src/main/preload.ts ***!
  \*****************************/
(__unused_webpack_module, exports, __webpack_require__) {

eval("{\n/**\n * CRA AI Assistant - Preload Script\n * Exposes safe APIs to the renderer process via contextBridge\n */\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nconst electron_1 = __webpack_require__(/*! electron */ \"electron\");\n// TODO: Define proper types for the electronAPI\nconst electronAPI = {\n    // File operations\n    uploadFile: (zone, filePath) => electron_1.ipcRenderer.invoke('file:upload', zone, filePath),\n    deleteFile: (zone, fileId) => electron_1.ipcRenderer.invoke('file:delete', zone, fileId),\n    getAllFiles: (zone) => electron_1.ipcRenderer.invoke('file:getAll', zone),\n    // AI operations\n    testConnection: (apiKey) => electron_1.ipcRenderer.invoke('ai:testConnection', apiKey),\n    extractCriteria: (fileId, pdfContent) => electron_1.ipcRenderer.invoke('ai:extractCriteria', fileId, pdfContent),\n    extractVisitSchedule: (fileId, pdfContent) => electron_1.ipcRenderer.invoke('ai:extractVisitSchedule', fileId, pdfContent),\n    extractFromImage: (imagePath, prompt) => electron_1.ipcRenderer.invoke('ai:extractFromImage', imagePath, prompt),\n    processProtocolFile: (fileId, filePath) => electron_1.ipcRenderer.invoke('ai:processProtocolFile', fileId, filePath),\n    processSubjectFile: (fileId, filePath) => electron_1.ipcRenderer.invoke('ai:processSubjectFile', fileId, filePath),\n    analyzeEligibility: (subjectFilePaths, inclusionCriteria, exclusionCriteria) => electron_1.ipcRenderer.invoke('ai:analyzeEligibility', subjectFilePaths, inclusionCriteria, exclusionCriteria),\n    // Excel operations\n    exportTracker: (data, options) => electron_1.ipcRenderer.invoke('excel:exportTracker', data, options),\n    // Settings operations\n    getSettings: () => electron_1.ipcRenderer.invoke('settings:get'),\n    setSettings: (settings) => electron_1.ipcRenderer.invoke('settings:set', settings),\n    resetSettings: () => electron_1.ipcRenderer.invoke('settings:reset'),\n    // System operations\n    getVersion: () => electron_1.ipcRenderer.invoke('system:getVersion'),\n    openExternal: (url) => electron_1.ipcRenderer.invoke('system:openExternal', url),\n    // Dialog operations\n    openFile: (filters) => electron_1.ipcRenderer.invoke('dialog:openFile', filters),\n    saveFile: (defaultPath, filters) => electron_1.ipcRenderer.invoke('dialog:saveFile', defaultPath, filters),\n};\nelectron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);\n\n\n//# sourceURL=webpack://cra-ai-assistant/./src/main/preload.ts?\n}");

/***/ },

/***/ "electron"
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
(module) {

module.exports = require("electron");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/main/preload.ts");
/******/ 	
/******/ })()
;