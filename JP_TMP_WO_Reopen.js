/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(["N/record"], /**
 * @param{record} record
 */ (record) => {
  /**
   * Defines the Scheduled script trigger point.
   * @param {Object} scriptContext
   * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
   * @since 2015.2
   */
  const execute = (scriptContext) => {
    try {
      let WORec = record.load({
        type: "workorder",
        id: 50283933,
      });
      let isClosedValue;
      for (var i = 0; i < WORec.getLineCount("item"); i++) {
        //WORec.setLineItemValue("item", "isclosed", i, "F");
        isClosedValue = WORec.getSublistValue({
          sublistId: "item",
          fieldId: "isclosed",
          line: i,
        });

        WORec.setSublistValue({
          sublistId: "item",
          fieldId: "isclosed",
          line: i,
          value: false,
        });
      }
      WORec.save();
    } catch (error) {
      log.error("ERROR", error);
    }
  };

  return { execute };
});
