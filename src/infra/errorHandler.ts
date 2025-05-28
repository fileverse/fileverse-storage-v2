import { CustomRequest } from "../types";
import { reportError } from "./reporter";

interface CustomError extends Error {
  code?: number;
  token?: any;
  req?: any;
  address?: string;
}

const throwError = ({
  code = 500,
  message,
  token,
  req = {} as CustomRequest,
}: {
  code?: number;
  message: string;
  token?: any;
  req?: CustomRequest;
}) => {
  const error = new Error(message) as CustomError;
  error.code = code;
  error.token = token;
  error.req = req;
  error.address = req.address;
  // Error Reporting to Slack
  const errorMessage = `Message: ${message}\nError Code: ${code}`;
  reportError(errorMessage).catch(console.log);
  throw error;
};

export { throwError };
