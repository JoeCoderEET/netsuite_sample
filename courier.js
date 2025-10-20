/**
 * @NApiVersion 2.1
 */
define(["N/error", "N/log", "N/record", "N/runtime", "N/search", "../library/constants"], /**
 * @param{error} error
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */ (error, log, record, runtime, search, constants) => {
  /**
   * This function creates the initial courier tracking record.
   * @date 9/1/2023 - 5:14:58 PM
   *
   * @param {*} trackingNumber
   * @param {*} soIDs
   * @param {*} soNumbers
   * @param {*} meOrderIds
   * @param {*} threePLCarrier
   * @param {*} threePLServiceCode
   * @param {*} labelCreated
   * @param {*} threePLOrderNumber
   */
  const createCourierRecord = (
    trackingNumber,
    soIDs,
    soNumbers,
    meOrderIds,
    threePLCarrier,
    threePLServiceCode,
    labelCreated,
    threePLOrderNumber
  ) => {
    const CONSTANTS = constants[runtime.accountId];

    //pull the list constant from the carrier on the SO
    let carrier;
    switch (threePLCarrier) {
      case "FEDEXP3D":
        carrier = CONSTANTS.COURIER.FEDEX;
        break;

      default:
        log.debug("ERROR", "Carrier not found!");
        break;
    }

    let newCourierRec = record.create({
      // GUC 2
      type: "customrecord_ep_courier_info_record",
      isDynamic: false,
    });
    newCourierRec.setValue({ fieldId: "name", value: trackingNumber });
    newCourierRec.setValue({ fieldId: "custrecord_ep_courier_name", value: carrier });
    //There is the possiblity that the tracking information belongs to both a host and general order.
    //Get both the internal ids and the SO numbers
    newCourierRec.setValue({
      fieldId: "custrecord_ep_so_internal_ids",
      value: soIDs,
    });
    newCourierRec.setValue({ fieldId: "custrecord_ep_so_numbers", value: soNumbers });
    newCourierRec.setValue({ fieldId: "custrecord_ep_me_order_ids", value: meOrderIds });
    newCourierRec.setValue({
      fieldId: "custrecord_ep_courier_3pl_order_number",
      value: threePLOrderNumber,
    });
    newCourierRec.setValue({
      fieldId: "custrecord_ep_label_created",
      value: new Date(labelCreated),
    });
    newCourierRec.setValue({
      fieldId: "custrecord_ep_courier_3pl_carrier",
      value: threePLCarrier,
    });
    newCourierRec.setValue({
      fieldId: "custrecord_ep_courier_3pl_service_code",
      value: threePLServiceCode,
    });

    newCourierRec.save(); // GUC 4
  };

  /**
   * This function updates the previously created tracking record until delivery.
   * @date 9/1/2023 - 5:13:13 PM
   *
   * @param {*} trackingNumber
   * @param {*} pickUpTime
   * @param {*} deliveryTime
   * @param {*} packageData
   * @param {*} serviceDetail
   * @param {*} esitmatedTime
   * @param {*} scanHistory
   * @param {*} latestStatus
   */
  const updateCourierDelivery = (
    labelCreated,
    trackingNumber,
    pickUpTime,
    deliveryTime,
    packageData,
    serviceDetail,
    estitmatedTime,
    scanHistory,
    latestStatus,
    isDelivered
  ) => {
    const CONSTANTS = constants[runtime.accountId];

    log.debug("UPDATE COURIER", "Starting Update...............");
    let customrecord_ep_courier_info_recordSearchObj = search.create({
      type: "customrecord_ep_courier_info_record",
      filters: [["name", "haskeywords", trackingNumber]],
      columns: [
        search.createColumn({ name: "internalid" }),
        search.createColumn({ name: "custrecord_ep_label_created" }),
      ],
    });

    let courierSearch = customrecord_ep_courier_info_recordSearchObj
      .run()
      .getRange({ start: 0, end: 1 });

    let updateValues = {
      custrecord_ep_package_data: JSON.stringify(packageData),
      custrecord_ep_service_detail: JSON.stringify(serviceDetail),
      custrecord_ep_scan_history: JSON.stringify(scanHistory),
      custrecord_ep_latest_status: latestStatus,
      custrecord_ep_courier_is_delivered: isDelivered,
    };
    if (pickUpTime !== undefined) {
      updateValues.custrecord_ep_courier_pickup_time = new Date(pickUpTime);
    }

    if (deliveryTime !== undefined) {
      updateValues.custrecord_ep_actual_delivery_date = new Date(deliveryTime);
      updateValues.custrecord_ep_total_actual_time =
        (new Date(deliveryTime) - new Date(labelCreated)) / (1000 * 60 * 60);
    }

    if (labelCreated !== undefined) {
      updateValues.custrecord_ep_label_created = new Date(labelCreated);
    }

    if (estitmatedTime !== undefined) {
      updateValues.custrecord_ep_estimated_delivery = new Date(estitmatedTime);
      updateValues.custrecord_ep_total_estimated_time =
        (new Date(estitmatedTime) - new Date(labelCreated)) / (1000 * 60 * 60);
    }

    //Update the ME Order status
    record.submitFields({
      type: "customrecord_ep_courier_info_record",
      id: parseInt(courierSearch[0].getValue({ name: "internalid" })),
      values: updateValues,
    });
    log.debug("UPDATE COURIER", "Update Successfull...............");
  };

  /**
   * This information will be updated by the information pulled from the report that fianance receives.
   * @date 9/1/2023 - 5:13:31 PM
   *
   * @param {*} trackingNumber
   * @param {*} packageCost
   * @param {*} billWeight
   * @param {*} packageData
   * @param {*} originalWeight
   * @param {*} courierRegion
   */
  const updateCourierCost = (
    trackingNumber,
    packageCost,
    billWeight,
    packageData,
    originalWeight,
    courierRegion
  ) => {
    const CONSTANTS = constants[runtime.accountId];
  };

  return { createCourierRecord, updateCourierDelivery, updateCourierCost };
});
