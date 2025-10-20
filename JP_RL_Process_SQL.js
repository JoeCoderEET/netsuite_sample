/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(["N/error", "N/log", "N/record", "N/query"], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{query} query
 */ (error, log, record, query) => {
  /**
   * Defines the function that is executed when a POST request is sent to a RESTlet.
   * @param {string | Object} requestBody - The HTTP request body; request body is passed as a string when request
   *     Content-Type is 'text/plain' or parsed into an Object when request Content-Type is 'application/json' (in which case
   *     the body must be a valid JSON)
   * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
   *     Object when request Content-Type is 'application/json' or 'application/xml'
   * @since 2015.2
   */
  const post = (requestBody) => {
    log.debug("REQUEST", requestBody);
    let request = requestBody;
    log.debug("REQUEST SQL", request.suite_sql);
    let suiteSQLQuery = request.suite_sql;
    log.debug("suiteSQLQuery", suiteSQLQuery);
    let queryResponse;
    try {
      let queryResults = query.runSuiteQL({
        query: suiteSQLQuery,
      });
      log.debug("RESULTS", queryResults.results);
      queryResponse = {
        status: "OK",
        message: "Query processed successfully!",
      };
      queryResponse.response = queryResults.results;
      log.debug("RESPONSE", queryResponse);
      return queryResponse;
      //queryResponse.response = queryResults.results.values;
    } catch (error) {
      log.debug("ERROR", error);
      queryResponse = {
        status: "ERROR",
        message: error,
      };
      return queryResponse;
    }
  };
  return { post };
});
