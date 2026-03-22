const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  target: 'electron-main',
  entry: './src/main/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist', 'main'),
    filename: 'index.js',
  },
  plugins: [
    // Copy Python scripts that need to run outside webpack bundle
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/main/services/PDFService/pdf_converter.py',
          to: path.resolve(__dirname, 'dist', 'main', 'pdf_converter.py'),
        },
      ],
    }),
  ],
  externals: {
    // Externalize pdf-to-img and its dependencies to avoid bundling browser-specific code
    'pdf-to-img': 'commonjs pdf-to-img',
    'pdfjs-dist': 'commonjs pdfjs-dist',
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
