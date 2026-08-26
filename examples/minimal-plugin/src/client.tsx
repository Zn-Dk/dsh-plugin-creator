// Client bundle source. This compiles to lib/client.js and is loaded by DSH
// through window.__ModuleLoader__.load — NOT a plain ES module at runtime.
// The wrapper below is the exact runtime contract; see templates/client.js.template
// and reference/CLIENT_BUNDLE.md for details.
//
// NOTE: This file is intentionally kept minimal (no JSX) so it compiles without
// react types; a real plugin with a settings card would put its component here.
export const CLIENT_CONTRACT = 'window.__ModuleLoader__.load({ id, factory: (require) => {...} })'
