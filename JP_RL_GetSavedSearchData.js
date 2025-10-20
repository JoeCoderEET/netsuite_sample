/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/error", "N/log", "N/record", "N/search"], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */ (error, log, record, search) => {
  /**
   * Defines the function that is executed when a GET request is sent to a RESTlet.
   * @param {Object} requestParams - Parameters from HTTP request URL; parameters passed as an Object (for all supported
   *     content types)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const get = (requestParams) => {
    log.debug("REQPARAMS", requestParams);
    let savedsearchID = requestParams.savedsearch_id;
    let offset = parseInt(requestParams.offset);
    let recordQuantity = 5000;
    let offSetPage = offset / 1000;
    log.debug("OFFSET", offset);
    let hasMore = false;

    try {
      const savedSearch = search.load({
        id: savedsearchID,
      });

      let cols = savedSearch.columns;
      log.debug("COLUMNS", savedSearch.columns);
      let pagedResultSet = savedSearch.runPaged({
        pageSize: 1000,
      });

      log.debug("pagedResultSet", pagedResultSet.count);
      log.debug("length", pagedResultSet.pageRanges.length);

      if (offset + recordQuantity > parseInt(pagedResultSet.count)) {
        hasMore = false;
        stopPos = pagedResultSet.pageRanges.length; //get from the start of the offset page to the end
      } else {
        hasMore = true;
        stopPos = offSetPage + 5; //get the next 5000 records over the next 5 pages
      }

      log.debug("NUMBER OF PAGES", stopPos - offSetPage);
      let formattedResults = [];
      for (let i = offSetPage; i < stopPos; i++) {
        let currentPage = pagedResultSet.fetch(i);
        log.debug("CURRENT PAGE", currentPage.data);
        currentPage.data.forEach((result) => {
          let columnCount = 0;
          let formattedObj = {};
          cols.forEach((col) => {
            formattedObj[col.name] =
              result.getText(col) === null ? result.getValue(col) : result.getText(col);
            columnCount++;
          });
          formattedResults.push(formattedObj);
        });
      }

      log.debug("payloadResult", formattedResults);
      log.debug("NUMBER OF RECORDS", formattedResults.length);
      let payload = JSON.stringify({
        status: "OK",
        message: "Query executed successfully!",
        response: formattedResults,
        has_more: hasMore,
        new_offset: !hasMore ? 0 : parseInt(stopPos) * 1000, //send a stop position of 0 if there is no more records and hasMore is false
      });
      log.debug("PAYLOAD", payload);
      return payload;
    } catch (error) {
      log.error("ERROR", error);
      return {
        status: "ERROR",
        message: error,
      };
    }
  };

  return { get };
});
