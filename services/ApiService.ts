import type { IApi, IData } from '@interfaces/IApi';

class ApiService implements IApi {
  async getInfo(): Promise<IData> {
    return { item: 'sample data', result: [1, 2, 3], status: 200 };
  }
}
export default ApiService;
