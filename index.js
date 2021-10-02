const axios = require("axios");
require("babel-core/register");
require("babel-polyfill");

const baseUrl = "https://testnet-index.elrond.com";
const condition = "condition=should&size=10000&scroll=1m";
const url = `${baseUrl}/transactions/_search`;
const urlScTransactions = `${baseUrl}/scresults/_search`;

var inputAddress = document.getElementById("address");
var btnGetStatement = document.getElementById("btnGetStatement");
var divError = document.getElementById("errorMessage");
var filterValue = document.getElementById("filter-values");

let firstTimeNormalTrans = true;
//let firstTimeScTrans = true;
let csvData = "";
let showZeroValues = false;

let allTransactions;
let allTransactionsSortedByTimestamp;
//let allTransactionsFilteredByValue;

//let isRefreshing = false;

let address;
let fromIndex = 0;
const size = 10000;
const scrollId = " ";

const refreshFromIndex = () => {
  fromIndex = 0;
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
      // data: row.data,
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

const getBody = (address, fromIndex) => {
  const body = {
    from: fromIndex,
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
  let body = getBody(address, fromIndex);

  let someResultTransactionsRaw = await getSimpleTransactions(body);
  // console.log(someResultTransactionsRaw);

  if (!someResultTransactionsRaw.data.hits.hits.length) {
    return;
  }

  let allSimpleTransactionsRaw = new Array();
  someResultTransactionsRaw.data.hits.hits.map((row) => allSimpleTransactionsRaw.push(row));

  while (someResultTransactionsRaw.data.hits.hits.length === size) {
    // const scrollId = someResultTransactionsRaw.data._scroll_id;
    // console.log(scrollId);
    // let scrollBody = getScrollBody(scrollId);
    // console.log(scrollBody);
    fromIndex += size;
    body = getBody(address, fromIndex);
    someResultTransactionsRaw = await getSimpleTransactions(body);

    if (someResultTransactionsRaw.data.hits.hits.length) {
      someResultTransactionsRaw.data.hits.hits.map((row) => allSimpleTransactionsRaw.push(row));
    }
    // allSimpleTransactionsRaw.push(someResultTransactionsRaw.data.hits.hits);
  }
  refreshFromIndex();

  return allSimpleTransactionsRaw;
}

const getAllScTransactions = async (address) => {
  let body = getBody(address, fromIndex);

  let someScResultTransactionsRaw = await getScTransactions(body, null);

  if (!someScResultTransactionsRaw.data.hits.hits.length) {
    return;
  }

  let allScTransactionsRaw = new Array();
  someScResultTransactionsRaw.data.hits.hits.map((row) => allScTransactionsRaw.push(row));

  while (someScResultTransactionsRaw.data.hits.hits.length === size) {
    // const scrollId = someScResultTransactionsRaw.data._scroll_id;
    // console.log(scrollId);
    // let scrollBody = getScrollBody(scrollId);
    // console.log(scrollBody);
    fromIndex += size;
    body = getBody(address, fromIndex);
    someScResultTransactionsRaw = await getScTransactions(body);

    if (someScResultTransactionsRaw.data.hits.hits.length) {
      someScResultTransactionsRaw.data.hits.hits.map((row) => allScTransactionsRaw.push(row));
    }
  }

  refreshFromIndex();

  return allScTransactionsRaw;
}

const getScTransactions = async (body, scrollBody) => {
  let someScResultTransactionsRaw;

  // if (firstTimeScTrans) {
  someScResultTransactionsRaw = await axios.post(urlScTransactions, body);
  // console.log(someScResultTransactionsRaw);
  // firstTimeScTrans = false;
  // } else {
  // console.log("before scroll");
  //someScResultTransactionsRaw =   axios.post(urlScTransactions, scrollBody);
  // console.log("after scroll");
  // }

  return someScResultTransactionsRaw;
}

const getSimpleTransactions = async (neededBody) => {
  let someResultTransactionsRaw;
  // console.log(neededBody);

  someResultTransactionsRaw = await axios.post(url, neededBody);
  // if (firstTimeNormalTrans) {
  //   someResultTransactionsRaw = await axios.post(url, neededBody);
  //   firstTimeNormalTrans = false;
  //   console.log(someResultTransactionsRaw);
  // } else {
  //   console.log("before scroll");
  //   const urlnew = `${baseUrl}/transactions/_search?scroll`;
  //   someResultTransactionsRaw = await axios.post(urlnew, neededBody);
  //   console.log("after scroll");
  // }
  // console.log("first");

  return someResultTransactionsRaw;
};

const getAllTransactions = async () => {
  //let body = getBody(address);

  const allSimpleTransactionsRaw = await getAllSimpleTransactions(address);
  const allScTransactionsRaw = await getAllScTransactions(address);

  const allSimpleTransactions = formatSimpleTransactions(allSimpleTransactionsRaw);
  const allScTransactions = formatScTransactions(allScTransactionsRaw);

  //in mod repetat ,   axios.post(url, bodyCuScroll)
  // if (resultScTransactionsRaw.data.hits.hits.length === 10000) {
  //     setScrollId(resultScTransactionsRaw.data._scroll_id);
  // }

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
  //  refreshData();
  if (!address) return;

  btnGetStatement.innerHTML = `<div class="spinner-border text-success"></div>`;
  await fetchTransactions();
  allTransactionsSortedByTimestamp = sortTransactionsByTimestamp(allTransactions);

  // console.log(allTransactionsSortedByTimestamp);
  setCsvData();

  downloadStatement();

  btnGetStatement.innerHTML = `Get Statement`;
  //getAllTransactions();

  //   getAllTransactions();
  // window.location = hookHandler(address);
  // console.log(hookHandler(address));
  // usernameSchema
  //     .validate({ address })
  //     .then((address) => {
  //         console.log("hook link");
  //         console.log(window.location);
  //         window.location = hookHandler(username.username);
  //     })
  //     .catch((error) => {
  //         inputAddress.classList.toggle("is-invalid");
  //         divError.textContent = error.message;
  //     });
}

btnGetStatement.onclick = () => { (() => { getStatement() })() };

filterValue.onclick = () => changeShowZeroValues();