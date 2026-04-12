module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated@4 moved its Babel plugin into a separate
    // react-native-worklets package. This must be the LAST plugin.
    plugins: ["react-native-worklets/plugin"],
  };
};
