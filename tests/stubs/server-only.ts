/**
 * `server-only` is a build-time marker that Next resolves during bundling; it
 * has no runtime behaviour. Vitest runs modules directly, so it is aliased to
 * this empty stub rather than dropping the import from the source - the import
 * is what keeps server modules out of client bundles.
 */
export {};
