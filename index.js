import "regenerator-runtime/runtime";
import axios from "axios";

const baseUrl = "https://testnet-index.elrond.com";

const url = `${baseUrl}/transactions/_search?scroll=1m`;
const urlScTransactions = `${baseUrl}/scresults/_search?scroll=1m`;

const noIndexUrl = `${baseUrl}/_search/scroll`;

var inputAddress = document.getElementById("address");
var btnGetStatement = document.getElementById("btnGetStatement");
var divError = document.getElementById("errorMessage");

let isFirstTime = true;
let csvData = "";
let address;
const MAXIMUM_NUMBER_OF_ROWS = 10000;
const ok = "QDZmNm";

btnGetStatement.onclick = async () => getStatement();

const transactionTypes = {
  TRANSACTION: "Transaction",
  RESULT: "Result",
};

const actionTypes = {
  SEND: "Sent",
  RECEIVED: "Received",
  SELF: "Self",
};

const status = {
  SUCCESS: "success",
  FAIL: "fail",
  INVALID: "invalid",
};

const showSpinner = () => {
  btnGetStatement.innerHTML = `<div class="spinner-border text-success"></div>`;
};

const hideSpinner = () => {
  btnGetStatement.innerHTML = `Get Statement`;
};

const getStatement = async () => {
  address = inputAddress.value;

  if (!address || !address.startsWith("erd1")) {
    inputAddress.classList.toggle("is-invalid");
    divError.textContent = "Enter a valid address";
    return;
  }

  showSpinner();

  const allTransactionsFormatted = await getAllFormattedTransactions();
  const allTransactionsSortedByTimestamp = sortTransactionsByTimestamp(
    allTransactionsFormatted
  );

  setCsvData(allTransactionsSortedByTimestamp);

  downloadStatement();

  hideSpinner();
};

const getAllFormattedTransactions = async () => {
  const allSimpleTransactionsRaw = await getAllTransactionsRaw(
    transactionTypes.TRANSACTION
  );

  const totalSent = allSimpleTransactionsRaw
    .filter(
      (row) =>
        row._source.sender === address &&
        row._source.receiver !== address &&
        row._source.status === "success"
    )
    .map((row) => BigInt(String(row._source.value)))
    .reduce((a, b) => a + b, BigInt(0));

  const totalReceived = allSimpleTransactionsRaw
    .filter(
      (row) =>
        row._source.sender !== address &&
        row._source.receiver === address &&
        row._source.status === "success"
    )
    .map((row) => BigInt(String(row._source.value)))
    .reduce((a, b) => a + b, BigInt(0));

  const totalFees = allSimpleTransactionsRaw
    .filter((row) => row._source.sender === address)
    .map((row) => BigInt(String(row._source.fee)))
    .reduce((a, b) => a + b, BigInt(0));

  const allFormattedSimpleTransactions = allSimpleTransactionsRaw
    ? formatTransactions(allSimpleTransactionsRaw, transactionTypes.TRANSACTION)
    : new Array();

  let allScTransactionsRaw = await getAllTransactionsRaw(
    transactionTypes.RESULT
  );

  let totalReceivedFromScResult = BigInt(0);

  if (allScTransactionsRaw) {
    allScTransactionsRaw = allScTransactionsRaw.filter(
      (x) => x._source && x._source.data && !x._source.data.startsWith(ok)
    );

    totalReceivedFromScResult = allScTransactionsRaw
      .map((x) => BigInt(String(x._source.value)))
      .reduce((a, b) => a + b, BigInt(0));
  }

  const balance =
    totalReceived - totalSent - totalFees + totalReceivedFromScResult;

  const statementDetails = {
    totalReceived: totalReceived,
    totalSent: totalSent,
    totalFees: totalFees,
    totalReceivedFromScResult: totalReceivedFromScResult,
    balance: balance,
    address: address,
  };

  console.log({ statementDetails });

  const allFormattedScTransactions = allScTransactionsRaw
    ? formatTransactions(allScTransactionsRaw, transactionTypes.RESULT)
    : new Array();

  const allFormattedTransactions = allFormattedSimpleTransactions.concat(
    allFormattedScTransactions
  );

  return allFormattedTransactions;
};

const appendContentToArray = (array, content) => {
  content.data.hits.hits.map((row) => array.push(row));
};

const hasAnyTransactions = (array) => {
  return array.data.hits.hits.length > 0;
};

const isArrayFull = (array) => {
  return array.data.hits.hits.length === MAXIMUM_NUMBER_OF_ROWS;
};

const getAllTransactionsRaw = async (txType) => {
  let body;

  if (txType === transactionTypes.TRANSACTION) {
    body = getTransactionBody(address);
  } else if (txType === transactionTypes.RESULT) {
    body = getSCBody(address);
  }

  isFirstTime = true;
  let someTransactionsRaw = await getTransactions(body, txType);

  if (!hasAnyTransactions(someTransactionsRaw)) {
    return;
  }

  let allTransactionsRaw = new Array();
  appendContentToArray(allTransactionsRaw, someTransactionsRaw);

  const scrollId = someTransactionsRaw.data._scroll_id;
  let scrollBody = getScrollBody(scrollId);

  while (isArrayFull(someTransactionsRaw)) {
    someTransactionsRaw = await getTransactions(scrollBody);

    if (hasAnyTransactions(someTransactionsRaw)) {
      appendContentToArray(allTransactionsRaw, someTransactionsRaw);
    }
  }

  return allTransactionsRaw;
};

