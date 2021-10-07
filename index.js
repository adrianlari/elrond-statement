const axios = require("axios");
require("babel-core/register");
require("babel-polyfill");

const baseUrl = "https://devnet-index.elrond.com";

const url = `${baseUrl}/transactions/_search?scroll=1m`;
const urlScTransactions = `${baseUrl}/scresults/_search?scroll=1m`;

const noIndexUrl = `${baseUrl}/_search/scroll`;

var inputAddress = document.getElementById("address");
var btnGetStatement = document.getElementById("btnGetStatement");
var divError = document.getElementById("errorMessage");
var filterValue = document.getElementById("filter-values");

let firstTimeNormalTrans = true;
let firstTimeScTrans = true;
let csvData = "";
let showZeroValues = false;

let allTransactions;
let allTransactionsSortedByTimestamp;

let address;
const size = 10000;

const refresh = () => {
  firstTimeNormalTrans = true;
  firstTimeScTrans = true;
}

const trimAddress = (address) => {
  return address.slice(0, 5) + "..." + address.slice(address.length - 4);
}

const arrayToCsv = (array) => {
  const csvHeader = "TxHash,Timestamp,Value,Sender,Receiver,Data,Status,Type\n";
  const csvContent = array.map(
    (row) =>
      [row.txHash, row.timestamp, row.value, row.sender, row.receiver, row.data, row.status, row.type].join(
        ","
      )
  ).join("\n");

  const csvData = csvHeader + csvContent;

  return csvData;
}

const formatValue = (value) => {
  //   return new BigInt(value)
  //     .dividedBy(new BigNumber(10 ** networkConfig.data.config.erd_denomination))
  // //     .toFixed(7);
  // console.log(BigInt(value));
  // let a = BigInt(10 ** 18);
  // console.log({ a });

  const formattedValue = (value / (10 ** 18)).toFixed(5);

  return formattedValue;
}

const formatToDate = (timestamp) => {
  const date = new Date(timestamp * 1000);

  return (
    date.toISOString().slice(0, 10) + " " + date.toTimeString().slice(0, 8)
  );
}

const formatScTransactions = (resultScTransactionsRaw) => {
  const someScTransactions = resultScTransactionsRaw
    .filter((x) => (showZeroValues ? x : x._source.value !== "0"))
    .map((row) => ({
      txHash: row._id,
      sender: row._source.sender,
      receiver: row._source.receiver,
      senderTrimmed: trimAddress(row._source.sender),
      receiverTrimmed: trimAddress(row._source.receiver),
      value: formatValue(row._source.value),
      timestamp: formatToDate(row._source.timestamp),
      status: "success",
      type: "scResult"
    }));

  return someScTransactions;
}

const formatSimpleTransactions = (someResultTransactionsRaw) => {
  const transactions = someResultTransactionsRaw
    .filter((row) => (showZeroValues ? row : row._source.value !== "0"))
    .map((row) => ({
      txHash: row._id,
      sender: row._source.sender,
      receiver: row._source.receiver,
      senderTrimmed: trimAddress(row._source.sender),
      receiverTrimmed: trimAddress(row._source.receiver),
      data: row._source.data
        ? Buffer.from(row._source.data, "base64").toString("binary")
        : "",
      value: formatValue(row._source.value),
      timestamp: formatToDate(row._source.timestamp),
      status: row._source.status,
      type: "Transaction"
    }));

  return transactions;
}

