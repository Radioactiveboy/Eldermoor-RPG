/**
 * Phaser's source checks build flags such as `typeof WEBGL_RENDERER` and `typeof PLUGIN_CAMERA3D`,
 * which Phaser's own build replaces with true or false. We build Phaser from its source (see
 * src/vendor/phaser.js), so vite.config.ts does the same with this, for the build and for the dev
 * server's pre-bundling. Left alone, `typeof X` of an undefined X is the string "undefined", which
 * counts as true, and Phaser would pull in (and ask for) its 3D camera and Facebook plugins.
 */
export const PHASER_FLAGS: Record<string, boolean> = {
  WEBGL_RENDERER: true,
  CANVAS_RENDERER: true,
  FEATURE_SOUND: true,
  WEBGL_DEBUG: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
};

/** Phaser's own source files (the only ones that need the flags). */
export const PHASER_SOURCE = /[\\/]node_modules[\\/]phaser[\\/]src[\\/].*\.js$/;

const FLAG = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');

/** Sets the flags in a Phaser source file's text. */
export function setPhaserFlags(code: string): string {
  return code.replace(FLAG, (_, name: string) => String(PHASER_FLAGS[name]));
}