const getTransactions = async (neededBody, txType) => {
  let someTransactionsRaw;

  if (isFirstTime) {
    someTransactionsRaw = await axios.post(
      txType === transactionTypes.RESULT ? urlScTransactions : url,
      neededBody
    );
    isFirstTime = false;
  } else {
    someTransactionsRaw = await axios.post(noIndexUrl, neededBody);
  }

  return someTransactionsRaw;
};

const arrayToCsv = (array) => {
  const csvHeader =
    "Timestamp,Value,Type,Address,Status,TxType,Fee,TxHash,Data\n";
  const csvContent = array
    .map((row) =>
      [
        row.timestamp,
        row.value,
        row.action,
        row.address,
        row.status,
        row.transactionType,
        row.fee,
        row.txHash,
        row.data,
      ].join(",")
    )
    .join("\n");

  const csvData = csvHeader + csvContent;

  return csvData;
};

const getAction = (sender, receiver) => {
  if (sender === receiver) {
    return actionTypes.SELF;
  } else if (receiver === address) {
    return actionTypes.RECEIVED;
  } else if (sender === address) {
    return actionTypes.SEND;
  }
};

const getAddress = (sender, receiver) => {
  if (sender === address) {
    return receiver;
  } else if (receiver === address) {
    return sender;
  }
};

const deleteFrontZeroes = (string) => {
  for (let index = 0; index < string.length; index++) {
    if (string[index] === "0" && string[index + 1] !== ".") {
      string = string.slice(1, string.length);
      index--;
    } else {
      return string;
    }
  }
};

const deleteBackZeroes = (string) => {
  for (let index = string.length - 1; index >= 0; index--) {
    if (string[index] === "0" && string[index - 1] !== ".") {
      string = string.slice(0, index);
    } else {
      return string;
    }
  }
};

const denominateValue = (value) => {
  let zeroes = "000000000000000000";

  let isValueNegative = value < 0;
  if (isValueNegative) {
    value = -value;
  }

  let stringValue = String(value);

  let zeroesBeforeStringValue = zeroes + stringValue;

  const lenght = zeroesBeforeStringValue.length;

  let denominatedValue =
    zeroesBeforeStringValue.slice(0, lenght - 18) +
    "." +
    zeroesBeforeStringValue.slice(length - 18);

  denominatedValue = deleteFrontZeroes(denominatedValue);
  denominatedValue = deleteBackZeroes(denominatedValue);

  if (isValueNegative) denominatedValue = "-" + denominatedValue;

  return denominatedValue;
};

const getFee = (txType, row) => {
  if (txType === transactionTypes.TRANSACTION && row.sender === address) {
    return denominateValue(parseInt(row.fee));
  }

  return BigInt(0);
};

const formatTransactions = (rawTransactions, txType) => {
  const formattedTransactions = rawTransactions.map((row) => ({
    timestamp: formatToDate(row._source.timestamp),
    value: getValue(
      row._source.sender,
      row._source.receiver,
      row._source.value
    ),
    action: getAction(row._source.sender, row._source.receiver),
    address: getAddress(row._source.sender, row._source.receiver),
    status: getStatus(txType, row._source),
    transactionType: txType,
    fee: getFee(txType, row._source),
    txHash: row._id,
    data: getData(row._source.data),
  }));

  return formattedTransactions;
};

const getData = (data) => {
  return data ? Buffer.from(data, "base64").toString("binary") : "";
};

const getStatus = (transactionType, row) => {
  return transactionType === transactionTypes.TRANSACTION
    ? row.status
    : status.SUCCESS;
};

const getValue = (sender, receiver, value) => {
  if (sender === receiver) {
    return BigInt(0);
  }

  if (sender === address) {
    value = -value;
  }

  return denominateValue(BigInt(value));
};

const formatToDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const formattedDate =
    date.toISOString().slice(0, 10) + " " + date.toTimeString().slice(0, 8);

  return formattedDate;
};

const getTransactionBody = (address) => {
  const body = {
    size: MAXIMUM_NUMBER_OF_ROWS,
    query: {
      bool: {
        should: [
          {
            match: {
              sender: {
                query: `${address}`,
              },
            },
          },
          {
            match: {
              receiver: {
                query: `${address}`,
              },
            },
          },
        ],
      },
    },
  };
  return body;
};

const getSCBody = (address) => {
  const body = {
    size: MAXIMUM_NUMBER_OF_ROWS,
    query: {
      bool: {
        must: [
          {
            match: {
              receiver: {
                query: `${address}`,
              },
            },
          },
        ],
        must_not: [
          {
            match: {
              sender: {
                query: `${address}`,
              },
            },
          },
        ],
      },
    },
  };
  return body;
};

const getScrollBody = (scrollId) => {
  const scrollBody = {
    scroll: "1m",
    scroll_id: `${scrollId}`,
  };

  return scrollBody;
};

const sortTransactionsByTimestamp = (transactions) => {
  return transactions.sort((element1, element2) => {
    return element2.timestamp.localeCompare(element1.timestamp);
  });
};

const downloadStatement = () => {
  var blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Statement.csv");
  document.body.appendChild(link);

  link.click();
};

const setCsvData = (transactionsArray) => {
  csvData = arrayToCsv(transactionsArray);
};
