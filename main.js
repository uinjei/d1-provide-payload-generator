const { writeFile } = require("fs/promises");
const { createBasicPayload, createMainOrder, createOrderItems, generateOfferGroupOrder, selectOnNetIndicator } = require("./buildOrderItem")
const { 
    readJSONFile, 
    BPO_IDS, 
    OUTPUT_FOLDER, 
    getLocaleValue,
    getCurrency,
    PRODUCT_OFFERING_FOLDER, 
    generateJSONFileLocation, 
    writeToJSONFile,
    OFF_NET_3RD_PARTY_PROVIDER } = require('./util')


    /* TODO:

        Issues:
        
        1. When the item is serialized, the quantity value must be equal to one
            - how to identify serialized item? --> from PST
        workaround: "ALLOW_RANDOM_QTY": false

    */

const buildPayload = async bundledProduct => {

    if (!bundledProduct.isBundle) throw new Error("Not a bundle")

    const payload = createBasicPayload()
    const mainOrder = createMainOrder(bundledProduct.id)
    const onNetIndicator = selectOnNetIndicator(OFF_NET_3RD_PARTY_PROVIDER)
    const offerGroupOrders = await generateOfferGroupOrder(bundledProduct.bundledProdOfferGroupOption)
    const orderItems = await createOrderItems([...bundledProduct.bundledProductOffering,...offerGroupOrders], onNetIndicator)

    mainOrder.orderItem = orderItems
    payload.orderItem.push(mainOrder)

    return {
        name: getLocaleValue(bundledProduct.localizedName).replace(/[^\w\s]/, ' '),
        currency: getCurrency(bundledProduct.currency),
        payload
    }
}

console.time("Generate Provide Payload")
let generatedPayloadList = BPO_IDS.map(id => {
    const __filename = generateJSONFileLocation(PRODUCT_OFFERING_FOLDER, id)
    return readJSONFile(__filename)
        .then(buildPayload)
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