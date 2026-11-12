/**
 * Code editor, node half. Pure UI plugin: the empty apply exists so the plugin
 * appears in the Host cordis.yml and Loader; the browser half ships through
 * exports["./client"], discovered through the package.json ah.client
 * declaration. Saves go through `@anotherharness/ah-api-workspace-files`.
 */

/** Host plugin body: no Host-side behavior for this surface plugin. */
export function apply(): void {}