const getBody = (address) => {
  const body = {
    size: size,
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
}

const getScrollBody = (scrollId) => {
  const scrollBody = {
    scroll: "1m",
    scroll_id: `${scrollId}`,
  };

  return scrollBody;
}

const getAllSimpleTransactions = async (address) => {
  let body = getBody(address);

  let someResultTransactionsRaw = await getSimpleTransactions(body);

  if (!someResultTransactionsRaw.data.hits.hits.length) {
    return;
  }

  let allSimpleTransactionsRaw = new Array();
  someResultTransactionsRaw.data.hits.hits.map((row) => allSimpleTransactionsRaw.push(row));

  while (someResultTransactionsRaw.data.hits.hits.length === size) {

    const scrollId = someResultTransactionsRaw.data._scroll_id;
    let scrollBody = getScrollBody(scrollId);

    someResultTransactionsRaw = await getSimpleTransactions(scrollBody);

    if (someResultTransactionsRaw.data.hits.hits.length) {
      someResultTransactionsRaw.data.hits.hits.map((row) => allSimpleTransactionsRaw.push(row));
    }
  }

  return allSimpleTransactionsRaw;
}

const getAllScTransactions = async (address) => {
  let body = getBody(address);

  let someScResultTransactionsRaw = await getScTransactions(body);

  if (!someScResultTransactionsRaw.data.hits.hits.length) {
    return;
  }

  let allScTransactionsRaw = new Array();
  someScResultTransactionsRaw.data.hits.hits.map((row) => allScTransactionsRaw.push(row));

  while (someScResultTransactionsRaw.data.hits.hits.length === size) {
    const scrollId = someScResultTransactionsRaw.data._scroll_id;
    let scrollBody = getScrollBody(scrollId);

    someScResultTransactionsRaw = await getScTransactions(scrollBody);

    if (someScResultTransactionsRaw.data.hits.hits.length) {
      someScResultTransactionsRaw.data.hits.hits.map((row) => allScTransactionsRaw.push(row));
    }
  }

  return allScTransactionsRaw;
}

const getScTransactions = async (neededBody) => {
  let someScResultTransactionsRaw;

  if (firstTimeScTrans) {
    someScResultTransactionsRaw = await axios.post(urlScTransactions, neededBody);
    firstTimeScTrans = false;
  } else {
    someScResultTransactionsRaw = axios.post(noIndexUrl, neededBody);
  }

  return someScResultTransactionsRaw;
}

const getSimpleTransactions = async (neededBody) => {
  let someResultTransactionsRaw;

  if (firstTimeNormalTrans) {
    someResultTransactionsRaw = await axios.post(url, neededBody);
    firstTimeNormalTrans = false;
  } else {
    someResultTransactionsRaw = await axios.post(noIndexUrl, neededBody);
  }

  return someResultTransactionsRaw;
};

const getAllTransactions = async () => {

  const allSimpleTransactionsRaw = await getAllSimpleTransactions(address);
  const allScTransactionsRaw = await getAllScTransactions(address);

  console.log({ allSimpleTransactionsRaw });
  console.log({ allScTransactionsRaw });

  const allSimpleTransactions = allSimpleTransactionsRaw ? formatSimpleTransactions(allSimpleTransactionsRaw) : new Array();
  const allScTransactions = allScTransactionsRaw ? formatScTransactions(allScTransactionsRaw) : new Array();

  console.log({ allSimpleTransactions });
  console.log({ allScTransactions });

  const allTransactions = allSimpleTransactions.concat(allScTransactions);

  return allTransactions;
}

const sortTransactionsByTimestamp = (transactions) => {
  return transactions.sort((element1, element2) => { return element2.timestamp.localeCompare(element1.timestamp) });
}

const downloadStatement = () => {
  var blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "Statement.csv");
  document.body.appendChild(link);

  link.click();
}

const changeShowZeroValues = () => {
  if (filterValue.checked) {
    showZeroValues = true;
  }
  else {
    showZeroValues = false;
  }
}

const fetchTransactions = async () => {
  allTransactions = await getAllTransactions();
}

const setCsvData = () => {
  csvData = arrayToCsv(allTransactionsSortedByTimestamp);
}

const getStatement = async () => {
  address = inputAddress.value;

  if (!address) {
    inputAddress.classList.toggle("is-invalid");
    divError.textContent = "Enter a valid address";
    return;
  }

  btnGetStatement.innerHTML = `<div class="spinner-border text-success"></div>`;
  await fetchTransactions();
  allTransactionsSortedByTimestamp = sortTransactionsByTimestamp(allTransactions);

  setCsvData();

  downloadStatement();

  refresh();
  btnGetStatement.innerHTML = `Get Statement`;
}

btnGetStatement.onclick = () => { (() => { getStatement() })() };

filterValue.onclick = () => changeShowZeroValues();