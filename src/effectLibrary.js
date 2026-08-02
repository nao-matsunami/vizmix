/**
 * VizMix - Effect Library (互換シム)
 *
 * ISF ソースは src/effectSources.js、登録と導出は src/effectRegistry.js に移した。
 * このファイルは旧 import パスを壊さないための再輸出だけを持つ。
 * 新しいコードは effectRegistry.js を直接使うこと。
 */

export { EFFECT_ISF, EFFECT_ORDER, buildActiveChain } from "./effectRegistry.js";
