/**
 * Virtual root of the worker host's in-memory filesystem. Kept
 * in one module so the process shim, the path/os shims, and the VFS image
 * collector cannot drift apart.
 */

/** Virtual filesystem root; `process.cwd()` and every absolute path start here. */
export const AH_ROOT = '/ah'

/** `$AH_HOME`: durable-state directory inside the image. */
export const AH_HOME = `${AH_ROOT}/home`

/** Flat, symlink-free package tree resolved by the worker module loader. */
export const AH_NODE_MODULES = `${AH_ROOT}/node_modules`

/** Directory holding the composed cordis.yml. */
export const AH_CONFIG = `${AH_ROOT}/config`

/** Default (empty) workspace directory. */
export const AH_WORKSPACE = `${AH_ROOT}/workspace`

/** Temporary directory reported by `os.tmpdir()`. */
export const AH_TMP = `${AH_ROOT}/tmp`
