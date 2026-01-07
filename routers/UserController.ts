import { route, GET, POST, PUT, DELETE } from 'awilix-koa';
import type { Context } from 'koa';
import type UserService from '../services/user.service';

@route('/api/users')
export default class UserController {
  private userService: UserService;

  constructor({ userService }: { userService: UserService }) {
    this.userService = userService;
  }

  @GET()
  async getUsers(ctx: Context) {
    try {
      const users = await this.userService.getAllUsers();
      ctx.body = {
        code: 0,
        data: users,
        message: 'Success',
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: error instanceof Error ? error.message : 'Failed to get users',
      };
    }
  }

  @GET()
  @route('/:email')
  async getUserByEmail(ctx: Context) {
    try {
      const { email } = ctx.params;
      const user = await this.userService.findUserByEmail(email);

      if (!user) {
        ctx.status = 404;
        ctx.body = {
          code: -1,
          message: 'User not found',
        };
        return;
      }

      ctx.body = {
        code: 0,
        data: user,
        message: 'Success',
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: error instanceof Error ? error.message : 'Failed to get user',
      };
    }
  }

  @POST()
  async createUser(ctx: Context) {
    try {
      const { email, name } = ctx.request.body as { email: string; name?: string };

      if (!email) {
        ctx.status = 400;
        ctx.body = {
          code: -1,
          message: 'Email is required',
        };
        return;
      }

      const user = await this.userService.createUser(email, name);
      ctx.body = {
        code: 0,
        data: user,
        message: 'User created successfully',
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: error instanceof Error ? error.message : 'Failed to create user',
      };
    }
  }

  @PUT()
  @route('/:id')
  async updateUser(ctx: Context) {
    try {
      const { id } = ctx.params;
      const { email, name } = ctx.request.body as { email?: string; name?: string };

      const user = await this.userService.updateUser(id, { email, name });
      ctx.body = {
        code: 0,
        data: user,
        message: 'User updated successfully',
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: error instanceof Error ? error.message : 'Failed to update user',
      };
    }
  }

  @DELETE()
  @route('/:id')
  async deleteUser(ctx: Context) {
    try {
      const { id } = ctx.params;
      await this.userService.deleteUser(id);
      ctx.body = {
        code: 0,
        message: 'User deleted successfully',
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        code: -1,
        message: error instanceof Error ? error.message : 'Failed to delete user',
      };
    }
  }
}
