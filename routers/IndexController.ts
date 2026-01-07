import { GET, route } from 'awilix-koa';
import type { Context } from 'koa';

@route('/')
class IndexController {
  @GET()
  async actionList(ctx: Context): Promise<void> {
    const data = await ctx.render('index', {
      data: '服务端数据',
    });
    ctx.body = data;
  }
}
export default IndexController;
