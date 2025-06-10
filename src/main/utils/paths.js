const path = require('path');
const { app } = require('electron');
const isDev = process.env.NODE_ENV === 'development';

/**
 * Get the appropriate path for an application asset
 * @param {string} assetType - Type of asset ('images', 'audio', 'models')
 * @param {string} assetName - The name of the asset file
 * @returns {string} Absolute path to the asset
 */
function getAssetPath(assetType, assetName) {
  // Both development and production use the same assets folder structure
  if (isDev) {
    // In development: use files from project directory
    return path.join(process.cwd(), 'assets', assetType, assetName);
  } else {
    // In production: use files from assets directory in the app package
    return path.join(app.getAppPath(), 'assets', assetType, assetName);
  }
}

/**
 * Get path for image assets
 * @param {string} imageName - Image filename
 * @returns {string} Absolute path to the image file
 */
function getImagePath(imageName) {
  return getAssetPath('images', imageName);
}

/**
 * Get path for audio assets
 * @param {string} audioName - Audio filename
 * @returns {string} Absolute path to the audio file
 */
function getAudioPath(audioName) {
  return getAssetPath('audio', audioName);
}

/**
 * Get path for model assets
 * @param {string} modelName - Model filename
 * @returns {string} Absolute path to the model file
 */
function getModelPath(modelName) {
  return getAssetPath('models', modelName);
}

/**
 * Get path for user data like settings, cache, etc.
 * @param {string} dataPath - Path relative to user data directory
 * @returns {string} Absolute path to the user data file
 */
function getUserDataPath(dataPath) {
  return path.join(app.getPath('userData'), dataPath);
}

module.exports = {
  getAssetPath,
  getImagePath,
  getAudioPath,
  getModelPath,
  getUserDataPath
}; 