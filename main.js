const { writeFile } = require("fs/promises");
const { createBasicPayload, createMainOrder, createOrderItems, generateOfferGroupOrder, selectOnNetIndicator } = require("./buildOrderItem")
const { 
    readJSONFile, 
    BPO_IDS, 
    OUTPUT_FOLDER, 
    getLocaleValue,
    getCurrency,
    getMainSpo,
    PRODUCT_OFFERING_FOLDER, 
    PRODUCT_PRICE_FOLDER,
    generateJSONFileLocation, 
    writeToJSONFile,
    OFF_NET_3RD_PARTY_PROVIDER } = require('./util')


    /* TODO:

        Issues:
        
        1. When the item is serialized, the quantity value must be equal to one
            - how to identify serialized item? --> from PST
        workaround: "ALLOW_RANDOM_QTY": false

    */


const findPrice = async args => {
    const { spoPrice } = args;
    const priceCharacteristic = await Promise.all(spoPrice.map(price => {
        const __filename = generateJSONFileLocation(PRODUCT_PRICE_FOLDER, price.id)
        return readJSONFile(__filename)
            .then(({priceType, priceCharacteristic}) => {
                if (priceType === "RC") {
                    const paymentTiming = priceCharacteristic.find(result => result.name === "Payment timing");
                    const prorationMethod = priceCharacteristic.find(result => result.name === "Proration Method");
                    return {
                        rc: {
                            timing: paymentTiming?paymentTiming.characteristicValue[0].value:"NO_PAYMENT_TIMING",
                            proration: prorationMethod?prorationMethod.characteristicValue[0].value:"NO_PRORATION_METHOD"
                        }
                    }
                }
                else return {oc: "OC"}
            })
    }))
    let paymentTiming = ""; 
    let prorationMethod = "";
    const rc = priceCharacteristic.find(result => result.rc);
    if (rc) {
       paymentTiming = rc.rc.timing;
       prorationMethod = rc.rc.proration;
    } else {
       paymentTiming = "NO";
       prorationMethod = "RC";
    }
    return {
        ...args,
        timing: paymentTiming,
        proration: prorationMethod
    }
}

const findMainSpoPrice = args => {
    const { mainSpoId } = args;
    const __filename = generateJSONFileLocation(PRODUCT_OFFERING_FOLDER, mainSpoId)
    return readJSONFile(__filename)
        .then(({productOfferingPrice}) => {
            return {
                ...args,
                spoPrice: productOfferingPrice
            }
        })
}

const buildPayload = async bundledProduct => {

    if (!bundledProduct.isBundle) throw new Error("Not a bundle")

    const payload = createBasicPayload()
    const mainOrder = createMainOrder(bundledProduct.id)
    const onNetIndicator = selectOnNetIndicator(OFF_NET_3RD_PARTY_PROVIDER)
    const offerGroupOrders = await generateOfferGroupOrder(bundledProduct.bundledProdOfferGroupOption)
    const orderItems = await createOrderItems([...bundledProduct.bundledProductOffering,...offerGroupOrders], onNetIndicator)
    
    mainOrder.orderItem = orderItems
    payload.orderItem.push(mainOrder)

    const mainSpoId = getMainSpo(bundledProduct.bundledProductOffering)
    
    return {
        name: getLocaleValue(bundledProduct.localizedName).replace(/[^\w\s]/, ' '),
        currency: getCurrency(bundledProduct.currency),
        mainSpoId: mainSpoId,
        payload
    }
}

console.time("Generate Provide Payload")
let generatedPayloadList = BPO_IDS.map(id => {
    const __filename = generateJSONFileLocation(PRODUCT_OFFERING_FOLDER, id)
    return readJSONFile(__filename)
        .then(buildPayload)
        .then(findMainSpoPrice)
        .then(findPrice)
        .then(writeToJSONFile)
        .catch(error => error)
})

Promise.all(generatedPayloadList).then((errors) => {

    const errorJSON = {}

    let errorCount = errors.filter(error => error).length

    console.log(`Successfully generated ${errors.length - errorCount} payloads`)
    if (errorCount > 0){
        console.log(`Error found in ${errorCount} file(s)`)

        errors.forEach((error, i) => {
            if (error) {
                console.log(error)
                errorJSON[BPO_IDS[i]] = error.toString()
            }
        })

        writeFile(`${OUTPUT_FOLDER}/error-${Date.now()}.json`, JSON.stringify(errorJSON))
    }
    console.timeEnd("Generate Provide Payload")
})