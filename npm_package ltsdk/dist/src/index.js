"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNormalized = exports.normalizeEdx = void 0;
const edx_1 = require("./adapters/edx");
Object.defineProperty(exports, "normalizeEdx", { enumerable: true, get: function () { return edx_1.normalizeEdx; } });
var validator_1 = require("./validator");
Object.defineProperty(exports, "validateNormalized", { enumerable: true, get: function () { return validator_1.validateNormalized; } });
__exportStar(require("./types"), exports);
// Convenience default
exports.default = { normalizeEdx: edx_1.normalizeEdx };
