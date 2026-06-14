// Config plugin: per-ABI APK splits + proper versionCode handling in the generated
// android/app/build.gradle. `expo prebuild --clean` regenerates that file and the
// default template emits a single universal APK with a fixed versionCode, so we patch
// the Groovy directly (expo-build-properties exposes no option for either).
//
//   1. Split into one APK per ABI (no universal).
//   2. Make defaultConfig.versionCode overridable via `-PappVersionCode=<n>` (CI passes
//      the run number) while keeping the app.json value as the local fallback.
//   3. Give each split APK a distinct versionCode so 64-bit builds outrank their 32-bit
//      counterparts and stores/devices treat each as a real, ordered version.
const { withAppBuildGradle } = require('@expo/config-plugins');

const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
// 64-bit > 32-bit so a device that can run both prefers the 64-bit APK.
const ABI_OFFSET = { 'armeabi-v7a': 1, x86: 2, 'arm64-v8a': 3, x86_64: 4 };

const SPLITS_BLOCK = `
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include ${ABIS.map((a) => `"${a}"`).join(', ')}
        }
    }
`;

const VERSION_OVERRIDE_BLOCK = `

// --- Per-ABI versionCode (added by withAndroidAbiSplits) ---
def abiVersionCodeOffset = [${ABIS.map((a) => `"${a}": ${ABI_OFFSET[a]}`).join(', ')}]
android.applicationVariants.all { variant ->
    variant.outputs.each { output ->
        def abiName = output.getFilter(com.android.build.OutputFile.ABI)
        if (abiName != null) {
            output.versionCodeOverride =
                ((variant.versionCode ?: 1) * 10) + (abiVersionCodeOffset.get(abiName) ?: 0)
        }
    }
}
`;

module.exports = function withAndroidAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withAndroidAbiSplits: expected app/build.gradle to be Groovy');
    }
    let src = cfg.modResults.contents;

    // 1. Insert the abi splits block right after the opening of the main `android {`.
    if (!src.includes('splits {')) {
      const marker = src.match(/\nandroid\s*\{/);
      if (!marker) throw new Error('withAndroidAbiSplits: could not find android { block');
      const at = marker.index + marker[0].length;
      src = src.slice(0, at) + SPLITS_BLOCK + src.slice(at);
    }

    // 2. Make versionCode overridable via the `appVersionCode` gradle property,
    //    keeping the prebuild value (from app.json) as the fallback.
    src = src.replace(
      /versionCode\s+(\d+)/,
      (_m, n) => `versionCode Integer.parseInt(findProperty('appVersionCode') ?: '${n}')`,
    );

    // 3. Append the per-ABI versionCode override (idempotent).
    if (!src.includes('abiVersionCodeOffset')) {
      src += VERSION_OVERRIDE_BLOCK;
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
