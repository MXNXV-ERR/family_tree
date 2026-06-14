module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated 4 ships its worklets transform in react-native-worklets.
    // This MUST be the last plugin. Without it, worklets are never compiled, so the
    // release (Hermes) build crashes on launch even though dev/web appear to work.
    plugins: ['react-native-worklets/plugin'],
  };
};
