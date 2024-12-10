import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'postcss-loader' }],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new MonacoEditorWebpackPlugin({
      languages: ['javascript', 'typescript', 'json', 'xml', 'html'], // TODO: also remove features that are not needed
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    plugins: [new TsconfigPathsPlugin()],
  },
};
