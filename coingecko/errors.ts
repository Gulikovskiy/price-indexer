import { ZodIssue } from "zod";

export enum ErrorType {
  InvalidSearchParams = 10001,
  InvalidSymbol = 10002,
  InvalidCoingeckoResponse = 10003,
  InvalidResponseTypes = 10004,
  InternalServerError = 10005,
}

export type ErrorResponse = {
  code: ErrorType;
  message?: string;
};

export class KeyError extends ReferenceError {
  constructor() {
    super("api key is undefined");
    this.name = "KeyError";
    Object.setPrototypeOf(this, KeyError.prototype);
  }
}

export const zodErrorResponse = (
  code: ErrorType,
  issue: ZodIssue
): ErrorResponse => ({
  message: `${issue.path} param ${issue.message.toLowerCase()}`,
  code,
});

export const invalidSymbolErrorResponse = (message: string) => {
  return {
    code: ErrorType.InvalidSymbol,
    message,
  };
};

export const coingeckoAPIErrorResponse = (res: Response) => {
  return {
    code: ErrorType.InvalidCoingeckoResponse,
    message: `Coingecko API failed. ${res.statusText}`,
  };
};

export const invalidResponseTypesError = {
  code: ErrorType.InvalidResponseTypes,
  message: "Invalid coingecko response types",
};

export const serverError = (message = "Internal Server Error") => ({
  code: ErrorType.InternalServerError,
  message: message,
});
