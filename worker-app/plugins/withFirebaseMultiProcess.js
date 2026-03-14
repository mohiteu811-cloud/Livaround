/**
 * Expo config plugin that ensures FirebaseApp is initialized in all Android
 * processes, including background worker processes. Without this, FCM / push
 * notifications fail in the worker process with:
 *   "Default FirebaseApp is not initialized in this process com.livaround.worker"
 *
 * This plugin does two things:
 * 1. Adds the firebase-common dependency to app/build.gradle so FirebaseApp is
 *    available at compile time.
 * 2. Adds FirebaseApp.initializeApp(this) to MainApplication.onCreate().
 */
const {
  withMainApplication,
  withAppBuildGradle,
  withPlugins,
} = require('@expo/config-plugins');

function withFirebaseMainApplication(config) {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    // Kotlin MainApplication
    if (mod.modResults.language === 'kt') {
      if (!contents.includes('FirebaseApp.initializeApp')) {
        contents = contents.replace(
          /import android\.app\.Application/,
          `import android.app.Application\nimport com.google.firebase.FirebaseApp`
        );
        contents = contents.replace(
          /override fun onCreate\(\) \{/,
          `override fun onCreate() {\n    FirebaseApp.initializeApp(this)`
        );
      }
    } else {
      // Java MainApplication
      if (!contents.includes('FirebaseApp.initializeApp')) {
        contents = contents.replace(
          /import android\.app\.Application;/,
          `import android.app.Application;\nimport com.google.firebase.FirebaseApp;`
        );
        contents = contents.replace(
          /public void onCreate\(\) \{/,
          `public void onCreate() {\n    FirebaseApp.initializeApp(this);`
        );
      }
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

function withFirebaseDependency(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Add firebase-common (provides FirebaseApp) if not already present
    if (!contents.includes('com.google.firebase:firebase-common')) {
      contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    implementation platform('com.google.firebase:firebase-bom:33.7.0')\n    implementation 'com.google.firebase:firebase-common'`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = function withFirebaseMultiProcess(config) {
  return withPlugins(config, [
    withFirebaseDependency,
    withFirebaseMainApplication,
  ]);
};
