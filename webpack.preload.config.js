const path = require('path');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  target: 'electron-preload',
  entry: './src/main/preload.ts',
  output: {
    path: path.resolve(__dirname, 'dist', 'main'),
    filename: 'preload.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  node: {
    __dirname: false,
    __filename: false,
  },
};
