/**
 * Expo config plugin that patches @react-native-async-storage/async-storage v3.x
 * to include its bundled local Maven repository in android/build.gradle.
 *
 * v3.x ships storage-android:1.0.0 inside android/local_repo/ but forgets to
 * declare that path as a Maven repository, causing Gradle to fail with:
 *   Could not find org.asyncstorage.shared_storage:storage-android:1.0.0
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAsyncStorageAndroidFix(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const asyncStorageRoot = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        '@react-native-async-storage',
        'async-storage',
        'android'
      );

      const localRepoPath = path.join(asyncStorageRoot, 'local_repo');
      const buildGradlePath = path.join(asyncStorageRoot, 'build.gradle');

      // Only needed for v3.x which ships local_repo
      if (!fs.existsSync(localRepoPath) || !fs.existsSync(buildGradlePath)) {
        return config;
      }

      let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

      if (buildGradle.includes('local_repo')) {
        return config; // Already patched
      }

      // Insert local_repo before mavenCentral() in the dependencies repositories block
      buildGradle = buildGradle.replace(
        /(^repositories\s*\{$)/m,
        '$1\n    maven { url project.file("local_repo") }'
      );

      fs.writeFileSync(buildGradlePath, buildGradle);
      console.log('[withAsyncStorageAndroidFix] Patched async-storage build.gradle to include local_repo');

      return config;
    },
  ]);
};
