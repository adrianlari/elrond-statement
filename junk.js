const getTransactionBody = (address) => {
  const body = {
    size: constants.MAXIMUM_NUMBER_OF_ROWS,
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
    size: constants.MAXIMUM_NUMBER_OF_ROWS,
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

const getTransactions = async (neededBody, txType) => {
  let someTransactionsRaw;

  if (isFirstScroll) {
    someTransactionsRaw = await axios.post(
      txType === constants.transactionTypes.RESULT
        ? constants.urlScTransactions
        : constants.url,
      neededBody
    );
    isFirstScroll = false;
  } else {
    someTransactionsRaw = await axios.post(constants.noIndexUrl, neededBody);
  }

  return someTransactionsRaw;
};

const getAllTransactionsRaw = async (txType) => {
  let body;

  if (txType === constants.transactionTypes.TRANSACTION) {
    body = getTransactionBody(address);
  } else if (txType === constants.transactionTypes.RESULT) {
    body = getSCBody(address);
  }

  isFirstScroll = true;
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

const getAllFormattedTransactions = async () => {
  const allSimpleTransactionsRaw = await getAllTransactionsRaw(
    constants.transactionTypes.TRANSACTION
  );

  const totalSent = allSimpleTransactionsRaw
    ? allSimpleTransactionsRaw
        .filter(
          (row) =>
            row._source.sender === address &&
            row._source.receiver !== address &&
            row._source.status === constants.status.SUCCESS
        )
        .map((row) => BigInt(String(row._source.value)))
        .reduce((a, b) => a + b, BigInt(0))
    : BigInt(0);

  const totalReceived = allSimpleTransactionsRaw
    ? allSimpleTransactionsRaw
        .filter(
          (row) =>
            row._source.sender !== address &&
            row._source.receiver === address &&
            row._source.status === constants.status.SUCCESS
        )
        .map((row) => BigInt(String(row._source.value)))
        .reduce((a, b) => a + b, BigInt(0))
    : BigInt(0);

  const totalFees = allSimpleTransactionsRaw
    ? allSimpleTransactionsRaw
        .filter((row) => row._source.sender === address)
        .map((row) => BigInt(String(row._source.fee)))
        .reduce((a, b) => a + b, BigInt(0))
    : BigInt(0);

  const allFormattedSimpleTransactions = allSimpleTransactionsRaw
    ? formatTransactions(
        allSimpleTransactionsRaw,
        constants.transactionTypes.TRANSACTION
      )
    : new Array();

  let allScTransactionsRaw = await getAllTransactionsRaw(
    constants.transactionTypes.RESULT
  );

  let totalReceivedFromScResult = BigInt(0);

  if (allScTransactionsRaw) {
    allScTransactionsRaw = allScTransactionsRaw.filter(
      (x) =>
        x._source && x._source.data && !x._source.data.startsWith(constants.ok)
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
    ? formatTransactions(
        allScTransactionsRaw,
        constants.transactionTypes.RESULT
      )
    : new Array();

  const allFormattedTransactions = allFormattedSimpleTransactions.concat(
    allFormattedScTransactions
  );

  return allFormattedTransactions;
};
