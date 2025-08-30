export enum StatusCode {
  Accepted = 200,
  Created = 201,
  NotFound = 404,
  InternalServerError = 500,
}

export interface IResponse<T> {
  status: StatusCode;
  message: string;
  data?: T;
}