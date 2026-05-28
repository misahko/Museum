/**
 * Replaces named objects in a Three.js scene with clones of replacement models.
 *
 * replacements: Array<{ name: string, model: THREE.Object3D }>
 *   - name:  exact name of the object to replace inside `scene`
 *   - model: the Three.js object (e.g. gltf.scene) to clone in its place
 *
 * Each call is idempotent — objects already marked with userData.__replaced
 * are skipped so the function is safe to call multiple times on the same scene.
 */
export function applyReplacements(scene, replacements) {
  for (const { name, model } of replacements) {
    const target = scene.getObjectByName(name);
    if (!target || target.userData.__replaced) continue;

    target.visible = false;
    target.userData.__replaced = true;

    const replacement = model.clone();
    replacement.position.copy(target.position);
    replacement.rotation.copy(target.rotation);
    replacement.scale.copy(target.scale);
    replacement.userData.__replacementFor = name;

    target.parent.add(replacement);
  }
}
