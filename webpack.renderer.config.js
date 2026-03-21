const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  target: 'web', // 改为 web 目标，避免 Node.js 全局变量依赖
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist', 'renderer'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [require('tailwindcss'), require('autoprefixer')],
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
    }),
    // Polyfill for global in sandboxed renderer
    new webpack.DefinePlugin({
      global: 'globalThis',
    }),
    new webpack.ProvidePlugin({
      global: 'globalThis',
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist', 'renderer'),
    },
    compress: true,
    port: 8080,
    hot: true,
  },
};
