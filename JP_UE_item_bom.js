/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(["N/currentRecord", "N/error", "N/log", "N/record", "N/search"], /**
 * @param{currentRecord} currentRecord
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{search} search
 */ (currentRecord, error, log, record, search) => {
  /**
   * Defines the function definition that is executed after record is submitted.
   * @param {Object} scriptContext
   * @param {Record} scriptContext.newRecord - New record
   * @param {Record} scriptContext.oldRecord - Old record
   * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
   * @since 2015.2
   */
  const afterSubmit = (scriptContext) => {
    let newRecord = scriptContext.newRecord;
    let internalid = newRecord.id;

    //Ensure this is an assembly item with a BOM
    let itemType = newRecord.getValue({ fieldId: "itemtype" });

    //Ensure that the is inactive is true
    let inactiveValue = newRecord.getValue({ fieldId: "isinactive" });

    let itemName = newRecord.getValue({ fieldId: "itemid" });
    log.debug("DEBUG", "Script Starting.... ");
    log.debug("DEBUG", "itemtype: " + itemType);
    log.debug("DEBUG", "isinactive: " + inactiveValue);
    log.debug("DEBUG", "Item Number: " + itemName);

    //Check there is a BOM record first
    let bomSearchObj = search.create({
      type: "bom",
      filters: [["legacybomforassembly", "anyof", internalid]],
      columns: [
        search.createColumn({ name: "name", label: "Name" }),
        search.createColumn({ name: "revisionname", label: "Revision : Name" }),
      ],
    });

    let bomResults = bomSearchObj.run().getRange({ start: 0, end: 1 });

    //check to be sure it is an assembly with a BOM to deactivate.
    if (itemType == "Assembly" && inactiveValue == true && bomResults.length > 0) {
      try {
        log.debug("DEBUG", "item ID: " + internalid);
        let itemRecord = record.load({
          type: record.Type.ASSEMBLY_ITEM,
          id: internalid,
        });

        //adjust the bom revision to inactive and set the end date
        let bomSublistCount = itemRecord.getLineCount({ sublistId: "billofmaterials" });

        log.debug("DEBUG", "bomSublist: " + bomSublistCount);
        for (let i = 0; i < bomSublistCount; i++) {
          let bomId = itemRecord.getSublistValue({
            sublistId: "billofmaterials",
            fieldId: "billofmaterials",
            line: i,
          });

          log.debug("DEBUG", "bomId: " + bomId);

          let bomrevisionSearchObj = search.create({
            type: "bomrevision",
            filters: [["billofmaterials.internalid", "anyof", bomId]],
            columns: [
              search.createColumn({ name: "internalid" }),
              search.createColumn({ name: "effectiveenddate" }),
            ],
          });

          let bomrevisionResults = bomrevisionSearchObj.run().getRange({ start: 0, end: 1 });

          bomrevisionResults.forEach((bomrevisionResult) => {
            let bomRevision = record.load({
              type: "bomrevision",
              id: bomrevisionResult.getValue({ name: "internalid" }),
            });

            log.debug(
              "DEBUG",
              "bomRevision: " +
                bomrevisionResult.getValue({ name: "effectiveenddate" }) +
                " Typeof " +
                typeof bomrevisionResult.getValue({ name: "effectiveenddate" })
            );

            //set the BOM revision to inactive and provide an end date
            if (
              bomrevisionResult.getValue({ name: "effectiveenddate" }) == null ||
              bomrevisionResult.getValue({ name: "effectiveenddate" }) == ""
            ) {
              log.debug("DEBUG", "bomRevision is empty");

              //set the date to yesterday to be sure it is not in today's report
              let endDate = new Date();
              let dateAdjust = endDate.getDate() - 1;
              endDate.setDate(dateAdjust);

              bomRevision.setValue({
                fieldId: "effectiveenddate",
                value: endDate,
              });
              bomRevision.setValue({
                fieldId: "isinactive",
                value: true,
              });
            }
            bomRevision.save();
          });

          //turn the master default setting to NO and inactivate the BOM itself
          let bomRecord = record.load({
            type: record.Type.BOM,
            id: bomId,
          });

          bomRecord.setSublistValue({
            sublistId: "assembly",
            fieldId: "masterdefault",
            value: false,
            line: 0,
          });

          bomRecord.setValue("isinactive", true);

          bomRecord.save();
        }
      } catch (error) {
        log.error({
          title: "Error Inactivating BOM",
          details: "Error Inactivating BOM: " + error.message,
        });
      }
    }
  };

  return { afterSubmit };
});
