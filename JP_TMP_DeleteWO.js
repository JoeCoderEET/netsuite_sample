/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 *@NModuleScope Public
 */

define(["N/search", "N/runtime", "N/record", "N/log", "N/error", "../library/constants"], function (
  search,
  runtime,
  record,
  log,
  error,
  constants
) {
  function execute() {
    let CONSTANTS = constants[runtime.accountId];

    try {
      // *** UPDATE THE FOLLOWING VARIABLES EACH TIME THIS SCRIPT IS REQUIRED

      let srchDate = "6/1/2023";
      let recordsPerRun = 160;

      log.audit("ACTIVITY", "Delete Work orders - Script Started!");

      let scriptObj = runtime.getCurrentScript();

      let woSrch = search.create({
        type: "workorder",
        filters: [
          ["startdate", "onorafter", srchDate],
          "AND",
          ["type", "anyof", "WorkOrd"],
          "AND",
          ["mainline", "is", "T"],
          "AND",
          ["subsidiary", "anyof", CONSTANTS.SUBSIDIARIES.CA],
          "AND",
          ["location", "anyof", CONSTANTS.LOCATIONS.CANADA_NS],
        ],
        columns: [
          search.createColumn({ name: "internalid", label: "Internal ID" }),
          search.createColumn({ name: "tranid", label: "Document Number" }),
          search.createColumn({ name: "trandate", label: "Date" }),
          search.createColumn({ name: "statusref", label: "Status" }),
          search.createColumn({ name: "subsidiary", label: "Subsidiary" }),
          search.createColumn({ name: "startdate", label: "Start Date" }),
        ],
      });

      log.debug("ACTIVITY", "Search created!");

      let resultCount = woSrch.runPaged().count;
      log.debug("ACTIVITY", "Count of Work Orders: " + resultCount);

      let i = 0;

      woSrch.run().each(function (wo) {
        // Load the Work Order

        log.debug("working on WO:", wo);

        if (runtime.getCurrentScript().getRemainingUsage() < 100) {
          throw error.create({
            name: "Governance Limit Reached",
            message: "There are less than 100 remaining units remaining. Exiting.",
          });
        }

        let recWO = record.load({
          type: record.Type.WORK_ORDER,
          id: wo.getValue("internalid"),
          isDynamic: true,
        });

        recWO.setValue({ fieldId: "deletionreason", value: 1 });
        recWO.setValue({
          fieldId: "deletionreasonmemo",
          value: "Removing WO for test",
        });

        recWO.save();

        record.delete({
          type: record.Type.WORK_ORDER,
          id: wo.getValue("internalid"),
        });

        log.debug("Deleted WO", wo.getValue("tranid"));

        i++;
        if (i < recordsPerRun) {
          return true;
        } else {
          return false; // just one for now
        }
      });
    } catch (e) {
      log.error("ERROR", "ERROR (runReport): " + e.message);
      return false;
    }

    // All done
    log.debug(
      "ACTIVITY",
      "Script complete - remnaining governance: " + runtime.getCurrentScript().getRemainingUsage()
    );
    return true;
  }

  return {
    execute: execute,
  };
});
