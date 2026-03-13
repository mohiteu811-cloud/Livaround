/**
 * Expo config plugin that ensures FirebaseApp is initialized in all Android
 * processes, including background worker processes. Without this, FCM / push
 * notifications fail in the worker process with:
 *   "Default FirebaseApp is not initialized in this process com.livaround.worker"
 */
const { withMainApplication } = require('@expo/config-plugins');

module.exports = function withFirebaseMultiProcess(config) {
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
};
