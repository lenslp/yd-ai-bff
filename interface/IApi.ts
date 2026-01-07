export type IData = {
  item: string;
  result?: Array<number | string>;
  status?: number;
};

export interface IApi {
  getInfo(): Promise<IData>;
}
