import { join } from 'node:path';
import _ from 'lodash';

let config = {
  viewDir: join(__dirname, '..', 'views'),
  staticDir: join(__dirname, '..', 'assets'),
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8081, // 支持 PM2 cluster 模式端口分配
  memoryFlag: false,
};
if (process.env.NODE_ENV === 'development') {
  const localConfig = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8081,
  };
  config = _.assignIn(config, localConfig);
}
if (process.env.NODE_ENV === 'production') {
  const prodConfig = {
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8082,
    memoryFlag: 'memory',
  };
  config = _.assignIn(config, prodConfig);
}

export default config;
