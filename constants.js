import config from "./config.json";
import moment from "moment";

export const months = moment.months();

export const transactionTypes = {
  TRANSACTION: "Transaction",
  RESULT: "Result",
};

export const actionTypes = {
  SEND: "Sent",
  RECEIVED: "Received",
  SELF: "Self",
};

export const status = {
  SUCCESS: "success",
  FAIL: "fail",
  INVALID: "invalid",
};

export const baseUrl = config.indexUrl;
export const url = `${baseUrl}/transactions/_search?scroll=1m`;
export const urlScTransactions = `${baseUrl}/scresults/_search?scroll=1m`;

export const noIndexUrl = `${baseUrl}/_search/scroll`;
export const MAXIMUM_NUMBER_OF_ROWS = 10000;
export const ok = "QDZmNm";
export const NUMBER_OF_MONTHS = 12;
