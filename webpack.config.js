const path = require('path');
// const TerserPlugin = require('terser-webpack-plugin');
const layerDependencies = [
  'awilix',
  'awilix-koa',
  'co',
  'koa',
  'koa-router',
  'koa-static',
  'koa-swig',
  'koa2-connect-history-api-fallback',
  'lodash',
  'module-alias',
  'serverless-http',
];
module.exports = {
  entry: {
    lambda: './lambda.ts',
  },
  target: 'node',
  externals: [
    ({ request }, callback) => {
      if (layerDependencies.includes(request)) {
        return callback(null, `commonjs ${request}`);
      }
      if (request === 'koa') {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    },
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: [
          /node_modules/,
          /\.spec\.ts$/,
          /\.e2e-spec\.ts$/,
          path.resolve(__dirname, 'test'),
          path.resolve(__dirname, 'src/**/*.spec.ts'),
        ],
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            experimentalWatchApi: true,
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, './'),
      '@interfaces': path.resolve(__dirname, './interface'),
      '@config': path.resolve(__dirname, './config'),
      '@middlewares': path.resolve(__dirname, './middlewares'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: (pathData) => {
      // 入口文件固定命名
      return pathData.chunk.name === 'lambda' ? 'lambda.js' : '[name].js';
    },
    chunkFilename: '[name].[contenthash].js',
    clean: true,
    libraryTarget: 'commonjs2',
  },
  optimization: {
    minimize: false,
    runtimeChunk: false,
    splitChunks: {
      chunks: 'all',
      minSize: 0,
      cacheGroups: {
        default: false,
        vendors: false,
        sources: {
          test: /\.ts$/,
          name(module) {
            if (module.resource.endsWith('lambda.ts')) {
              return false;
            }
            const srcPath = path.relative(path.join(__dirname, 'src'), module.resource);
            return srcPath.replace(/\.ts$/, ''); // 只替换 .ts 后缀为空
          },
          chunks: 'all',
          enforce: true,
          priority: 10,
        },
      },
    },
  },
  stats: {
    errorDetails: true,
    chunks: true,
    modules: true,
  },
  devtool: 'source-map',
};
