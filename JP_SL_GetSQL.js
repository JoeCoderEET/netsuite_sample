/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
  "N/dataset",
  "N/error",
  "N/log",
  "N/ui/serverWidget",
  "N/url",
  "N/ui/dialog",
  "N/query",
  "N/record",
  "N/runtime",
  "N/workbook",
], /**
 * @param{dataset} dataset
 * @param{error} error
 * @param{log} log
 * @param{query} query
 * @param{record} record
 * @param{runtime} runtime
 * @param{workbook} workbook
 */ function (dataset, error, log, serverWidget, url, dialog, query, record, runtime, workbook) {
  /**
   * Defines the Suitelet script trigger point.
   * @param {Object} scriptContext
   * @param {ServerRequest} scriptContext.request - Incoming request
   * @param {ServerResponse} scriptContext.response - Suitelet response
   * @since 2015.2
   */
  const onRequest = (scriptContext) => {
    try {
      if (scriptContext.request.method === "GET") {
        let form = serverWidget.createForm({
          title: "Workbook SQL",
        });

        let sqlGroup = form.addFieldGroup({
          id: "sqlgroup",
          label: "Enter the workbook ID",
        });

        form.addField({
          id: "custpage_wbid",
          type: serverWidget.FieldType.TEXT,
          label: "Workbook ID",
          container: "sqlgroup",
        });

        form.addField({
          id: "custpage_sql",
          type: serverWidget.FieldType.LONGTEXT,
          label: "Workbook SQL Statement",
          container: "sqlgroup",
        });
        form.addSubmitButton({
          label: "Get SQL",
        });

        scriptContext.response.writePage(form);
      } else {
        let wbID = scriptContext.request.parameters.custpage_wbid;
        log.debug("wbID", wbID);

        let wbQuery = query.load({
          id: wbID,
        });

        let wbQuerySuiteQL = wbQuery.toSuiteQL();
        log.debug("QUERY", wbQuerySuiteQL);

        let form = serverWidget.createForm({
          title: "Workbook SQL",
        });

        let sqlGroup = form.addFieldGroup({
          id: "sqlgroup",
          label: "Enter the workbook ID",
        });

        form.addField({
          id: "custpage_wbid",
          type: serverWidget.FieldType.TEXT,
          label: "Workbook ID",
          container: "sqlgroup",
        });

        form.updateDefaultValues({
          custpage_wbid: wbID,
        });

        form.addField({
          id: "custpage_sql",
          type: serverWidget.FieldType.LONGTEXT,
          label: "Workbook SQL Statement",
          container: "sqlgroup",
        });
        let dirtyQuery = wbQuerySuiteQL.query;
        let cleanQuery = dirtyQuery.replaceAll("/*", "").replaceAll("*/", ""); //takes out extra character add by NetSuite
        let jsonQuery = cleanQuery.replaceAll('"', "'");
        log.debug("UPDATE SQL", "Updating text...");
        form.updateDefaultValues({
          custpage_sql: cleanQuery,
        });

        form.addSubmitButton({
          label: "Get SQL",
        });

        scriptContext.response.writePage(form);
      }
    } catch (error) {
      log.debug("ERROR", error);
      let form = serverWidget.createForm({
        title: "Workbook SQL",
      });

      let sqlGroup = form.addFieldGroup({
        id: "sqlgroup",
        label: "Enter the workbook ID",
      });

      form.addField({
        id: "custpage_wbid",
        type: serverWidget.FieldType.TEXT,
        label: "Workbook ID",
        container: "sqlgroup",
      });

      form.addField({
        id: "custpage_sql",
        type: serverWidget.FieldType.LONGTEXT,
        label: "Workbook SQL Statement",
        container: "sqlgroup",
      });

      form.updateDefaultValues({
        custpage_sql: "ERROR: ***Invalid Workbook ID***",
      });

      form.addSubmitButton({
        label: "Get SQL",
      });

      scriptContext.response.writePage(form);
    }
  };

  return { onRequest };
});
