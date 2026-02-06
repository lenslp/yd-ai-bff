import { addAliases } from 'module-alias';

addAliases({
  '@root': __dirname,
  '@interfaces': `${__dirname}/interface`,
  '@config': `${__dirname}/config`,
  '@middlewares': `${__dirname}/middlewares`,
});

import config from '@config/index';
import render from '@koa/ejs';
import ErrorHandler from '@middlewares/ErrorHandler';
import { asValue, createContainer, Lifetime } from 'awilix';
import { loadControllers, scopePerRequest } from 'awilix-koa';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import historyApiFallback from 'koa2-connect-history-api-fallback';
import { configure, getLogger } from 'log4js';
import { createPrismaClient } from './services/prisma.service';

const app = new Koa();
//日志系统 - Lambda 兼容配置
const isLambda = process.env.LAMBDA_TASK_ROOT !== undefined;

if (isLambda) {
  // Lambda 环境：只使用控制台输出
  configure({
    appenders: {
      console: {
        type: 'console',
        layout: { type: 'pattern', pattern: '%d %p %m' },
      },
    },
    categories: { default: { appenders: ['console'], level: 'info' } },
  });
} else {
  // 本地/EC2 环境：使用文件日志
  configure({
    appenders: { cheese: { type: 'file', filename: `${__dirname}/logs/yd.log` } },
    categories: { default: { appenders: ['cheese'], level: 'error' } },
  });
}
const { port, viewDir, memoryFlag, staticDir } = config;
//静态资源生效节点
app.use(serve(staticDir));
//自动解析 HTTP 请求体 (Request Body)，将结果直接挂载到 Koa 上下文对象的 ctx.request.body 属性上
app.use(bodyParser());
//创建容器
const container = createContainer();

//注册 Prisma Client 到容器
//在 Awilix（依赖注入容器）中，asValue 的作用是将一个“现成的值”或“已经创建好的实例”直接注册到容器中
container.register({
  prismaClient: asValue(createPrismaClient()),
});

//所有的可以被注入的代码都在container中
container.loadModules([`${__dirname}/services/*{.ts,.js}`], {
  formatName: 'camelCase',
  resolverOptions: {
    // 1.每次都new
    // 2.单例模式0的
    lifetime: Lifetime.SCOPED, // 每次请求创建一个新的实例
  },
});

//把路由和容器进行关联
app.use(scopePerRequest(container));
render(app, {
  root: viewDir,
  layout: false,
  viewExt: 'html',
  cache: memoryFlag,
  debug: false,
});
//除去api 以外的路由 全部映射回index.html 让前端路由来处理
app.use(historyApiFallback({ index: '/', whiteList: ['/api'] }));
//让所有的路由全部生效
const logger = getLogger('cheese');
ErrorHandler.error(app, logger);
//把所有的路由全部load进来
app.use(loadControllers(`${__dirname}/routers/*{.ts,.js}`));
//本地开发/ECS EC2 运行时listen
app.listen(port || 3000, () => {
  console.log(`Server is running on port ${port || 3000}`);
});
export default app;
