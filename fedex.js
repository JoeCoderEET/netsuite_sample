/**
 * @NApiVersion 2.1
 */
define([
  "N/log",
  "N/encode",
  "N/file",
  "N/xml",
  "N/crypto",
  "N/https",
  "N/runtime",
  "../library/constants",
], function (log, encode, file, xml, crypto, https, runtime, constants) {
  /**
   * Description placeholder
   * @date 8/21/2023 - 3:42:04 PM
   *
   * @returns {*}
   */
  const fedExAuth = () => {
    const CONSTANTS = constants[runtime.accountId];

    let bodyData = {
      grant_type: "client_credentials",
      client_id: CONSTANTS.FEDEX.CLIENTID,
      client_secret: CONSTANTS.FEDEX.SECRET,
    };

    const oauthRequest = {
      url: CONSTANTS.FEDEX.URI + CONSTANTS.FEDEX.OAUTHURI,
      body: bodyData,
    };
    log.debug("OAUTH REQUEST", oauthRequest);
    let bearerToken;

    try {
      let oauthResponse = https.post(oauthRequest);
      log.debug("OAUTH RESPONSE", oauthResponse);
      bearerToken = JSON.parse(oauthResponse.body);
      log.debug("DEBUG bearerToken", bearerToken);
    } catch (error) {
      log.error("ERROR", error);
    }

    return bearerToken.access_token;
  };

  /**
   * Description placeholder
   * @date 8/21/2023 - 3:42:22 PM
   *
   * @param {*} bearerToken
   * @param {*} trackingNumbers
   * @returns {*}
   */
  const fedExTrack = (bearerToken, trackingNumbers) => {
    const CONSTANTS = constants[runtime.accountId];
    let authorization = "Bearer " + bearerToken;
    let commInfo = {};
    let bodyData = {
      trackingInfo: trackingNumbers,
      includeDetailedScans: true,
    };

    const trackingRequest = {
      url: CONSTANTS.FEDEX.URI + CONSTANTS.FEDEX.TRACKINGURI,
      body: JSON.stringify(bodyData),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
        "x-locale": "en_CA",
      },
    };

    commInfo.request = bodyData;
    try {
      let trackingResponse = https.post(trackingRequest);
      log.debug("TRACKING RESPONSE", trackingResponse);
      trackingData = JSON.parse(trackingResponse.body);
      log.debug("DEBUG", trackingData);
      commInfo.response = trackingData;
    } catch (error) {
      log.error("ERROR", error);
    }

    return commInfo;
  };

  /**
   * This will be needed if EPG moves to REST from FWS/SOAP
   *
   * @param {*} bearerToken
   * @param {*} fileID
   * @param {*} masterTracking
   * @returns {{ request: any; response: any; }}
   */
  const fedExUpload = (bearerToken, fileID, masterTracking) => {
    const CONSTANTS = constants[runtime.accountId];
    let authorization = "Bearer " + bearerToken;
    let commInfo = {};
    let genBoundary = () => {
      let boundary = "----WebKitFormBoundry";
      let randomPart = "";
      let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmmnopqrstuvwxyz0123456789";
      let charactersLength = characters.length;

      for (let i = 0; i < 16; i++) {
        randomPart += characters.charAt(Math.floor(Math.random() * charactersLength));
      }

      boundary += randomPart;
      return boundary;
    };

    let boundary = "--abcxyz"; //genBoundary();
    let formBody = [];
    let shipdate = new Date().toUTCString();

    let pdfFile = file.load({
      id: fileID,
    });

    log.debug("filename", pdfFile.name);
    log.debug("shipdate", shipdate);

    //FedEx document JSON
    let documentJSON = {
      workflowName: "ETDPreshipment",
      name: "file.txt",
      contentType: "text/plain",
      meta: {
        shipDocumentType: "COMMERCIAL_INVOICE",
        originCountryCode: "US",
        destinationCountryCode: "IN",
      },
    };

    /*{
      workflowName: "ETDPostshipment",
      carrierCode: "FDXE",
      name: pdfFile.name,
      contentType: "application/pdf",
      meta: {
        shipDocumentType: "COMMERCIAL_INVOICE",
        formCode: "USMCA",
        trackingNumber: masterTracking,
        shipmentDate: shipdate,
        originCountryCode: "CA",
        destinationCountryCode: "US",
      },
    }; */

    log.debug("documentJSON", JSON.stringify(documentJSON));

    formBody.push("--" + boundary); //first line form start
    formBody.push('Content-Disposition: form-data; name="document"');
    formBody.push("Content-Type: application/json");
    formBody.push("");
    formBody.push(JSON.stringify(documentJSON));
    formBody.push("--" + boundary); //second line form start
    formBody.push('Content-Disposition: form-data; name="attachment"; filename="file.txt"');
    formBody.push("Content-Type: text/plain");
    formBody.push("");
    formBody.push(pdfFile.getContents());
    formBody.push("--" + boundary + "--"); //end of form

    //formatting the form data for transmit
    let formData = formBody.join("/r/n");

    log.debug("formData", formData);
    const uploadRequest = {
      url: "https://documentapitest.prod.fedex.com/sandbox/documents/v1/etds/upload",
      headers: {
        Accept: "*/*",
        "x-customer-transaction-id": "SOU1234567",
        "Content-Type": 'multipart/form-data; boundary="' + boundary + '"',
        "Content-Length": formData.length.toString(),
        Authorization: authorization,
        Connection: "keep-alive",
      },
      body: formData,
    };

    commInfo.request = formData;
    log.debug("UPLOAD REQUEST", JSON.stringify(uploadRequest));
    try {
      let uploadResponse = https.post(uploadRequest);
      log.debug("UPLOAD RESPONSE", JSON.stringify(uploadResponse));
      commInfo.response = uploadResponse;
    } catch (error) {
      log.error("ERROR", error);
    }

    return commInfo;
  };

  const fedExWebServicesUpload = (fileID, masterTracking, docType) => {
    const CONSTANTS = constants[runtime.accountId];
    let commInfo = {};
    let now = new Date();

    log.debug("NOW", now);

    //Format date for payload
    let year = now.getFullYear();
    let month = ("0" + (now.getMonth() + 1)).slice(-2);
    let day = ("0" + now.getDate()).slice(-2);
    let nowDateString = `${year}-${month}-${day}`;

    //get the fedex web services credentials
    const fedexCredentials = {
      key: CONSTANTS.FEDEX.FWS_KEY, //CONSTANTS.FEDEX.FWS_KEY, "Kgat4BOwBbSaHpfL"
      password: CONSTANTS.FEDEX.FWS_PASSWORD, //CONSTANTS.FEDEX.FWS_PASSWORD, "JaJHpl38bnPYO9fPWLN51nCaC"
      accountNumber: CONSTANTS.FEDEX.FWS_ACCOUNT, //CONSTANTS.FEDEX.FWS_ACCOUNT,  "510087500"
      meterNumber: CONSTANTS.FEDEX.FWS_METER, //CONSTANTS.FEDEX.FWS_METER, "256518901"
    };

    let pdfFile = file.load({
      id: fileID,
    });

    log.debug("filename", pdfFile.name);

    let pdfContent = pdfFile.getContents().toString("base64");

    let encodedPDF = pdfContent;

    let xmlRequestString = `
<soapenv:Envelope
	xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
	xmlns="http://fedex.com/ws/uploaddocument/v17">
	<soapenv:Header/>
	<soapenv:Body>
		<UploadDocumentsRequest>
			<WebAuthenticationDetail>
				<UserCredential>
					<Key>${fedexCredentials.key}</Key>
					<Password>${fedexCredentials.password}</Password>
				</UserCredential>
			</WebAuthenticationDetail>
			<ClientDetail>
				<AccountNumber>${fedexCredentials.accountNumber}</AccountNumber>
				<MeterNumber>${fedexCredentials.meterNumber}</MeterNumber>
			</ClientDetail>
			<Version>
				<ServiceId>cdus</ServiceId>
				<Major>17</Major>
				<Intermediate>0</Intermediate>
				<Minor>0</Minor>
			</Version>
			<ProcessingOptions>
				<Options>POST_SHIPMENT_UPLOAD</Options>
				<PostShipmentUploadDetail>
					<TrackingNumber>${masterTracking}</TrackingNumber>
				</PostShipmentUploadDetail>
			</ProcessingOptions>
			<OriginCountryCode>CA</OriginCountryCode>
			<DestinationCountryCode>US</DestinationCountryCode>
			<Usage>ELECTRONIC_TRADE_DOCUMENTS</Usage>
			<Documents>
				<DocumentType>${docType}</DocumentType>
				<FileName>${pdfFile.name}</FileName>
				<DocumentContent>${encodedPDF}</DocumentContent>
				<ExpirationDate>${nowDateString}</ExpirationDate>
			</Documents>
		</UploadDocumentsRequest>
	</soapenv:Body>
</soapenv:Envelope>`;

    log.debug("xmlRequestString", xmlRequestString);

    commInfo.request = JSON.stringify(xmlRequestString);

    const uploadRequest = {
      url: "https://ws.fedex.com:443/web-services/uploaddocument",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/xml",
        "Content-Length": xmlRequestString.length.toString(),
        Connection: "keep-alive",
      },
      body: xmlRequestString,
    };

    log.debug("UPLOAD REQUEST", JSON.stringify(uploadRequest));
    try {
      let uploadResponse = https.post(uploadRequest);
      log.debug("UPLOAD RESPONSE", JSON.stringify(uploadResponse));
      commInfo.response = uploadResponse;
    } catch (error) {
      log.error("ERROR", error);
    }

    return commInfo;
  };

  return { fedExAuth, fedExTrack, fedExUpload, fedExWebServicesUpload };
});
