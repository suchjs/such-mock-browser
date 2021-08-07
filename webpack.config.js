const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const FileManagerPlugin = require('filemanager-webpack-plugin');
const version = require('./package.json').version;
const webpack = require('webpack');
const resolve = (pathname) => path.resolve(__dirname, pathname);
const fileName = `such-mock-browser.${version}.min.js`;
module.exports = {
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules|__tests__|lib|dist|local|coverage/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename() {
      return fileName;
    },
    path: resolve('dist'),
    globalObject: 'this',
    library: {
      name: 'Such',
      type: 'umd',
      export: 'default',
    },
  },
  resolve: {
    alias: {
      // suchjs: resolve('./node_modules/suchjs/lib/browser')
    }
  },
  externals: {
    'suchjs/lib/browser': {
      commonjs: 'Such',
      commonjs2: 'Such',
      amd: 'Such',
      root: 'Such',
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.BROWSER': process.env.BROWSER,
    }),
    new FileManagerPlugin({
      events: {
        onEnd: {
          copy: [
            {
              source: resolve(`dist/${fileName}`),
              destination: resolve('dist/such-mock-browser.min.js'),
            },
          ],
          delete: [resolve('lib')],
        },
      },
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: true,
          keep_classnames: false,
          keep_fnames: false,
        },
      }),
    ],
  },
};
